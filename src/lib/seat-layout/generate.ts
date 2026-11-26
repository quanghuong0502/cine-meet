import { rowLabels } from "./config.constants";
import {
  NO_SEAT,
  type GridSeat,
  type LayoutConfig,
  type LayoutGeometry,
  type SeatFlag,
  type SeatTypeInfo,
} from "./types";

/** Extra width/height an aisle adds, in seat pitches. */
export const AISLE_SIZE = 0.8;
/** Empty space between the screen and the first row's edge, by screen distance. */
export const SCREEN_GAP = { near: 1, medium: 2, far: 3 } as const;

interface Cell {
  type: string;
  flags: SeatFlag[];
}

/** Physical index (from the screen / from the left) of the gap that follows the Nth item in label/number order. */
function gapAfterPhysical(n: number, count: number, reversed: boolean): number {
  return reversed ? count - n - 1 : n - 1;
}

/** Turns a config into physical geometry and the list of seats (without scores). */
export function generateGrid(
  config: LayoutConfig,
  seatTypes: SeatTypeInfo[],
): { seats: GridSeat[]; geometry: LayoutGeometry } {
  const { rows, cols } = config;
  const labelsInOrder = rowLabels(rows, config.skipRowLetters);
  const rowsReversed = config.rowLabelOrder === "back_to_front";
  const colsReversed = config.colNumbering === "right_to_left";

  // Physical order, from the screen outwards and left to right.
  const physRowLabels = rowsReversed ? [...labelsInOrder].reverse() : labelsInOrder;
  const physColNumbers = Array.from({ length: cols }, (_, c) => (colsReversed ? cols - c : c + 1));

  const vGaps = new Set(config.aisles.verticalAfterCols.map((n) => gapAfterPhysical(n, cols, colsReversed)));
  const hGaps = new Set(config.aisles.horizontalAfterRows.map((n) => gapAfterPhysical(n, rows, rowsReversed)));

  const rowIndexByLabel = new Map(physRowLabels.map((label, i) => [label, i]));

  // Aisles that selected rows run straight through: widened to hold `seats` extra seats in those rows.
  const fills = new Map<number, { seats: number; rows: Set<number> }>();
  for (const f of config.aisleFills ?? []) {
    const p = gapAfterPhysical(f.afterCol, cols, colsReversed);
    if (!vGaps.has(p) || p >= cols - 1) continue;
    const rowIdx = f.rows.flatMap((n) => {
      const r = rowIndexByLabel.get(labelsInOrder[n - 1]);
      return r === undefined ? [] : [r];
    });
    if (rowIdx.length) fills.set(p, { seats: f.seats, rows: new Set(rowIdx) });
  }
  const gapWidth = (p: number) => fills.get(p)?.seats ?? AISLE_SIZE;

  const sideAisles = config.aisles.sideAisles?.length ? [...config.aisles.sideAisles] : undefined;
  const hasLeftSideAisle = sideAisles?.includes("left") ?? false;
  const hasRightSideAisle = sideAisles?.includes("right") ?? false;

  // Cell centres: x and y per physical index. Side-wall aisles reserve real room width so a 1-sided aisle shifts the
  // seating block toward the closed wall while the screen (at 50%) stays centred on the full room.
  const colX: number[] = [];
  let x = hasLeftSideAisle ? AISLE_SIZE : 0;
  for (let c = 0; c < cols; c++) {
    colX.push(x + 0.5);
    x += 1;
    if (vGaps.has(c) && c < cols - 1) x += gapWidth(c);
  }
  if (hasRightSideAisle) x += AISLE_SIZE;
  const width = x;

  const firstRowY = SCREEN_GAP[config.screen.distance] + 0.5;
  const rowY: number[] = [];
  let y = firstRowY - 0.5;
  for (let r = 0; r < rows; r++) {
    rowY.push(y + 0.5);
    y += 1;
    if (hGaps.has(r) && r < rows - 1) y += AISLE_SIZE;
  }
  const lastRowY = rowY[rows - 1];
  const height = lastRowY + 0.5;

  const capacity = new Map(seatTypes.map((t) => [t.id, t.capacity]));

  // Positions of each row from the left (rows running through an aisle get extra slots in the gap).
  interface Slot {
    /** Physical column index, or null for a seat placed inside a vertical aisle. */
    c: number | null;
    x: number;
    num: number;
  }
  const rowSlots: Slot[][] = [];
  for (let r = 0; r < rows; r++) {
    const raw: Omit<Slot, "num">[] = [];
    for (let c = 0; c < cols; c++) {
      raw.push({ c, x: colX[c] });
      const fill = fills.get(c);
      if (fill?.rows.has(r)) {
        for (let k = 0; k < fill.seats; k++) raw.push({ c: null, x: colX[c] + 0.5 + k + 0.5 });
      }
    }
    rowSlots.push(raw.map((s, i) => ({ ...s, num: colsReversed ? raw.length - i : i + 1 })));
  }

  // Resolve every slot, applying overrides in order (by printed seat number in that row).
  const cells: (Cell | null)[][] = rowSlots.map((slots) => slots.map(() => ({ type: config.defaultSeatType, flags: [] })));
  for (const o of config.overrides) {
    const r = rowIndexByLabel.get(o.row);
    if (r === undefined) continue;
    for (const n of o.cols) {
      const s = rowSlots[r].findIndex((slot) => slot.num === n);
      if (s < 0) continue;
      if (o.type === NO_SEAT) {
        cells[r][s] = null;
        continue;
      }
      const current = cells[r][s] ?? { type: config.defaultSeatType, flags: [] };
      cells[r][s] = { type: o.type ?? current.type, flags: o.flags ?? current.flags };
    }
  }

  // Build seats; adjacent couple-seat cells of the same type (with no empty aisle between them) pair up.
  const seats: GridSeat[] = [];
  for (let r = 0; r < rows; r++) {
    const slots = rowSlots[r];
    let s = 0;
    while (s < slots.length) {
      const cell = cells[r][s];
      if (!cell) {
        s += 1;
        continue;
      }
      const slot = slots[s];
      const nextSlot = slots[s + 1];
      const separatedByEmptyAisle = slot.c !== null && nextSlot && nextSlot.c !== null && vGaps.has(slot.c);
      const next = nextSlot && !separatedByEmptyAisle ? cells[r][s + 1] : null;
      const pairs = capacity.get(cell.type) === 2 && next && next.type === cell.type;
      const span = pairs ? 2 : 1;
      const lowestNumber = Math.min(slot.num, slots[s + span - 1].num);
      const flags = pairs ? [...new Set([...cell.flags, ...next.flags])] : cell.flags;
      seats.push({
        code: `${physRowLabels[r]}${lowestNumber}`,
        row: physRowLabels[r],
        col: lowestNumber,
        rowIndex: r,
        colIndex: s,
        type: cell.type,
        span: span as 1 | 2,
        x: pairs ? (slot.x + nextSlot.x) / 2 : slot.x,
        y: rowY[r],
        flags,
      });
      s += span;
    }
  }

  // Screen: its centre follows the slider, kept inside the room.
  const screenWidth = (width * config.screen.widthPct) / 100;
  const wanted = width / 2 + ((config.screen.positionPct - 50) / 50) * (width / 2);
  const centre = Math.min(Math.max(wanted, screenWidth / 2), width - screenWidth / 2);

  const partialVerticalAisles = [...fills.entries()]
    .filter(([p]) => p < cols - 1)
    .map(([p, fill]) => ({
      x: colX[p] + 0.5 + fill.seats / 2,
      gapWidth: fill.seats,
      filledRows: [...fill.rows].sort((a, b) => a - b),
    }));

  const entranceX = { left: 0, center: width / 2, right: width } as const;
  const geometry: LayoutGeometry = {
    width,
    height,
    screen: { x1: centre - screenWidth / 2, x2: centre + screenWidth / 2, y: 0 },
    verticalAisles: [...vGaps].filter((p) => p < cols - 1 && !fills.has(p)).map((p) => colX[p] + 0.5 + gapWidth(p) / 2),
    ...(partialVerticalAisles.length ? { partialVerticalAisles } : {}),
    ...(sideAisles ? { sideAisles } : {}),
    horizontalAisles: [...hGaps].filter((p) => p < rows - 1).map((p) => rowY[p] + 0.5 + AISLE_SIZE / 2),
    entrances: config.entrances.map((e) => ({
      ...e,
      x: entranceX[e.side],
      y: e.position === "front" ? firstRowY : lastRowY,
    })),
    colX,
    rowY,
    firstRowY,
    lastRowY,
    rowSlots: Object.fromEntries(physRowLabels.map((label, r) => [label, rowSlots[r].map(({ num, x: sx }) => ({ col: num, x: sx }))])),
    rowLabels: physRowLabels,
    colNumbers: physColNumbers,
  };
  return { seats, geometry };
}
