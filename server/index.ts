// Loads .env before any module reads the environment (PORT/HOST, GEMINI_API_KEY, APP_URL).
// Kept first: ES module evaluation follows import order.
import 'dotenv/config';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { roomManager } from './roomManager.ts';
import { reportAiUnavailableOnce } from './content/index.ts';

const projectRoot = process.cwd();

async function startServer() {
  // Announce once at boot whether the content engine has an AI provider, so the
  // fallback behaviour is never a surprise. Silent when a real key is set.
  reportAiUnavailableOnce();

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

    // Any broadcast counts as room activity: it is what keeps an in-progress
    // game alive for the idle-room sweeper below.
    room.lastActivityAt = Date.now();

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
    socket.on(
      'create-room',
      (
        { hostName, colorIndex }: { hostName: string; colorIndex?: number },
        callback
      ) => {
        try {
          const { room, host } = roomManager.createRoom(
            hostName,
            socket.id,
            colorIndex
          );
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
      }
    );

    // 2. Player joins room (or reconnects)
    socket.on(
      'join-room',
      (
        {
          roomCode,
          playerName,
          sessionToken,
          colorIndex,
        }: {
          roomCode: string;
          playerName: string;
          sessionToken: string | null;
          colorIndex?: number;
        },
        callback
      ) => {
        try {
          const upperCode = (roomCode || '').toUpperCase().trim();
          const result = roomManager.joinOrReconnect(
            upperCode,
            playerName,
            sessionToken,
            socket.id,
            colorIndex
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

    // 4b. Host updates the selected game's public settings (difficulty, theme, mode, tone)
    socket.on(
      'set-game-settings',
      (
        {
          roomCode,
          playerId,
          settings,
        }: {
          roomCode: string;
          playerId: string;
          settings?: {
            impostor?: { mode?: string; difficulty?: string; tone?: string; theme?: string };
          };
        },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.setGameSettings(upperCode, playerId, settings || {});
        if (typeof callback === 'function') {
          callback(result);
        }
        if (result.success) {
          broadcastRoom(upperCode);
        }
      }
    );

    // 4c. Room play mode: solo <-> team (host only, before a round starts)
    socket.on(
      'set-play-mode',
      (
        { roomCode, playerId, mode }: { roomCode: string; playerId: string; mode: 'solo' | 'team' },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.setPlayMode(upperCode, playerId, mode);
        if (typeof callback === 'function') callback(result);
        if (result.success) broadcastRoom(upperCode);
      }
    );

    // 4d. Team count 2-4 (host only)
    socket.on(
      'set-team-count',
      (
        { roomCode, playerId, count }: { roomCode: string; playerId: string; count: number },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.setTeamCount(upperCode, playerId, count);
        if (typeof callback === 'function') callback(result);
        if (result.success) broadcastRoom(upperCode);
      }
    );

    // 4e. A player joins or switches teams
    socket.on(
      'join-team',
      (
        { roomCode, playerId, teamId }: { roomCode: string; playerId: string; teamId: string },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.joinTeam(upperCode, playerId, teamId);
        if (typeof callback === 'function') callback(result);
        if (result.success) broadcastRoom(upperCode);
      }
    );

    // 4f. Host renames a team
    socket.on(
      'rename-team',
      (
        {
          roomCode,
          playerId,
          teamId,
          name,
        }: { roomCode: string; playerId: string; teamId: string; name: string },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.renameTeam(upperCode, playerId, teamId, name);
        if (typeof callback === 'function') callback(result);
        if (result.success) broadcastRoom(upperCode);
      }
    );

    // 4g. Host auto-balances or shuffles the teams
    socket.on(
      'balance-teams',
      (
        { roomCode, playerId, shuffle }: { roomCode: string; playerId: string; shuffle?: boolean },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = shuffle
          ? roomManager.shuffleTeams(upperCode, playerId)
          : roomManager.balanceTeams(upperCode, playerId);
        if (typeof callback === 'function') callback(result);
        if (result.success) broadcastRoom(upperCode);
      }
    );

    // 4h. Host sets how many rounds the session runs (1-7)
    socket.on(
      'set-round-count',
      (
        { roomCode, playerId, rounds }: { roomCode: string; playerId: string; rounds: number },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.setRoundCount(upperCode, playerId, rounds);
        if (typeof callback === 'function') callback(result);
        if (result.success) broadcastRoom(upperCode);
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
          // Games with a dedicated engine follow their own phase chain.
          const phases: string[] =
            room.selectedGame?.id === 'avoid-the-word'
              ? [
                  'lobby',
                  'game-select',
                  'reveal',
                  'avoid-anchor',
                  'avoid-turn',
                  'avoid-reveal',
                  'results',
                ]
              : room.selectedGame?.id === 'mafia'
              ? ['lobby', 'game-select', 'reveal', 'night', 'day', 'discussion', 'vote', 'results']
              : room.selectedGame?.id === 'guess-the-link'
              ? ['lobby', 'game-select', 'reveal', 'input', 'reveal-answers', 'guess', 'results']
              : room.selectedGame?.id === 'top-100'
              ? ['lobby', 'game-select', 'reveal', 'input', 'reveal-answers', 'rank', 'results']
              : room.selectedGame?.id === 'reverse-categories'
              ? ['lobby', 'game-select', 'reveal', 'input', 'reveal-answers', 'vote', 'results']
              : [
                  'lobby',
                  'game-select',
                  'reveal',
                  'input',
                  'reveal-answers',
                  'discussion',
                  'vote',
                  'results',
                ];
          const currentIdx = phases.indexOf(room.phase);
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

    // 8. Avoid the Word: the player whose input is open submits their answer
    // ('player' answers pass the tapped player's id as well as the raw value).
    socket.on(
      'avoid-answer',
      ({
        roomCode,
        playerId,
        answer,
        targetPlayerId,
      }: {
        roomCode: string;
        playerId: string;
        answer: string;
        targetPlayerId?: string;
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.submitAvoidAnswer(
          room,
          playerId,
          { raw: String(answer ?? ''), ...(targetPlayerId ? { playerId: targetPlayerId } : {}) },
          () => broadcastRoom(upperCode)
        );
      }
    );

    // 9. Avoid the Word: the host overrules a close call during the reveal
    socket.on(
      'avoid-overrule',
      ({
        roomCode,
        playerId,
        targetPlayerId,
        countAsMatch,
      }: {
        roomCode: string;
        playerId: string;
        targetPlayerId: string;
        countAsMatch: boolean;
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.hostOverruleAvoidMatch(
          room,
          playerId,
          targetPlayerId,
          Boolean(countAsMatch),
          () => broadcastRoom(upperCode)
        );
      }
    );

    // 10. Avoid the Word: the host applies the eliminations and moves the round on
    socket.on(
      'avoid-continue',
      ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.hostContinueAvoidReveal(room, playerId, () => broadcastRoom(upperCode));
      }
    );

    // 11. Mafia: a night actor (Mafia/Detective) locks in a target
    socket.on(
      'mafia-night-action',
      ({
        roomCode,
        playerId,
        targetPlayerId,
      }: {
        roomCode: string;
        playerId: string;
        targetPlayerId: string;
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.submitMafiaNightTarget(room, playerId, targetPlayerId, () =>
          broadcastRoom(upperCode)
        );
      }
    );

    // 12. Mafia: host resolves the night early
    socket.on(
      'mafia-resolve-night',
      ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.hostResolveMafiaNight(room, playerId, () => broadcastRoom(upperCode));
      }
    );

    // 13. Mafia: host resolves the exile trial early
    socket.on(
      'mafia-resolve-vote',
      ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.hostResolveMafiaTrial(room, playerId, () => broadcastRoom(upperCode));
      }
    );

    // 14. Guess the Link: a player locks in a guess at the hidden concept
    socket.on(
      'gtl-guess',
      ({
        roomCode,
        playerId,
        guess,
      }: {
        roomCode: string;
        playerId: string;
        guess: string;
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.submitGtlGuess(room, playerId, guess, () => broadcastRoom(upperCode));
      }
    );

    // 14b. Guess the Link: host authors a custom concept + hint angles
    socket.on(
      'gtl-set-prompt',
      (
        {
          roomCode,
          playerId,
          concept,
          category,
          hints,
        }: {
          roomCode: string;
          playerId: string;
          concept: string;
          category?: string;
          hints?: string[];
        },
        callback
      ) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const result = roomManager.setGtlCustomPrompt(upperCode, playerId, {
          concept,
          category,
          hints,
        });

        if (typeof callback === 'function') {
          callback(result);
        }
        if (result.success) {
          broadcastRoom(upperCode);
        }
      }
    );

    // 14c. Top 100: the host pushes their live drag order
    socket.on(
      'top100-reorder',
      ({
        roomCode,
        playerId,
        order,
      }: {
        roomCode: string;
        playerId: string;
        order: string[];
      }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.submitTop100Order(room, playerId, order || [], () =>
          broadcastRoom(upperCode)
        );
      }
    );

    // 14d. Top 100: the host locks the ordering in and reveals the truth
    socket.on(
      'top100-lock-order',
      ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
        const upperCode = (roomCode || '').toUpperCase().trim();
        const room = roomManager.getRoom(upperCode);
        if (!room) return;

        roomManager.hostLockTop100Order(room, playerId, () => broadcastRoom(upperCode));
      }
    );

    // 15. Reset room back to lobby
    socket.on('reset-to-lobby', ({ roomCode }: { roomCode: string }) => {
      const upperCode = (roomCode || '').toUpperCase().trim();
      const room = roomManager.getRoom(upperCode);
      if (!room) return;

      roomManager.transitionToPhase(room, 'lobby', () =>
        broadcastRoom(upperCode)
      );
    });

    // 16. Handle socket disconnect
    socket.on('disconnect', () => {
      // Avoid the Word resolves an open answer window when the player who owes
      // an answer drops (so the round never stalls on a ghost); the room is
      // broadcast right below, and a no-op notifier avoids a double broadcast.
      const { room } = roomManager.handleDisconnect(socket.id, () => undefined);
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

  // Idle-room sweep: releases a room's content bags, round state and AI
  // counters once nobody has been connected for two hours.
  const sweepTimer = setInterval(() => {
    const removed = roomManager.sweepIdleRooms();
    if (removed.length > 0) {
      console.log(`[rooms] Swept ${removed.length} idle room(s): ${removed.join(', ')}`);
    }
  }, 10 * 60 * 1000);
  sweepTimer.unref?.();

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
