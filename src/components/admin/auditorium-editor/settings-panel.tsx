"use client";

import { useTranslations } from "next-intl";
import { RequiredMark } from "@/components/required-mark";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { MAX_COLS, MAX_ROWS, MAX_STEPS_PER_ROW, MIN_STEPS_PER_ROW, rowLabel } from "@/lib/seat-layout/config";
import { pruneConfig } from "@/lib/seat-layout/overrides";
import type { EntrancePosition, EntranceSide, LayoutConfig } from "@/lib/seat-layout/types";
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
  onConfig: (update: (current: LayoutConfig) => LayoutConfig) => void;
  /** Error codes by field name, already known to be translatable. */
  errors: { name?: string; branchId?: string };
}

function toggle(list: number[], n: number): number[] {
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b);
}

/** The "Settings" tab: every number and choice of the room's layout (design 2.2). Each change updates the map above at once. */
export function SettingsPanel({ name, onName, branchId, onBranch, branchLocked, branches, seatTypes, config, onConfig, errors }: Props) {
  const t = useTranslations("admin.auditoriums.editor");
  const tv = useTranslations("admin.validation");
  const set = (patch: Partial<LayoutConfig>) => onConfig((c) => ({ ...c, ...patch }));
  const resize = (patch: Partial<Pick<LayoutConfig, "rows" | "cols">>) => onConfig((c) => pruneConfig({ ...c, ...patch }));
  const err = (code?: string) => (code ? tv(code === "too_long" ? "too_long" : "required") : null);

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

      <div className="grid grid-cols-2 gap-group">
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
        <span className="type-label leading-none! text-muted-foreground">{t("fields.stepsPerRow.label")}</span>
        <ChoiceGroup
          label={t("fields.stepsPerRow.label")}
          value={config.stadiumFromRow === null ? "0" : String(config.stepsPerRow)}
          options={[
            { value: "0", label: "0" },
            ...Array.from({ length: MAX_STEPS_PER_ROW - MIN_STEPS_PER_ROW + 1 }, (_, i) => String(MIN_STEPS_PER_ROW + i)).map((n) => ({ value: n, label: n })),
          ]}
          onChange={(n) =>
            // 0 = flat room: no stadium row. Any steps count turns the stadium on, from the front row unless a row was already set.
            set(n === "0" ? { stadiumFromRow: null } : { stepsPerRow: Number(n), stadiumFromRow: config.stadiumFromRow ?? 1 })
          }
        />
      </div>

      {config.stadiumFromRow !== null ? (
        <div className="flex flex-col gap-item">
          <Label htmlFor="aud-stadium" className="text-muted-foreground">
            {t("fields.stadiumFromRow.label")}
          </Label>
          <NumberField
            id="aud-stadium"
            value={config.stadiumFromRow}
            min={1}
            max={config.rows}
            placeholder={t("fields.stadiumFromRow.placeholder")}
            onChange={(stadiumFromRow) => set({ stadiumFromRow: stadiumFromRow ?? 1 })}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-item">
        <span className="type-label leading-none! text-muted-foreground">{t("fields.verticalAisles.label")}</span>
        <div className="flex flex-wrap gap-stack">
          {Array.from({ length: config.cols - 1 }, (_, i) => i + 1).map((n) => (
            <Chip
              key={n}
              selected={config.aisles.verticalAfterCols.includes(n)}
              onClick={() => set({ aisles: { ...config.aisles, verticalAfterCols: toggle(config.aisles.verticalAfterCols, n) } })}
              className="tabular-nums"
            >
              {n}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-item">
        <span className="type-label leading-none! text-muted-foreground">{t("fields.horizontalAisles.label")}</span>
        <div className="flex flex-wrap gap-stack">
          {Array.from({ length: config.rows - 1 }, (_, i) => i + 1).map((n) => (
            <Chip
              key={n}
              selected={config.aisles.horizontalAfterRows.includes(n)}
              onClick={() => set({ aisles: { ...config.aisles, horizontalAfterRows: toggle(config.aisles.horizontalAfterRows, n) } })}
            >
              {rowLabel(n - 1)}
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
    </div>
  );
}
