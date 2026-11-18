import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { formatVnd } from "@/lib/money";
import { PX } from "@/lib/ui-sizes";
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
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} />
      {groups.length === 0 ? (
        <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        groups.map((group) => (
          <section key={group.brand.id} className="flex flex-col gap-stack">
            <h2 className="type-heading">{group.brand.name}</h2>
            <ul className="flex flex-col gap-stack">
              {group.branches.map((branch) => (
                <li key={branch.id}>
                  <Link href={`/cinemas/${branch.id}`} className="flex min-h-row flex-col overflow-hidden rounded-xl border bg-card">
                    {branch.imageUrl ? (
                      <div className="relative aspect-video w-full bg-muted">
                        <Image src={branch.imageUrl} alt="" fill sizes={`(max-width: ${PX.column}px) 100vw, ${PX.column}px`} unoptimized className="object-cover" />
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-stack p-inset">
                      <span className="type-item-title">{branch.name}</span>
                      {branch.address ? (
                        <span className="flex items-start gap-stack type-secondary text-muted-foreground">
                          <MapPin className="mt-hair size-icon-sm shrink-0" aria-hidden />
                          {branch.address}
                        </span>
                      ) : null}
                      <span className="flex flex-wrap gap-stack">
                        <Badge variant="secondary" className="h-auto py-hair type-tag">
                          {t("roomCount", { count: branch.roomCount })}
                        </Badge>
                        {branch.parkingFee !== null ? (
                          <Badge variant="outline" className="h-auto py-hair type-tag">
                            {t("parkingFee", { fee: formatVnd(branch.parkingFee, locale) })}
                          </Badge>
                        ) : null}
                      </span>
                    </div>
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
