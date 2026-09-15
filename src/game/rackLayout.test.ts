import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeRack, reconcileRack, moveRackSlot, rackTarget, slotPosition, RACK, DISCARD, inside } from './rackLayout';
const ids = Array.from({ length: 22 }, (_, i) => `tile-${i}`);
test('moving between rows retains the empty source and every physical tile', () => {
  const before = reconcileRack([], ids);
  const after = moveRackSlot(before, ids[0], 29);
  assert.equal(after[0], null); assert.equal(after[29], ids[0]);
  assert.deepEqual(after.filter(Boolean).sort(), [...ids].sort());
  assert.equal(before[0], ids[0]);
});
test('occupied slots slide toward free space; a full destination row swaps without losing tiles', () => {
  const before = reconcileRack([], ids);
  const after = moveRackSlot(before, ids[0], 3);
  assert.deepEqual(after.slice(0, 4), [ids[1], ids[2], ids[3], ids[0]]);
  const cross = moveRackSlot(before, ids[20], 5);
  assert.equal(cross[5], ids[20]); assert.equal(cross[20], ids[5]);
  assert.deepEqual(cross.filter(Boolean).sort(), [...ids].sort());
});
test('drawing and opening preserve the custom rack positions', () => {
  const arranged = moveRackSlot(reconcileRack([], ids), ids[0], 31);
  const updated = reconcileRack(arranged, [...ids.slice(0, 20), 'drawn']);
  assert.equal(updated[31], ids[0]); assert.equal(updated[0], 'drawn');
  assert.ok(!updated.includes(ids[20])); assert.ok(!updated.includes(ids[21]));
});
test('all 32 tile centers resolve to their own slot and outside drops never reorder', () => {
  for (let i = 0; i < 32; i++) {
    const p = slotPosition(i);
    assert.equal(rackTarget({ x: p.x + RACK.tileWidth / 2, y: p.y + RACK.tileHeight / 2 }), i);
  }
  assert.equal(rackTarget({ x: 400, y: -100 }), null);
  assert.equal(rackTarget({ x: RACK.width + 10, y: 70 }), null);
  assert.ok(!inside({ x: 1400, y: 700 }, DISCARD));
  assert.ok(inside({ x: DISCARD.x + 20, y: DISCARD.y + 30 }, DISCARD));
});
test('automatic arrangement keeps a gap between melds and remaining tiles on row two', () => {
  const arranged = arrangeRack([ids.slice(0, 3), ids.slice(3, 6)], ids.slice(6));
  assert.equal(arranged[3], null); assert.equal(arranged[7], null);
  assert.equal(arranged[16], ids[6]);
  assert.deepEqual(arranged.filter(Boolean).sort(), [...ids].sort());
});
