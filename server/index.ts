import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { roomManager } from './roomManager.ts';

const projectRoot = process.cwd();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  app.use(express.json());

  // Socket.IO Server configuration
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Helper to broadcast room state to all clients in that room
  const broadcastRoom = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const publicState = roomManager.getPublicRoomState(room);

    // Emit public state to the whole room
    io.to(roomCode).emit('room:update', publicState);

    // Also emit updated private state to each connected player individually
    for (const player of room.players) {
      if (player.socketId) {
        const privateState = roomManager.getPlayerPrivateState(room, player.id);
        io.to(player.socketId).emit('player:private-state', privateState);
      }
    }
  };

  // Socket.IO Connection and Event Handlers
  io.on('connection', (socket) => {
    // 1. Host creates a new room
    socket.on('create-room', ({ hostName }: { hostName: string }, callback) => {
      try {
        const { room, host } = roomManager.createRoom(hostName, socket.id);
        socket.join(room.code);

        const publicState = roomManager.getPublicRoomState(room);
        const privateState = roomManager.getPlayerPrivateState(room, host.id);

        if (typeof callback === 'function') {
          callback({
            success: true,
            room: publicState,
            player: host,
            privateState,
          });
        }

        broadcastRoom(room.code);
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err?.message || 'Failed to create room' });
        }
      }
    });

    // 2. Player joins room (or reconnects)
    socket.on(
      'join-room',
      (
        {
          roomCode,
          playerName,
          sessionToken,
        }: {
          roomCode: string;
          playerName: string;
          sessionToken: string | null;
        },
        callback
      ) => {
        try {
          const upperCode = (roomCode || '').toUpperCase().trim();
          const result = roomManager.joinOrReconnect(
            upperCode,
            playerName,
            sessionToken,
            socket.id
          );

          if (!result.success || !result.room || !result.player) {
            if (typeof callback === 'function') {
              callback({ success: false, error: result.error || 'Failed to join' });
            }
            return;
          }

          socket.join(result.room.code);

          const publicState = roomManager.getPublicRoomState(result.room);
          const privateState = roomManager.getPlayerPrivateState(
            result.room,
            result.player.id
          );

          if (typeof callback === 'function') {
            callback({
              success: true,
              room: publicState,
              player: result.player,
              privateState,
              isReconnect: result.isReconnect,
            });
          }

          broadcastRoom(result.room.code);
        } catch (err: any) {
          if (typeof callback === 'function') {
            callback({ success: false, error: err?.message || 'Failed to join room' });
          }
        }
      }
    );

    // Explicit reconnect event allowing a player whose connection dropped to rejoin by previous name
    socket.on(
      'reconnect',
      (
        {
          roomCode,
          playerName,
          sessionToken,
        }: {
          roomCode: string;
          playerName: string;
          sessionToken?: string | null;
        },
        callback
      ) => {
        try {
          const upperCode = (roomCode || '').toUpperCase().trim();
          const result = roomManager.joinOrReconnect(
            upperCode,
            playerName,
            sessionToken || null,
            socket.id
          );

          if (!result.success || !result.room || !result.player) {
            if (typeof callback === 'function') {
              callback({ success: false, error: result.error || 'Failed to reconnect' });
            }
            return;
          }

          socket.join(result.room.code);

          const publicState = roomManager.getPublicRoomState(result.room);
          const privateState = roomManager.getPlayerPrivateState(
            result.room,
            result.player.id
          );

          // Direct socket emissions to restore private and room state immediately
          socket.emit('room:update', publicState);
          socket.emit('player:private-state', privateState);

          if (typeof callback === 'function') {
            callback({
              success: true,
              room: publicState,
              player: result.player,
              privateState,
              isReconnect: true,
            });
          }

          // Broadcast updated player connectivity list to all clients in room
          broadcastRoom(result.room.code);
        } catch (err: any) {
          if (typeof callback === 'function') {
            callback({ success: false, error: err?.message || 'Failed to reconnect' });
          }
        }
      }
    );

    // 3. Add bot/test player (for solo testing in preview)
    socket.on('add-bot', ({ roomCode }: { roomCode: string }, callback) => {
      const upperCode = (roomCode || '').toUpperCase().trim();
      const res = roomManager.addBotPlayer(upperCode);
      if (typeof callback === 'function') {
        callback(res);
      }
      if (res.success) {
        broadcastRoom(upperCode);
      }
    });

    // 4. Select game in game-select phase
    socket.on(
      'select-game',
      ({ roomCode, gameId }: { roomCode: string; gameId: string }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const success = roomManager.selectGame(upperCode, gameId);
        if (success) {
          broadcastRoom(upperCode);
        }
      }
    );

    // 5. Host advances phase or starts game
    socket.on(
      'advance-phase',
      ({ roomCode, targetPhase }: { roomCode: string; targetPhase?: any }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        let nextPhase = targetPhase;
        if (!nextPhase) {
          const phases = [
            'lobby',
            'game-select',
            'reveal',
            'input',
            'reveal-answers',
            'discussion',
            'vote',
            'results',
          ] as const;
          const currentIdx = phases.indexOf(room.phase as any);
          nextPhase = currentIdx >= 0 && currentIdx < phases.length - 1
            ? phases[currentIdx + 1]
            : 'game-select';
        }

        roomManager.transitionToPhase(room, nextPhase, () => broadcastRoom(upperCode));
      }
    );

    // 6. Submit player response during 'input' phase
    socket.on(
      'submit-input',
      ({
        roomCode,
        playerId,
        answer,
      }: {
        roomCode: string;
        playerId: string;
        answer: string;
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.submitInput(room, playerId, answer, () =>
          broadcastRoom(upperCode)
        );
      }
    );

    // 7. Cast player vote during 'vote' phase
    socket.on(
      'cast-vote',
      ({
        roomCode,
        voterId,
        targetPlayerId,
      }: {
        roomCode: string;
        voterId: string;
        targetPlayerId: string;
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.castVote(room, voterId, targetPlayerId, () =>
          broadcastRoom(upperCode)
        );
      }
    );

    // 8. Reset room back to lobby
    socket.on('reset-to-lobby', ({ roomCode }: { roomCode: string }) => {
      const upperCode = (roomCode || '').toUpperCase().trim();
      const room = roomManager.getRoom(upperCode);
      if (!room) return;

      roomManager.transitionToPhase(room, 'lobby', () =>
        broadcastRoom(upperCode)
      );
    });

    // 9. Handle socket disconnect
    socket.on('disconnect', () => {
      const { room } = roomManager.handleDisconnect(socket.id);
      if (room) {
        broadcastRoom(room.code);
      }
    });
  });

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite middleware in development vs static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.resolve(projectRoot, 'vite.config.ts'),
      root: path.resolve(projectRoot, 'client'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`\n🎉 Party Games Server running at:`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);

    // Discover LAN IPv4 address for mobile players
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`  ➜  Network: http://${iface.address}:${PORT}/ (for mobile players)`);
            break;
          }
        }
      }
    } catch {
      // ignore
    }
    console.log('');
  });
}

startServer();
