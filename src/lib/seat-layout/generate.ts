import { rowLabels } from "./config";
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
  const labelsInOrder = rowLabels(rows);
  const rowsReversed = config.rowLabelOrder === "back_to_front";
  const colsReversed = config.colNumbering === "right_to_left";

  // Physical order, from the screen outwards and left to right.
  const physRowLabels = rowsReversed ? [...labelsInOrder].reverse() : labelsInOrder;
  const physColNumbers = Array.from({ length: cols }, (_, c) => (colsReversed ? cols - c : c + 1));

  const vGaps = new Set(config.aisles.verticalAfterCols.map((n) => gapAfterPhysical(n, cols, colsReversed)));
  const hGaps = new Set(config.aisles.horizontalAfterRows.map((n) => gapAfterPhysical(n, rows, rowsReversed)));

  // Cell centres: x and y per physical index.
  const colX: number[] = [];
  let x = 0;
  for (let c = 0; c < cols; c++) {
    colX.push(x + 0.5);
    x += 1;
    if (vGaps.has(c) && c < cols - 1) x += AISLE_SIZE;
  }
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

  // Resolve every cell, applying overrides in order.
  const capacity = new Map(seatTypes.map((t) => [t.id, t.capacity]));
  const grid = new Map<string, Cell | null>();
  const key = (rowIdx: number, colIdx: number) => `${rowIdx}:${colIdx}`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) grid.set(key(r, c), { type: config.defaultSeatType, flags: [] });
  }
  const rowIndexByLabel = new Map(physRowLabels.map((label, i) => [label, i]));
  const colIndexByNumber = new Map(physColNumbers.map((n, i) => [n, i]));
  for (const o of config.overrides) {
    const r = rowIndexByLabel.get(o.row);
    if (r === undefined) continue;
    for (const n of o.cols) {
      const c = colIndexByNumber.get(n);
      if (c === undefined) continue;
      if (o.type === NO_SEAT) {
        grid.set(key(r, c), null);
        continue;
      }
      const current = grid.get(key(r, c)) ?? { type: config.defaultSeatType, flags: [] };
      grid.set(key(r, c), { type: o.type ?? current.type, flags: o.flags ?? current.flags });
    }
  }

  // Build seats; adjacent couple-seat cells of the same type (no aisle between) pair up.
  const seats: GridSeat[] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const cell = grid.get(key(r, c));
      if (!cell) {
        c += 1;
        continue;
      }
      const next = c + 1 < cols && !vGaps.has(c) ? grid.get(key(r, c + 1)) : null;
      const pairs = capacity.get(cell.type) === 2 && next && next.type === cell.type;
      const cells = pairs ? 2 : 1;
      const lowestNumber = Math.min(physColNumbers[c], physColNumbers[c + cells - 1]);
      const flags = pairs ? [...new Set([...cell.flags, ...next.flags])] : cell.flags;
      seats.push({
        code: `${physRowLabels[r]}${lowestNumber}`,
        row: physRowLabels[r],
        col: lowestNumber,
        rowIndex: r,
        colIndex: c,
        type: cell.type,
        span: cells as 1 | 2,
        x: pairs ? (colX[c] + colX[c + 1]) / 2 : colX[c],
        y: rowY[r],
        flags,
      });
      c += cells;
    }
  }

  // Screen: its centre follows the slider, kept inside the room.
  const screenWidth = (width * config.screen.widthPct) / 100;
  const wanted = width / 2 + ((config.screen.positionPct - 50) / 50) * (width / 2);
  const centre = Math.min(Math.max(wanted, screenWidth / 2), width - screenWidth / 2);

  const entranceX = { left: 0, center: width / 2, right: width } as const;
  const geometry: LayoutGeometry = {
    width,
    height,
    screen: { x1: centre - screenWidth / 2, x2: centre + screenWidth / 2, y: 0 },
    verticalAisles: [...vGaps].filter((p) => p < cols - 1).map((p) => colX[p] + 0.5 + AISLE_SIZE / 2),
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
    rowLabels: physRowLabels,
    colNumbers: physColNumbers,
  };
  return { seats, geometry };
}
