import { getSocket } from './socket';

export type WarmupStatus = 'idle' | 'waking' | 'ready' | 'error';

type WarmupListener = (status: WarmupStatus, elapsedSeconds: number) => void;

class ServerWarmupManager {
  private status: WarmupStatus = 'idle';
  private elapsedSeconds = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<WarmupListener>();
  private started = false;

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status, this.elapsedSeconds);
      } catch (err) {
        console.error('[serverWarmup] listener error:', err);
      }
    });
  }

  public subscribe(listener: WarmupListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.elapsedSeconds);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): { status: WarmupStatus; elapsedSeconds: number } {
    return { status: this.status, elapsedSeconds: this.elapsedSeconds };
  }

  public startWarmup(): void {
    if (this.started) return;
    this.started = true;

    const rawUrl = (import.meta.env.VITE_SERVER_URL || '').trim();
    // Default to the known Render URL in production if not explicitly set, or same origin in dev
    const serverUrl =
      rawUrl ||
      (typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
        ? 'https://group-games.onrender.com'
        : '');

    const healthEndpoint = serverUrl ? `${serverUrl}/api/health` : '/api/health';

    const startTime = Date.now();
    this.status = 'waking';
    this.notify();

    this.timer = setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      this.notify();
    }, 1000);

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(healthEndpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          if (this.timer) clearInterval(this.timer);
          this.status = 'ready';
          this.notify();

          // Connect socket immediately once server is confirmed alive
          const socket = getSocket();
          if (!socket.connected) {
            socket.connect();
          }
          return;
        }
      } catch {
        // Server still spinning up
      }

      // Keep polling every 2.5s while spinning up, max 90s
      if (Date.now() - startTime < 90000) {
        setTimeout(checkHealth, 2500);
      } else {
        if (this.timer) clearInterval(this.timer);
        this.status = 'error';
        this.notify();
      }
    };

    checkHealth();
  }
}

export const serverWarmup = new ServerWarmupManager();

// Automatically start wake-up when running in browser
if (typeof window !== 'undefined') {
  serverWarmup.startWarmup();
}
