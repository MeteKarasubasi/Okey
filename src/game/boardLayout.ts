export const BOARD_ROWS = 13;
export const SECTION_COLUMNS = 13;
export const BOARD_COLUMNS = SECTION_COLUMNS * 2;

const LEFT_SECTION = 0;
const RIGHT_SECTION = 1;
const SECTION_ORDER = [LEFT_SECTION, RIGHT_SECTION] as const;

export type MeldLayoutSpec = { length: number; start: number; kind?: 'run' | 'set' | 'pair' };

// Search every row in the left section before considering the right section.
// Within a section, place whole melds top to bottom and right to left.
// Keep an empty cell between different melds in the same row.
export function layoutMelds(lengths: number[] | MeldLayoutSpec[]) {
  if (lengths.length && typeof lengths[0] !== 'number') {
    const specs = lengths as MeldLayoutSpec[];
    const occupied = Array.from({ length: 2 }, () => Array(BOARD_ROWS).fill(false));
    return specs.map(spec => {
      if (spec.length < 1 || spec.length > SECTION_COLUMNS) throw new Error('Per 1–13 taş içermeli.');
      if (spec.start < 1 || spec.start > SECTION_COLUMNS) throw new Error('Per başlangıcı 1–13 arasında olmalı.');
      const column = spec.kind === 'run' ? spec.start - 1 : Math.min(spec.start - 1, SECTION_COLUMNS - spec.length);
      if (column + spec.length > SECTION_COLUMNS) throw new Error('Per, başladığı sayıdan sonra 13. hücreyi aşamaz.');
      for (const section of SECTION_ORDER) {
        for (let row = 0; row < BOARD_ROWS; row++) {
          if (occupied[section][row]) continue;
          occupied[section][row] = true;
          return { row, column: section * SECTION_COLUMNS + column, length: spec.length };
        }
      }
      throw new Error('Masa hücreleri dolu.');
    });
  }
  const numericLengths = lengths as number[];
  const used = Array.from({ length: 2 }, () => Array(BOARD_ROWS).fill(0));
  return numericLengths.map(length => {
    if (length < 1 || length > SECTION_COLUMNS) throw new Error('Per 1–13 taş içermeli.');
    for (const section of SECTION_ORDER) {
      for (let row = 0; row < BOARD_ROWS; row++) {
        const occupied = used[section][row];
        const gap = occupied ? 1 : 0;
        if (occupied + gap + length > SECTION_COLUMNS) continue;
        used[section][row] += gap + length;
        return { row, column: section * SECTION_COLUMNS + SECTION_COLUMNS - used[section][row], length };
      }
    }
    throw new Error('Masa hücreleri dolu.');
  });
}
