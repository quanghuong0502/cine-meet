import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ResourceManager } from "@/components/admin/resource-manager";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { listAuditoriums } from "@/services/auditorium.service";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { removeAuditoriumAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.auditoriums");
  return { title: t("title") };
}

export default async function AdminAuditoriumsPage({ searchParams }: { searchParams: Promise<{ q?: string; branch?: string }> }) {
  const t = await getTranslations("admin.auditoriums");
  const { q = "", branch: activeBranch = "" } = await searchParams;
  const [rooms, branches, brands] = await Promise.all([listAuditoriums(), branchService.list({}), getBrandOptions()]);

  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const branchInfo = new Map(branches.map((b) => [b._id.toString(), { name: b.name, brand: brandName.get(b.brandId.toString()) ?? "" }]));
  const branchChips = branches
    .filter((b) => rooms.some((r) => r.branchId === b._id.toString()))
    .map((b) => ({
      id: b._id.toString(),
      label: [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

  const term = q.trim().toLowerCase();
  const items = rooms
    .filter((room) => !activeBranch || room.branchId === activeBranch)
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
      meta: [t("seatCount", { count: room.seatCount })],
    }));

  const chipHref = (branchId?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (branchId) params.set("branch", branchId);
    return params.size ? `/admin/auditoriums?${params}` : "/admin/auditoriums";
  };

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} description={t("description")} />
      {branchChips.length >= 2 ? (
        <nav aria-label={t("branchFilterLabel")} className="scroll-strip flex gap-stack pb-tight">
          <Link
            href={chipHref()}
            replace
            scroll={false}
            className={cn(
              "inline-flex min-h-target shrink-0 items-center rounded-full border px-inset-sm type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              !activeBranch ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t("allBranches")}
          </Link>
          {branchChips.map((chip) => (
            <Link
              key={chip.id}
              href={chipHref(chip.id)}
              replace
              scroll={false}
              className={cn(
                "inline-flex min-h-target shrink-0 items-center rounded-full border px-inset-sm type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                activeBranch === chip.id ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
            </Link>
          ))}
        </nav>
      ) : null}
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
