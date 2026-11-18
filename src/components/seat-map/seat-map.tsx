"use client";

import { RotateCcw, ThumbsUp, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";
import { heatColor, heatRange, heatTextColor } from "./heat-color";
import { MAX_SCALE, MIN_SCALE, usePanZoom } from "./use-pan-zoom";

export interface SeatMapSeatType {
  id: string;
  name: string;
  color?: string | null;
}

export interface SeatMapProps {
  geometry: LayoutGeometry;
  seats: LayoutSeat[];
  seatTypes: SeatMapSeatType[];
  /** Colour seats by score instead of seat type. */
  showHeatmap?: boolean;
  /** The viewer's own marks by seat code: a star (favourite) or a crossed circle (avoid) in the seat's corner. */
  marks?: ReadonlyMap<string, "favorite" | "avoid">;
  /** Seat codes drawn with a selection ring. */
  selectedCodes?: ReadonlySet<string>;
  onSeatTap?: (seat: LayoutSeat) => void;
  /** Tapping a row label (e.g. "D") or a column number. */
  onRowTap?: (rowLabel: string) => void;
  onColTap?: (colNumber: number) => void;
  /** Cells without a seat that stay tappable (editor: so a removed seat can be brought back). Drawn as dashed outlines. */
  emptyCells?: { code: string; x: number; y: number }[];
  onEmptyTap?: (cellCode: string) => void;
  /** CSS max-height of the map frame. */
  maxHeight?: string;
  className?: string;
}

// Space around the seats, in layout units (1 unit = one seat pitch).
const BASE_PAD = { left: 1.6, right: 0.8, top: 1.1, bottom: 2.4 };
/** Width of the strip left of the seats that holds row labels (and their tap area). */
const ROW_LABEL_STRIP = 1.5;

/** Room around the seats; grows only on the side that has an entrance, which needs space for its bar and its "Door" label. */
function mapPadding(geometry: LayoutGeometry) {
  const has = (side: string, position: string) => geometry.entrances.some((e) => e.side === side && e.position === position);
  const side = (name: string) => geometry.entrances.some((e) => e.side === name);
  return {
    left: side("left") ? 2.3 : BASE_PAD.left,
    right: side("right") ? 1.9 : BASE_PAD.right,
    // A front-centre door sits above the screen; a back-centre door sits below the column numbers.
    top: has("center", "front") ? 2.2 : BASE_PAD.top,
    bottom: has("center", "back") ? 3.5 : BASE_PAD.bottom,
  };
}
const SEAT = 0.84;
/** Zoom level from which the seat code (row and number, e.g. F12) is drawn inside the seats. */
const LABELS_FROM_SCALE = 1.8;
/** Width of the selection ring in screen pixels (`non-scaling-stroke`): it stays this thin at every zoom instead of growing with it. */
const SELECT_RING_PX = 1.5;
const DEFAULT_COLOR = "var(--muted-foreground)";

interface LayerProps extends Omit<SeatMapProps, "className" | "onSeatTap" | "onRowTap" | "onColTap" | "maxHeight"> {
  labels: boolean;
  interactive: boolean;
  rowLabelsTappable: boolean;
  colLabelsTappable: boolean;
  screenLabel: string;
  seatAria: (seat: LayoutSeat, typeName: string, mark?: "favorite" | "avoid") => string;
  doorLabel: string;
  doorText: string;
}

/** Everything that does not change while zooming, so a pinch never re-renders hundreds of seats. */
const MapLayer = memo(function MapLayer({
  geometry,
  seats,
  seatTypes,
  showHeatmap,
  marks,
  selectedCodes,
  emptyCells,
  labels,
  interactive,
  rowLabelsTappable,
  colLabelsTappable,
  screenLabel,
  seatAria,
  doorLabel,
  doorText,
}: LayerProps) {
  const types = useMemo(() => new Map(seatTypes.map((t) => [t.id, t])), [seatTypes]);
  const { min, max } = useMemo(() => heatRange(seats), [seats]);

  const g = geometry;
  const sx1 = g.screen.x1;
  const sx2 = g.screen.x2;
  const sMid = (sx1 + sx2) / 2;

  return (
    <>
      {/* Screen */}
      <path d={`M ${sx1} 0.1 Q ${sMid} -0.45 ${sx2} 0.1`} fill="none" stroke="var(--primary)" strokeWidth={0.22} strokeLinecap="round" />
      <path d={`M ${sx1} 0.1 Q ${sMid} -0.45 ${sx2} 0.1 L ${sx2 - 0.3} 0.7 Q ${sMid} 0.2 ${sx1 + 0.3} 0.7 Z`} fill="var(--primary)" opacity={0.12} />
      <text x={sMid} y={0.62} textAnchor="middle" fontSize={0.42} fill="var(--muted-foreground)" style={{ letterSpacing: "0.08em" }}>
        {screenLabel}
      </text>

      {/* Aisles */}
      {g.verticalAisles.map((x) => (
        <line key={`v${x}`} x1={x} x2={x} y1={g.firstRowY - 0.5} y2={g.lastRowY + 0.5} stroke="var(--border)" strokeWidth={0.06} strokeDasharray="0.2 0.2" />
      ))}
      {g.horizontalAisles.map((y) => (
        <line key={`h${y}`} x1={0} x2={g.width} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.06} strokeDasharray="0.2 0.2" />
      ))}

      {/* Entrances: an outlined bar (not a filled one, so it is not mistaken for a selected seat) with a short "Door" label. */}
      {g.entrances.map((e) => {
        const vertical = e.side !== "center";
        const w = vertical ? 0.28 : 1.2;
        const h = vertical ? 1.2 : 0.28;
        const cx = e.side === "left" ? -1.5 : e.side === "right" ? g.width + 0.6 : e.x;
        const cy = vertical ? e.y : e.position === "front" ? -0.95 : g.lastRowY + 1.9;
        // Front doors are labelled above the bar, back doors below it, so the label never lands on a seat row or label.
        const labelY = e.position === "front" ? cy - h / 2 - 0.2 : cy + h / 2 + 0.5;
        return (
          <g key={`${e.side}-${e.position}`}>
            <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={0.08} fill="none" stroke="var(--primary)" strokeWidth={0.08}>
              <title>{doorLabel}</title>
            </rect>
            <text x={cx} y={labelY} textAnchor="middle" fontSize={0.42} fill="var(--muted-foreground)" pointerEvents="none">
              {doorText}
            </text>
          </g>
        );
      })}

      {/* Row labels */}
      {g.rowLabels.map((label, i) => {
        const y = g.rowY[i];
        return (
          <g key={`r${label}`} data-row={label} className={rowLabelsTappable ? "cursor-pointer" : undefined}>
            {rowLabelsTappable ? <rect data-row={label} x={-ROW_LABEL_STRIP} y={y - 0.5} width={ROW_LABEL_STRIP - 0.1} height={1} fill="transparent" /> : null}
            <text x={-0.85} y={y + 0.17} textAnchor="middle" fontSize={0.5} fill="var(--muted-foreground)" pointerEvents="none">
              {label}
            </text>
          </g>
        );
      })}

      {/* Column numbers under the last row */}
      {g.colNumbers.map((n, i) => {
        const cx = g.colX[i];
        return (
          <g key={`c${n}`} data-col={n} className={colLabelsTappable ? "cursor-pointer" : undefined}>
            {colLabelsTappable ? <rect data-col={n} x={cx - 0.5} y={g.lastRowY + 0.55} width={1} height={1.2} fill="transparent" /> : null}
            <text x={cx} y={g.lastRowY + 1.2} textAnchor="middle" fontSize={0.42} fill="var(--muted-foreground)" pointerEvents="none">
              {n}
            </text>
          </g>
        );
      })}

      {/* Empty cells (editor only) */}
      {emptyCells?.map((cell) => {
        const selected = selectedCodes?.has(cell.code);
        return (
          <g key={`e${cell.code}`} data-seat={cell.code} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-pressed={interactive ? !!selected : undefined} aria-label={interactive ? cell.code : undefined} className={cn("outline-none", interactive && "cursor-pointer")}>
            <rect data-seat={cell.code} x={cell.x - SEAT / 2} y={cell.y - SEAT / 2} width={SEAT} height={SEAT} rx={0.2} fill="transparent" stroke={selected ? "var(--foreground)" : "var(--border)"} strokeWidth={selected ? SELECT_RING_PX : 1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}

      {/* Seats */}
      {seats.map((seat) => {
        const type = types.get(seat.type);
        const fill = showHeatmap ? heatColor(seat.score, min, max) : (type?.color ?? DEFAULT_COLOR);
        const w = seat.span * 1 - (1 - SEAT);
        const selected = selectedCodes?.has(seat.code);
        const broken = seat.flags.includes("broken");
        const obstructed = seat.flags.includes("obstructed");
        const recommended = seat.flags.includes("recommended");
        const mark = marks?.get(seat.code);
        return (
          <g
            key={seat.code}
            data-seat={seat.code}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? seatAria(seat, type?.name ?? "", mark) : undefined}
            aria-pressed={interactive ? !!selected : undefined}
            className={cn("outline-none", interactive && "cursor-pointer")}
          >
            <rect data-seat={seat.code} x={seat.x - w / 2} y={seat.y - SEAT / 2} width={w} height={SEAT} rx={0.2} fill={fill} opacity={broken ? 0.45 : 1} />
            {/* Seat back, on the side away from the screen */}
            <rect x={seat.x - w / 2 + 0.06} y={seat.y + SEAT / 2 - 0.2} width={w - 0.12} height={0.14} rx={0.07} fill="#000" opacity={0.22} pointerEvents="none" />
            {obstructed ? (
              <rect x={seat.x - w / 2} y={seat.y - SEAT / 2} width={w} height={SEAT} rx={0.2} fill="none" stroke="var(--foreground)" strokeWidth={0.08} strokeDasharray="0.18 0.12" pointerEvents="none" />
            ) : null}
            {broken ? (
              <path
                d={`M ${seat.x - 0.28} ${seat.y - 0.28} L ${seat.x + 0.28} ${seat.y + 0.28} M ${seat.x + 0.28} ${seat.y - 0.28} L ${seat.x - 0.28} ${seat.y + 0.28}`}
                stroke="var(--destructive)"
                strokeWidth={0.12}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ) : null}
            {recommended ? <RecommendedBadge x={seat.x - w / 2 + 0.02} y={seat.y - SEAT / 2 + 0.02} /> : null}
            {mark ? <MarkBadge kind={mark} x={seat.x + w / 2 - 0.02} y={seat.y - SEAT / 2 + 0.02} /> : null}
            {selected ? (
              <rect x={seat.x - w / 2 - 0.03} y={seat.y - SEAT / 2 - 0.03} width={w + 0.06} height={SEAT + 0.06} rx={0.23} fill="none" stroke="var(--foreground)" strokeWidth={SELECT_RING_PX} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : null}
            {labels && !broken ? (
              <text x={seat.x} y={seat.y + 0.12} textAnchor="middle" fontSize={seat.code.length > 3 ? 0.28 : 0.34} fontWeight={600} fill={showHeatmap ? heatTextColor(seat.score, min, max) : "#fff"} pointerEvents="none" style={showHeatmap ? undefined : { textShadow: "0 0 2px rgba(0,0,0,0.6)" }}>
                {seat.code}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
});

/** Top-left badge of a seat the admin recommends: a green circle with a thumbs-up (lucide "thumbs-up" paths, drawn in a 24-unit box). */
function RecommendedBadge({ x, y }: { x: number; y: number }) {
  const size = 0.34;
  const k = size / 24;
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={0.25} fill="#16a34a" stroke="#fff" strokeWidth={0.05} />
      <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
      </g>
    </g>
  );
}

/** Corner badge of a marked seat: a gold star, or a red circle with a bar. Shape differs, so colour is not the only signal. */
function MarkBadge({ kind, x, y }: { kind: "favorite" | "avoid"; x: number; y: number }) {
  if (kind === "favorite") {
    const points = Array.from({ length: 10 }, (_, i) => {
      const radius = i % 2 === 0 ? 0.3 : 0.13;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      return `${(x + radius * Math.cos(angle)).toFixed(3)},${(y + radius * Math.sin(angle)).toFixed(3)}`;
    }).join(" ");
    return <polygon points={points} fill="#facc15" stroke="#000" strokeOpacity={0.55} strokeWidth={0.04} pointerEvents="none" />;
  }
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={0.25} fill="#dc2626" stroke="#fff" strokeWidth={0.05} />
      <line x1={x - 0.14} y1={y} x2={x + 0.14} y2={y} stroke="#fff" strokeWidth={0.07} strokeLinecap="round" />
    </g>
  );
}

/**
 * Seat map drawn as SVG from a generated layout: pinch to zoom, drag to pan, tap a seat.
 * One component for every screen (admin editor now; user seat view and seat picking later).
 */
export function SeatMap({
  geometry,
  seats,
  seatTypes,
  showHeatmap = false,
  marks,
  selectedCodes,
  onSeatTap,
  onRowTap,
  onColTap,
  emptyCells,
  onEmptyTap,
  maxHeight = "60dvh",
  className,
}: SeatMapProps) {
  const t = useTranslations("seatMap");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const seatsByCode = useMemo(() => new Map(seats.map((s) => [s.code, s])), [seats]);
  const emptyByCode = useMemo(() => new Map((emptyCells ?? []).map((c) => [c.code, c])), [emptyCells]);

  const pad = useMemo(() => mapPadding(geometry), [geometry]);
  const viewW = geometry.width + pad.left + pad.right;
  const viewH = geometry.height + pad.top + pad.bottom;

  const { scale, handlers, zoomIn, zoomOut, reset } = usePanZoom(containerRef, svgRef, { x: -pad.left, y: -pad.top, w: viewW, h: viewH }, {
    onTap: (target) => {
      const el = target instanceof Element ? target : null;
      const seatCode = el?.closest("[data-seat]")?.getAttribute("data-seat");
      if (seatCode) {
        const seat = seatsByCode.get(seatCode);
        if (seat) onSeatTap?.(seat);
        else if (emptyByCode.has(seatCode)) onEmptyTap?.(seatCode);
        return;
      }
      const row = el?.closest("[data-row]")?.getAttribute("data-row");
      if (row) {
        onRowTap?.(row);
        return;
      }
      const col = el?.closest("[data-col]")?.getAttribute("data-col");
      if (col) onColTap?.(Number(col));
    },
  });


  // Stable between renders: the layer below is memoized and must not redraw every seat at each zoom step.
  const seatAria = useCallback(
    (seat: LayoutSeat, typeName: string, mark?: "favorite" | "avoid") =>
      [
        t("seat", { code: seat.code, type: typeName }),
        t("score", { score: seat.score }),
        mark === "favorite" ? t("markFavorite") : mark === "avoid" ? t("markAvoid") : null,
        seat.flags.includes("broken") ? t("broken") : null,
        seat.flags.includes("obstructed") ? t("obstructed") : null,
        seat.flags.includes("recommended") ? t("recommended") : null,
      ]
        .filter(Boolean)
        .join(", "),
    [t],
  );

  return (
    <div className={cn("flex flex-col gap-stack", className)}>
      <div
        ref={containerRef}
        {...handlers}
        // The map takes every touch gesture, always: if the browser may scroll at 1x it grabs the pinch (pointercancel) as soon
        // as the fingers drift vertically and the map jumps. The page scrolls from outside the map (devices.md, rule 6).
        style={{ touchAction: "none", aspectRatio: `${viewW} / ${viewH}`, maxHeight }}
        className="relative w-full overflow-hidden rounded-xl border bg-card select-none"
      >
        <svg
          ref={svgRef}
          viewBox={`${-pad.left} ${-pad.top} ${viewW} ${viewH}`}
          className="size-full"
          role="group"
          aria-label={t("label")}
          preserveAspectRatio="xMidYMid meet"
        >
          <MapLayer
            geometry={geometry}
            seats={seats}
            seatTypes={seatTypes}
            showHeatmap={showHeatmap}
            marks={marks}
            selectedCodes={selectedCodes}
            emptyCells={emptyCells}
            labels={scale >= LABELS_FROM_SCALE}
            interactive={!!onSeatTap || !!onEmptyTap}
            rowLabelsTappable={!!onRowTap}
            colLabelsTappable={!!onColTap}
            screenLabel={t("screen")}
            seatAria={seatAria}
            doorLabel={t("doorLabel")}
            doorText={t("door")}
          />
        </svg>

        <div className="absolute right-inset-xs bottom-inset-xs flex gap-stack" data-no-pan>
          <Button type="button" variant="secondary" size="icon" aria-label={t("zoomOut")} disabled={scale <= MIN_SCALE} onClick={zoomOut} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <ZoomOut className="size-icon" />
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label={t("zoomIn")} disabled={scale >= MAX_SCALE} onClick={zoomIn} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <ZoomIn className="size-icon" />
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label={t("zoomReset")} disabled={scale <= MIN_SCALE} onClick={reset} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <RotateCcw className="size-icon" />
          </Button>
        </div>
      </div>

      {seats.some((seat) => seat.flags.includes("recommended")) ? (
        <p className="flex items-center gap-stack type-micro text-muted-foreground">
          <span aria-hidden className="flex size-icon-sm shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
            <ThumbsUp className="size-icon-xs" />
          </span>
          {t("recommendedLegend")}
        </p>
      ) : null}

      {showHeatmap ? (
        <div className="flex items-center gap-stack type-micro text-muted-foreground">
          <span>{t("heatLow")}</span>
          <div
            className="h-track flex-1 rounded-full"
            style={{ background: `linear-gradient(in oklch to right, ${[0, 0.25, 0.5, 0.75, 1].map((t) => heatColor(t, 0, 1)).join(", ")})` }}
            aria-hidden
          />
          <span>{t("heatHigh")}</span>
        </div>
      ) : null}
    </div>
  );
}
