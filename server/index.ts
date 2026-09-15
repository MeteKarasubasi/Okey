import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { botTurn, collectMelds, discard, draw, extendMeld, newGame, openMelds, rearrangeTable, timeoutTurn, type Game, type Meld, type Mode, type Tile } from '../src/game/engine';

type ClientMessage = {
  type: 'create' | 'join' | 'action' | 'ping';
  roomId?: string;
  userId?: string;
  mode?: Mode;
  action?: string;
  payload?: Record<string, unknown>;
};
type Player = { ws: WebSocket; userId: string; seat: number };
type Room = { id: string; game: Game; players: Map<WebSocket, Player>; timer?: NodeJS.Timeout };

const port = Number(process.env.GAME_WS_PORT ?? 8787);
const rooms = new Map<string, Room>();

function roomId() { return randomBytes(4).toString('hex').toUpperCase(); }
function send(ws: WebSocket, message: Record<string, unknown>) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }
function playersFor(room: Room) { return [...room.players.values()].map(player => ({ seat: player.seat, userId: player.userId })); }
function broadcast(room: Room) {
  const players = playersFor(room);
  for (const player of room.players.values()) send(player.ws, { type: 'state', roomId: room.id, seat: player.seat, players, game: room.game });
}
function clearRoomTimer(room: Room) { if (room.timer) clearTimeout(room.timer); room.timer = undefined; }
function scheduleRoom(room: Room) {
  clearRoomTimer(room);
  if (room.game.ended) return;
  const turn = room.game.turn;
  const humanTurn = [...room.players.values()].some(player => player.seat === turn);
  const wait = humanTurn
    ? Math.max(250, room.game.rules.turnTimeSeconds * 1000 - (Date.now() - room.game.turnStartedAt) + 250)
    : 1200;
  room.timer = setTimeout(() => {
    if (room.game.ended || room.game.turn !== turn) return scheduleRoom(room);
    room.game = humanTurn ? timeoutTurn(room.game) : botTurn(room.game);
    broadcast(room);
    scheduleRoom(room);
  }, wait);
}
function fail(ws: WebSocket, message: string) { send(ws, { type: 'error', message }); }
function actionGame(room: Room, player: Player, message: ClientMessage): Game {
  const payload = message.payload ?? {};
  switch (message.action) {
    case 'DRAW_DECK': return draw(room.game);
    case 'DRAW_DISCARD': return draw(room.game, 'discard');
    case 'DISCARD': return typeof payload.tileId === 'string' ? discard(room.game, payload.tileId) : room.game;
    case 'OPEN': {
      const source = new Map<string, Tile>(room.game.hands[player.seat].map(tile => [tile.id, tile]));
      const rawMelds = Array.isArray(payload.melds) ? payload.melds : [];
      const planned = rawMelds.map(raw => {
        const item = raw as { ids?: unknown; kind?: unknown; owner?: unknown; score?: unknown };
        const ids = Array.isArray(item.ids) ? item.ids.filter((id): id is string => typeof id === 'string') : [];
        return { tiles: ids.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)), kind: item.kind === 'set' || item.kind === 'pair' ? item.kind : 'run', owner: player.seat, score: typeof item.score === 'number' ? item.score : 0 } as Meld;
      });
      return planned.length ? openMelds(room.game, planned) : openMelds(room.game);
    }
    case 'ADD_TO_MELD': return typeof payload.tileId === 'string' && typeof payload.meldIndex === 'number'
      ? extendMeld(room.game, payload.tileId, payload.meldIndex) : room.game;
    case 'COLLECT_MELDS': return collectMelds(room.game, player.seat);
    case 'REARRANGE_TABLE': {
      const source = new Map<string, Tile>([...room.game.hands[player.seat], ...room.game.melds.flatMap(meld => meld.tiles)].map(tile => [tile.id, tile]));
      const rawMelds = Array.isArray(payload.melds) ? payload.melds : [];
      const proposed = rawMelds.map(raw => {
        const item = raw as { ids?: unknown; kind?: unknown; owner?: unknown };
        const ids = Array.isArray(item.ids) ? item.ids.filter((id): id is string => typeof id === 'string') : [];
        return { tiles: ids.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)), kind: item.kind === 'set' || item.kind === 'pair' ? item.kind : 'run', owner: player.seat, score: 0 } as Meld;
      });
      const remainingIds = Array.isArray(payload.remainingHand) ? payload.remainingHand.filter((id): id is string => typeof id === 'string') : [];
      return rearrangeTable(room.game, proposed, remainingIds.map(id => source.get(id)).filter((tile): tile is Tile => Boolean(tile)));
    }
    default: return room.game;
  }
}

function joinRoom(ws: WebSocket, id: string, userId: string) {
  const room = rooms.get(id);
  if (!room) return fail(ws, 'Bu canlı oda bulunamadı.');
  if ([...room.players.values()].some(player => player.userId === userId)) return fail(ws, 'Bu kullanıcı zaten odada.');
  const usedSeats = new Set([...room.players.values()].map(player => player.seat));
  const seat = [0, 1, 2, 3].find(candidate => !usedSeats.has(candidate));
  if (seat === undefined) return fail(ws, 'Oda dolu.');
  const player = { ws, userId, seat };
  room.players.set(ws, player);
  send(ws, { type: 'ready', roomId: room.id, seat });
  broadcast(room);
  scheduleRoom(room);
}

const server = new WebSocketServer({ port });
server.on('connection', ws => {
  ws.on('message', raw => {
    let message: ClientMessage;
    try { message = JSON.parse(raw.toString()) as ClientMessage; } catch { return fail(ws, 'Geçersiz mesaj.'); }
    if (message.type === 'ping') return send(ws, { type: 'pong' });
    if (message.type === 'create') {
      const id = roomId();
      const room: Room = { id, game: newGame(message.mode === 'pairs' ? 'pairs' : 'classic'), players: new Map() };
      rooms.set(id, room);
      const player = { ws, userId: message.userId || `guest-${id}`, seat: 0 };
      room.players.set(ws, player);
      send(ws, { type: 'ready', roomId: id, seat: 0 });
      broadcast(room);
      scheduleRoom(room);
      return;
    }
    if (message.type === 'join') return joinRoom(ws, (message.roomId ?? '').toUpperCase(), message.userId || `guest-${Date.now()}`);
    if (message.type !== 'action') return fail(ws, 'Bilinmeyen mesaj türü.');
    const player = [...rooms.values()].flatMap(room => [...room.players.values()]).find(item => item.ws === ws);
    const room = player ? [...rooms.values()].find(item => item.players.has(ws)) : undefined;
    if (!player || !room) return fail(ws, 'Önce bir canlı odaya katılmalısın.');
    if (room.game.turn !== player.seat) return fail(ws, 'Sıra bu oyuncuda değil.');
    const next = actionGame(room, player, message);
    if (next === room.game) return fail(ws, room.game.message);
    room.game = next;
    broadcast(room);
    scheduleRoom(room);
  });
  ws.on('close', () => {
    for (const [id, room] of rooms) {
      if (!room.players.delete(ws)) continue;
      if (!room.players.size) { clearRoomTimer(room); rooms.delete(id); } else { broadcast(room); scheduleRoom(room); }
      break;
    }
  });
});
console.log(`Keyif 101 WebSocket server listening on ws://localhost:${port}`);
