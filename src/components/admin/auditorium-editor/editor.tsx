"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAuditoriumAction, removeAuditoriumAction } from "@/app/admin/auditoriums/actions";
import { DeleteRecordButton } from "@/components/admin/delete-record-button";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { rowLabels } from "@/lib/seat-layout/config";
import { cellKey, cellsOfSeat, patchCells, removedCells, resetCells, type Cell } from "@/lib/seat-layout/overrides";
import type { LayoutConfig, LayoutSeat, SeatFlag, SeatTypeInfo } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";
import { buildLayout } from "@/services/seat-layout-build";
import { SeatsPanel } from "./seats-panel";
import { SettingsPanel } from "./settings-panel";
import type { EditorSeatType, EditorVersion } from "./types";
import { VersionsPanel } from "./versions-panel";

type Tab = "settings" | "seats" | "versions";

/** One height for the map on every tab: switching tabs must not make it jump or resize. */
const MAP_MAX_HEIGHT = "36dvh";

interface Props {
  /** The room being edited, or null when adding one. */
  auditorium: { id: string; name: string; branchId: string } | null;
  branches: { value: string; label: string }[];
  seatTypes: EditorSeatType[];
  initialConfig: LayoutConfig;
  versions: EditorVersion[];
  /** Read-only view of an older version: no editing, only a way to start from it. */
  viewing: { layoutId: string; version: number } | null;
  /** Editing a copy of this older version: saving creates a new version. */
  fromVersion: number | null;
  backHref: string;
  /** `?back=...` to carry over to links within the room's screens. */
  backParam: string;
}

/**
 * The room editor: the map on top (always visible, updates as you type or drag), the controls below in three tabs.
 * Saving sends the whole layout config; the server validates it and, if it changed, stores it as a new version.
 */
export function AuditoriumEditor({ auditorium, branches, seatTypes, initialConfig, versions, viewing, fromVersion, backHref, backParam }: Props) {
  const t = useTranslations("admin.auditoriums.editor");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const readOnly = viewing !== null;
  const editing = auditorium !== null;

  const [tab, setTab] = useState<Tab>(readOnly ? "versions" : "settings");
  const [name, setName] = useState(auditorium?.name ?? "");
  const [branchId, setBranchId] = useState(auditorium?.branchId ?? "");
  const [config, setConfig] = useState(initialConfig);
  const [heat, setHeat] = useState(false);
  const [selected, setSelected] = useState<Map<string, Cell>>(() => new Map());
  const [errors, setErrors] = useState<{ name?: string; branchId?: string }>({});
  const [pending, startSaving] = useTransition();

  const infos = useMemo<SeatTypeInfo[]>(() => seatTypes.map(({ id, name: n, capacity }) => ({ id, name: n, capacity })), [seatTypes]);
  const mapTypes = useMemo<SeatMapSeatType[]>(() => seatTypes.map(({ id, name: n, color }) => ({ id, name: n, color })), [seatTypes]);
  const built = useMemo(() => buildLayout(config, infos), [config, infos]);

  // Cell lookups for the seats tab.
  const seatByCell = useMemo(() => {
    const map = new Map<string, LayoutSeat>();
    for (const seat of built.seats) for (const cell of cellsOfSeat(seat)) map.set(cellKey(cell), seat);
    return map;
  }, [built.seats]);

  const emptyCells = useMemo(
    () =>
      removedCells(config.overrides).flatMap((cell) => {
        const x = built.geometry.colX[built.geometry.colNumbers.indexOf(cell.col)];
        const y = built.geometry.rowY[built.geometry.rowLabels.indexOf(cell.row)];
        return x === undefined || y === undefined ? [] : [{ code: cellKey(cell), x, y }];
      }),
    [config.overrides, built.geometry],
  );

  const selectedCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const key of selected.keys()) {
      const seat = seatByCell.get(key);
      codes.add(seat ? seat.code : key);
    }
    return codes;
  }, [selected, seatByCell]);

  const inSeatsTab = tab === "seats" && !readOnly;

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

  const cellsOfRow = (row: string): Cell[] => Array.from({ length: config.cols }, (_, i) => ({ row, col: i + 1 }));
  const cellsOfCol = (col: number): Cell[] => rowLabels(config.rows).map((row) => ({ row, col }));

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
          toast.success(result.createdVersion ? t("saved", { version: result.version }) : t("savedRename"));
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

  const tabs: { key: Tab; label: string }[] = readOnly
    ? []
    : [
        { key: "settings", label: t("tabs.settings") },
        { key: "seats", label: t("tabs.seats") },
        ...(editing ? [{ key: "versions" as const, label: t("tabs.versions") }] : []),
      ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* The map stays under the title bar while the controls scroll beneath it. */}
      {/* transform-gpu: its own compositor layer, so on iOS the browser only moves it while scrolling instead of repainting the
          whole map at every new position (a sticky block without one lags and jumps behind the scroll). */}
      <div data-scroll-probe className="sticky top-[4.25rem] z-10 -mx-4 flex transform-gpu flex-col gap-1 bg-background px-4 pb-2">
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
        <div className="flex min-h-target items-center justify-between gap-4">
          <Label htmlFor="aud-heat" className="text-muted-foreground">
            {t("heatmap")}
          </Label>
          <Switch id="aud-heat" checked={heat} onCheckedChange={setHeat} />
        </div>
      </div>

      {readOnly ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">{t("versions.readOnly", { version: viewing.version })}</p>
      ) : fromVersion !== null ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">{t("fromVersion", { version: fromVersion })}</p>
      ) : null}

      {tabs.length > 0 ? (
        <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-2">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "h-target flex-1 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === key ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "settings" && !readOnly ? (
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
          onConfig={(update) => {
            setConfig(update);
            // Rows or columns may have shrunk under the selection.
            setSelected(new Map());
          }}
          errors={errors}
        />
      ) : null}

      {tab === "seats" && !readOnly ? (
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

      {tab === "versions" && auditorium ? (
        <VersionsPanel auditoriumId={auditorium.id} versions={versions} viewingId={viewing?.layoutId} summary={built.summary} backParam={backParam} />
      ) : null}

      {/* Room for the fixed bar, so the last control can scroll clear of it. */}
      <div aria-hidden className="h-[calc(var(--spacing-control)+2.5rem)] shrink-0" />

      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-64">
        <div className="mx-auto flex max-w-sm items-center gap-2">
          {readOnly && auditorium ? (
            <Button asChild size="cta" className="pointer-events-auto min-w-0 flex-1">
              <Link href={`/admin/auditoriums/${auditorium.id}?from=${viewing.layoutId}${backParam ? `&${backParam.slice(1)}` : ""}`}>{t("versions.editFromThis")}</Link>
            </Button>
          ) : (
            <>
              {auditorium ? <DeleteRecordButton id={auditorium.id} name={auditorium.name} backHref={backHref} removeAction={removeAuditoriumAction} /> : null}
              <Button type="button" size="cta" disabled={pending} onClick={save} className="pointer-events-auto min-w-0 flex-1">
                {pending ? (
                  <>
                    <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
                    {tc("saving")}
                  </>
                ) : (
                  tc("save")
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
