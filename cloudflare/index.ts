import {
  collectMelds,
  discard,
  draw,
  extendMeld,
  newGame,
  openMelds,
  rearrangeTable,
  scores,
  timeoutTurn,
  type Game,
  type Meld,
  type Mode,
  type Tile,
} from '../src/game/engine';

export type Env = {
  ROOMS: DurableObjectNamespace;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GAME_WS_AUTH_REQUIRED?: string;
  GAME_WS_DEV_ALLOW_GUESTS?: string;
  GAME_ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
};

type ClientMessage = {
  type: 'create' | 'join' | 'action' | 'ping';
  mode?: Mode;
  accessToken?: string;
  userId?: string;
  action?: string;
  payload?: Record<string, unknown>;
};
type Reservation = { seat: number; expiresAt: number };
type PlayerAttachment = { userId: string; seat: number; timestamps: number[] };
type HibernatedWebSocket = WebSocket & {
  serializeAttachment(attachment: PlayerAttachment): void;
  deserializeAttachment(): PlayerAttachment | null;
};
type RoomState = {
  roomId: string;
  game?: Game;
  started?: boolean;
  reservations: Record<string, Reservation>;
  lastActivity: number;
  sequence: number;
  dbId?: string;
  roundSaved?: boolean;
};

const MAX_PAYLOAD = 8192;
const MAX_PLAYERS = 4;
const ROOM_TTL_MS = 30 * 60 * 1000;
const RESERVATION_TTL_MS = 90 * 1000;
const ALLOWED_ACTIONS = new Set(['DRAW_DECK', 'DRAW_DISCARD', 'DISCARD', 'OPEN', 'ADD_TO_MELD', 'COLLECT_MELDS', 'REARRANGE_TABLE']);

function json(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers ?? {}) } });
}
function roomId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function safeRoomId(value: unknown): value is string { return typeof value === 'string' && /^[A-F0-9]{12}$/.test(value); }
function tileId(value: unknown): value is string { return typeof value === 'string' && /^(red|blue|black|yellow)-(?:[0-9]|1[0-9]|2[0-5])$|^fake-[01]$/.test(value); }
function allowedAction(value: unknown): value is string { return typeof value === 'string' && ALLOWED_ACTIONS.has(value); }
function requiredAuth(env: Env) { return env.ENVIRONMENT === 'production' || env.GAME_WS_AUTH_REQUIRED !== 'false'; }
function origins(env: Env) { return new Set((env.GAME_ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean)); }

function hiddenGame(game: Game, seat: number): Game {
  return { ...game, hands: game.hands.map((hand, index) => index === seat ? hand : hand.map((_, tileIndex) => ({ id: `hidden-${index}-${tileIndex}`, color: 'black', value: 0 }))) };
}
function send(socket: WebSocket, message: Record<string, unknown>) {
  try { socket.send(JSON.stringify(message)); } catch { /* closed socket */ }
}
function error(socket: WebSocket, message: string) { send(socket, { type: 'error', message }); }
function validatePayload(action: string, payload: Record<string, unknown>) {
  if ((action === 'DISCARD' || action === 'ADD_TO_MELD') && !tileId(payload.tileId)) return 'Geçersiz taş kimliği.';
  if (action === 'ADD_TO_MELD' && (!Number.isInteger(payload.meldIndex) || Number(payload.meldIndex) < 0 || Number(payload.meldIndex) > 200)) return 'Geçersiz per numarası.';
  if (action === 'OPEN' && (!Array.isArray(payload.melds) || payload.melds.length > 32)) return 'Geçersiz açılış verisi.';
  if (action === 'REARRANGE_TABLE' && (!Array.isArray(payload.melds) || !Array.isArray(payload.remainingHand) || payload.melds.length > 32 || payload.remainingHand.length > 32)) return 'Geçersiz masa düzeni.';
  return null;
}

function actionGame(game: Game, player: PlayerAttachment, message: ClientMessage): Game {
  const payload = message.payload ?? {};
  switch (message.action) {
    case 'DRAW_DECK': return draw(game);
    case 'DRAW_DISCARD': return draw(game, 'discard');
    case 'DISCARD': return discard(game, payload.tileId as string);
    case 'OPEN': {
      const source = new Map(game.hands[player.seat].map(tile => [tile.id, tile]));
      const planned = (payload.melds as unknown[]).map(raw => {
        const item = raw as { ids?: unknown; kind?: unknown; score?: unknown };
        const ids = Array.isArray(item.ids) ? item.ids.filter(tileId) : [];
        return { tiles: ids.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)), kind: item.kind === 'set' || item.kind === 'pair' ? item.kind : 'run', owner: player.seat, score: typeof item.score === 'number' ? item.score : 0 } as Meld;
      });
      return planned.length ? openMelds(game, planned) : openMelds(game);
    }
    case 'ADD_TO_MELD': return extendMeld(game, payload.tileId as string, Number(payload.meldIndex));
    case 'COLLECT_MELDS': return collectMelds(game, player.seat);
    case 'REARRANGE_TABLE': {
      const source = new Map([...game.hands[player.seat], ...game.melds.flatMap(meld => meld.tiles)].map(tile => [tile.id, tile]));
      const proposed = (payload.melds as unknown[]).map(raw => {
        const item = raw as { ids?: unknown; kind?: unknown };
        const ids = Array.isArray(item.ids) ? item.ids.filter(tileId) : [];
        return { tiles: ids.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)), kind: item.kind === 'set' || item.kind === 'pair' ? item.kind : 'run', owner: player.seat, score: 0 } as Meld;
      });
      const remaining = (payload.remainingHand as unknown[]).filter(tileId).map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile));
      return rearrangeTable(game, proposed, remaining);
    }
    default: return game;
  }
}

export class RoomDurableObject implements DurableObject {
  private statePromise: Promise<RoomState>;
  private roomId = '';

  constructor(private ctx: DurableObjectState, private env: Env) {
    this.statePromise = ctx.storage.get<RoomState>('room').then(saved => saved ?? { roomId: '', reservations: {}, lastActivity: Date.now(), sequence: 0 });
  }

  private async load() {
    const state = await this.statePromise;
    if (!this.roomId) this.roomId = state.roomId;
    return state;
  }
  private async save(state: RoomState) { state.lastActivity = Date.now(); await this.ctx.storage.put('room', state); }
  private players() {
    return this.ctx.getWebSockets().map(socket => (socket as HibernatedWebSocket).deserializeAttachment()).filter((player): player is PlayerAttachment => Boolean(player));
  }
  private isStarted(state: RoomState) { return state.started === true || Boolean(state.game && this.players().length === MAX_PLAYERS); }
  private broadcast(state: RoomState) {
    if (!state.game) return;
    const players = this.players().map(player => ({ seat: player.seat }));
    for (const socket of this.ctx.getWebSockets()) {
      const player = (socket as HibernatedWebSocket).deserializeAttachment();
      if (player) send(socket, { type: 'state', roomId: state.roomId, seat: player.seat, players, started: this.isStarted(state), game: hiddenGame(state.game, player.seat), scoreSnapshot: scores(state.game) });
    }
  }
  private async authenticate(message: ClientMessage) {
    const token = message.accessToken;
    const key = this.env.SUPABASE_SERVICE_ROLE_KEY ?? this.env.SUPABASE_ANON_KEY;
    if (!token || token.length > 4096 || !this.env.SUPABASE_URL || !key) return null;
    const response = await fetch(`${this.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown };
    return typeof user.id === 'string' ? user.id : null;
  }
  private async persistence(state: RoomState, player?: PlayerAttachment, action?: string, payload: Record<string, unknown> = {}) {
    const key = this.env.SUPABASE_SERVICE_ROLE_KEY, base = this.env.SUPABASE_URL;
    if (!key || !base || !state.dbId || !state.game) return;
    const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
    await fetch(`${base}/rest/v1/games?id=eq.${encodeURIComponent(state.dbId)}`, { method: 'PATCH', headers, body: JSON.stringify({ current_turn: state.game.turn, status: state.game.ended ? 'finished' : 'in_progress', game_state: state.game, last_sequence: state.sequence, last_activity: new Date().toISOString() }) });
    if (player && action) await fetch(`${base}/rest/v1/game_actions`, { method: 'POST', headers, body: JSON.stringify({ game_id: state.dbId, sequence: state.sequence, player_id: player.userId, action_type: action, payload }) });
    if (state.game.ended && !state.roundSaved) {
      state.roundSaved = true;
      await this.save(state);
      await fetch(`${base}/rest/v1/game_rounds`, { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ game_id: state.dbId, round_no: 1, status: 'finished', winner_seat: state.game.winner, finish_type: state.game.finishType, score_snapshot: scores(state.game), finished_at: new Date().toISOString() }) });
      const reward = state.game.mode === 'pairs' ? 750 : 500;
      for (const participant of this.players()) await fetch(`${base}/rest/v1/rpc/record_server_result`, { method: 'POST', headers, body: JSON.stringify({ target_user_id: participant.userId, did_win: state.game.winner === participant.seat, reward: state.game.winner === participant.seat ? reward : 0 }) });
    }
  }
  private async createDatabaseRoom(state: RoomState, player: PlayerAttachment) {
    const key = this.env.SUPABASE_SERVICE_ROLE_KEY, base = this.env.SUPABASE_URL;
    if (!key || !base || !state.game) return;
    const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', Prefer: 'return=representation' };
    const response = await fetch(`${base}/rest/v1/games`, { method: 'POST', headers, body: JSON.stringify({ created_by: player.userId, mode: state.game.mode, status: 'in_progress', round_count: state.game.rules.roundCount, current_turn: state.game.turn, rules: state.game.rules, room_code: state.roomId, game_state: state.game }) });
    if (!response.ok) return;
    const rows = await response.json() as Array<{ id?: string }>;
    state.dbId = rows[0]?.id;
    if (state.dbId) {
      await fetch(`${base}/rest/v1/game_players`, { method: 'POST', headers, body: JSON.stringify({ game_id: state.dbId, player_id: player.userId, seat: player.seat }) });
      await this.save(state);
    }
  }
  private async schedule(state: RoomState) {
    if (!this.isStarted(state) || !state.game || state.game.ended) return;
    const wait = Math.max(250, state.game.rules.turnTimeSeconds * 1000 - (Date.now() - state.game.turnStartedAt) + 250);
    await this.ctx.storage.setAlarm(Date.now() + wait);
  }
  async alarm() {
    const state = await this.load();
    if (!this.isStarted(state) || !state.game || state.game.ended) return;
    const turn = state.game.turn;
    const deadlinePassed = Date.now() - state.game.turnStartedAt >= state.game.rules.turnTimeSeconds * 1000;
    if (state.game.turn !== turn || !deadlinePassed) return this.schedule(state);
    state.game = timeoutTurn(state.game);
    state.sequence += 1;
    await this.save(state);
    this.broadcast(state);
    await this.persistence(state);
    await this.schedule(state);
  }
  async fetch(request: Request) {
    const url = new URL(request.url);
    this.roomId = url.searchParams.get('roomId')?.toUpperCase() ?? this.roomId;
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ ok: true, service: 'keyif-101-realtime', roomId: this.roomId });
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS + 8) return json({ error: 'Oda bağlantı sınırına ulaştı.' }, { status: 429 });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }
  async webSocketMessage(socket: HibernatedWebSocket, raw: string | ArrayBuffer) {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw.byteLength;
    if (bytes > MAX_PAYLOAD) return error(socket, 'Mesaj boyutu sınırı aşıldı.');
    const current = socket.deserializeAttachment();
    if (current) {
      const now = Date.now();
      current.timestamps = current.timestamps.filter((timestamp: number) => now - timestamp < 10000);
      if (current.timestamps.length >= 40) return error(socket, 'Çok fazla istek gönderildi. Birkaç saniye bekle.');
      current.timestamps.push(now);
      socket.serializeAttachment(current);
    }
    let message: ClientMessage;
    try { message = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMessage; } catch { return error(socket, 'Geçersiz mesaj.'); }
    if (message.type === 'ping') return send(socket, { type: 'pong' });
    const state = await this.load();
    if (!current) {
      const verified = await this.authenticate(message);
      const identity = verified ?? (!requiredAuth(this.env) && this.env.GAME_WS_DEV_ALLOW_GUESTS === 'true' && typeof message.userId === 'string' ? message.userId.slice(0, 80) : null);
      if (!identity) {
        error(socket, requiredAuth(this.env) ? 'Geçersiz veya süresi dolmuş oturum.' : 'Canlı oyun için giriş yapmalısın.');
        socket.close(1008, 'Authentication required');
        return;
      }
      if (message.type === 'create') {
        if (state.game) return error(socket, 'Bu oda zaten oluşturuldu.');
        state.roomId = this.roomId || roomId();
        state.game = newGame(message.mode === 'pairs' ? 'pairs' : 'classic');
        state.started = false;
        state.reservations = {};
        const player: PlayerAttachment = { userId: identity, seat: 0, timestamps: [] };
        socket.serializeAttachment(player);
        await this.save(state);
        await this.createDatabaseRoom(state, player);
        send(socket, { type: 'ready', roomId: state.roomId, seat: 0 });
        this.broadcast(state);
        return;
      }
      if (message.type !== 'join') return error(socket, 'Önce bir canlı odaya katılmalısın.');
      if (!state.game) return error(socket, 'Bu canlı oda bulunamadı.');
      const activePlayers = this.players();
      if (activePlayers.some(player => player.userId === identity)) return error(socket, 'Bu kullanıcı zaten odada.');
      for (const [userId, reservation] of Object.entries(state.reservations)) if (reservation.expiresAt <= Date.now()) delete state.reservations[userId];
      const reserved = state.reservations[identity];
      const used = new Set(activePlayers.map(player => player.seat));
      const seat = reserved && !used.has(reserved.seat) ? reserved.seat : [0, 1, 2, 3].find(candidate => !used.has(candidate));
      if (seat === undefined || activePlayers.length >= MAX_PLAYERS) return error(socket, 'Oda dolu.');
      delete state.reservations[identity];
      const player: PlayerAttachment = { userId: identity, seat, timestamps: [] };
      socket.serializeAttachment(player);
      if (activePlayers.length + 1 === MAX_PLAYERS) {
        state.started = true;
        state.game.turnStartedAt = Date.now();
      }
      await this.save(state);
      if (state.dbId && this.env.SUPABASE_SERVICE_ROLE_KEY && this.env.SUPABASE_URL) await fetch(`${this.env.SUPABASE_URL}/rest/v1/game_players`, { method: 'POST', headers: { apikey: this.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ game_id: state.dbId, player_id: identity, seat }) });
      send(socket, { type: 'ready', roomId: state.roomId, seat });
      this.broadcast(state);
      return this.schedule(state);
    }
    if (message.type !== 'action') return error(socket, 'Bilinmeyen mesaj türü.');
    if (!state.game) return error(socket, 'Önce bir canlı odaya katılmalısın.');
    if (!this.isStarted(state)) return error(socket, 'Masa dört gerçek oyuncunun katılmasını bekliyor.');
    const action = current;
    if (!allowedAction(message.action)) return error(socket, 'Geçersiz hamle türü.');
    const payload = message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload) ? message.payload : {};
    const payloadError = validatePayload(message.action, payload);
    if (payloadError) return error(socket, payloadError);
    if (state.game.turn !== action.seat) return error(socket, 'Sıra bu oyuncuda değil.');
    const next = actionGame(state.game, action, { ...message, payload });
    if (next === state.game) return error(socket, state.game.message);
    state.game = next;
    state.sequence += 1;
    await this.save(state);
    this.broadcast(state);
    await this.persistence(state, action, message.action, payload);
    return this.schedule(state);
  }
  async webSocketClose(socket: HibernatedWebSocket) {
    const player = socket.deserializeAttachment();
    if (!player) return;
    const state = await this.load();
    state.reservations[player.userId] = { seat: player.seat, expiresAt: Date.now() + RESERVATION_TTL_MS };
    await this.save(state);
    this.broadcast(state);
    await this.schedule(state);
    if (!this.ctx.getWebSockets().length && state.lastActivity + ROOM_TTL_MS < Date.now()) await this.ctx.storage.deleteAll();
  }
  async webSocketError(socket: HibernatedWebSocket) { await this.webSocketClose(socket); }
}

function allowedOrigin(request: Request, env: Env) {
  const list = origins(env);
  const origin = request.headers.get('Origin');
  return env.ENVIRONMENT !== 'production' ? (!list.size || (origin ? list.has(origin) : true)) : Boolean(origin && list.has(origin));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!allowedOrigin(request, env)) return json({ error: 'Origin not allowed' }, { status: 403 });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'keyif-101-realtime', durableObjects: true });
    if (url.pathname === '/new') {
      const id = roomId();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(id));
      return stub.fetch(`https://room.internal/room?roomId=${id}`, request);
    }
    const match = url.pathname.match(/^\/room\/([A-Fa-f0-9]{12})$/);
    if (!match) return json({ error: 'Not found' }, { status: 404 });
    const id = match[1].toUpperCase();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(id));
    return stub.fetch(`https://room.internal/room?roomId=${id}`, request);
  },
};
