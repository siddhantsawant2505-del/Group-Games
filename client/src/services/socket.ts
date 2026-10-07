import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In browser, connect to same origin
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });
  }
  return socket;
}

const STORAGE_KEYS = {
  ROOM_CODE: 'party_game_room_code',
  PLAYER_ID: 'party_game_player_id',
  SESSION_TOKEN: 'party_game_session_token',
  PLAYER_NAME: 'party_game_player_name',
  PLAYER_COLOR: 'party_game_player_color_idx',
};

export function saveUserProfile(name: string, colorIndex: number) {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name.trim());
    localStorage.setItem(STORAGE_KEYS.PLAYER_COLOR, colorIndex.toString());
  } catch (e) {
    console.error('Failed to save user profile to localStorage', e);
  }
}

export function loadUserProfile(): { name: string; colorIndex: number } | null {
  try {
    const name = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    const colorStr = localStorage.getItem(STORAGE_KEYS.PLAYER_COLOR);
    if (!name || !name.trim()) return null;
    const colorIndex = colorStr !== null ? parseInt(colorStr, 10) : 0;
    return {
      name: name.trim(),
      colorIndex: isNaN(colorIndex) ? 0 : colorIndex,
    };
  } catch (e) {
    return null;
  }
}

export function saveSession(
  roomCode: string,
  playerId: string,
  sessionToken: string,
  playerName: string
) {
  try {
    localStorage.setItem(STORAGE_KEYS.ROOM_CODE, roomCode);
    localStorage.setItem(STORAGE_KEYS.PLAYER_ID, playerId);
    localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName);
  } catch (e) {
    console.error('Failed to save session to localStorage', e);
  }
}

export function loadSession(): {
  roomCode: string | null;
  playerId: string | null;
  sessionToken: string | null;
  playerName: string | null;
} {
  try {
    return {
      roomCode: localStorage.getItem(STORAGE_KEYS.ROOM_CODE),
      playerId: localStorage.getItem(STORAGE_KEYS.PLAYER_ID),
      sessionToken: localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN),
      playerName: localStorage.getItem(STORAGE_KEYS.PLAYER_NAME),
    };
  } catch (e) {
    return { roomCode: null, playerId: null, sessionToken: null, playerName: null };
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    // keep playerName and color for convenience
  } catch (e) {
    // ignore
  }
}
