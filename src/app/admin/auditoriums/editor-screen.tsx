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
import { getAuditorium, getLayout } from "@/services/auditorium.service";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { seatTypeService } from "@/services/master-data/seat-type.service";

interface Props {
  /** Null when adding a room. */
  id: string | null;
  back?: string;
}

/** The entry screen of a room (add or edit): loads what the editor needs. */
export async function AuditoriumEditorScreen({ id, back }: Props) {
  const t = await getTranslations("admin.auditoriums");
  const locale = await getLocale();
  const backHref = resolveBackHref(back, "/admin/auditoriums");

  const [branches, brands, types] = await Promise.all([branchService.list({}), getBrandOptions(), seatTypeService.list({})]);
  if (branches.length === 0 || types.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("newTitle")} backHref={backHref} hideTitle />
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
  // Switched-off branches are not offered for a new room; a room that already belongs to one keeps it in the list.
  const optionsFor = (currentBranchId?: string) =>
    branches
      .filter((b) => b.active !== false || b._id.toString() === currentBranchId)
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
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("newTitle")} backHref={backHref} hideTitle />
        <AuditoriumEditor
          auditorium={null}
          branches={optionsFor()}
          seatTypes={seatTypes}
          initialConfig={defaultLayoutConfig(defaultType.id)}
          backHref={backHref}
        />
      </div>
    );
  }

  const room = await getAuditorium(id);
  if (!room) notFound();
  const current = await getLayout(id);
  if (!current) notFound();

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={room.name} backHref={backHref} hideTitle />
      <AuditoriumEditor
        // Another room: start the editor's state from scratch.
        key={id}
        auditorium={{ id, name: room.name, branchId: room.branchId.toString() }}
        branches={optionsFor(room.branchId.toString())}
        seatTypes={seatTypes}
        initialConfig={current.config as LayoutConfig}
        backHref={backHref}
      />
    </div>
  );
}
