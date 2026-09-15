import type { Game, Mode } from './engine';

type ServerState = { type: 'state'; roomId: string; seat: number; players: { seat: number }[]; game: Game; scoreSnapshot: number[] };
type ServerReady = { type: 'ready'; roomId: string; seat: number };
type ConnectOptions = {
  mode: Mode;
  userId?: string;
  accessToken?: string;
  roomId?: string;
  onReady: (ready: ServerReady) => void;
  onState: (state: ServerState) => void;
  onError?: (message: string) => void;
};

export const gameServerUrl = process.env.EXPO_PUBLIC_GAME_WS_URL ?? '';

export class GameConnection {
  constructor(private socket: WebSocket, public roomId: string, public seat: number) {}
  send(action: string, payload: Record<string, unknown> = {}) {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'action', action, payload }));
  }
  close() { this.socket.close(); }
}

export async function connectGameServer(options: ConnectOptions): Promise<GameConnection | null> {
  if (!gameServerUrl || typeof WebSocket === 'undefined') return null;
  if (process.env.NODE_ENV === 'production' && !gameServerUrl.startsWith('wss://')) {
    options.onError?.('Canlı ortamda güvenli WSS bağlantısı gerekli.');
    return null;
  }
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(gameServerUrl);
    let connection: GameConnection | null = null;
    let settled = false;
    const fail = (message: string) => {
      if (!settled) { settled = true; options.onError?.(message); reject(new Error(message)); }
    };
    socket.onopen = () => socket.send(JSON.stringify({ type: options.roomId ? 'join' : 'create', roomId: options.roomId, mode: options.mode, userId: options.userId, accessToken: options.accessToken }));
    socket.onmessage = event => {
      let message: ServerReady | ServerState | { type: 'error'; message: string };
      try { message = JSON.parse(String(event.data)); } catch { return fail('Canlı sunucudan geçersiz cevap alındı.'); }
      if (message.type === 'error') return fail(message.message);
      if (message.type === 'ready') {
        connection = new GameConnection(socket, message.roomId, message.seat);
        options.onReady(message);
        if (!settled) { settled = true; resolve(connection); }
      }
      if (message.type === 'state') options.onState(message);
    };
    socket.onerror = () => fail('Canlı oyun sunucusuna bağlanılamadı.');
    socket.onclose = () => { if (!settled) fail('Canlı oyun bağlantısı kapandı.'); };
  });
}
