import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { collectMelds, discard, draw, extendMeld, newGame, openMelds, rearrangeTable, scores, timeoutTurn, type Game, type Meld, type Mode, type Tile } from '../src/game/engine';

type ClientMessage = { type: 'create' | 'join' | 'action' | 'ping'; roomId?: string; accessToken?: string; userId?: string; mode?: Mode; action?: string; payload?: Record<string, unknown> };
type Player = { ws: WebSocket; userId: string; seat: number };
type Reservation = { seat: number; expiresAt: number };
type Room = { id: string; game: Game; started: boolean; countdownEndsAt?: number; startingUntil?: number; players: Map<WebSocket, Player>; reserved: Map<string, Reservation>; lastActivity: number; sequence: number; dbId?: string; roundSaved?: boolean; timer?: NodeJS.Timeout };
type ClientMeta = { ip: string; timestamps: number[] };

const port = Number(process.env.GAME_WS_PORT ?? 8787);
const roomTtlMs = 30 * 60 * 1000;
const reservationTtlMs = 90 * 1000;
const maxRooms = Number(process.env.GAME_MAX_ROOMS ?? 1000);
const maxConnections = Number(process.env.GAME_MAX_CONNECTIONS ?? 4000);
const production = process.env.NODE_ENV === 'production';
const rooms = new Map<string, Room>();
const roomBySocket = new Map<WebSocket, Room>();
const clientMeta = new Map<WebSocket, ClientMeta>();
const messageChains = new Map<WebSocket, Promise<void>>();
const allowedActions = new Set(['DRAW_DECK', 'DRAW_DISCARD', 'DISCARD', 'OPEN', 'ADD_TO_MELD', 'COLLECT_MELDS', 'REARRANGE_TABLE']);
const authRequired = production || process.env.GAME_WS_AUTH_REQUIRED !== 'false';
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const authClient: SupabaseClient | null = supabaseUrl && serverKey ? createClient(supabaseUrl, serverKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const adminClient: SupabaseClient | null = supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const allowedOrigins = new Set((process.env.GAME_ALLOWED_ORIGINS ?? '').split(',').map((origin: string) => origin.trim()).filter(Boolean));
const connectionAttempts = new Map<string, number[]>();
if (production && !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Production WebSocket server requires SUPABASE_SERVICE_ROLE_KEY.');

function roomId() { return globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(); }
function send(ws: WebSocket, message: Record<string, unknown>) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }
function fail(ws: WebSocket, message: string) { send(ws, { type: 'error', message }); }
function playersFor(room: Room) { return [...room.players.values()].map(player => ({ seat: player.seat })); }
function hiddenGame(game: Game, seat: number): Game {
  return { ...game, hands: game.hands.map((hand, index) => index === seat ? hand : hand.map((_, tileIndex) => ({ id: `hidden-${index}-${tileIndex}`, color: 'black', value: 0 }))) };
}
function broadcast(room: Room) {
  const players = playersFor(room);
  for (const player of room.players.values()) send(player.ws, { type: 'state', roomId: room.id, seat: player.seat, players, started: room.started, countdownEndsAt: room.countdownEndsAt ?? null, startingUntil: room.startingUntil ?? null, game: hiddenGame(room.game, player.seat), scoreSnapshot: scores(room.game) });
}
async function persistRoom(room: Room, actor?: Player, action?: string, payload: Record<string, unknown> = {}) {
  if (!adminClient || !room.dbId) return;
  room.sequence += action ? 1 : 0;
  await adminClient.from('games').update({ current_turn: room.game.turn, status: room.game.ended ? 'finished' : 'in_progress', game_state: room.game, last_sequence: room.sequence, last_activity: new Date().toISOString() }).eq('id', room.dbId);
  if (actor && action) await adminClient.from('game_actions').insert({ game_id: room.dbId, sequence: room.sequence, player_id: actor.userId, action_type: action, payload });
  if (room.game.ended && !room.roundSaved) {
    room.roundSaved = true;
    await adminClient.from('game_rounds').upsert({ game_id: room.dbId, round_no: 1, status: 'finished', winner_seat: room.game.winner, finish_type: room.game.finishType, score_snapshot: scores(room.game), finished_at: new Date().toISOString() }, { onConflict: 'game_id,round_no' });
    const reward = room.game.mode === 'pairs' ? 750 : 500;
    for (const player of room.players.values()) await adminClient.rpc('record_server_result', { target_user_id: player.userId, did_win: room.game.winner === player.seat, reward: room.game.winner === player.seat ? reward : 0 });
  }
}
async function createPersistentRoom(room: Room, host: Player) {
  if (!adminClient) return;
  const { data } = await adminClient.from('games').insert({ created_by: host.userId, mode: room.game.mode, status: 'in_progress', round_count: room.game.rules.roundCount, current_turn: room.game.turn, rules: room.game.rules, room_code: room.id, game_state: room.game }).select('id').single();
  if (!data) return;
  room.dbId = data.id as string;
  await adminClient.from('game_players').insert({ game_id: room.dbId, player_id: host.userId, seat: host.seat });
}
function clearRoomTimer(room: Room) { if (room.timer) clearTimeout(room.timer); room.timer = undefined; }
function scheduleRoom(room: Room) {
  clearRoomTimer(room);
  if (room.game.ended) return;
  if (!room.started) {
    if (!room.countdownEndsAt && !room.startingUntil) return;
    const until = room.startingUntil ?? room.countdownEndsAt!;
    room.timer = setTimeout(() => {
      if (room.players.size < 4) { room.countdownEndsAt = undefined; room.startingUntil = undefined; broadcast(room); return; }
      if (room.countdownEndsAt) {
        room.countdownEndsAt = undefined; room.startingUntil = Date.now() + 1000; broadcast(room); scheduleRoom(room); return;
      }
      room.startingUntil = undefined; room.started = true; room.game.turnStartedAt = Date.now(); broadcast(room); scheduleRoom(room);
    }, Math.max(100, until - Date.now()));
    return;
  }
  const turn = room.game.turn;
  const wait = Math.max(250, room.game.rules.turnTimeSeconds * 1000 - (Date.now() - room.game.turnStartedAt) + 250);
  room.timer = setTimeout(() => {
    if (room.game.ended || room.game.turn !== turn) return scheduleRoom(room);
    room.game = timeoutTurn(room.game);
    room.lastActivity = Date.now();
    broadcast(room);
    void persistRoom(room);
    scheduleRoom(room);
  }, wait);
}
function trimReservations(room: Room) {
  const now = Date.now();
  for (const [userId, reservation] of room.reserved) if (reservation.expiresAt <= now) room.reserved.delete(userId);
}
function isTileId(value: unknown): value is string { return typeof value === 'string' && /^(red|blue|black|yellow)-(?:[0-9]|1[0-9]|2[0-5])$|^fake-[01]$/.test(value); }
function isSafeRoomId(value: unknown): value is string { return typeof value === 'string' && /^[A-F0-9]{12}$/.test(value); }
function isAllowedAction(value: unknown): value is string { return typeof value === 'string' && allowedActions.has(value); }
function rateLimit(ws: WebSocket, bytes: number) {
  if (bytes > 8192) return 'Mesaj boyutu sınırı aşıldı.';
  const meta = clientMeta.get(ws)!;
  const now = Date.now();
  meta.timestamps = meta.timestamps.filter(timestamp => now - timestamp < 10_000);
  if (meta.timestamps.length >= 40) return 'Çok fazla istek gönderildi. Birkaç saniye bekle.';
  meta.timestamps.push(now);
  return null;
}
async function authenticate(message: ClientMessage): Promise<string | null> {
  if (!message.accessToken || message.accessToken.length > 4096 || !authClient) return null;
  const { data, error } = await authClient.auth.getUser(message.accessToken);
  return error || !data.user ? null : data.user.id;
}
function validatePayload(action: string, payload: Record<string, unknown>) {
  if ((action === 'DISCARD' || action === 'ADD_TO_MELD') && !isTileId(payload.tileId)) return 'Geçersiz taş kimliği.';
  if (action === 'ADD_TO_MELD' && (!Number.isInteger(payload.meldIndex) || Number(payload.meldIndex) < 0 || Number(payload.meldIndex) > 200)) return 'Geçersiz per numarası.';
  if (action === 'OPEN' && (!Array.isArray(payload.melds) || payload.melds.length > 32)) return 'Geçersiz açılış verisi.';
  if (action === 'REARRANGE_TABLE' && (!Array.isArray(payload.melds) || !Array.isArray(payload.remainingHand) || payload.melds.length > 32 || payload.remainingHand.length > 32)) return 'Geçersiz masa düzeni.';
  return null;
}
function actionGame(room: Room, player: Player, message: ClientMessage): Game {
  const payload = message.payload ?? {};
  switch (message.action) {
    case 'DRAW_DECK': return draw(room.game);
    case 'DRAW_DISCARD': return draw(room.game, 'discard');
    case 'DISCARD': return discard(room.game, payload.tileId as string);
    case 'OPEN': {
      const source = new Map<string, Tile>(room.game.hands[player.seat].map(tile => [tile.id, tile]));
      const planned = (payload.melds as unknown[]).map(raw => {
        const item = raw as { ids?: unknown; kind?: unknown; score?: unknown };
        const ids = Array.isArray(item.ids) ? item.ids.filter(isTileId) : [];
        return { tiles: ids.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)), kind: item.kind === 'set' || item.kind === 'pair' ? item.kind : 'run', owner: player.seat, score: typeof item.score === 'number' ? item.score : 0 } as Meld;
      });
      return planned.length ? openMelds(room.game, planned) : openMelds(room.game);
    }
    case 'ADD_TO_MELD': return extendMeld(room.game, payload.tileId as string, Number(payload.meldIndex));
    case 'COLLECT_MELDS': return collectMelds(room.game, player.seat);
    case 'REARRANGE_TABLE': {
      const source = new Map<string, Tile>([...room.game.hands[player.seat], ...room.game.melds.flatMap(meld => meld.tiles)].map(tile => [tile.id, tile]));
      const proposed = (payload.melds as unknown[]).map(raw => {
        const item = raw as { ids?: unknown; kind?: unknown };
        const ids = Array.isArray(item.ids) ? item.ids.filter(isTileId) : [];
        return { tiles: ids.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)), kind: item.kind === 'set' || item.kind === 'pair' ? item.kind : 'run', owner: player.seat, score: 0 } as Meld;
      });
      const remaining = (payload.remainingHand as unknown[]).filter(isTileId).map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile));
      return rearrangeTable(room.game, proposed, remaining);
    }
    default: return room.game;
  }
}
function joinRoom(ws: WebSocket, id: string, userId: string) {
  const room = rooms.get(id);
  if (!room) return fail(ws, 'Bu canlı oda bulunamadı.');
  trimReservations(room);
  if ([...room.players.values()].some(player => player.userId === userId)) return fail(ws, 'Bu kullanıcı zaten odada.');
  const reserved = room.reserved.get(userId);
  const usedSeats = new Set([...room.players.values()].map(player => player.seat));
  const seat = reserved && !usedSeats.has(reserved.seat) ? reserved.seat : [0, 1, 2, 3].find(candidate => !usedSeats.has(candidate));
  if (seat === undefined) return fail(ws, 'Oda dolu.');
  room.reserved.delete(userId);
  const player = { ws, userId, seat };
  room.players.set(ws, player); roomBySocket.set(ws, room); room.lastActivity = Date.now();
  if (!room.started && room.players.size === 4 && !room.countdownEndsAt && !room.startingUntil) room.countdownEndsAt = Date.now() + 10_000;
  if (adminClient && room.dbId) void adminClient.from('game_players').insert({ game_id: room.dbId, player_id: userId, seat });
  send(ws, { type: 'ready', roomId: room.id, seat }); broadcast(room); scheduleRoom(room);
}
async function handleMessage(ws: WebSocket, raw: RawData) {
  const limited = rateLimit(ws, Buffer.byteLength(raw.toString()));
  if (limited) return fail(ws, limited);
  let message: ClientMessage;
  try { message = JSON.parse(raw.toString()) as ClientMessage; } catch { return fail(ws, 'Geçersiz mesaj.'); }
  if (message.type === 'ping') return send(ws, { type: 'pong' });
  const userId = await authenticate(message);
  if (!userId && authRequired) return fail(ws, 'Geçersiz veya süresi dolmuş oturum.');
  const identity = userId ?? (process.env.GAME_WS_DEV_ALLOW_GUESTS === 'true' ? message.userId : undefined);
  if (!identity) return fail(ws, 'Canlı oyun için giriş yapmalısın.');
  if (message.type === 'create') {
    if (rooms.size >= maxRooms) return fail(ws, 'Sunucu şu anda yeni oda kabul etmiyor.');
    const id = roomId();
  const room: Room = { id, game: newGame(message.mode === 'pairs' ? 'pairs' : 'classic'), started: false, players: new Map(), reserved: new Map(), lastActivity: Date.now(), sequence: 0 };
    rooms.set(id, room);
    const player = { ws, userId: identity, seat: 0 };
    room.players.set(ws, player); roomBySocket.set(ws, room);
    void createPersistentRoom(room, player);
    send(ws, { type: 'ready', roomId: id, seat: 0 }); broadcast(room); return;
  }
  if (message.type === 'join') return isSafeRoomId(message.roomId) ? joinRoom(ws, message.roomId, identity) : fail(ws, 'Geçersiz oda kodu.');
  if (message.type !== 'action') return fail(ws, 'Bilinmeyen mesaj türü.');
  const room = roomBySocket.get(ws);
  if (!room) return fail(ws, 'Önce bir canlı odaya katılmalısın.');
  const player = room.players.get(ws)!;
  if (!isAllowedAction(message.action)) return fail(ws, 'Geçersiz hamle türü.');
  const payload = message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload) ? message.payload : {};
  const payloadError = validatePayload(message.action, payload);
  if (payloadError) return fail(ws, payloadError);
  if (!room.started) return fail(ws, 'Masa dört gerçek oyuncunun katılmasını bekliyor.');
  if (room.game.turn !== player.seat) return fail(ws, 'Sıra bu oyuncuda değil.');
  const next = actionGame(room, player, { ...message, payload });
  if (next === room.game) return fail(ws, room.game.message);
  room.game = next; room.lastActivity = Date.now(); broadcast(room); scheduleRoom(room); void persistRoom(room, player, message.action, payload);
}

const server = new WebSocketServer({
  port,
  maxPayload: 8192,
  verifyClient: (info, done) => {
    const origin = info.origin;
    if (production && (!origin || !allowedOrigins.has(origin))) return done(false, 403, 'Origin not allowed');
    if (server.clients.size >= maxConnections) return done(false, 503, 'Server is full');
    const ip = info.req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const attempts = (connectionAttempts.get(ip) ?? []).filter(timestamp => now - timestamp < 60_000);
    if (attempts.length >= 60) return done(false, 429, 'Too many connections');
    attempts.push(now); connectionAttempts.set(ip, attempts);
    done(true);
  },
});
server.on('connection', (ws, request) => {
  clientMeta.set(ws, { ip: request.socket.remoteAddress ?? 'unknown', timestamps: [] });
  ws.on('message', raw => {
    const previous = messageChains.get(ws) ?? Promise.resolve();
    const current = previous.then(() => handleMessage(ws, raw)).catch(() => fail(ws, 'İstek işlenemedi.'));
    messageChains.set(ws, current);
  });
  ws.on('close', () => {
    messageChains.delete(ws); clientMeta.delete(ws);
    const room = roomBySocket.get(ws); roomBySocket.delete(ws);
    if (!room) return;
    const player = room.players.get(ws);
    room.players.delete(ws); room.lastActivity = Date.now();
    if (player) room.reserved.set(player.userId, { seat: player.seat, expiresAt: Date.now() + reservationTtlMs });
    if (!room.started && room.players.size < 4) { room.countdownEndsAt = undefined; room.startingUntil = undefined; }
    broadcast(room); scheduleRoom(room);
  });
});
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    trimReservations(room);
    if (!room.players.size && now - room.lastActivity > roomTtlMs) { clearRoomTimer(room); rooms.delete(id); }
  }
}, 60_000).unref();
console.log(`Keyif 101 WebSocket server listening on ws://localhost:${port}`);
