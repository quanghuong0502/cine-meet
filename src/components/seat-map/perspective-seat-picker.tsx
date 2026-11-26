"use client";

import { CloseIcon, StarsMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { heatColor, heatRange } from "@/components/seat-map/heat-color";
import type { SeatMarkKind3D } from "@/components/seat-map/room-3d-scene";
import type { SceneSeatType } from "@/lib/seat-layout/scene";
import type { LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";

interface Props {
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
  seatTypes: SceneSeatType[];
  heat: boolean;
  selected: string | null;
  bestSeatCode: string | null;
  marks?: Map<string, SeatMarkKind3D>;
  expanded: boolean;
  onPick: (code: string) => void;
  onPickBest: () => void;
  onClose: () => void;
}

const DEFAULT_SEAT_FILL = "#8e1e36";
const BROKEN_SEAT_FILL = "#242029";

/**
 * Interactive 3D-perspective seat picker overlay inspired by CinemaView & Codrops SeatPreview.
 * Renders the auditorium's true physical seat layout (aisles, couple spans, staggered/filled rows)
 * on a gently tilted perspective stage beneath a glowing curved cinema screen.
 */
export function PerspectiveSeatPicker({
  seats,
  geometry,
  seatTypes,
  heat,
  selected,
  bestSeatCode,
  marks,
  expanded,
  onPick,
  onPickBest,
  onClose,
}: Props) {
  const t = useTranslations("cinemas.room");
  const { min, max } = useMemo(() => heatRange(seats), [seats]);
  const typeColorById = useMemo(() => new Map(seatTypes.map((st) => [st.id, st.color])), [seatTypes]);

  const bounds = useMemo(() => {
    const minY = geometry.rowY.length > 0 ? Math.min(...geometry.rowY) - 0.5 : 0;
    const maxY = geometry.rowY.length > 0 ? Math.max(...geometry.rowY) + 0.5 : Math.max(1, geometry.height);
    const spanY = Math.max(1, maxY - minY);
    const width = Math.max(1, geometry.width);
    return { minY, spanY, width };
  }, [geometry]);

  const stageAspect = `${(bounds.width * 1.08).toFixed(2)} / ${(bounds.spanY * 1.06).toFixed(2)}`;

  return (
    <div
      role="dialog"
      aria-label={t("chooseSeatTitle")}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{
        background:
          "radial-gradient(115% 75% at 50% -10%, rgba(112, 160, 255, 0.24), transparent 55%), radial-gradient(85% 65% at 50% 115%, rgba(198, 21, 131, 0.16), transparent 60%), rgba(5, 6, 12, 0.97)",
      }}
      className={cn(
        "absolute inset-0 z-30 flex flex-col overflow-hidden text-white",
        expanded &&
          "pt-(--inset-top) pb-(--inset-bottom) pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
      )}
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between gap-stack px-inset py-inset-xs">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate type-item-title text-white">{t("chooseSeatTitle")}</h2>
          <p className="type-micro text-white/60 tabular-nums">{t("seatCount", { count: seats.length })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-stack">
          {bestSeatCode ? (
            <button
              type="button"
              onClick={onPickBest}
              className="inline-flex h-target items-center gap-tight rounded-full bg-primary px-inset-sm type-tag text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              <StarsMinimalisticIcon className="size-icon-sm" aria-hidden />
              <span>{t("bestSeat")}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="inline-flex size-target items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <CloseIcon className="size-icon" aria-hidden />
          </button>
        </div>
      </div>

      {/* Perspective 3D-tilted auditorium seating stage */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-inset py-inset-xs">
        {/* Glowing curved screen arc */}
        <div className="pointer-events-none flex w-full max-w-media shrink-0 flex-col items-center gap-tight">
          <div
            className="h-track w-3/4 rounded-full"
            style={{
              height: "4px",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.92), transparent)",
              boxShadow: "0 0 32px 8px rgba(135, 175, 255, 0.36)",
            }}
          />
          <span className="type-micro tracking-widest text-white/50 uppercase">{t("screenBadge")}</span>
        </div>

        {/* Tilted seat bowl matching exact room geometry */}
        <div
          className="relative flex min-h-0 w-full max-w-page flex-1 items-center justify-center overflow-hidden"
          style={{ perspective: expanded ? "1100px" : "760px" }}
        >
          <div
            className="relative max-h-full max-w-full"
            style={{
              width: expanded ? "min(92%, 720px)" : "min(92%, 440px)",
              aspectRatio: stageAspect,
              transform: expanded ? "rotateX(34deg)" : "rotateX(26deg)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Row letters anchored along the left edge */}
            {geometry.rowLabels.map((label, idx) => {
              const rowY = geometry.rowY[idx];
              if (rowY === undefined) return null;
              const topPct = ((rowY - bounds.minY) / bounds.spanY) * 100;
              return (
                <span
                  key={label}
                  aria-hidden
                  className="pointer-events-none absolute left-0 -translate-x-full -translate-y-1/2 pr-inset-xs type-micro text-white/45 tabular-nums"
                  style={{ top: `${topPct}%` }}
                >
                  {label}
                </span>
              );
            })}

            {/* Interactive seat tiles */}
            {seats.map((seat) => {
              const broken = seat.flags.includes("broken");
              const isSelected = seat.code === selected;
              const isBest = seat.code === bestSeatCode;
              const mark = marks?.get(seat.code);
              const leftPct = (seat.x / bounds.width) * 100;
              const topPct = ((seat.y - bounds.minY) / bounds.spanY) * 100;
              const widthPct = ((seat.span * 0.82) / bounds.width) * 100;
              const heightPct = (0.78 / bounds.spanY) * 100;
              const baseFill = broken
                ? BROKEN_SEAT_FILL
                : isSelected
                  ? "var(--primary)"
                  : heat
                    ? heatColor(seat.score, min, max)
                    : (typeColorById.get(seat.type) ?? DEFAULT_SEAT_FILL);

              return (
                <button
                  key={seat.code}
                  type="button"
                  title={t("seatPickerTitle", { code: seat.code, score: Math.round(seat.score) })}
                  aria-label={t("seatPickerTitle", { code: seat.code, score: Math.round(seat.score) })}
                  aria-pressed={isSelected}
                  onClick={() => onPick(seat.code)}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-150 hover:z-20 hover:scale-125 focus-visible:z-20 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                    broken && "opacity-40",
                  )}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: baseFill,
                    borderRadius: "34% 34% 18% 18%",
                    boxShadow: isSelected
                      ? "0 0 0 2px #ffffff, 0 0 12px 2px rgba(244, 63, 94, 0.7)"
                      : isBest
                        ? "0 0 0 2px #fbbf24, 0 0 10px 1px rgba(251, 191, 36, 0.55)"
                        : "inset 0 -2px 0 rgba(0, 0, 0, 0.35)",
                  }}
                >
                  {mark ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-0 right-0 size-icon-xs rounded-full"
                      style={{
                        width: "4px",
                        height: "4px",
                        backgroundColor: mark === "favorite" ? "#facc15" : "#ef4444",
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compact bottom legend */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-group gap-y-tight px-inset pb-inset-xs type-micro text-white/70">
        <span className="inline-flex items-center gap-tight">
          <span
            aria-hidden
            className="inline-block size-icon-xs rounded-sm bg-primary"
            style={{ boxShadow: "0 0 0 1.5px #ffffff" }}
          />
          {t("legendSelected")}
        </span>
        {bestSeatCode ? (
          <span className="inline-flex items-center gap-tight">
            <span
              aria-hidden
              className="inline-block size-icon-xs rounded-sm bg-white/20"
              style={{ boxShadow: "0 0 0 1.5px #fbbf24" }}
            />
            {t("legendBest", { code: bestSeatCode })}
          </span>
        ) : null}
        {heat ? (
          <span className="inline-flex items-center gap-tight">
            <span>{t("legendHeatLow")}</span>
            <span
              aria-hidden
              className="inline-block h-track w-swatch rounded-full"
              style={{
                background: `linear-gradient(in oklch to right, ${[0, 0.35, 0.7, 1].map((v) => heatColor(v, 0, 1)).join(", ")})`,
              }}
            />
            <span>{t("legendHeatHigh")}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
