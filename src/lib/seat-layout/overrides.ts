import { maxColOfRow, rowLabels } from "./config.constants";
import { NO_SEAT, type GridSeat, type LayoutConfig, type SeatFlag, type SeatOverride } from "./types";

/** One cell of the grid, by row label and the column number printed on the seat. */
export interface Cell {
  row: string;
  col: number;
}

interface CellState {
  type?: string;
  flags?: SeatFlag[];
}

/** "D5". Row labels are letters and columns digits, so the key is unambiguous. */
export const cellKey = (cell: Cell): string => `${cell.row}${cell.col}`;

/** Cells a seat covers: one, or two for a couple seat. */
export function cellsOfSeat(seat: Pick<GridSeat, "row" | "col" | "span">): Cell[] {
  return Array.from({ length: seat.span }, (_, i) => ({ row: seat.row, col: seat.col + i }));
}

function rowOrder(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b);
}

function sameFlags(a: SeatFlag[] = [], b: SeatFlag[] = []): boolean {
  return a.length === b.length && a.every((f) => b.includes(f));
}

/** Final state of every overridden cell (a later override wins, as in `generateGrid`). */
function toCells(overrides: SeatOverride[]): Map<string, Cell & { state: CellState }> {
  const cells = new Map<string, Cell & { state: CellState }>();
  for (const o of overrides) {
    for (const col of o.cols) {
      const key = cellKey({ row: o.row, col });
      const current = cells.get(key)?.state ?? {};
      const state: CellState = { ...current };
      if (o.type !== undefined) state.type = o.type;
      if (o.flags !== undefined) state.flags = o.flags;
      cells.set(key, { row: o.row, col, state });
    }
  }
  return cells;
}

/** The shortest equivalent override list: one entry per row and distinct state. Order no longer matters. */
function fromCells(cells: Iterable<Cell & { state: CellState }>): SeatOverride[] {
  const sorted = [...cells].sort((a, b) => rowOrder(a.row, b.row) || a.col - b.col);
  const result: SeatOverride[] = [];
  for (const cell of sorted) {
    const last = result[result.length - 1];
    const flags = cell.state.flags?.length ? cell.state.flags : undefined;
    if (last && last.row === cell.row && last.type === cell.state.type && sameFlags(last.flags, flags)) {
      last.cols.push(cell.col);
    } else {
      result.push({
        row: cell.row,
        cols: [cell.col],
        ...(cell.state.type !== undefined ? { type: cell.state.type } : {}),
        ...(flags ? { flags } : {}),
      });
    }
  }
  return result;
}

export interface CellPatch {
  /** A seatType id, or `NO_SEAT` to remove the seat. */
  type?: string;
  /** Turn one flag on or off. Ignored for cells without a seat. */
  flag?: { name: SeatFlag; on: boolean };
}

/** Applies a change to the given cells. A cell back at the room's default type with no flags stops being an override. */
export function patchCells(overrides: SeatOverride[], target: Cell[], patch: CellPatch, defaultSeatType: string): SeatOverride[] {
  const cells = toCells(overrides);
  for (const t of target) {
    const key = cellKey(t);
    const state: CellState = { ...(cells.get(key)?.state ?? {}) };
    if (patch.type !== undefined) {
      state.type = patch.type === defaultSeatType ? undefined : patch.type;
      if (patch.type === NO_SEAT) state.flags = undefined;
    }
    if (patch.flag && state.type !== NO_SEAT) {
      const flags = new Set(state.flags ?? []);
      if (patch.flag.on) flags.add(patch.flag.name);
      else flags.delete(patch.flag.name);
      state.flags = [...flags];
    }
    if (state.type === undefined && !state.flags?.length) cells.delete(key);
    else cells.set(key, { ...t, state });
  }
  return fromCells(cells.values());
}

/** Puts the given cells back to the room's default (no override). */
export function resetCells(overrides: SeatOverride[], target: Cell[]): SeatOverride[] {
  const cells = toCells(overrides);
  for (const t of target) cells.delete(cellKey(t));
  return fromCells(cells.values());
}

/** Cells that currently have no seat. */
export function removedCells(overrides: SeatOverride[]): Cell[] {
  return [...toCells(overrides).values()].filter((c) => c.state.type === NO_SEAT).map(({ row, col }) => ({ row, col }));
}

/** Drops whatever no longer fits after rows, columns or row letters change (overrides, aisles, fills, stadium row). */
export function pruneConfig(config: LayoutConfig): LayoutConfig {
  const labels = new Set(rowLabels(config.rows, config.skipRowLetters));
  const verticalAfterCols = config.aisles.verticalAfterCols.filter((n) => n < config.cols);
  const aisleFills = config.aisleFills
    ?.filter((f) => verticalAfterCols.includes(f.afterCol))
    .map((f) => ({ ...f, rows: f.rows.filter((r) => r <= config.rows) }))
    .filter((f) => f.rows.length > 0);
  const next: LayoutConfig = {
    ...config,
    stadiumFromRow: config.stadiumFromRow !== null && config.stadiumFromRow > config.rows ? null : config.stadiumFromRow,
    aisles: {
      verticalAfterCols,
      horizontalAfterRows: config.aisles.horizontalAfterRows.filter((n) => n < config.rows),
      ...(config.aisles.sideAisles?.length ? { sideAisles: config.aisles.sideAisles } : {}),
    },
    ...(aisleFills?.length ? { aisleFills } : { aisleFills: undefined }),
  };
  return {
    ...next,
    overrides: fromCells(
      [...toCells(config.overrides).values()].filter((c) => labels.has(c.row) && c.col <= maxColOfRow(next, c.row)),
    ),
  };
}
