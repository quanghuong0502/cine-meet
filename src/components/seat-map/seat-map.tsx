"use client";

import { LikeIcon, RestartIcon, RoundedMagnifierZoomInIcon, RoundedMagnifierZoomOutIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { memo, useCallback, useId, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AISLE_SIZE } from "@/lib/seat-layout/generate";
import type { LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";
import { heatColor, heatRange, heatTextColor } from "./heat-color";
import { usePanZoom } from "./use-pan-zoom";

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
  /** Seats another party already holds (planning a viewing): drawn faded, with a bar across. */
  reservedCodes?: ReadonlySet<string>;
  /** Seats given to people: seat code to the short text drawn on it (initials), in the brand colour. */
  holderLabels?: ReadonlyMap<string, string>;
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

// Space around the seats, in layout units (1 unit = one seat pitch). Both left and right reserve a row-label strip.
const BASE_PAD = { left: 1.6, right: 1.6, top: 1.1, bottom: 2.4 };
/** Width of the strip beside the seats that holds row labels (and their tap area). */
const ROW_LABEL_STRIP = 1.5;

/** Room around the seats; grows only on the side that has an entrance, which needs space for its bar and its "Door" label. */
function mapPadding(geometry: LayoutGeometry) {
  const has = (side: string, position: string) => geometry.entrances.some((e) => e.side === side && e.position === position);
  const side = (name: string) => geometry.entrances.some((e) => e.side === name);
  return {
    left: side("left") ? 2.3 : BASE_PAD.left,
    right: side("right") ? 2.3 : BASE_PAD.right,
    // A front-centre door sits above the screen; a back-centre door sits below the column numbers.
    top: has("center", "front") ? 2.2 : BASE_PAD.top,
    bottom: has("center", "back") ? 3.5 : BASE_PAD.bottom,
  };
}
const SEAT = 0.84;
/** Zoom level from which the seat code (row and number, e.g. F12) is drawn inside the seats. */
const LABELS_FROM_SCALE = 1.5;
/** Width of the selection ring in screen pixels (`non-scaling-stroke`): it stays this thin at every zoom instead of growing with it. */
const SELECT_RING_PX = 1.5;
const DEFAULT_COLOR = "var(--muted-foreground)";

interface LayerProps extends Omit<SeatMapProps, "className" | "onSeatTap" | "onRowTap" | "onColTap" | "maxHeight"> {
  scoreMin: number;
  scoreMax: number;
  labels: boolean;
  interactive: boolean;
  rowLabelsTappable: boolean;
  colLabelsTappable: boolean;
  screenLabel: string;
  seatAria: (seat: LayoutSeat, typeName: string, mark?: "favorite" | "avoid") => string;
  doorLabel: string;
  doorText: string;
  defPrefix: string;
}

interface SeatNodeProps {
  code: string;
  x: number;
  y: number;
  span: number;
  fill: string;
  labelFill: string;
  selected: boolean;
  reserved: boolean;
  broken: boolean;
  obstructed: boolean;
  recommended: boolean;
  mark?: "favorite" | "avoid";
  holder?: string;
  labels: boolean;
  interactive: boolean;
  focusable: boolean;
  ariaLabel?: string;
  defPrefix: string;
}

/**
 * Single SVG seat wrapped in `memo` with primitive props so selecting or marking 1 seat on a 250-seat
 * layout only reconciles the 1-2 changed seats instead of the entire auditorium.
 */
const SeatNode = memo(function SeatNode({
  code,
  x,
  y,
  span,
  fill,
  labelFill,
  selected,
  reserved,
  broken,
  obstructed,
  recommended,
  mark,
  holder,
  labels,
  interactive,
  focusable,
  ariaLabel,
  defPrefix,
}: SeatNodeProps) {
  const w = span * 1 - (1 - SEAT);
  return (
    <g
      data-seat={code}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? (focusable ? 0 : -1) : undefined}
      aria-label={ariaLabel}
      aria-pressed={interactive ? selected : undefined}
      className={cn("outline-none focus-visible:outline-2 focus-visible:outline-ring", interactive && "cursor-pointer")}
    >
      {/* Full-pitch invisible hit zone so taps in the small inter-seat gap still register cleanly. */}
      {interactive ? <rect x={x - span / 2} y={y - 0.5} width={span} height={1} fill="transparent" /> : null}
      <rect
        data-seat={code}
        x={x - w / 2}
        y={y - SEAT / 2}
        width={w}
        height={SEAT}
        rx={0.2}
        fill={fill}
        stroke="var(--border)"
        strokeWidth={0.04}
        opacity={broken ? 0.45 : reserved ? 0.3 : 1}
      />
      {/* Seat back, on the side away from the screen */}
      <rect x={x - w / 2 + 0.06} y={y + SEAT / 2 - 0.2} width={w - 0.12} height={0.14} rx={0.07} fill="#000" opacity={0.22} pointerEvents="none" />
      {obstructed ? (
        <rect x={x - w / 2} y={y - SEAT / 2} width={w} height={SEAT} rx={0.2} fill="none" stroke="var(--foreground)" strokeWidth={0.08} strokeDasharray="0.18 0.12" pointerEvents="none" />
      ) : null}
      {broken ? (
        <path
          d={`M ${x - 0.28} ${y - 0.28} L ${x + 0.28} ${y + 0.28} M ${x + 0.28} ${y - 0.28} L ${x - 0.28} ${y + 0.28}`}
          stroke="var(--destructive)"
          strokeWidth={0.12}
          strokeLinecap="round"
          pointerEvents="none"
        />
      ) : null}
      {reserved ? (
        <line x1={x - w / 2 + 0.1} y1={y} x2={x + w / 2 - 0.1} y2={y} stroke="var(--foreground)" strokeWidth={0.1} strokeLinecap="round" pointerEvents="none" />
      ) : null}
      {holder ? (
        <text x={x} y={y + 0.14} textAnchor="middle" fontSize={0.4} fontWeight={700} fill="#fff" pointerEvents="none">
          {holder}
        </text>
      ) : null}
      {recommended ? <use href={`#${defPrefix}-rec`} x={x - w / 2 + 0.02} y={y - SEAT / 2 + 0.02} pointerEvents="none" /> : null}
      {mark ? <use href={`#${defPrefix}-${mark === "favorite" ? "fav" : "avoid"}`} x={x + w / 2 - 0.02} y={y - SEAT / 2 + 0.02} pointerEvents="none" /> : null}
      {selected ? (
        <rect x={x - w / 2 - 0.03} y={y - SEAT / 2 - 0.03} width={w + 0.06} height={SEAT + 0.06} rx={0.23} fill="none" stroke="var(--foreground)" strokeWidth={SELECT_RING_PX} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      ) : null}
      {labels && !broken && !holder ? (
        <text x={x} y={y + 0.12} textAnchor="middle" fontSize={code.length > 3 ? 0.28 : 0.34} fontWeight={600} fill={labelFill} pointerEvents="none">
          {code}
        </text>
      ) : null}
    </g>
  );
});

/** Everything that does not change while zooming, so a pinch never re-renders hundreds of seats. */
const MapLayer = memo(function MapLayer({
  geometry,
  seats,
  seatTypes,
  showHeatmap,
  scoreMin,
  scoreMax,
  marks,
  selectedCodes,
  reservedCodes,
  holderLabels,
  emptyCells,
  labels,
  interactive,
  rowLabelsTappable,
  colLabelsTappable,
  screenLabel,
  seatAria,
  doorLabel,
  doorText,
  defPrefix,
}: LayerProps) {
  const types = useMemo(() => new Map(seatTypes.map((t) => [t.id, t])), [seatTypes]);
  // Precompute heatmap colors once per layout/bounds change rather than inside every seat render.
  const heatStyles = useMemo(() => {
    if (!showHeatmap) return null;
    const map = new Map<string, { fill: string; text: string }>();
    for (const seat of seats) {
      map.set(seat.code, {
        fill: heatColor(seat.score, scoreMin, scoreMax),
        text: heatTextColor(seat.score, scoreMin, scoreMax),
      });
    }
    return map;
  }, [seats, scoreMin, scoreMax, showHeatmap]);

  const g = geometry;
  const sx1 = g.screen.x1;
  const sx2 = g.screen.x2;
  const sMid = (sx1 + sx2) / 2;
  const hasAnySelected = Boolean(selectedCodes && selectedCodes.size > 0);
  const recSize = 0.34;
  const recScale = recSize / 24;
  const favSize = 0.62;
  const favScale = favSize / 24;

  return (
    <>
      {/* Reusable badge symbols defined once in <defs> and instanced via <use> to cut SVG DOM node count. */}
      <defs>
        <g id={`${defPrefix}-rec`}>
          <circle cx={0} cy={0} r={0.25} fill="var(--success)" stroke="#fff" strokeWidth={0.05} />
          <g transform={`translate(${-recSize / 2} ${-recSize / 2}) scale(${recScale})`} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" />
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
          </g>
        </g>
        <g id={`${defPrefix}-fav`} transform={`translate(${-favSize / 2} ${-favSize / 2}) scale(${favScale})`}>
          <path
            d="M11.16 4.48 Q12 3 12.84 4.48 L14.25 6.96 Q15 8.27 16.48 8.58 L19.28 9.15 Q20.94 9.5 19.79 10.75 L17.87 12.86 Q16.85 13.98 17.02 15.48 L17.34 18.32 Q17.53 20 15.98 19.3 L13.38 18.13 Q12 17.5 10.62 18.13 L8.02 19.3 Q6.47 20 6.66 18.32 L6.98 15.48 Q7.15 13.98 6.13 12.86 L4.21 10.75 Q3.06 9.5 4.72 9.15 L7.52 8.58 Q9 8.27 9.75 6.96 Z"
            fill="var(--seat-favorite)"
            stroke="#fff"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </g>
        <g id={`${defPrefix}-avoid`}>
          <circle cx={0} cy={0} r={0.25} fill="var(--seat-avoid)" stroke="#fff" strokeWidth={0.05} />
          <line x1={-0.14} y1={0} x2={0.14} y2={0} stroke="#fff" strokeWidth={0.07} strokeLinecap="round" />
        </g>
      </defs>

      {/* Screen */}
      <path d={`M ${sx1} 0.1 Q ${sMid} -0.45 ${sx2} 0.1`} fill="none" stroke="var(--primary)" strokeWidth={0.22} strokeLinecap="round" />
      <path d={`M ${sx1} 0.1 Q ${sMid} -0.45 ${sx2} 0.1 L ${sx2 - 0.3} 0.7 Q ${sMid} 0.2 ${sx1 + 0.3} 0.7 Z`} fill="var(--screen-glow)" />
      <text x={sMid} y={0.62} textAnchor="middle" fontSize={0.42} fill="var(--muted-foreground)" style={{ letterSpacing: "0.08em" }}>
        {screenLabel}
      </text>

      {/* Aisles */}
      {g.verticalAisles.map((x) => (
        <line key={`v${x}`} x1={x} x2={x} y1={g.firstRowY - 0.5} y2={g.lastRowY + 0.5} stroke="var(--border)" strokeWidth={0.06} strokeDasharray="0.2 0.2" />
      ))}
      {g.sideAisles?.includes("left") ? (
        <line key="side-left" x1={AISLE_SIZE / 2} x2={AISLE_SIZE / 2} y1={g.firstRowY - 0.5} y2={g.lastRowY + 0.5} stroke="var(--border)" strokeWidth={0.07} strokeDasharray="0.2 0.2" />
      ) : null}
      {g.sideAisles?.includes("right") ? (
        <line key="side-right" x1={g.width - AISLE_SIZE / 2} x2={g.width - AISLE_SIZE / 2} y1={g.firstRowY - 0.5} y2={g.lastRowY + 0.5} stroke="var(--border)" strokeWidth={0.07} strokeDasharray="0.2 0.2" />
      ) : null}
      {g.horizontalAisles.map((y) => (
        <line key={`h${y}`} x1={0} x2={g.width} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.06} strokeDasharray="0.2 0.2" />
      ))}

      {/* Entrances: an outlined bar (not a filled one, so it is not mistaken for a selected seat) with a short "Door" label. */}
      {g.entrances.map((e) => {
        const vertical = e.side !== "center";
        const w = vertical ? 0.28 : 1.2;
        const h = vertical ? 1.2 : 0.28;
        const cx = e.side === "left" ? -1.5 : e.side === "right" ? g.width + 1.5 : e.x;
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

      {/* Row labels (left and right edges so wide rooms are effortless to scan without zooming) */}
      {g.rowLabels.map((label, i) => {
        const y = g.rowY[i];
        return (
          <g key={`r${label}`} data-row={label} className={rowLabelsTappable ? "cursor-pointer" : undefined}>
            {rowLabelsTappable ? (
              <>
                <rect data-row={label} x={-ROW_LABEL_STRIP} y={y - 0.5} width={ROW_LABEL_STRIP - 0.1} height={1} fill="transparent" />
                <rect data-row={label} x={g.width + 0.1} y={y - 0.5} width={ROW_LABEL_STRIP - 0.1} height={1} fill="transparent" />
              </>
            ) : null}
            <text x={-0.85} y={y + 0.17} textAnchor="middle" fontSize={0.5} fill="var(--muted-foreground)" pointerEvents="none">
              {label}
            </text>
            <text x={g.width + 0.85} y={y + 0.17} textAnchor="middle" fontSize={0.5} fill="var(--muted-foreground)" pointerEvents="none">
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
      {seats.map((seat, index) => {
        const type = types.get(seat.type);
        const holder = holderLabels?.get(seat.code);
        const reserved = reservedCodes?.has(seat.code) ?? false;
        const heat = heatStyles?.get(seat.code);
        const fill = holder ? "var(--primary)" : heat ? heat.fill : (type?.color ?? DEFAULT_COLOR);
        const labelFill = heat ? heat.text : "#fff";
        const selected = selectedCodes?.has(seat.code) ?? false;
        const focusable = interactive && (selected || (!hasAnySelected && index === 0));
        const mark = marks?.get(seat.code);
        return (
          <SeatNode
            key={seat.code}
            code={seat.code}
            x={seat.x}
            y={seat.y}
            span={seat.span}
            fill={fill}
            labelFill={labelFill}
            selected={selected}
            reserved={reserved}
            broken={seat.flags.includes("broken")}
            obstructed={seat.flags.includes("obstructed")}
            recommended={seat.flags.includes("recommended")}
            mark={mark}
            holder={holder}
            labels={labels}
            interactive={interactive}
            focusable={focusable}
            ariaLabel={interactive ? seatAria(seat, type?.name ?? "", mark) : undefined}
            defPrefix={defPrefix}
          />
        );
      })}
    </>
  );
});

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
  reservedCodes,
  holderLabels,
  onSeatTap,
  onRowTap,
  onColTap,
  emptyCells,
  onEmptyTap,
  maxHeight = "60dvh",
  className,
}: SeatMapProps) {
  const t = useTranslations("seatMap");
  const defPrefix = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const seatsByCode = useMemo(() => new Map(seats.map((s) => [s.code, s])), [seats]);
  const emptyByCode = useMemo(() => new Map((emptyCells ?? []).map((c) => [c.code, c])), [emptyCells]);

  const pad = useMemo(() => mapPadding(geometry), [geometry]);
  const viewW = geometry.width + pad.left + pad.right;
  const viewH = geometry.height + pad.top + pad.bottom;
  const scoreBounds = useMemo(() => heatRange(seats), [seats]);
  const usedSeatTypes = useMemo(() => {
    const ids = new Set(seats.map((s) => s.type));
    return seatTypes.filter((type) => ids.has(type.id));
  }, [seats, seatTypes]);
  const hasRecommended = useMemo(() => seats.some((seat) => seat.flags.includes("recommended")), [seats]);
  const hasBroken = useMemo(() => seats.some((seat) => seat.flags.includes("broken")), [seats]);
  const hasObstructed = useMemo(() => seats.some((seat) => seat.flags.includes("obstructed")), [seats]);

  const activateTarget = useCallback(
    (target: EventTarget | null) => {
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
    [seatsByCode, emptyByCode, onSeatTap, onEmptyTap, onRowTap, onColTap],
  );

  const { zoomed, atMax, showLabels, handlers, zoomIn, zoomOut, reset } = usePanZoom(
    containerRef,
    svgRef,
    { x: -pad.left, y: -pad.top, w: viewW, h: viewH },
    { onTap: activateTarget, labelScale: LABELS_FROM_SCALE },
  );


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
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              activateTarget(event.target);
            }
          }}
        >
          <MapLayer
            geometry={geometry}
            seats={seats}
            seatTypes={seatTypes}
            showHeatmap={showHeatmap}
            scoreMin={scoreBounds.min}
            scoreMax={scoreBounds.max}
            marks={marks}
            selectedCodes={selectedCodes}
            reservedCodes={reservedCodes}
            holderLabels={holderLabels}
            emptyCells={emptyCells}
            labels={showLabels}
            interactive={!!onSeatTap || !!onEmptyTap}
            rowLabelsTappable={!!onRowTap}
            colLabelsTappable={!!onColTap}
            screenLabel={t("screen")}
            seatAria={seatAria}
            doorLabel={t("doorLabel")}
            doorText={t("door")}
            defPrefix={defPrefix}
          />
        </svg>
      </div>

      {/* Zoom controls sit cleanly outside the SVG frame so they never cover corner seats. */}
      <div className="flex flex-wrap items-center justify-between gap-stack">
        <div className="flex flex-wrap items-center gap-x-item gap-y-tight type-micro text-muted-foreground">
          {!showHeatmap && usedSeatTypes.length > 0
            ? usedSeatTypes.map((type) => (
                <span key={type.id} className="inline-flex items-center gap-tight">
                  <span aria-hidden className="size-icon-xs shrink-0 rounded-sm border border-border" style={{ backgroundColor: type.color ?? DEFAULT_COLOR }} />
                  {type.name}
                </span>
              ))
            : null}
          {hasRecommended ? (
            <span className="inline-flex items-center gap-tight">
              <span aria-hidden className="flex size-icon-sm shrink-0 items-center justify-center rounded-full bg-success text-white">
                <LikeIcon className="size-icon-xs" />
              </span>
              {t("recommendedLegend")}
            </span>
          ) : null}
          {hasObstructed ? (
            <span className="inline-flex items-center gap-tight">
              <span aria-hidden className="size-icon-xs shrink-0 rounded-sm border border-dashed border-warning" />
              {t("obstructedLegend")}
            </span>
          ) : null}
          {hasBroken ? (
            <span className="inline-flex items-center gap-tight">
              <span aria-hidden className="flex size-icon-xs shrink-0 items-center justify-center rounded-sm border border-destructive/60 bg-destructive/15 type-micro leading-none text-destructive">
                ×
              </span>
              {t("brokenLegend")}
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 gap-stack">
          <Button type="button" variant="secondary" size="icon" aria-label={t("zoomOut")} disabled={!zoomed} onClick={zoomOut}>
            <RoundedMagnifierZoomOutIcon className="size-icon" />
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label={t("zoomIn")} disabled={atMax} onClick={zoomIn}>
            <RoundedMagnifierZoomInIcon className="size-icon" />
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label={t("zoomReset")} disabled={!zoomed} onClick={reset}>
            <RestartIcon className="size-icon" />
          </Button>
        </div>
      </div>

      {showHeatmap ? (
        <div className="flex items-center gap-stack type-micro text-muted-foreground">
          <span className="tabular-nums">{t("heatLow")} ({scoreBounds.min})</span>
          <div
            className="h-track flex-1 rounded-full"
            style={{ background: `linear-gradient(in oklch to right, ${[0, 0.25, 0.5, 0.75, 1].map((t) => heatColor(t, 0, 1)).join(", ")})` }}
            aria-hidden
          />
          <span className="tabular-nums">{t("heatHigh")} ({scoreBounds.max})</span>
        </div>
      ) : null}
    </div>
  );
}
