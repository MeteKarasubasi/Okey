export type Color = 'red' | 'blue' | 'black' | 'yellow';
export type Tile = { id: string; color: Color; value: number; fake?: boolean };
export type Mode = 'classic' | 'pairs';
export type TileFace = Pick<Tile, 'color' | 'value'>;
export type Meld = { tiles: Tile[]; score: number; kind: 'run' | 'set' | 'pair'; owner: number; jokerRepresents?: Record<string, TileFace> };
export type FinishType = 'normal' | 'joker' | 'hand' | 'pair' | null;
export type RuleConfig = {
  mode: Mode; openingThreshold: number; minimumMeldSize: number; pairMode: boolean;
  allowDiscardPickupBeforeOpen: boolean; requireDiscardForOpening: boolean;
  allowTableRearrangement: boolean; allowPairBreak: boolean;
  allowJokerFinish: boolean; allowHandFinish: boolean; allowPairFinish: boolean;
  turnTimeSeconds: number; unopenedPenalty: number; jokerFinishMultiplier: number; roundCount: number;
};
export type Game = {
  hands: Tile[][]; stock: Tile[]; discards: Tile[][]; indicator: Tile;
  turn: number; phase: 'draw' | 'discard'; opened: boolean[]; melds: Meld[]; turnStartedAt: number; discardLockedTileId: string | null; pendingDiscardTileId: string | null;
  mode: Mode; rules: RuleConfig; winner: number | null; finishType: FinishType; ended: boolean; turnCount: number; message: string;
};
export const COLORS: Color[] = ['red', 'blue', 'black', 'yellow'];
export const NAMES = ['Sen', 'GÜLAY', 'GÜLAY', 'GÜLAY'];
export const COLOR_NAMES: Record<Color, string> = { red: 'Kırmızı', blue: 'Mavi', black: 'Siyah', yellow: 'Sarı' };
export const RULES: Record<Mode, RuleConfig> = {
  classic: { mode: 'classic', openingThreshold: 101, minimumMeldSize: 3, pairMode: false, allowDiscardPickupBeforeOpen: true, requireDiscardForOpening: true, allowTableRearrangement: true, allowPairBreak: false, allowJokerFinish: true, allowHandFinish: true, allowPairFinish: false, turnTimeSeconds: 30, unopenedPenalty: 202, jokerFinishMultiplier: 2, roundCount: 5 },
  pairs: { mode: 'pairs', openingThreshold: 5, minimumMeldSize: 2, pairMode: true, allowDiscardPickupBeforeOpen: true, requireDiscardForOpening: true, allowTableRearrangement: true, allowPairBreak: false, allowJokerFinish: true, allowHandFinish: true, allowPairFinish: true, turnTimeSeconds: 30, unopenedPenalty: 202, jokerFinishMultiplier: 2, roundCount: 5 },
};
export const rulesFor = (mode: Mode): RuleConfig => ({ ...RULES[mode] });
const activeRules = (game: Game) => game.rules?.mode === game.mode ? game.rules : rulesFor(game.mode);
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
    turn: 0, phase: 'discard', opened: [false, false, false, false], melds: [], turnStartedAt: Date.now(), discardLockedTileId: null, pendingDiscardTileId: null, mode, rules: rulesFor(mode), winner: null, finishType: null, ended: false, turnCount: 1,
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
  function add(tiles: Tile[], score: number, kind: Meld['kind'], jokerRepresents: Record<string, TileFace> = {}) {
    const key = tiles.map(t => t.id).sort().join('|');
    if (!seen.has(key)) { seen.add(key); result.push({ tiles, score, kind, owner: 0, jokerRepresents }); }
    else { const old = result.find(m => m.tiles.map(t => t.id).sort().join('|') === key)!; if (score > old.score) { old.score = score; old.tiles = tiles; old.kind = kind; old.jokerRepresents = jokerRepresents; } }
  }
  function combinations(slots: Tile[][], expected: TileFace[], score: number, kind: Meld['kind'], index = 0, used: Tile[] = [], jokerRepresents: Record<string, TileFace> = {}) {
    if (index === slots.length) { add(used, score, kind, jokerRepresents); return; }
    for (const tile of [...slots[index], ...wild]) {
      if (!used.some(t => t.id === tile.id)) {
        const nextJokers = isJoker(tile, indicator) ? { ...jokerRepresents, [tile.id]: expected[index] } : jokerRepresents;
        combinations(slots, expected, score, kind, index + 1, [...used, tile], nextJokers);
      }
    }
  }
  if (mode === 'pairs') {
    for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
      const a = face(hand[i], indicator), b = face(hand[j], indicator);
      if ((a.color === b.color && a.value === b.value) || isJoker(hand[i], indicator) || isJoker(hand[j], indicator)) {
        const jokerRepresents: Record<string, TileFace> = {};
        if (isJoker(hand[i], indicator) && !isJoker(hand[j], indicator)) jokerRepresents[hand[i].id] = { color: b.color, value: b.value };
        if (isJoker(hand[j], indicator) && !isJoker(hand[i], indicator)) jokerRepresents[hand[j].id] = { color: a.color, value: a.value };
        add([hand[i], hand[j]], 1, 'pair', jokerRepresents);
      }
    }
    return result;
  }
  for (const color of COLORS) {
    for (let start = 1; start <= 11; start++) {
      for (let end = start + 2; end <= 13; end++) {
        const values = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const slots = values.map(value => normal.filter(t => { const f = face(t, indicator); return f.color === color && f.value === value; }));
        if (slots.filter(s => !s.length).length <= wild.length) combinations(slots, values.map(value => ({ color, value })), values.reduce((a, b) => a + b, 0), 'run');
      }
    }
  }
  for (let value = 1; value <= 13; value++) {
    for (let mask = 1; mask < 16; mask++) {
      const colors = COLORS.filter((_, i) => mask & (1 << i));
      if (colors.length < 3) continue;
      const slots = colors.map(color => normal.filter(t => { const f = face(t, indicator); return f.value === value && f.color === color; }));
      if (slots.filter(s => !s.length).length <= wild.length) combinations(slots, colors.map(color => ({ color, value })), value * colors.length, 'set');
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

function canonicalMeld(meld: Meld, indicator: Tile, mode: Mode): Meld | null {
  const minimum = mode === 'pairs' ? 2 : 3;
  if (meld.tiles.length < minimum) return null;
  return candidates(meld.tiles, indicator, mode).find(candidate => candidate.tiles.length === meld.tiles.length && candidate.kind === meld.kind && new Set(candidate.tiles.map(tile => tile.id)).size === meld.tiles.length) ?? null;
}

export function validateMeld(meld: Meld, indicator: Tile, mode: Mode): boolean {
  return canonicalMeld(meld, indicator, mode) !== null;
}

export function validateTable(melds: Meld[], indicator: Tile, mode: Mode): boolean {
  const ids = new Set<string>();
  return melds.every(meld => {
    if (!validateMeld(meld, indicator, mode)) return false;
    return meld.tiles.every(tile => {
      if (ids.has(tile.id)) return false;
      ids.add(tile.id); return true;
    });
  });
}

/**
 * Commits a complete proposed table in one step. The player's remaining hand
 * and the table must conserve exactly the same physical tiles as before.
 */
export function rearrangeTable(game: Game, proposedMelds: Meld[], remainingHand: Tile[]): Game {
  if (game.ended || game.phase !== 'discard' || !game.opened[game.turn]) return fail(game, 'Masayı düzenlemek için önce elini açmalısın.');
  const rules = activeRules(game);
  if (!rules.allowTableRearrangement || !validateTable(proposedMelds, game.indicator, game.mode)) return fail(game, 'Masa düzeni geçersiz. Her per hamle sonunda geçerli kalmalı.');
  const canonicalMelds = proposedMelds.map(meld => canonicalMeld(meld, game.indicator, game.mode)!);
  const source = [...game.hands[game.turn], ...game.melds.flatMap(meld => meld.tiles)];
  const sourceIds = new Set(source.map(tile => tile.id)), used = [...proposedMelds.flatMap(meld => meld.tiles), ...remainingHand];
  if (used.length !== source.length || used.some(tile => !sourceIds.has(tile.id)) || new Set(used.map(tile => tile.id)).size !== source.length) return fail(game, 'Masa hamlesinde taş kaybı veya aynı taşı iki kez kullanma var.');
  const next = copy(game); next.melds = canonicalMelds.map(meld => ({ ...meld, owner: meld.owner ?? game.turn })); next.hands[next.turn] = [...remainingHand];
  next.message = 'Masa düzeni geçerli olarak güncellendi.'; return next;
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
  if (source === 'discard' && game.discardLockedTileId === tile.id) return fail(game, 'Bu atılan taşı bu turda tekrar alamazsın.');
  // Unopened players may take a discard only if they can open with that exact tile immediately.
  const rules = activeRules(next);
  if (source === 'discard' && !rules.allowDiscardPickupBeforeOpen) return fail(game, 'Bu masa kuralında açılmadan yandan taş alınamaz.');
  if (source === 'discard' && !next.opened[next.turn] && rules.requireDiscardForOpening) {
    next.hands[next.turn].push(pile.pop()!); next.phase = 'discard';
    next.discardLockedTileId = null;
    next.pendingDiscardTileId = tile.id;
    next.message = 'Bu taşı açılışında kullanmayı dene. Açılış olmazsa taş geri bırakılır.';
    return next;
  }
  if (source === 'stock' && next.pendingDiscardTileId) return fail(game, 'Yandan aldığın taşı önce açılışında kullanmalısın.');
  next.hands[next.turn].push(pile.pop()!); next.phase = 'discard'; next.discardLockedTileId = null; next.pendingDiscardTileId = null;
  next.message = 'Taşını çektin. Per açabilir veya bir taş atabilirsin.'; return next;
}
function rejectPendingDiscard(game: Game): Game {
  const tileId = game.pendingDiscardTileId;
  if (!tileId) return game;
  const previous = (game.turn + 3) % 4, next = copy(game);
  const index = next.hands[next.turn].findIndex(tile => tile.id === tileId);
  if (index < 0) return fail(game, 'Yandan alınan taş ıstakada bulunamadı.');
  const tile = next.hands[next.turn].splice(index, 1)[0];
  next.discards[previous].push(tile);
  next.pendingDiscardTileId = null;
  next.discardLockedTileId = tile.id;
  next.phase = 'draw';
  next.message = 'Açılış olmadı. Taş geri bırakıldı; aynı taşı bu turda tekrar alamazsın. Ortadan taş çek.';
  return next;
}
export function openMelds(game: Game, plannedMelds?: Meld[]): Game {
  if (game.ended || game.phase !== 'discard') return fail(game, 'Per açmadan önce taş çekmelisin.');
  const planned = plannedMelds ?? bestMelds(game.hands[game.turn], game.indicator, game.mode, true);
  const melds = planned.map(meld => canonicalMeld(meld, game.indicator, game.mode)).filter((meld): meld is Meld => meld !== null);
  const rules = activeRules(game), score = melds.reduce((s, m) => s + m.score, 0), threshold = rules.openingThreshold;
  const handIds = new Set(game.hands[game.turn].map(tile => tile.id));
  if (!planned.length || melds.length !== planned.length || !validateTable(melds, game.indicator, game.mode) || melds.some(meld => meld.tiles.some(tile => !handIds.has(tile.id))) || new Set(melds.flatMap(meld => meld.tiles.map(tile => tile.id))).size !== melds.flatMap(meld => meld.tiles).length) return game.pendingDiscardTileId ? rejectPendingDiscard(game) : fail(game, 'Açılışta yalnızca elindeki taşlardan oluşan geçerli perler kullanılabilir.');
  if (game.pendingDiscardTileId && !melds.some(meld => meld.tiles.some(tile => tile.id === game.pendingDiscardTileId))) return rejectPendingDiscard(game);
  if (!game.opened[game.turn] && score < threshold) return game.pendingDiscardTileId ? rejectPendingDiscard(game) : fail(game, game.mode === 'pairs' ? `Elinde ${score} çift var. Açmak için 5 çift gerekli.` : `Perlerin ${score} puan. İlk açılış için en az 101 gerekli.`);
  const next = copy(game), ids = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
  if (next.hands[next.turn].filter(t => !ids.has(t.id)).length === 0) return game.pendingDiscardTileId ? rejectPendingDiscard(game) : fail(game, 'Açılışta ıstakanda atacak en az bir taş bırakmalısın.');
  next.hands[next.turn] = next.hands[next.turn].filter(t => !ids.has(t.id));
  next.pendingDiscardTileId = null;
  next.melds.push(...melds.map(m => ({ ...m, owner: next.turn }))); next.opened[next.turn] = true;
  next.message = `${NAMES[next.turn]} ${game.mode === 'pairs' ? `${melds.length} çift` : `${melds.reduce((s, m) => s + m.score, 0)} puanlık per`} açtı.`; return next;
}
export function discard(game: Game, tileId: string): Game {
  if (game.ended || game.phase !== 'discard') return fail(game, 'Taş atmadan önce taş çekmelisin.');
  if (game.pendingDiscardTileId) return fail(game, 'Yandan aldığın taşı açılışında kullanmalısın.');
  const index = game.hands[game.turn].findIndex(t => t.id === tileId);
  if (index < 0) return fail(game, 'Atmak için ıstakandan bir taş seç.');
  const next = copy(game), tile = next.hands[next.turn].splice(index, 1)[0];
  next.discards[next.turn].push(tile);
  if (!next.hands[next.turn].length) {
    const rules = activeRules(game);
    const finishType: FinishType = !game.opened[game.turn] && rules.allowHandFinish ? 'hand' : isJoker(tile, game.indicator) && rules.allowJokerFinish ? 'joker' : game.mode === 'pairs' && rules.allowPairFinish ? 'pair' : 'normal';
    return { ...next, ended: true, winner: next.turn, finishType, message: `${NAMES[next.turn]} eli bitirdi!` };
  }
  next.turn = (next.turn + 1) % 4; next.phase = 'draw'; next.turnStartedAt = Date.now(); next.turnCount++; next.discardLockedTileId = null; next.pendingDiscardTileId = null;
  next.message = next.turn === 0 ? 'Sıra sende. Ortadan veya soldan bir taş al.' : `${NAMES[next.turn]} düşünüyor…`; return next;
}
export function collectMelds(game: Game, player = game.turn): Game {
  if (game.ended || game.turn !== player || !game.opened[player]) return fail(game, 'Geri toplayabilmek için sıra sende ve elin açık olmalı.');
  const mine = game.melds.filter(meld => meld.owner === player);
  if (!mine.length) return fail(game, 'Geri toplanacak açık bir elin yok.');
  const next = copy(game);
  next.hands[player] = [...next.hands[player], ...mine.flatMap(meld => meld.tiles)];
  next.melds = next.melds.filter(meld => meld.owner !== player);
  next.opened[player] = false;
  next.message = 'Açtığın perler ıstakana geri toplandı.';
  return next;
}
export function timeoutTurn(game: Game): Game {
  if (game.ended) return game;
  let next = game.phase === 'draw' ? draw(game) : game;
  if (next.ended) return next;
  const smallest = [...next.hands[next.turn]].sort((a, b) => {
    const aValue = isJoker(a, next.indicator) ? 1000 : face(a, next.indicator).value;
    const bValue = isJoker(b, next.indicator) ? 1000 : face(b, next.indicator).value;
    return aValue - bValue || a.id.localeCompare(b.id);
  })[0];
  return smallest ? discard(next, smallest.id) : next;
}
export function extendMeld(game: Game, tileId: string, meldIndex: number): Game {
  if (game.ended || game.phase !== 'discard' || !game.opened[game.turn]) return fail(game, 'Taş işlemek için önce taş çekip elini açmalısın.');
  if (game.hands[game.turn].length <= 1) return fail(game, 'Son taşını sağa atarak bitir.');
  const tile = game.hands[game.turn].find(t => t.id === tileId), target = game.melds[meldIndex];
  if (!tile || !target) return fail(game, 'Bu pere taş işlenemiyor.');
  const jokerIndex = target.tiles.findIndex(meldTile => isJoker(meldTile, game.indicator));
  if (jokerIndex >= 0) {
    const replacement = [...target.tiles];
    const joker = replacement[jokerIndex];
    const expected = target.jokerRepresents?.[joker.id] ?? candidates(target.tiles, game.indicator, game.mode)
      .filter(candidate => candidate.kind === target.kind && candidate.score === target.score)
      .map(candidate => candidate.jokerRepresents?.[joker.id]).find(Boolean);
    const actual = face(tile, game.indicator);
    if (!expected || actual.color !== expected.color || actual.value !== expected.value) return fail(game, 'Okeyi almak için onun temsil ettiği taşı işlemelisin.');
    replacement[jokerIndex] = tile;
    const validReplacement = candidates(replacement, game.indicator, game.mode).find(meld => meld.tiles.length === replacement.length && meld.kind === target.kind);
    if (validReplacement) {
      const next = copy(game);
      next.melds[meldIndex] = { ...validReplacement, owner: target.owner };
      next.hands[next.turn] = next.hands[next.turn].filter(handTile => handTile.id !== tileId).concat(joker);
      next.message = game.mode === 'pairs' ? 'Çiftteki okeyi gerçek taşla değiştirdin; okey ıstakana geri geldi.' : 'Taşı işledin; okey ıstakana geri geldi.';
      return next;
    }
  }
  if (target.kind === 'pair') return fail(game, 'Çifte yalnızca okeyin yerine aynı taş işlenebilir.');
  const combined = [...target.tiles, tile];
  const valid = candidates(combined, game.indicator, game.mode).find(m => m.tiles.length === combined.length && m.kind === target.kind);
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
export type RoundScore = { winner: number | null; finishType: FinishType; players: { player: number; score: number }[] };
export function calculateRoundScore(game: Game): RoundScore {
  const rules = activeRules(game), multiplier = game.finishType && game.finishType !== 'normal' ? rules.jokerFinishMultiplier : 1;
  return { winner: game.winner, finishType: game.finishType, players: game.hands.map((hand, player) => ({
    player,
    score: player === game.winner ? -101 : (!game.opened[player] ? rules.unopenedPenalty : hand.reduce((sum, tile) => sum + (isJoker(tile, game.indicator) ? 101 : face(tile, game.indicator).value), 0)) * multiplier,
  })) };
}
export function scores(game: Game): number[] { return calculateRoundScore(game).players.map(result => result.score); }
