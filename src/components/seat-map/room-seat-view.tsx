"use client";

import { Ban, Star, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEAT_MARK_TAGS, type SeatMarkKind, type SeatMarkTag } from "@/models/seat-mark-constants";
import type { LayoutSeat } from "@/lib/seat-layout/types";
import type { RoomView } from "@/services/cinema.service";
import type { SeatMarkView } from "@/services/seat-mark.service";
import type { MarkActionResult } from "@/app/(user)/cinemas/actions";

interface Props {
  view: RoomView;
  marks: { active: SeatMarkView[]; old: SeatMarkView[] };
  saveAction: (input: unknown) => Promise<MarkActionResult>;
  removeAction: (auditoriumId: string, seatCode: string) => Promise<MarkActionResult>;
}

type Marks = { active: SeatMarkView[]; old: SeatMarkView[] };
type Change = { type: "save"; mark: SeatMarkView } | { type: "remove"; seatCode: string };

function applyChange(current: Marks, change: Change): Marks {
  const without = (list: SeatMarkView[], code: string) => list.filter((m) => m.seatCode !== code);
  if (change.type === "remove") return { active: without(current.active, change.seatCode), old: without(current.old, change.seatCode) };
  return { active: [...without(current.active, change.mark.seatCode), change.mark], old: without(current.old, change.mark.seatCode) };
}

/**
 * Read-only seat map of a room with two layers (the system's seat score, and my own marks) and an inline panel to mark a seat.
 * The panel is a section of the page, not a sheet: a note field inside a bottom sheet fights the keyboard on an installed iPhone app.
 */
export function RoomSeatView({ view, marks: serverMarks, saveAction, removeAction }: Props) {
  const t = useTranslations("cinemas.room");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const [heat, setHeat] = useState(true);
  const [showMine, setShowMine] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [marks, change] = useOptimistic(serverMarks, applyChange);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const mapTypes = useMemo<SeatMapSeatType[]>(() => view.seatTypes.map(({ id, name, nameEn, color }) => ({ id, name: locale === "en" && nameEn ? nameEn : name, color })), [view.seatTypes, locale]);
  const markByCode = useMemo(() => new Map(marks.active.map((m) => [m.seatCode, m])), [marks.active]);
  const mapMarks = useMemo(() => (showMine ? new Map(marks.active.map((m) => [m.seatCode, m.kind])) : undefined), [marks.active, showMine]);
  const seat = selected ? view.seats.find((s) => s.code === selected) : undefined;
  const selectedSet = useMemo(() => (selected ? new Set([selected]) : undefined), [selected]);

  // Bring the panel into view after a seat is tapped (it sits below the map).
  useEffect(() => {
    if (selected) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  function save(mark: SeatMarkView) {
    startTransition(async () => {
      change({ type: "save", mark });
      const result = await saveAction({ auditoriumId: view.auditorium.id, layoutId: view.layoutId, seatCode: mark.seatCode, kind: mark.kind, tags: mark.tags, note: mark.note || undefined }).catch(() => null);
      if (result?.ok) toast.success(t("saved"));
      else toast.error(t("saveFailed"));
    });
  }

  function remove(seatCode: string) {
    startTransition(async () => {
      change({ type: "remove", seatCode });
      const result = await removeAction(view.auditorium.id, seatCode).catch(() => null);
      if (result?.ok) toast.success(t("removed"));
      else toast.error(t("saveFailed"));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("layers")} className="flex flex-wrap gap-2">
        <Chip selected={heat} onClick={() => setHeat((v) => !v)}>
          {t("layerScore")}
        </Chip>
        <Chip selected={showMine} onClick={() => setShowMine((v) => !v)}>
          <Star className="size-4" aria-hidden />
          {t("layerMine")}
        </Chip>
      </div>

      <SeatMap
        geometry={view.geometry}
        seats={view.seats}
        seatTypes={mapTypes}
        showHeatmap={heat}
        marks={mapMarks}
        selectedCodes={selectedSet}
        onSeatTap={(s) => setSelected((current) => (current === s.code ? null : s.code))}
        maxHeight="55dvh"
      />

      <div ref={panelRef} className="scroll-mb-4">
        {seat ? (
          <SeatPanel
            key={seat.code}
            seat={seat}
            typeName={mapTypes.find((type) => type.id === seat.type)?.name ?? ""}
            existing={markByCode.get(seat.code)}
            onSave={save}
            onRemove={() => remove(seat.code)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("tapSeat")}</p>
        )}
      </div>

      {marks.old.length > 0 ? (
        <section aria-label={t("oldMarks")} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{t("oldMarks")}</h2>
          <p className="text-sm text-muted-foreground">{t("oldMarksDescription")}</p>
          <ul className="flex flex-col gap-2">
            {marks.old.map((mark) => (
              <li key={mark.seatCode} className="flex min-w-0 items-center rounded-xl border bg-card pr-2">
                <div className="flex min-h-row min-w-0 flex-1 flex-col justify-center gap-0.5 py-3 pl-4">
                  <span className="flex items-center gap-2 text-base font-semibold">
                    {mark.kind === "favorite" ? <Star className="size-4 text-yellow-500" aria-hidden /> : <Ban className="size-4 text-destructive" aria-hidden />}
                    {mark.seatCode}
                    <span className="text-sm font-normal text-muted-foreground">{t(mark.kind === "favorite" ? "favorite" : "avoid")}</span>
                  </span>
                  {mark.note ? <span className="break-words text-sm text-muted-foreground">{mark.note}</span> : null}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(mark.seatCode)} aria-label={`${tc("delete")}: ${mark.seatCode}`} className="size-target shrink-0 text-muted-foreground">
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

interface PanelProps {
  seat: LayoutSeat;
  typeName: string;
  existing?: SeatMarkView;
  onSave: (mark: SeatMarkView) => void;
  onRemove: () => void;
  onClose: () => void;
}

function SeatPanel({ seat, typeName, existing, onSave, onRemove, onClose }: PanelProps) {
  const t = useTranslations("cinemas.room");
  const [kind, setKind] = useState<SeatMarkKind | null>(existing?.kind ?? null);
  const [tags, setTags] = useState<SeatMarkTag[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const flags = seat.flags.map((flag) => t(`flags.${flag}`));

  return (
    <section aria-label={t("seatTitle", { code: seat.code })} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl font-semibold">{t("seatTitle", { code: seat.code })}</h2>
          <p className="text-sm text-muted-foreground">{[typeName, t("score", { score: seat.score }), ...flags].filter(Boolean).join(" · ")}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-target shrink-0">
          {t("close")}
        </Button>
      </div>

      <div role="radiogroup" aria-label={t("kindLabel")} className="flex gap-2">
        <Chip role="radio" selected={kind === "favorite"} onClick={() => setKind("favorite")} className="min-w-0 flex-1 px-2">
          <Star className="size-4" aria-hidden />
          {t("favorite")}
        </Chip>
        <Chip role="radio" selected={kind === "avoid"} onClick={() => setKind("avoid")} className="min-w-0 flex-1 px-2">
          <Ban className="size-4" aria-hidden />
          {t("avoid")}
        </Chip>
      </div>

      <div role="group" aria-label={t("tagsLabel")} className="flex flex-wrap gap-2">
        {SEAT_MARK_TAGS.map((tag) => (
          <Chip key={tag} selected={tags.includes(tag)} onClick={() => setTags((c) => (c.includes(tag) ? c.filter((x) => x !== tag) : [...c, tag]))}>
            {t(`tags.${tag}`)}
          </Chip>
        ))}
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        placeholder={t("notePlaceholder")}
        aria-label={t("noteLabel")}
        autoComplete="off"
        enterKeyHint="done"
        className="h-control rounded-xl bg-background px-4 text-base"
      />

      <div className="flex gap-2">
        {existing ? (
          <Button type="button" variant="outline" size="cta" onClick={onRemove} className="w-auto shrink-0 border-destructive/40 text-destructive">
            <Trash2 aria-hidden />
            {t("removeMark")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="cta"
          disabled={kind === null}
          onClick={() => {
            if (!kind) return;
            onSave({ seatCode: seat.code, kind, tags, note: note.trim() });
          }}
          className="min-w-0 flex-1"
        >
          {t("saveMark")}
        </Button>
      </div>
    </section>
  );
}
