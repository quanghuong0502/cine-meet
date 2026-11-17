import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditoriumEditor } from "@/components/admin/auditorium-editor/editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { resolveBackHref } from "@/lib/admin/back-href";
import { defaultLayoutConfig } from "@/lib/seat-layout/config";
import type { LayoutConfig } from "@/lib/seat-layout/types";
import { getAuditorium, getLayout, listLayoutVersions } from "@/services/auditorium.service";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { seatTypeService } from "@/services/master-data/seat-type.service";

interface Props {
  /** Null when adding a room. */
  id: string | null;
  /** Layout id to look at read-only. */
  version?: string;
  /** Layout id to start editing from. */
  from?: string;
  back?: string;
}

/** The entry screen of a room (add, edit, or look at an older version): loads what the editor needs. */
export async function AuditoriumEditorScreen({ id, version, from, back }: Props) {
  const t = await getTranslations("admin.auditoriums");
  const locale = await getLocale();
  const backHref = resolveBackHref(back, "/admin/auditoriums");
  const backParam = back ? `?back=${encodeURIComponent(back)}` : "";

  const [branches, brands, types] = await Promise.all([branchService.list({}), getBrandOptions(), seatTypeService.list({})]);
  if (branches.length === 0 || types.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
        <PageHeader title={t("newTitle")} backHref={backHref} />
        <EmptyState
          title={t("needSetup.title")}
          description={t("needSetup.description")}
          action={
            <Button asChild size="pill">
              <Link href="/admin/master-data">{t("needSetup.action")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const branchOptions = branches
    .map((b) => ({ value: b._id.toString(), label: [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  const seatTypes = types.map((type) => ({
    id: type._id.toString(),
    name: locale === "en" && type.nameEn ? type.nameEn : type.name,
    color: type.color ?? null,
    capacity: type.capacity,
  }));

  if (id === null) {
    const defaultType = seatTypes.find((s) => s.capacity === 1) ?? seatTypes[0];
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
        <PageHeader title={t("newTitle")} backHref={backHref} />
        <AuditoriumEditor
          auditorium={null}
          branches={branchOptions}
          seatTypes={seatTypes}
          initialConfig={defaultLayoutConfig(defaultType.id)}
          versions={[]}
          viewing={null}
          fromVersion={null}
          backHref={backHref}
          backParam={backParam}
        />
      </div>
    );
  }

  const room = await getAuditorium(id);
  if (!room) notFound();
  const current = await getLayout(id);
  const target = version ? await getLayout(id, version) : from ? await getLayout(id, from) : current;
  if (!current || !target) notFound();
  const history = await listLayoutVersions(id);
  const viewing = version ? { layoutId: target._id.toString(), version: target.version } : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={viewing ? t("versionTitle", { name: room.name, version: viewing.version }) : room.name} backHref={viewing ? `/admin/auditoriums/${id}${backParam}` : backHref} />
      <AuditoriumEditor
        // Different version or room: start the editor's state from scratch.
        key={`${id}:${target._id.toString()}:${viewing ? "view" : "edit"}`}
        auditorium={{ id, name: room.name, branchId: room.branchId.toString() }}
        branches={branchOptions}
        seatTypes={seatTypes}
        initialConfig={target.config as LayoutConfig}
        versions={history.map((v) => ({ id: v.id, version: v.version, seatCount: v.seatCount, createdAt: v.createdAt.toISOString(), current: v.id === current._id.toString() }))}
        viewing={viewing}
        fromVersion={!viewing && from && target._id.toString() !== current._id.toString() ? target.version : null}
        backHref={backHref}
        backParam={backParam}
      />
    </div>
  );
}
