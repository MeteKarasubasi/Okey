import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeck, newGame, candidates, bestMelds, rackMelds, discard, draw, openMelds, botTurn, extendMeld, scores, isJoker, face, jokerValue, type Tile, type Game, type Color } from './engine';
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
test('discard pickup is forbidden before opening unless used in immediate opening', () => {
  const last = t(8, 'blue'), game = fixture([t(2), t(3)], { phase: 'draw', discards: [[], [], [], [last]] });
  assert.equal(draw(game, 'discard').hands[0].length, 2);
  const opened = draw({ ...game, opened: [true, false, false, false] }, 'discard'); assert.equal(opened.hands[0].length, 3); assert.equal(opened.discards[3].length, 0);
});
test('meld extension validates the tile and prevents using the last discard', () => {
  const tile = t(7), game = fixture([tile, t(2, 'black')], { opened: [true, false, false, false], melds: [{ tiles: run(4, 6), kind: 'run', score: 15, owner: 1 }] });
  const next = extendMeld(game, tile.id, 0); assert.equal(next.hands[0].length, 1); assert.equal(next.melds[0].score, 22);
  assert.equal(extendMeld(game, game.hands[0][1].id, 0).hands[0].length, 2);
  const final = discard(next, next.hands[0][0].id); assert.equal(final.winner, 0); assert.equal(final.ended, true); assert.equal(scores(final)[0], -101);
});
test('empty stock ends the game without inventing a winner', () => {
  const next = draw(fixture([t(3)], { stock: [], phase: 'draw' })); assert.equal(next.ended, true); assert.equal(next.winner, null);
});
test('30 deterministic games conserve every tile through complete bot turns', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let rng = seed;
    let game = newGame(seed % 2 ? 'classic' : 'pairs', () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; });
    let turns = 0;
    while (!game.ended && turns++ < 120) {
      if (game.turn === 0) {
        if (game.phase === 'draw') game = draw(game);
        if (!game.ended) { game = openMelds(game); game = discard(game, game.hands[0][0].id); }
      } else game = botTurn(game);
      invariant(game);
      for (const meld of game.melds) assert.ok(candidates(meld.tiles, game.indicator, game.mode).some(c => c.tiles.length === meld.tiles.length));
    }
    assert.ok(game.ended); assert.ok(turns < 120);
  }
});
