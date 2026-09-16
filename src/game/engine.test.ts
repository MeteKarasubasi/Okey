import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeck, newGame, candidates, bestMelds, rackMelds, discard, draw, openMelds, extendMeld, collectMelds, timeoutTurn, scores, validateMeld, validateTable, rearrangeTable, isJoker, face, jokerValue, NAMES, type Tile, type Game, type Color } from './engine';
let serial = 0;
const t = (value: number, color: Color = 'red', fake = false): Tile => ({ id: `t-${serial++}`, value, color, fake });
const indicator = t(12, 'yellow');
const run = (start: number, end: number, color: Color = 'red') => Array.from({ length: end - start + 1 }, (_, i) => t(i + start, color));
function fixture(hand: Tile[], options: Partial<Game> = {}): Game { return { ...newGame(), indicator, hands: [hand, [], [], []], ...options }; }
const sum = (melds: ReturnType<typeof bestMelds>) => melds.reduce((s, m) => s + m.score, 0);
function invariant(game: Game) {
  const all = [...game.hands.flat(), ...game.stock, ...game.discards.flat(), game.indicator, ...game.melds.flatMap(m => m.tiles)];
  assert.equal(all.length, 106); assert.equal(new Set(all.map(t => t.id)).size, 106);
}
test('106 unique physical tiles and fair 22/21/21/21 deal, 20 in stock', () => {
  const deck = makeDeck(); assert.equal(deck.length, 106); assert.equal(deck.filter(t => t.fake).length, 2);
  const game = newGame(); assert.deepEqual(game.hands.map(h => h.length), [22, 21, 21, 21]); assert.equal(game.stock.length, 20); assert.equal(game.indicator.fake, undefined); invariant(game);
});
test('all non-host seats are real-player placeholders, never bot identities', () => {
  assert.deepEqual(NAMES, ['Sen', 'Oyuncu 2', 'Oyuncu 3', 'Oyuncu 4']);
});
test('indicator wraps 13 to 1; true joker is wild, false joker has a fixed identity', () => {
  const show = t(13, 'blue'); assert.equal(jokerValue(show), 1); assert.ok(isJoker(t(1, 'blue'), show)); assert.ok(!isJoker(t(0, 'black', true), show));
  assert.deepEqual([face(t(0, 'black', true), show).value, face(t(0, 'black', true), show).color], [1, 'blue']);
  assert.equal(sum(bestMelds([t(4), t(6), t(13, 'yellow')], indicator)), 15);
  assert.equal(bestMelds([t(4), t(6), t(0, 'black', true)], indicator).length, 0);
  assert.equal(sum(bestMelds([t(11, 'yellow'), t(12, 'yellow'), t(0, 'black', true)], indicator)), 36);
});
test('runs cannot wrap, reuse a number, or mix colors', () => {
  assert.equal(candidates([t(12), t(13), t(1)], indicator, 'classic').length, 0);
  assert.equal(candidates([t(4), t(4), t(5)], indicator, 'classic').length, 0);
  assert.equal(candidates([t(4), t(5, 'blue'), t(6)], indicator, 'classic').length, 0);
  assert.equal(sum(bestMelds(run(8, 13), indicator)), 63);
});
test('sets require three/four distinct colors', () => {
  assert.equal(sum(bestMelds([t(8), t(8, 'blue'), t(8, 'black')], indicator)), 24);
  assert.equal(bestMelds([t(8), t(8), t(8, 'blue')], indicator).length, 0);
});
test('optimizer finds non-overlapping melds and handles duplicate copies', () => {
  const hand = [...run(8, 12), ...run(8, 12)];
  const result = bestMelds(hand, indicator); assert.equal(sum(result), 100); assert.equal(new Set(result.flatMap(m => m.tiles.map(t => t.id))).size, 10);
});
test('rack scoring counts only contiguous groups separated on the rack', () => {
  const first = run(1, 3), second = run(5, 7), hand = [...first, ...second];
  const split = [first[0].id, null, first[1].id, first[2].id, ...second.map(tile => tile.id)];
  assert.equal(sum(rackMelds(hand, indicator, split)), 0);
  const grouped = [first[0].id, first[1].id, first[2].id, null, ...second.map(tile => tile.id)];
  assert.equal(sum(rackMelds(hand, indicator, grouped)), 24);
});
test('pairs require identical color and number, or a true joker', () => {
  assert.equal(bestMelds([t(7), t(7, 'blue')], indicator, 'pairs').length, 0);
  assert.equal(bestMelds([t(7), t(7)], indicator, 'pairs').length, 1);
  assert.equal(bestMelds([t(7), t(13, 'yellow')], indicator, 'pairs').length, 1);
});
test('four identical tiles need two physically separated pair groups', () => {
  const four = [t(7), t(7), t(7), t(7)];
  assert.equal(rackMelds(four, indicator, four.map(tile => tile.id), 'pairs').length, 0);
  const separated = [four[0].id, four[1].id, null, four[2].id, four[3].id];
  const pairs = rackMelds(four, indicator, separated, 'pairs');
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs.map(meld => meld.tiles.length), [2, 2]);
});
test('opening respects the 101 threshold and keeps the final discard', () => {
  const below = fixture([...run(8, 12), ...run(8, 12, 'blue'), t(2, 'black')]);
  assert.equal(openMelds(below).opened[0], false);
  const exact = fixture([...run(6, 8), ...run(6, 9, 'blue'), ...run(11, 13, 'black'), ...run(2, 5, 'yellow'), t(1, 'blue')]);
  const opened = openMelds(exact); assert.equal(opened.opened[0], true); assert.equal(sum(opened.melds), 101); assert.equal(opened.hands[0].length, 1);
  assert.equal(exact.melds.length, 0, 'transition must be immutable');
  const full = fixture([...run(1, 13), ...run(8, 12, 'blue')]);
  const fullOpened = openMelds(full); assert.ok(fullOpened.hands[0].length > 0); assert.ok(sum(fullOpened.melds) >= 101);
});
test('five pairs open; four pairs cannot', () => {
  const hand = [1, 3, 5, 7, 9].flatMap(n => [t(n), t(n)]);
  assert.equal(openMelds(fixture([...hand, t(4, 'blue')], { mode: 'pairs' })).opened[0], true);
  assert.equal(openMelds(fixture(hand.slice(0, 8), { mode: 'pairs' })).opened[0], false);
});
test('draw/discard phases prevent double drawing and advance the player', () => {
  const game = newGame(); const attempted = draw(game); assert.equal(attempted.stock.length, 20);
  const next = discard(game, game.hands[0][0].id); assert.equal(next.turn, 1); assert.equal(next.phase, 'draw'); assert.equal(game.hands[0].length, 22);
  const drawn = draw(next); assert.equal(drawn.phase, 'discard'); assert.equal(drawn.stock.length, 19); assert.equal(draw(drawn).stock.length, 19); invariant(drawn);
});
test('unopened discard pickup enters the rack and failed opening returns and locks it', () => {
  const last = t(8, 'blue'), game = fixture([t(2), t(3)], { phase: 'draw', discards: [[], [], [], [last]] });
  const picked = draw(game, 'discard');
  assert.equal(picked.hands[0].length, 3);
  assert.equal(picked.pendingDiscardTileId, last.id);
  assert.equal(picked.discards[3].length, 0);
  const rejected = openMelds(picked);
  assert.equal(rejected.hands[0].length, 2);
  assert.equal(rejected.discardLockedTileId, last.id);
  assert.equal(rejected.pendingDiscardTileId, null);
  assert.equal(rejected.phase, 'draw');
  assert.equal(draw(rejected, 'discard').discardLockedTileId, last.id);
  assert.match(rejected.message, /tekrar alamazsın/);
});
test('a picked discard must be part of a valid opening', () => {
  const last = t(9, 'black');
  const hand = [...run(10, 13), ...run(10, 13, 'blue'), t(7, 'black'), t(8, 'black'), t(1, 'yellow')];
  const picked = draw(fixture(hand, { phase: 'draw', discards: [[], [], [], [last]] }), 'discard');
  const opened = openMelds(picked);
  assert.equal(opened.opened[0], true);
  assert.equal(opened.pendingDiscardTileId, null);
  assert.equal(opened.hands[0].length, 1);
  assert.equal(opened.discards[3].length, 0);
});
test('central meld validation rejects short or duplicated table melds', () => {
  const first = run(4, 6), second = run(8, 10, 'blue');
  assert.ok(validateMeld({ tiles: first, score: 15, kind: 'run', owner: 0 }, indicator, 'classic'));
  assert.ok(!validateMeld({ tiles: first.slice(0, 2), score: 9, kind: 'run', owner: 0 }, indicator, 'classic'));
  assert.ok(validateTable([{ tiles: first, score: 15, kind: 'run', owner: 0 }, { tiles: second, score: 27, kind: 'run', owner: 1 }], indicator, 'classic'));
  assert.ok(!validateTable([{ tiles: first, score: 15, kind: 'run', owner: 0 }, { tiles: first, score: 15, kind: 'run', owner: 1 }], indicator, 'classic'));
});
test('table rearrangement commits only a complete valid tile conservation', () => {
  const first = run(1, 3), second = run(5, 7), spare = t(11, 'black');
  const game = fixture([spare], { phase: 'discard', turn: 0, opened: [true, false, false, false], melds: [
    { tiles: first, score: 6, kind: 'run', owner: 0 },
    { tiles: second, score: 18, kind: 'run', owner: 1 },
  ] });
  const reordered = rearrangeTable(game, [game.melds[1], game.melds[0]], game.hands[0]);
  assert.deepEqual(reordered.melds.map(m => m.tiles[0].value), [5, 1]);
  const broken = rearrangeTable(game, [{ ...game.melds[0], tiles: first.slice(0, 2) }, game.melds[1]], game.hands[0]);
  assert.equal(broken.melds[0].tiles[0].value, 1);
  assert.match(broken.message, /Masa düzeni/);
});
test('opening recalculates the real meld value and always leaves a discard', () => {
  const three = run(1, 3);
  const forged = openMelds(fixture([...three, t(9)]), [{ tiles: three, score: 101, kind: 'run', owner: 0 }]);
  assert.equal(forged.opened[0], false);
  const allUsed = fixture([...run(7, 13), ...run(7, 13, 'blue'), ...run(7, 13, 'black')]);
  const melds = [0, 1, 2].map(i => ({ tiles: allUsed.hands[0].slice(i * 7, i * 7 + 7), score: 999, kind: 'run' as const, owner: 0 }));
  assert.equal(openMelds(allUsed, melds).opened[0], false);
});
test('finish type is recorded for hand, joker, and pair finishes', () => {
  const handFinish = fixture([t(4)], { opened: [false, false, false, false] });
  assert.equal(discard(handFinish, handFinish.hands[0][0].id).finishType, 'hand');
  const joker = t(jokerValue(indicator), indicator.color);
  const jokerFinish = fixture([joker], { opened: [true, false, false, false] });
  assert.equal(discard(jokerFinish, joker.id).finishType, 'joker');
  const pairFinish = fixture([t(4)], { mode: 'pairs', opened: [true, false, false, false] });
  assert.equal(discard(pairFinish, pairFinish.hands[0][0].id).finishType, 'pair');
});
test('meld extension validates the tile and prevents using the last discard', () => {
  const tile = t(7), game = fixture([tile, t(2, 'black')], { opened: [true, false, false, false], melds: [{ tiles: run(4, 6), kind: 'run', score: 15, owner: 1 }] });
  const next = extendMeld(game, tile.id, 0); assert.equal(next.hands[0].length, 1); assert.equal(next.melds[0].score, 22);
  assert.equal(extendMeld(game, game.hands[0][1].id, 0).hands[0].length, 2);
  const final = discard(next, next.hands[0][0].id); assert.equal(final.winner, 0); assert.equal(final.ended, true); assert.equal(scores(final)[0], -101);
});
test('pair mode lets a player replace a true joker inside a pair', () => {
  const joker = t(jokerValue(indicator), indicator.color), real = t(7), spare = t(2, 'black');
  const target = { tiles: [real, joker], kind: 'pair' as const, score: 1, owner: 0 };
  const replacement = t(7), game = fixture([replacement, spare], { mode: 'pairs', opened: [true, false, false, false], melds: [target] });
  const next = extendMeld(game, replacement.id, 0);
  assert.equal(next.hands[0].length, 2);
  assert.ok(next.hands[0].some(tile => tile.id === joker.id));
  assert.ok(next.melds[0].tiles.every(tile => tile.value === 7 && tile.color === 'red'));
});
test('a joker can only be reclaimed with the tile it represents', () => {
  const joker = t(jokerValue(indicator), indicator.color), target = { tiles: [t(5), t(6), joker], kind: 'run' as const, score: 18, owner: 0 };
  const wrong = t(4), game = fixture([wrong, t(9, 'blue')], { opened: [true, false, false, false], melds: [target] });
  assert.equal(extendMeld(game, wrong.id, 0).hands[0].some(tile => tile.id === joker.id), false);
  const right = t(7), valid = fixture([right, t(9, 'blue')], { opened: [true, false, false, false], melds: [target] });
  assert.equal(extendMeld(valid, right.id, 0).hands[0].some(tile => tile.id === joker.id), true);
});
test('collecting returns the player melds to the rack and joker replacement takes the joker', () => {
  const joker = t(13, 'yellow'), target = { tiles: [t(5), joker, t(7)], kind: 'run' as const, score: 18, owner: 0 };
  const replacement = t(6), game = fixture([replacement, t(2, 'blue')], { opened: [true, false, false, false], melds: [target] });
  const extended = extendMeld(game, replacement.id, 0);
  assert.ok(extended.hands[0].some(tile => tile.id === joker.id));
  assert.ok(extended.melds[0].tiles.some(tile => tile.id === replacement.id));
  const collected = collectMelds(extended);
  assert.equal(collected.opened[0], false);
  assert.equal(collected.melds.length, 0);
  assert.equal(collected.hands[0].length, 5);
  assert.equal(collectMelds({ ...extended, turn: 1 }, 0).melds.length, 1);
});
test('timeout draws when needed, discards the smallest tile, and advances the turn', () => {
  const game = fixture([t(4), t(1)], { phase: 'discard', turnStartedAt: 0 });
  const timedOut = timeoutTurn(game);
  assert.equal(timedOut.turn, 1);
  assert.equal(timedOut.phase, 'draw');
  assert.equal(timedOut.discards[0].at(-1)?.value, 1);
  const drawTimeout = timeoutTurn({ ...game, phase: 'draw', stock: [t(9)] });
  assert.equal(drawTimeout.stock.length, 0);
  assert.equal(drawTimeout.discards[0].at(-1)?.value, 1);
});
test('empty stock ends the game without inventing a winner', () => {
  const next = draw(fixture([t(3)], { stock: [], phase: 'draw' })); assert.equal(next.ended, true); assert.equal(next.winner, null);
});
