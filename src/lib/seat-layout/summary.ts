import type { LayoutConfig, LayoutGeometry, LayoutSeat, SeatTypeInfo } from "./types";

/** Seats within this many points of the best score count as the "best zone". */
const TOP_ZONE_MARGIN = 5;

function side(pct: number): string {
  if (pct < 45) return `lệch trái (${pct}%)`;
  if (pct > 55) return `lệch phải (${pct}%)`;
  return `ở giữa (${pct}%)`;
}

const ENTRANCE_SIDE = { left: "trái", center: "giữa", right: "phải" } as const;
const ENTRANCE_POSITION = { front: "trước", back: "sau" } as const;
const DISTANCE = { near: "gần", medium: "vừa", far: "xa" } as const;

/**
 * Short Vietnamese description of a layout, stored with it so the chatbot (Sprint 7) can
 * answer without loading every seat. Content for the model, not UI text, so it is not i18n.
 */
export function buildLayoutSummary(
  config: LayoutConfig,
  geometry: LayoutGeometry,
  seats: LayoutSeat[],
  seatTypes: SeatTypeInfo[],
): string {
  const parts: string[] = [];
  const first = geometry.rowLabels[0];
  const last = geometry.rowLabels[geometry.rowLabels.length - 1];

  const byType = new Map<string, number>();
  for (const s of seats) byType.set(s.type, (byType.get(s.type) ?? 0) + 1);
  const typeText = seatTypes
    .filter((t) => byType.has(t.id))
    .map((t) => `${t.name} ${byType.get(t.id)}`)
    .join(", ");
  parts.push(
    `${config.rows} hàng (${first} đến ${last} tính từ màn hình) × ${config.cols} cột, ${seats.length} ghế${typeText ? ` (${typeText})` : ""}.`,
  );

  parts.push(
    `Màn hình ${side(Math.round(config.screen.positionPct))}, rộng ${config.screen.widthPct}% dãy ghế, cách hàng đầu ${DISTANCE[config.screen.distance]}.`,
  );

  const aisles: string[] = [];
  if (config.aisles.verticalAfterCols.length) {
    aisles.push(`lối đi dọc sau cột ${[...config.aisles.verticalAfterCols].sort((a, b) => a - b).join(", ")}`);
  }
  if (config.aisles.horizontalAfterRows.length) {
    const labels = [...config.aisles.horizontalAfterRows]
      .sort((a, b) => a - b)
      .map((n) => geometry.rowLabels[config.rowLabelOrder === "front_to_back" ? n - 1 : config.rows - n]);
    aisles.push(`lối đi ngang sau hàng ${labels.join(", ")}`);
  }
  parts.push(aisles.length ? `${aisles.join("; ")}.` : "Không có lối đi.");

  parts.push(config.stadiumFromRow !== null ? `Bậc thang từ hàng thứ ${config.stadiumFromRow} tính từ màn hình.` : "Phòng phẳng, không có bậc thang.");
  if (config.entrances.length) {
    parts.push(
      `Cửa: ${config.entrances.map((e) => `${ENTRANCE_SIDE[e.side]}-${ENTRANCE_POSITION[e.position]}`).join(", ")}.`,
    );
  }

  const broken = seats.filter((s) => s.flags.length).length;
  if (broken) parts.push(`${broken} ghế hỏng hoặc bị che tầm nhìn.`);

  if (seats.length) {
    const best = Math.max(...seats.map((s) => s.score));
    const zone = seats.filter((s) => s.score >= best - TOP_ZONE_MARGIN);
    const zoneRows = [...new Set(zone.map((s) => s.rowIndex))].sort((a, b) => a - b);
    const zoneCols = zone.map((s) => s.col);
    parts.push(
      `Vùng điểm cao (${best - TOP_ZONE_MARGIN} đến ${best}): hàng ${geometry.rowLabels[zoneRows[0]]} đến ${geometry.rowLabels[zoneRows[zoneRows.length - 1]]}, cột ${Math.min(...zoneCols)} đến ${Math.max(...zoneCols)}.`,
    );
  }
  return parts.join(" ");
}
