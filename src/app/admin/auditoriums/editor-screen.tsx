import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditoriumEditor } from "@/components/admin/auditorium-editor/editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Button } from "@/components/ui/button";
import { resolveBackHref } from "@/lib/admin/back-href";
import { defaultLayoutConfig } from "@/lib/seat-layout/config";
import type { LayoutConfig, SeatStyle } from "@/lib/seat-layout/types";
import { getAuditorium, getLayoutConfigById } from "@/services/auditorium.service";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";
import { getRoom3DAppearance } from "@/services/room-3d-appearance.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { getCachedBranches } from "@/services/master-data/catalog-cache";
import { seatTypeService } from "@/services/master-data/seat-type.service";

interface Props {
  /** Null when adding a room. */
  id: string | null;
  back?: string;
}

/** The entry screen of a room (add or edit): loads what the editor needs. */
export async function AuditoriumEditorScreen({ id, back }: Props) {
  const backHref = resolveBackHref(back, "/admin/auditoriums");

  const [t, locale, branches, brands, types, dimensionDefaults, room3dAppearance, room] = await Promise.all([
    getTranslations("admin.auditoriums"),
    getLocale(),
    getCachedBranches(),
    getBrandOptions(),
    seatTypeService.list({}),
    getCinemaDimensions(),
    getRoom3DAppearance(),
    id ? getAuditorium(id) : Promise.resolve(null),
  ]);
  if (id !== null && !room) notFound();
  if (branches.length === 0 || types.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
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
  // Switched-off branches are not offered for a new room; a room that already belongs to one keeps it in the list.
  const optionsFor = (currentBranchId?: string) =>
    branches
      .filter((b) => b.active || b.id === currentBranchId)
      .map((b) => ({ value: b.id, label: [brandName.get(b.brandId), b.name].filter(Boolean).join(" · ") }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  const seatTypes = types.map((type) => ({
    id: type._id.toString(),
    name: locale === "en" && type.nameEn ? type.nameEn : type.name,
    color: type.color ?? null,
    color3d: type.color3d ?? null,
    capacity: type.capacity,
    style: (type.style as SeatStyle | undefined) ?? "standard",
  }));

  if (id === null) {
    const defaultType = seatTypes.find((s) => s.capacity === 1) ?? seatTypes[0];
    return (
      <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.auditoriums.editor", "seatMap", "cinemas.room"]}>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
          <PageHeader title={t("newTitle")} backHref={backHref} />
          <AuditoriumEditor
            auditorium={null}
            branches={optionsFor()}
            seatTypes={seatTypes}
            initialConfig={defaultLayoutConfig(defaultType.id)}
            dimensionDefaults={dimensionDefaults}
            room3dAppearance={room3dAppearance}
            backHref={backHref}
          />
        </div>
      </ScopedIntlProvider>
    );
  }

  const currentConfig = room?.currentLayoutId ? await getLayoutConfigById(room.currentLayoutId.toString()) : null;
  if (!room || !currentConfig) notFound();

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.auditoriums.editor", "seatMap", "cinemas.room"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={room.name} backHref={backHref} />
        <AuditoriumEditor
          // Another room: start the editor's state from scratch.
          key={id}
          auditorium={{ id, name: room.name, branchId: room.branchId.toString() }}
          branches={optionsFor(room.branchId.toString())}
          seatTypes={seatTypes}
          initialConfig={currentConfig as LayoutConfig}
          dimensionDefaults={dimensionDefaults}
          room3dAppearance={room3dAppearance}
          backHref={backHref}
        />
      </div>
    </ScopedIntlProvider>
  );
}
