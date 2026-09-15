export type Color = 'red' | 'blue' | 'black' | 'yellow';
export type Tile = { id: string; color: Color; value: number; fake?: boolean };
export type Mode = 'classic' | 'pairs';
export type Meld = { tiles: Tile[]; score: number; kind: 'run' | 'set' | 'pair'; owner: number };
export type Game = {
  hands: Tile[][]; stock: Tile[]; discards: Tile[][]; indicator: Tile;
  turn: number; phase: 'draw' | 'discard'; opened: boolean[]; melds: Meld[];
  mode: Mode; winner: number | null; ended: boolean; turnCount: number; message: string;
};
export const COLORS: Color[] = ['red', 'blue', 'black', 'yellow'];
export const NAMES = ['Sen', 'Defne', 'Emre', 'Selin'];
export const COLOR_NAMES: Record<Color, string> = { red: 'Kırmızı', blue: 'Mavi', black: 'Siyah', yellow: 'Sarı' };
export const jokerValue = (indicator: Tile) => indicator.value % 13 + 1;
export const isJoker = (tile: Tile, indicator: Tile) => !tile.fake && tile.color === indicator.color && tile.value === jokerValue(indicator);
export const face = (tile: Tile, indicator: Tile): Tile => tile.fake ? { ...tile, color: indicator.color, value: jokerValue(indicator) } : tile;
export function makeDeck(): Tile[] {
  return [...COLORS.flatMap(color => Array.from({ length: 26 }, (_, i) => ({ id: `${color}-${i}`, color, value: i % 13 + 1 }))),
    { id: 'fake-0', color: 'black' as Color, value: 0, fake: true }, { id: 'fake-1', color: 'black' as Color, value: 0, fake: true }];
}
export function newGame(mode: Mode = 'classic', random: () => number = Math.random): Game {
  const deck = makeDeck();
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const indicatorIndex = deck.findIndex(t => !t.fake);
  const indicator = deck.splice(indicatorIndex, 1)[0];
  const hands = [deck.splice(0, 22), deck.splice(0, 21), deck.splice(0, 21), deck.splice(0, 21)];
  return { hands: hands.map(h => sortTiles(h, indicator)), stock: deck, discards: [[], [], [], []], indicator,
    turn: 0, phase: 'discard', opened: [false, false, false, false], melds: [], mode, winner: null, ended: false, turnCount: 1,
    message: 'İlk el senin. Bir taş seç ve sağa at.' };
}
export function sortTiles(tiles: Tile[], indicator: Tile, by: 'color' | 'number' = 'color') {
  return [...tiles].sort((a, b) => {
    const x = face(a, indicator), y = face(b, indicator);
    if (isJoker(a, indicator) !== isJoker(b, indicator)) return isJoker(a, indicator) ? 1 : -1;
    return by === 'color' ? COLORS.indexOf(x.color) - COLORS.indexOf(y.color) || x.value - y.value : x.value - y.value || COLORS.indexOf(x.color) - COLORS.indexOf(y.color);
  });
}

// Every candidate records physical tile IDs: duplicate copies can never be reused.
export function candidates(hand: Tile[], indicator: Tile, mode: Mode): Meld[] {
  const wild = hand.filter(t => isJoker(t, indicator));
  const normal = hand.filter(t => !isJoker(t, indicator));
  const result: Meld[] = [];
  const seen = new Set<string>();
  function add(tiles: Tile[], score: number, kind: Meld['kind']) {
    const key = tiles.map(t => t.id).sort().join('|');
    if (!seen.has(key)) { seen.add(key); result.push({ tiles, score, kind, owner: 0 }); }
    else { const old = result.find(m => m.tiles.map(t => t.id).sort().join('|') === key)!; if (score > old.score) { old.score = score; old.tiles = tiles; old.kind = kind; } }
  }
  function combinations(slots: Tile[][], score: number, kind: Meld['kind'], index = 0, used: Tile[] = []) {
    if (index === slots.length) { add(used, score, kind); return; }
    for (const tile of [...slots[index], ...wild]) {
      if (!used.some(t => t.id === tile.id)) combinations(slots, score, kind, index + 1, [...used, tile]);
    }
  }
  if (mode === 'pairs') {
    for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
      const a = face(hand[i], indicator), b = face(hand[j], indicator);
      if ((a.color === b.color && a.value === b.value) || isJoker(hand[i], indicator) || isJoker(hand[j], indicator)) add([hand[i], hand[j]], 1, 'pair');
    }
    return result;
  }
  for (const color of COLORS) {
    for (let start = 1; start <= 11; start++) {
      for (let end = start + 2; end <= 13; end++) {
        const values = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const slots = values.map(value => normal.filter(t => { const f = face(t, indicator); return f.color === color && f.value === value; }));
        if (slots.filter(s => !s.length).length <= wild.length) combinations(slots, values.reduce((a, b) => a + b, 0), 'run');
      }
    }
  }
  for (let value = 1; value <= 13; value++) {
    for (let mask = 1; mask < 16; mask++) {
      const colors = COLORS.filter((_, i) => mask & (1 << i));
      if (colors.length < 3) continue;
      const slots = colors.map(color => normal.filter(t => { const f = face(t, indicator); return f.value === value && f.color === color; }));
      if (slots.filter(s => !s.length).length <= wild.length) combinations(slots, value * colors.length, 'set');
    }
  }
  return result;
}
export function bestMelds(hand: Tile[], indicator: Tile, mode: Mode = 'classic', reserveDiscard = false): Meld[] {
  if (!hand.length) return [];
  const options = candidates(hand, indicator, mode).map(meld => ({ meld, mask: meld.tiles.reduce((m, t) => m | (1 << hand.findIndex(x => x.id === t.id)), 0) }));
  const byBit = hand.map((_, i) => options.filter(o => o.mask & (1 << i)));
  const memo = new Map<number, { score: number; melds: Meld[] }>();
  function solve(mask: number): { score: number; melds: Meld[] } {
    if (!mask) return { score: 0, melds: [] };
    const cached = memo.get(mask); if (cached) return cached;
    const i = 31 - Math.clz32(mask & -mask);
    let best = solve(mask & ~(1 << i));
    for (const option of byBit[i]) {
      if ((mask & option.mask) !== option.mask) continue;
      const next = solve(mask ^ option.mask), score = next.score + option.meld.score;
      if (score > best.score) best = { score, melds: [option.meld, ...next.melds] };
    }
    memo.set(mask, best); return best;
  }
  const fullMask = (1 << hand.length) - 1;
  let best = solve(fullMask);
  if (reserveDiscard && best.melds.reduce((n, m) => n + m.tiles.length, 0) === hand.length) {
    best = { score: 0, melds: [] };
    for (let i = 0; i < hand.length; i++) {
      const option = solve(fullMask & ~(1 << i));
      if (option.score > best.score) best = option;
    }
  }
  return best.melds;
}
/**
 * Finds only the melds that the player has physically grouped side by side
 * on the two-row rack. Empty slots split one group from the next group.
 */
export function rackMelds(hand: Tile[], indicator: Tile, slots: (string | null)[], mode: Mode = 'classic', columns = 16): Meld[] {
  const byId = new Map(hand.map(tile => [tile.id, tile]));
  const groups: Tile[][] = [];
  const rows = Math.ceil(slots.length / columns);
  for (let row = 0; row < rows; row++) {
    let current: Tile[] = [];
    for (let column = 0; column < columns; column++) {
      const tile = byId.get(slots[row * columns + column] ?? '');
      if (tile) current.push(tile);
      else if (current.length) { groups.push(current); current = []; }
    }
    if (current.length) groups.push(current);
  }
  return groups.flatMap(group => candidates(group, indicator, mode).find(meld => meld.tiles.length === group.length) ?? []);
}
export function openingValue(game: Game, player = game.turn) {
  return bestMelds(game.hands[player], game.indicator, game.mode, true).reduce((sum, m) => sum + m.score, 0);
}
function copy(game: Game): Game { return { ...game, hands: game.hands.map(h => [...h]), stock: [...game.stock], discards: game.discards.map(d => [...d]), opened: [...game.opened], melds: game.melds.map(m => ({ ...m, tiles: [...m.tiles] })) }; }
const fail = (game: Game, message: string): Game => ({ ...game, message });
export function draw(game: Game, source: 'stock' | 'discard' = 'stock'): Game {
  if (game.ended || game.phase !== 'draw') return fail(game, 'Önce elinden bir taş atmalısın.');
  const next = copy(game), previous = (game.turn + 3) % 4;
  const pile = source === 'stock' ? next.stock : next.discards[previous];
  if (!pile.length) return source === 'stock' ? { ...next, ended: true, message: 'Ortadaki taşlar bitti. El berabere.' } : fail(game, 'Solda alınabilecek bir taş yok.');
  const tile = pile[pile.length - 1];
  // Unopened players may take a discard only if they can open with that exact tile immediately.
  if (source === 'discard' && !next.opened[next.turn]) {
    const melds = bestMelds([...next.hands[next.turn], tile], next.indicator, next.mode, true);
    if (melds.reduce((s, m) => s + m.score, 0) < (next.mode === 'pairs' ? 5 : 101) || !melds.some(m => m.tiles.some(t => t.id === tile.id))) return fail(game, 'Soldaki taşı almak için o taşla el açabilmelisin. Ortadan taş çek.');
    next.hands[next.turn].push(pile.pop()!); next.phase = 'discard';
    return openMelds(next);
  }
  next.hands[next.turn].push(pile.pop()!); next.phase = 'discard';
  next.message = 'Taşını çektin. Per açabilir veya bir taş atabilirsin.'; return next;
}
export function openMelds(game: Game, plannedMelds?: Meld[]): Game {
  if (game.ended || game.phase !== 'discard') return fail(game, 'Per açmadan önce taş çekmelisin.');
  const melds = plannedMelds ?? bestMelds(game.hands[game.turn], game.indicator, game.mode, true);
  const score = melds.reduce((s, m) => s + m.score, 0), threshold = game.mode === 'pairs' ? 5 : 101;
  if (!melds.length || (!game.opened[game.turn] && score < threshold)) return fail(game, game.mode === 'pairs' ? `Elinde ${score} çift var. Açmak için 5 çift gerekli.` : `Perlerin ${score} puan. İlk açılış için en az 101 gerekli.`);
  const next = copy(game), ids = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
  next.hands[next.turn] = next.hands[next.turn].filter(t => !ids.has(t.id));
  next.melds.push(...melds.map(m => ({ ...m, owner: next.turn }))); next.opened[next.turn] = true;
  next.message = `${NAMES[next.turn]} ${game.mode === 'pairs' ? `${melds.length} çift` : `${melds.reduce((s, m) => s + m.score, 0)} puanlık per`} açtı.`; return next;
}
export function discard(game: Game, tileId: string): Game {
  if (game.ended || game.phase !== 'discard') return fail(game, 'Taş atmadan önce taş çekmelisin.');
  const index = game.hands[game.turn].findIndex(t => t.id === tileId);
  if (index < 0) return fail(game, 'Atmak için ıstakandan bir taş seç.');
  const next = copy(game), tile = next.hands[next.turn].splice(index, 1)[0];
  next.discards[next.turn].push(tile);
  if (!next.hands[next.turn].length) return { ...next, ended: true, winner: next.turn, message: `${NAMES[next.turn]} eli bitirdi!` };
  next.turn = (next.turn + 1) % 4; next.phase = 'draw'; next.turnCount++;
  next.message = next.turn === 0 ? 'Sıra sende. Ortadan veya soldan bir taş al.' : `${NAMES[next.turn]} düşünüyor…`; return next;
}
export function extendMeld(game: Game, tileId: string, meldIndex: number): Game {
  if (game.ended || game.phase !== 'discard' || !game.opened[game.turn]) return fail(game, 'Taş işlemek için önce taş çekip elini açmalısın.');
  if (game.hands[game.turn].length <= 1) return fail(game, 'Son taşını sağa atarak bitir.');
  const tile = game.hands[game.turn].find(t => t.id === tileId), target = game.melds[meldIndex];
  if (!tile || !target || target.kind === 'pair') return fail(game, 'Bu pere taş işlenemiyor.');
  const combined = [...target.tiles, tile];
  const valid = candidates(combined, game.indicator, 'classic').find(m => m.tiles.length === combined.length && m.kind === target.kind);
  if (!valid) return fail(game, 'Seçtiğin taş bu pere uymuyor.');
  const next = copy(game); next.melds[meldIndex] = { ...valid, owner: target.owner };
  next.hands[next.turn] = next.hands[next.turn].filter(t => t.id !== tileId); next.message = 'Taş masadaki pere işlendi.'; return next;
}
export function botTurn(game: Game): Game {
  if (game.turn === 0 || game.ended) return game;
  let next = draw(game);
  if (next.ended) return next;
  const opened = openMelds(next);
  if (opened.hands[next.turn].length < next.hands[next.turn].length) next = opened;
  if (next.opened[next.turn]) {
    for (const tile of [...next.hands[next.turn]]) {
      for (let i = 0; i < next.melds.length; i++) {
        const extended = extendMeld(next, tile.id, i);
        if (extended.hands[next.turn].length < next.hands[next.turn].length) { next = extended; break; }
      }
    }
  }
  const hand = next.hands[next.turn];
  const usefulness = (tile: Tile) => {
    if (isJoker(tile, next.indicator)) return 1000;
    const f = face(tile, next.indicator);
    return hand.reduce((sum, other) => {
      if (other.id === tile.id) return sum;
      const g = face(other, next.indicator);
      if (game.mode === 'pairs') return sum + (f.value === g.value && f.color === g.color ? 20 : 0);
      return sum + (f.value === g.value && f.color !== g.color ? 6 : f.color === g.color && Math.abs(f.value - g.value) === 1 ? 8 : f.color === g.color && Math.abs(f.value - g.value) === 2 ? 3 : 0);
    }, 0) - f.value / 100;
  };
  const worst = [...hand].sort((a, b) => usefulness(a) - usefulness(b))[0];
  return worst ? discard(next, worst.id) : next;
}
export function scores(game: Game): number[] {
  return game.hands.map((hand, i) => i === game.winner ? -101 : !game.opened[i] ? 202 : hand.reduce((s, t) => s + (isJoker(t, game.indicator) ? 101 : face(t, game.indicator).value), 0));
}
