import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResourceManager } from "@/components/admin/resource-manager";
import { PageHeader } from "@/components/page-header";
import { listAuditoriums } from "@/services/auditorium.service";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { removeAuditoriumAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.auditoriums");
  return { title: t("title") };
}

export default async function AdminAuditoriumsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("admin.auditoriums");
  const { q = "" } = await searchParams;
  const [rooms, branches, brands] = await Promise.all([listAuditoriums(), branchService.list({}), getBrandOptions()]);

  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const branchInfo = new Map(branches.map((b) => [b._id.toString(), { name: b.name, brand: brandName.get(b.brandId.toString()) ?? "" }]));

  const term = q.trim().toLowerCase();
  const items = rooms
    .map((room) => {
      const branch = branchInfo.get(room.branchId);
      return { room, where: [branch?.brand, branch?.name].filter(Boolean).join(" · ") };
    })
    .filter(({ room, where }) => !term || `${room.name} ${where}`.toLowerCase().includes(term))
    .sort((a, b) => a.where.localeCompare(b.where, "vi") || a.room.name.localeCompare(b.room.name, "vi"))
    .map(({ room, where }) => ({
      id: room.id,
      title: room.name,
      subtitle: where || undefined,
      meta: [t("seatCount", { count: room.seatCount }), t("versionBadge", { version: room.version })],
    }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} description={t("description")} />
      <ResourceManager
        basePath="/admin/auditoriums"
        query={q}
        searchLabels={{ placeholder: t("searchPlaceholder"), label: t("searchLabel") }}
        labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
        items={items}
        removeAction={removeAuditoriumAction}
      />
    </div>
  );
}
