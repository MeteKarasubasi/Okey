export const RACK_COLUMNS = 16;
export const RACK_SLOTS = RACK_COLUMNS * 2;
export type RackSlots = (string | null)[];
export const RACK = { x: 128, y: 662, width: 1344, height: 234, inset: 26, top: 9, pitch: 80.75, rowHeight: 108, tileWidth: 78, tileHeight: 102 };
export const DISCARD = { x: 1486, y: 548, width: 92, height: 104 };
export type Point = { x: number; y: number };
export function inside(point: Point, rect: { x: number; y: number; width: number; height: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
export function slotPosition(index: number): Point {
  return { x: RACK.inset + index % RACK_COLUMNS * RACK.pitch, y: RACK.top + Math.floor(index / RACK_COLUMNS) * RACK.rowHeight };
}
export function rackTarget(point: Point): number | null {
  if (!inside(point, { x: 0, y: 0, width: RACK.width, height: RACK.height })) return null;
  const col = Math.max(0, Math.min(15, Math.floor((point.x - RACK.inset) / RACK.pitch)));
  const row = point.y < RACK.top + RACK.rowHeight ? 0 : 1;
  return row * RACK_COLUMNS + col;
}
export function reconcileRack(slots: RackSlots, ids: string[]): RackSlots {
  const available = new Set(ids), placed = new Set<string>();
  const next = Array.from({ length: RACK_SLOTS }, (_, i) => {
    const id = slots[i];
    if (!id || !available.has(id) || placed.has(id)) return null;
    placed.add(id); return id;
  });
  for (const id of ids) if (!placed.has(id)) {
    const empty = next.indexOf(null);
    if (empty !== -1) { next[empty] = id; placed.add(id); }
  }
  return next;
}
export function moveRackSlot(slots: RackSlots, id: string, target: number): RackSlots {
  const source = slots.indexOf(id);
  if (source < 0 || target < 0 || target >= RACK_SLOTS || target === source) return slots;
  const next = [...slots]; next[source] = null;
  if (next[target]) {
    const start = Math.floor(target / RACK_COLUMNS) * RACK_COLUMNS;
    const empties = Array.from({ length: RACK_COLUMNS }, (_, i) => start + i).filter(i => !next[i]);
    const empty = empties.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    if (empty === undefined) next[source] = next[target];
    else {
      const step = empty > target ? 1 : -1;
      for (let i = empty; i !== target; i -= step) next[i] = next[i - step];
    }
  }
  next[target] = id;
  return next;
}

export function arrangeRack(groups: string[][], remaining: string[]): RackSlots {
  const next: RackSlots = Array(RACK_SLOTS).fill(null);
  let index = 0;
  for (const group of groups) {
    if (index % RACK_COLUMNS + group.length > RACK_COLUMNS) index = Math.ceil(index / RACK_COLUMNS) * RACK_COLUMNS;
    for (const id of group) { if (index < RACK_SLOTS) next[index] = id; index++; }
    if (index % RACK_COLUMNS) index++;
  }
  if (groups.length && index < RACK_COLUMNS && remaining.length <= RACK_COLUMNS) index = RACK_COLUMNS;
  for (const id of remaining) { if (index < RACK_SLOTS) next[index] = id; index++; }
  return reconcileRack(next, [...groups.flat(), ...remaining]);
}
