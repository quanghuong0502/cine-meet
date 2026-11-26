"use client";

import { AltArrowDownIcon, AltArrowUpIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RequiredMark } from "@/components/required-mark";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_COLS, MAX_FILL_SEATS, MAX_ROWS, MAX_STEPS_PER_ROW, MIN_STEPS_PER_ROW, rowLabel } from "@/lib/seat-layout/config.constants";
import { DEFAULT_CINEMA_DIMENSIONS, type CinemaDimensionDefaults } from "@/lib/seat-layout/dimensions.defaults";
import { pruneConfig } from "@/lib/seat-layout/overrides";
import { SCREEN_TILT_DEG } from "@/lib/seat-layout/physical";
import {
  ROW_PITCHES,
  SCREEN_MOUNTS,
  SCREEN_SHAPES,
  SCREEN_TILTS,
  SEAT_RECLINES,
  SEAT_STAGGERS,
  SIDE_AISLES,
  type EntrancePosition,
  type EntranceSide,
  type LayoutConfig,
  type RowPitch,
  type ScreenMount,
  type ScreenShape,
  type ScreenTilt,
  type SeatRecline,
  type SeatStagger,
  type SideAisle,
} from "@/lib/seat-layout/types";
import { Chip, ChoiceGroup } from "./chips";
import { NumberField } from "./number-field";
import type { EditorSeatType } from "./types";

const SIDES: EntranceSide[] = ["left", "center", "right"];
const POSITIONS: EntrancePosition[] = ["front", "back"];
const CONTROL = "h-control rounded-xl bg-card px-inset type-body";

interface Props {
  name: string;
  onName: (name: string) => void;
  branchId: string;
  onBranch: (id: string) => void;
  /** Editing keeps the room in its cinema. */
  branchLocked: boolean;
  branches: { value: string; label: string }[];
  seatTypes: EditorSeatType[];
  config: LayoutConfig;
  dimensionDefaults?: CinemaDimensionDefaults;
  onConfig: (update: (current: LayoutConfig) => LayoutConfig) => void;
  /** Error codes by field name, already known to be translatable. */
  errors: { name?: string; branchId?: string };
}

function toggle(list: number[], n: number): number[] {
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b);
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex flex-col rounded-xl border bg-card/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-target items-center justify-between gap-item rounded-xl px-inset-sm py-inset-xs text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <h3 className="type-item-title">{title}</h3>
        {open ? <AltArrowUpIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden /> : <AltArrowDownIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />}
      </button>
      {open ? <div className="flex flex-col gap-field border-t px-inset-sm py-inset">{children}</div> : null}
    </section>
  );
}

/** The "Settings" tab: every number and choice of the room's layout (design 2.2). Each change updates the map above at once. */
export function SettingsPanel({
  name,
  onName,
  branchId,
  onBranch,
  branchLocked,
  branches,
  seatTypes,
  config,
  dimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
  onConfig,
  errors,
}: Props) {
  const t = useTranslations("admin.auditoriums.editor");
  const tv = useTranslations("admin.validation");
  const set = (patch: Partial<LayoutConfig>) => onConfig((c) => ({ ...c, ...patch }));
  const resize = (patch: Partial<Pick<LayoutConfig, "rows" | "cols">>) => onConfig((c) => pruneConfig({ ...c, ...patch }));
  const err = (code?: string) => (code ? tv(code === "too_long" ? "too_long" : "required") : null);
  const effectiveStepM = dimensionDefaults.stepHeightM;
  const skipIO = Boolean(config.skipRowLetters);
  const fills = config.aisleFills ?? [];
  const sideAisles = config.aisles.sideAisles ?? [];
  const [fillRow, setFillRow] = useState<number | null>(null);
  const fillSeats = fills[0]?.seats ?? 1;

  function toggleSideAisle(side: SideAisle) {
    const next = sideAisles.includes(side) ? sideAisles.filter((s) => s !== side) : [...sideAisles, side];
    set({ aisles: { ...config.aisles, sideAisles: next.length ? next : undefined } });
  }

  function toggleRowAisle(row: number, col: number) {
    const current = fills.find((f) => f.afterCol === col);
    const rows = toggle(current?.rows ?? [], row);
    const next = rows.length
      ? current
        ? fills.map((f) => (f.afterCol === col ? { ...f, rows } : f))
        : [...fills, { afterCol: col, seats: fillSeats, rows }]
      : fills.filter((f) => f.afterCol !== col);
    set({ aisleFills: next.length ? next : undefined });
  }

  return (
    <div className="flex flex-col gap-field" role="tabpanel">
      <div className="flex flex-col gap-item">
        <Label htmlFor="aud-name" className="text-muted-foreground">
          <span>
            {t("fields.name.label")}
            <RequiredMark />
          </span>
        </Label>
        <Input
          id="aud-name"
          value={name}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t("fields.name.placeholder")}
          aria-invalid={Boolean(errors.name) || undefined}
          aria-required
          onChange={(event) => onName(event.target.value)}
          className={CONTROL}
        />
        {errors.name ? <p role="alert" className="-mt-tight type-secondary text-destructive">{err(errors.name)}</p> : null}
      </div>

      <div className="flex flex-col gap-item">
        <Label htmlFor="aud-branch" className="text-muted-foreground">
          <span>
            {t("fields.branch.label")}
            <RequiredMark />
          </span>
        </Label>
        <Select value={branchId || undefined} onValueChange={onBranch} disabled={branchLocked}>
          <SelectTrigger id="aud-branch" aria-invalid={Boolean(errors.branchId) || undefined} aria-required className={`${CONTROL} w-full`}>
            <SelectValue placeholder={t("fields.branch.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.branchId ? <p role="alert" className="-mt-tight type-secondary text-destructive">{err(errors.branchId)}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-group sm:grid-cols-2">
        <div className="flex flex-col gap-item">
          <Label htmlFor="aud-rows" className="text-muted-foreground">
            <span>
              {t("fields.rows.label")}
              <RequiredMark />
            </span>
          </Label>
          <NumberField id="aud-rows" value={config.rows} min={1} max={MAX_ROWS} onChange={(n) => n !== null && resize({ rows: n })} />
        </div>
        <div className="flex flex-col gap-item">
          <Label htmlFor="aud-cols" className="text-muted-foreground">
            <span>
              {t("fields.cols.label")}
              <RequiredMark />
            </span>
          </Label>
          <NumberField id="aud-cols" value={config.cols} min={1} max={MAX_COLS} onChange={(n) => n !== null && resize({ cols: n })} />
        </div>
      </div>

      <div className="flex flex-col gap-item">
        <span className="type-label leading-none! text-muted-foreground">{t("fields.rowLabelOrder.label")}</span>
        <ChoiceGroup
          label={t("fields.rowLabelOrder.label")}
          value={config.rowLabelOrder}
          onChange={(rowLabelOrder) => set({ rowLabelOrder })}
          options={[
            { value: "front_to_back", label: t("options.rowLabelOrder.nearScreen") },
            { value: "back_to_front", label: t("options.rowLabelOrder.farScreen") },
          ]}
        />
        <div className="flex min-h-target items-center justify-between gap-group pt-tight">
          <Label htmlFor="aud-skip-io" className="text-muted-foreground">
            {t("fields.skipRowLetters.label")}
          </Label>
          <Switch
            id="aud-skip-io"
            checked={skipIO}
            onCheckedChange={(checked) => onConfig((c) => pruneConfig({ ...c, skipRowLetters: checked || undefined }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-item">
        <span className="type-label leading-none! text-muted-foreground">{t("fields.colNumbering.label")}</span>
        <ChoiceGroup
          label={t("fields.colNumbering.label")}
          value={config.colNumbering}
          onChange={(colNumbering) => set({ colNumbering })}
          options={[
            { value: "left_to_right", label: t("options.colNumbering.leftToRight") },
            { value: "right_to_left", label: t("options.colNumbering.rightToLeft") },
          ]}
        />
      </div>

      <div className="flex flex-col gap-item">
        <Label htmlFor="aud-default-type" className="text-muted-foreground">
          <span>
            {t("fields.defaultSeatType.label")}
            <RequiredMark />
          </span>
        </Label>
        <Select value={config.defaultSeatType} onValueChange={(defaultSeatType) => set({ defaultSeatType })}>
          <SelectTrigger id="aud-default-type" aria-required className={`${CONTROL} w-full`}>
            <SelectValue placeholder={t("fields.defaultSeatType.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {seatTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CollapsibleSection title={t("sections.screen")} defaultOpen>
        <div className="flex flex-col gap-tight">
          <div className="flex items-baseline justify-between gap-group">
            <Label htmlFor="aud-screen-pos" className="text-muted-foreground">
              {t("fields.screenPosition.label")}
            </Label>
            <span className="type-label tabular-nums">{Math.round(config.screen.positionPct)}</span>
          </div>
          <Slider
            id="aud-screen-pos"
            aria-label={t("fields.screenPosition.label")}
            min={0}
            max={100}
            step={1}
            value={[config.screen.positionPct]}
            onValueChange={([positionPct]) => set({ screen: { ...config.screen, positionPct } })}
          />
        </div>

        <div className="flex flex-col gap-tight">
          <div className="flex items-baseline justify-between gap-group">
            <Label htmlFor="aud-screen-width" className="text-muted-foreground">
              {t("fields.screenWidth.label")}
            </Label>
            <span className="type-label tabular-nums">{Math.round(config.screen.widthPct)}</span>
          </div>
          <Slider
            id="aud-screen-width"
            aria-label={t("fields.screenWidth.label")}
            min={30}
            max={100}
            step={1}
            value={[config.screen.widthPct]}
            onValueChange={([widthPct]) => set({ screen: { ...config.screen, widthPct } })}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.screenDistance.label")}</span>
          <ChoiceGroup
            label={t("fields.screenDistance.label")}
            value={config.screen.distance}
            onChange={(distance) => set({ screen: { ...config.screen, distance } })}
            options={[
              { value: "near", label: t("options.distance.near") },
              { value: "medium", label: t("options.distance.medium") },
              { value: "far", label: t("options.distance.far") },
            ]}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.screenShape.label")}</span>
          <ChoiceGroup
            label={t("fields.screenShape.label")}
            value={config.screen.shape ?? "scope"}
            onChange={(shape) => set({ screen: { ...config.screen, shape: shape as ScreenShape } })}
            options={SCREEN_SHAPES.map((value) => ({
              value,
              label: `${t(`options.screenShape.${value}`)} (${dimensionDefaults.screenAspect[value]}:1)`,
            }))}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.screenMount.label")}</span>
          <ChoiceGroup
            label={t("fields.screenMount.label")}
            value={config.screen.mount ?? "mid"}
            onChange={(mount) => set({ screen: { ...config.screen, mount: mount as ScreenMount } })}
            options={SCREEN_MOUNTS.map((value) => ({
              value,
              label: `${t(`options.screenMount.${value}`)} (${dimensionDefaults.screenMount[value]}m)`,
            }))}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.screenTilt.label")}</span>
          <ChoiceGroup
            label={t("fields.screenTilt.label")}
            value={config.screen.tilt ?? "flat"}
            onChange={(tilt) => set({ screen: { ...config.screen, tilt: tilt as ScreenTilt } })}
            options={SCREEN_TILTS.map((value) => ({
              value,
              label: `${t(`options.screenTilt.${value}`)} (${SCREEN_TILT_DEG[value]}°)`,
            }))}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("sections.seating")}>
        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.seatStagger.label")}</span>
          <ChoiceGroup
            label={t("fields.seatStagger.label")}
            value={config.seatStagger ?? "aligned"}
            onChange={(seatStagger) => set({ seatStagger: seatStagger as SeatStagger })}
            options={SEAT_STAGGERS.map((value) => ({ value, label: t(`options.seatStagger.${value}`) }))}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.rowPitch.label")}</span>
          <ChoiceGroup
            label={t("fields.rowPitch.label")}
            value={config.rowPitch ?? "standard"}
            onChange={(rowPitch) => set({ rowPitch: rowPitch as RowPitch })}
            options={ROW_PITCHES.map((value) => ({
              value,
              label: `${t(`options.rowPitch.${value}`)} (${dimensionDefaults.rowPitch[value]}m)`,
            }))}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.seatRecline.label")}</span>
          <ChoiceGroup
            label={t("fields.seatRecline.label")}
            value={config.seatRecline ?? "slight"}
            onChange={(seatRecline) => set({ seatRecline: seatRecline as SeatRecline })}
            options={SEAT_RECLINES.map((value) => ({ value, label: t(`options.seatRecline.${value}`) }))}
          />
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.stepsPerRow.label")}</span>
          <ChoiceGroup
            label={t("fields.stepsPerRow.label")}
            value={config.stadiumFromRow === null ? "0" : String(config.stepsPerRow)}
            options={[
              { value: "0", label: t("options.stepsFlat") },
              ...Array.from({ length: MAX_STEPS_PER_ROW - MIN_STEPS_PER_ROW + 1 }, (_, i) => MIN_STEPS_PER_ROW + i).map((n) => ({
                value: String(n),
                label: `${n} (${Math.round(n * effectiveStepM * 100)}cm)`,
              })),
            ]}
            onChange={(n) =>
              // 0 = flat room: no stadium steps. Any step count raises consecutive rows evenly from row 1.
              set(n === "0" ? { stadiumFromRow: null } : { stepsPerRow: Number(n), stadiumFromRow: 1 })
            }
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("sections.aisles")}>
        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.sideAisles.label")}</span>
          <div className="flex flex-wrap gap-stack">
            {SIDE_AISLES.map((side) => (
              <Chip key={side} selected={sideAisles.includes(side)} onClick={() => toggleSideAisle(side)}>
                {t(`options.sideAisle.${side}`)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.verticalAisles.label")}</span>
          <div className="flex flex-wrap gap-stack">
            {Array.from({ length: config.cols - 1 }, (_, i) => i + 1).map((n) => (
              <Chip
                key={n}
                selected={config.aisles.verticalAfterCols.includes(n)}
                onClick={() => {
                  const verticalAfterCols = toggle(config.aisles.verticalAfterCols, n);
                  const nextFills = fills.filter((f) => verticalAfterCols.includes(f.afterCol));
                  set({
                    aisles: { ...config.aisles, verticalAfterCols },
                    aisleFills: nextFills.length ? nextFills : undefined,
                  });
                }}
                className="tabular-nums"
              >
                {n}
              </Chip>
            ))}
          </div>
        </div>

        {config.aisles.verticalAfterCols.length > 0 ? (
          <div className="flex flex-col gap-field rounded-xl border bg-background p-inset-sm">
            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.aisleFillRow.label")}</span>
              <div className="flex flex-wrap gap-stack">
                {Array.from({ length: config.rows }, (_, i) => i + 1).map((n) => (
                  <Chip key={n} selected={fillRow === n} onClick={() => setFillRow(fillRow === n ? null : n)}>
                    {rowLabel(n - 1, skipIO)}
                    {fills.some((f) => f.rows.includes(n)) ? <span aria-hidden>•</span> : null}
                  </Chip>
                ))}
              </div>
            </div>

            {fillRow !== null ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">
                  {t("fields.aisleFillCols.label", { row: rowLabel(fillRow - 1, skipIO) })}
                </span>
                <div className="flex flex-wrap gap-stack">
                  {[...config.aisles.verticalAfterCols]
                    .sort((a, b) => a - b)
                    .map((col) => (
                      <Chip
                        key={col}
                        selected={fills.some((f) => f.afterCol === col && f.rows.includes(fillRow))}
                        onClick={() => toggleRowAisle(fillRow, col)}
                        className="tabular-nums"
                      >
                        {col}
                      </Chip>
                    ))}
                </div>
              </div>
            ) : null}

            {fills.length > 0 ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">{t("fields.aisleFillSeats.label")}</span>
                <ChoiceGroup
                  label={t("fields.aisleFillSeats.label")}
                  value={String(fillSeats)}
                  onChange={(seats) => set({ aisleFills: fills.map((f) => ({ ...f, seats: Number(seats) })) })}
                  options={Array.from({ length: MAX_FILL_SEATS }, (_, i) => String(i + 1)).map((n) => ({ value: n, label: n }))}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.horizontalAisles.label")}</span>
          <div className="flex flex-wrap gap-stack">
            {Array.from({ length: config.rows - 1 }, (_, i) => i + 1).map((n) => (
              <Chip
                key={n}
                selected={config.aisles.horizontalAfterRows.includes(n)}
                onClick={() => set({ aisles: { ...config.aisles, horizontalAfterRows: toggle(config.aisles.horizontalAfterRows, n) } })}
              >
                {rowLabel(n - 1, skipIO)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-item">
          <span className="type-label leading-none! text-muted-foreground">{t("fields.entrances.label")}</span>
          <div className="flex flex-wrap gap-stack">
            {POSITIONS.flatMap((position) => SIDES.map((side) => ({ side, position }))).map(({ side, position }) => {
              const on = config.entrances.some((e) => e.side === side && e.position === position);
              return (
                <Chip
                  key={`${side}-${position}`}
                  selected={on}
                  onClick={() =>
                    set({
                      entrances: on
                        ? config.entrances.filter((e) => !(e.side === side && e.position === position))
                        : [...config.entrances, { side, position }],
                    })
                  }
                >
                  {t("options.entrance", { side: t(`options.side.${side}`), position: t(`options.position.${position}`) })}
                </Chip>
              );
            })}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
