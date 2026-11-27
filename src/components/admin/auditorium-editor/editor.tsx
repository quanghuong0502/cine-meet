"use client";

import { AltArrowDownIcon, AltArrowUpIcon, CopyIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAuditoriumAction, removeAuditoriumAction } from "@/app/admin/auditoriums/actions";
import { DeleteRecordButton } from "@/components/admin/delete-record-button";
import { LoadingState } from "@/components/loading-state";
import { preloadRoom3D } from "@/components/seat-map/preload-room-3d";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_STEPS_PER_ROW, rowLabels } from "@/lib/seat-layout/config.constants";
import { DEFAULT_CINEMA_DIMENSIONS, type CinemaDimensionDefaults } from "@/lib/seat-layout/dimensions.defaults";
import { cellKey, cellsOfSeat, patchCells, removedCells, resetCells, type Cell } from "@/lib/seat-layout/overrides";
import { DEFAULT_ROOM_3D_APPEARANCE, type Room3DAppearance } from "@/lib/seat-layout/room-3d-appearance.defaults";
import type { Room3DConfig, SceneSeatType } from "@/lib/seat-layout/scene";
import type { LayoutConfig, LayoutSeat, SeatFlag, SeatTypeInfo } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";
import { buildLayoutPreview } from "@/services/seat-layout-build";
import { SeatsPanel } from "./seats-panel";
import { SettingsPanel } from "./settings-panel";
import type { EditorSeatType } from "./types";

const Room3DView = dynamic(() => import("@/components/seat-map/room-3d-view").then((m) => m.Room3DView), {
  ssr: false,
  loading: () => (
    <div
      style={{ aspectRatio: "4 / 3", maxHeight: MAP_MAX_HEIGHT }}
      className="relative flex w-full items-center justify-center rounded-xl border bg-card"
    >
      <LoadingState compact className="h-full min-h-0" />
    </div>
  ),
});

type Tab = "settings" | "seats";

/** One height for the map on every tab: switching tabs must not make it jump or resize. */
const MAP_MAX_HEIGHT = "36dvh";

interface Props {
  /** The room being edited, or null when adding one. */
  auditorium: { id: string; name: string; branchId: string } | null;
  /** Default branch preselected when duplicating an existing room. */
  initialBranchId?: string;
  branches: { value: string; label: string }[];
  seatTypes: EditorSeatType[];
  initialConfig: LayoutConfig;
  dimensionDefaults?: CinemaDimensionDefaults;
  room3dAppearance?: Room3DAppearance;
  brandName?: string;
  backHref: string;
}

/**
 * The room editor: the map on top (always visible, updates as you type or drag), the controls below in three tabs.
 * Saving sends the whole layout config; the server validates it and stores it (a changed layout becomes a new version in the
 * data; the screen does not show versions).
 */
export function AuditoriumEditor({
  auditorium,
  initialBranchId,
  branches,
  seatTypes,
  initialConfig,
  dimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
  room3dAppearance = DEFAULT_ROOM_3D_APPEARANCE,
  brandName,
  backHref,
}: Props) {
  const t = useTranslations("admin.auditoriums.editor");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const editing = auditorium !== null;

  const [tab, setTab] = useState<Tab>("settings");
  const [name, setName] = useState(auditorium?.name ?? "");
  const [branchId, setBranchId] = useState(auditorium?.branchId ?? initialBranchId ?? "");
  const [config, setConfig] = useState(initialConfig);
  const deferredConfig = useDeferredValue(config);
  const [heat, setHeat] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [config3d, setConfig3d] = useState(initialConfig);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [previewSeat, setPreviewSeat] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, Cell>>(() => new Map());
  const [errors, setErrors] = useState<{ name?: string; branchId?: string }>({});
  const [pending, startSaving] = useTransition();

  // Debounce 3D scene rebuilds while editing settings so dragging sliders never destroys/recreates WebGL per tick.
  useEffect(() => {
    if (!view3d) return;
    const id = window.setTimeout(() => setConfig3d(config), 180);
    return () => window.clearTimeout(id);
  }, [config, view3d]);

  const infos = useMemo<SeatTypeInfo[]>(() => seatTypes.map(({ id, name: n, capacity, style }) => ({ id, name: n, capacity, style })), [seatTypes]);
  const mapTypes = useMemo<SeatMapSeatType[]>(() => seatTypes.map(({ id, name: n, color }) => ({ id, name: n, color })), [seatTypes]);
  const sceneTypes = useMemo<SceneSeatType[]>(() => seatTypes.map(({ id, color, color3d, style }) => ({ id, color, color3d, style })), [seatTypes]);
  const built = useMemo(() => buildLayoutPreview(deferredConfig, infos, dimensionDefaults), [deferredConfig, infos, dimensionDefaults]);
  const built3d = useMemo(
    () => (view3d ? (config3d === deferredConfig ? built : buildLayoutPreview(config3d, infos, dimensionDefaults)) : null),
    [view3d, config3d, deferredConfig, built, infos, dimensionDefaults],
  );
  const room3dConfig = useMemo<Room3DConfig>(
    () => ({
      stadiumFromRow: config3d.stadiumFromRow,
      stepsPerRow: config3d.stepsPerRow ?? DEFAULT_STEPS_PER_ROW,
      screenDistance: config3d.screen.distance,
      screenShape: config3d.screen.shape,
      screenMount: config3d.screen.mount,
      screenTilt: config3d.screen.tilt,
      screenCurved: Boolean(config3d.screen.curved),
      seatRecline: config3d.seatRecline,
      rowCurve: config3d.rowCurve ?? "straight",
      seatStagger: config3d.seatStagger ?? "aligned",
      rowPitch: config3d.rowPitch ?? "standard",
      dimensions: config3d.dimensions,
      defaults: dimensionDefaults,
    }),
    [
      config3d.stadiumFromRow,
      config3d.stepsPerRow,
      config3d.screen.distance,
      config3d.screen.shape,
      config3d.screen.mount,
      config3d.screen.tilt,
      config3d.screen.curved,
      config3d.seatRecline,
      config3d.rowCurve,
      config3d.seatStagger,
      config3d.rowPitch,
      config3d.dimensions,
      dimensionDefaults,
    ],
  );

  // Cell lookups for the seats tab.
  const seatByCell = useMemo(() => {
    const map = new Map<string, LayoutSeat>();
    for (const seat of built.seats) for (const cell of cellsOfSeat(seat)) map.set(cellKey(cell), seat);
    return map;
  }, [built.seats]);

  const emptyCells = useMemo(
    () =>
      removedCells(deferredConfig.overrides).flatMap((cell) => {
        const x =
          built.geometry.rowSlots?.[cell.row]?.find((slot) => slot.col === cell.col)?.x ??
          built.geometry.colX[built.geometry.colNumbers.indexOf(cell.col)];
        const y = built.geometry.rowY[built.geometry.rowLabels.indexOf(cell.row)];
        return x === undefined || y === undefined ? [] : [{ code: cellKey(cell), x, y }];
      }),
    [deferredConfig.overrides, built.geometry],
  );

  const selectedCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const key of selected.keys()) {
      const seat = seatByCell.get(key);
      codes.add(seat ? seat.code : key);
    }
    return codes;
  }, [selected, seatByCell]);

  const inSeatsTab = tab === "seats";

  function toggleCells(cells: Cell[]) {
    setSelected((current) => {
      const next = new Map(current);
      const all = cells.every((c) => next.has(cellKey(c)));
      for (const c of cells) {
        if (all) next.delete(cellKey(c));
        else next.set(cellKey(c), c);
      }
      return next;
    });
  }

  const { rowSlots, colX, colNumbers } = built.geometry;
  const cellsOfRow = (row: string): Cell[] =>
    rowSlots?.[row]
      ? rowSlots[row].map((slot) => ({ row, col: slot.col }))
      : Array.from({ length: config.cols }, (_, i) => ({ row, col: i + 1 }));
  const cellsOfCol = (col: number): Cell[] => {
    const x = colX[colNumbers.indexOf(col)];
    return rowLabels(config.rows, config.skipRowLetters).flatMap((row) => {
      if (rowSlots?.[row]) {
        const slot = rowSlots[row].find((s) => Math.abs(s.x - x) < 0.01);
        return slot ? [{ row, col: slot.col }] : [];
      }
      return [{ row, col }];
    });
  };

  const targets = [...selected.values()];
  const apply = (patch: Parameters<typeof patchCells>[2]) => setConfig((c) => ({ ...c, overrides: patchCells(c.overrides, targets, patch, c.defaultSeatType) }));
  const typeOf = (key: string) => {
    const seat = seatByCell.get(key);
    return seat ? seat.type : "none";
  };

  function save() {
    const next: { name?: string; branchId?: string } = {};
    if (!name.trim()) next.name = "required";
    if (!editing && !branchId) next.branchId = "required";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setTab("settings");
      return;
    }
    startSaving(async () => {
      try {
        const result = await saveAuditoriumAction({ id: auditorium?.id, branchId: branchId || auditorium?.branchId || "", name, config });
        if (result.status === "success") {
          toast.success(tc("saved"));
          router.replace(backHref);
          return;
        }
        if (result.fieldErrors) {
          setErrors({ name: result.fieldErrors.name, branchId: result.fieldErrors.branchId });
          setTab("settings");
        }
        toast.error(tc(`errors.${result.error}`));
      } catch {
        // The request itself failed (no connection): nothing was lost, the layout stays on screen to try again.
        toast.error(tc("errors.unknown"));
      }
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: t("tabs.settings") },
    { key: "seats", label: t("tabs.seats") },
  ];

  const previewSeatObj = previewSeat ? built.seats.find((s) => s.code === previewSeat) : undefined;
  const previewSeatInSelection = Boolean(previewSeat && selectedCodes.has(previewSeat));
  const seatAction3D =
    inSeatsTab && previewSeatObj
      ? {
          label: previewSeatInSelection
            ? t("deselectSeat3d", { code: previewSeatObj.code })
            : t("selectSeat3d", { code: previewSeatObj.code }),
          active: previewSeatInSelection,
          onAction: () => toggleCells(cellsOfSeat(previewSeatObj)),
        }
      : undefined;

  return (
    <div className="flex flex-1 flex-col gap-group">
      <div className="flex flex-col gap-group lg:grid lg:grid-cols-[minmax(0,1fr)_var(--container-form)] lg:items-start lg:gap-section">
        {/* The map stays under the title bar while the controls scroll beneath it on phones, or beside them on wide screens. */}
        {/* transform-gpu: its own compositor layer, so on iOS the browser only moves it while scrolling instead of repainting the
            whole map at every new position (a sticky block without one lags and jumps behind the scroll). */}
        <div data-scroll-probe className="sticky top-target z-10 -mx-inset flex transform-gpu flex-col gap-tight bg-background px-inset pb-inset-xs lg:mx-0 lg:px-0">
          {!mapCollapsed || inSeatsTab ? (
            view3d && built3d ? (
              <Room3DView
                layoutKey={auditorium?.id ?? "new-auditorium"}
                seats={built3d.seats}
                geometry={built3d.geometry}
                roomConfig={room3dConfig}
                appearance={room3dAppearance}
                roomMeta={{ roomName: name || auditorium?.name, brandName }}
                seatTypes={sceneTypes}
                highlightedCodes={inSeatsTab ? selectedCodes : undefined}
                seatAction={seatAction3D}
                maxHeight={MAP_MAX_HEIGHT}
                heat={heat}
                selected={previewSeat}
                onSelect={setPreviewSeat}
                onSwitch2D={() => setView3d(false)}
              />
            ) : (
              <SeatMap
                geometry={built.geometry}
                seats={built.seats}
                seatTypes={mapTypes}
                showHeatmap={heat}
                maxHeight={MAP_MAX_HEIGHT}
                selectedCodes={inSeatsTab ? selectedCodes : undefined}
                emptyCells={inSeatsTab ? emptyCells : undefined}
                onSeatTap={inSeatsTab ? (seat) => toggleCells(cellsOfSeat(seat)) : undefined}
                onEmptyTap={
                  inSeatsTab
                    ? (code) => {
                        const cell = removedCells(config.overrides).find((c) => cellKey(c) === code);
                        if (cell) toggleCells([cell]);
                      }
                    : undefined
                }
                onRowTap={inSeatsTab ? (row) => toggleCells(cellsOfRow(row)) : undefined}
                onColTap={inSeatsTab ? (col) => toggleCells(cellsOfCol(col)) : undefined}
              />
            )
          ) : null}
          <div className="flex min-h-target flex-wrap items-center justify-between gap-stack">
            <div className="flex items-center gap-stack">
              <Label htmlFor="aud-heat" className="text-muted-foreground">
                {t("heatmap")}
              </Label>
              <Switch id="aud-heat" checked={heat} onCheckedChange={setHeat} />
              <span className="rounded-full bg-muted px-inset-xs py-hair type-caption text-muted-foreground tabular-nums">
                {t("seatCount", { count: built.seats.length })}
              </span>
            </div>
            <div
              className="flex items-center gap-stack"
              onPointerEnter={preloadRoom3D}
              onTouchStart={preloadRoom3D}
              onFocus={preloadRoom3D}
            >
              <Label htmlFor="aud-3d" className="text-muted-foreground">
                {t("view3d")}
              </Label>
              <Switch
                id="aud-3d"
                checked={view3d}
                onCheckedChange={(next) => {
                  if (next) setConfig3d(config);
                  setView3d(next);
                }}
              />
              {!inSeatsTab ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMapCollapsed((v) => !v)}
                  aria-label={mapCollapsed ? t("showMap") : t("hideMap")}
                  aria-expanded={!mapCollapsed}
                  className="text-muted-foreground lg:hidden"
                >
                  {mapCollapsed ? <AltArrowDownIcon aria-hidden /> : <AltArrowUpIcon aria-hidden />}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-group">
          <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-stack">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "h-target flex-1 rounded-full border px-inset-sm type-label transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                  tab === key ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "settings" ? (
            <SettingsPanel
              name={name}
              onName={(v) => {
                setName(v);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              branchId={branchId}
              onBranch={(v) => {
                setBranchId(v);
                if (errors.branchId) setErrors((e) => ({ ...e, branchId: undefined }));
              }}
              branchLocked={editing}
              branches={branches}
              seatTypes={seatTypes}
              config={config}
              dimensionDefaults={dimensionDefaults}
              onConfig={(update) => {
                const next = update(config);
                setConfig(next);
                if (
                  next.rows !== config.rows ||
                  next.cols !== config.cols ||
                  next.skipRowLetters !== config.skipRowLetters
                ) {
                  setSelected(new Map());
                }
              }}
              errors={errors}
            />
          ) : null}

          {tab === "seats" ? (
            <SeatsPanel
              seatTypes={seatTypes}
              selectedCount={selected.size}
              allHaveFlag={(flag: SeatFlag) => targets.every((c) => seatByCell.get(cellKey(c))?.flags.includes(flag))}
              allHaveType={(type) => targets.every((c) => typeOf(cellKey(c)) === type)}
              onType={(type) => apply({ type })}
              onFlag={(name, on) => apply({ flag: { name, on } })}
              onReset={() => setConfig((c) => ({ ...c, overrides: resetCells(c.overrides, targets) }))}
              onClear={() => setSelected(new Map())}
            />
          ) : null}
        </div>
      </div>

      {/* Room for the fixed bar, so the last control can scroll clear of it. */}
      <div aria-hidden className="h-save-clear shrink-0" />

      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom) md:left-sidebar">
        <div className="mx-auto flex max-w-form items-center gap-stack">
          {auditorium ? <DeleteRecordButton id={auditorium.id} name={auditorium.name} backHref={backHref} removeAction={removeAuditoriumAction} /> : null}
          {auditorium ? (
            <Button
              asChild
              variant="outline"
              size="cta"
              className="pointer-events-auto w-auto shrink-0 bg-background px-inset-sm"
            >
              <Link
                href={`/admin/auditoriums/new?from=${auditorium.id}&back=${encodeURIComponent(backHref)}`}
                aria-label={t("duplicate")}
              >
                <CopyIcon aria-hidden />
                <span className="hidden sm:inline">{t("duplicate")}</span>
              </Link>
            </Button>
          ) : null}
          <Button type="button" size="cta" disabled={pending} onClick={save} className="pointer-events-auto min-w-0 flex-1">
            {pending ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
                {tc("saving")}
              </>
            ) : (
              tc("save")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
