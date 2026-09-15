import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMelds, BOARD_COLUMNS, BOARD_ROWS, SECTION_COLUMNS } from './boardLayout';

test('two 13×13 sections fit melds without overlap or crossing the divider', () => {
  assert.equal(BOARD_COLUMNS, 26);
  assert.equal(BOARD_ROWS, 13);
  for (const lengths of [Array(52).fill(2), Array(35).fill(3), Array(26).fill(13), [3, 4, 5, 3, 3, 5, 3, 3]]) {
    const cells = new Set<string>();
    for (const { row, column, length } of layoutMelds(lengths)) {
      assert.ok(row >= 0 && row < BOARD_ROWS);
      assert.ok(column >= 0 && column + length <= BOARD_COLUMNS);
      assert.equal(Math.floor(column / SECTION_COLUMNS), Math.floor((column + length - 1) / SECTION_COLUMNS));
      for (let c = column; c < column + length; c++) {
        const key = `${row},${c}`;
        assert.ok(!cells.has(key), `Overlapping cell ${key}`);
        cells.add(key);
      }
    }
  }
});

test('fills rows from the right and moves to the second section after row 13', () => {
  const slots = layoutMelds(Array(14).fill(13));
  assert.deepEqual(slots[0], { row: 0, column: 0, length: 13 });
  assert.deepEqual(slots[12], { row: 12, column: 0, length: 13 });
  assert.deepEqual(slots[13], { row: 0, column: 13, length: 13 });
  assert.deepEqual(layoutMelds([3, 4]), [{ row: 0, column: 10, length: 3 }, { row: 0, column: 5, length: 4 }]);
});

test('fills every available left row before placing a meld on the right', () => {
  const slots = layoutMelds(Array(40).fill(3));
  assert.ok(slots.slice(0, 39).every(slot => slot.column + slot.length <= SECTION_COLUMNS));
  assert.deepEqual(slots[3], { row: 1, column: 10, length: 3 });
  assert.deepEqual(slots[38], { row: 12, column: 2, length: 3 });
  assert.deepEqual(slots[39], { row: 0, column: 23, length: 3 });
});

test('uses remaining left space for a smaller meld even after a larger meld needed the right', () => {
  const slots = layoutMelds([...Array(13).fill(10), 4, 2]);
  assert.deepEqual(slots[13], { row: 0, column: 22, length: 4 });
  assert.deepEqual(slots[14], { row: 0, column: 0, length: 2 });
});
