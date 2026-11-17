import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { formatVnd } from "@/lib/money";
import { listCinemaGroups } from "@/services/cinema.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cinemas");
  return { title: t("title") };
}

export default async function CinemasPage() {
  await requireUser();
  const t = await getTranslations("cinemas");
  const locale = await getLocale();
  const groups = await listCinemaGroups();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PageHeader title={t("title")} />
      {groups.length === 0 ? (
        <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        groups.map((group) => (
          <section key={group.brand.id} className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">{group.brand.name}</h2>
            <ul className="flex flex-col gap-2">
              {group.branches.map((branch) => (
                <li key={branch.id}>
                  <Link href={`/cinemas/${branch.id}`} className="flex min-h-row flex-col gap-1.5 rounded-xl border bg-card p-4">
                    <span className="text-base font-semibold">{branch.name}</span>
                    {branch.address ? (
                      <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {branch.address}
                      </span>
                    ) : null}
                    <span className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="h-auto py-0.5 text-xs font-medium">
                        {t("roomCount", { count: branch.roomCount })}
                      </Badge>
                      {branch.parkingFee !== null ? (
                        <Badge variant="outline" className="h-auto py-0.5 text-xs font-medium">
                          {t("parkingFee", { fee: formatVnd(branch.parkingFee, locale) })}
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
