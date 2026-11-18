import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Clock, ExternalLink, MapPin, ParkingCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { formatVnd } from "@/lib/money";
import { getCinema } from "@/services/cinema.service";
import { PX } from "@/lib/ui-sizes";

type Props = { params: Promise<{ branchId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchId } = await params;
  const cinema = await getCinema(branchId);
  return { title: cinema?.branch.name };
}

export default async function CinemaPage({ params }: Props) {
  await requireUser();
  const { branchId } = await params;
  const cinema = await getCinema(branchId);
  if (!cinema) notFound();
  const t = await getTranslations("cinemas");
  const locale = await getLocale();
  const { branch, brand, rooms } = cinema;
  const parking = [
    branch.parkingFee !== null ? t("parkingFee", { fee: formatVnd(branch.parkingFee, locale) }) : null,
    branch.parkingLocation,
    branch.parkingEntrance,
  ].filter(Boolean);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={branch.name} backHref="/cinemas" />

      {branch.imageUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
          <Image src={branch.imageUrl} alt="" fill sizes={`(max-width: ${PX.column}px) 100vw, ${PX.column}px`} unoptimized className="object-cover" priority />
        </div>
      ) : null}

      <section className="flex flex-col gap-item">
        <p className="type-secondary text-muted-foreground">{brand.name}</p>
        {branch.address ? (
          <p className="flex items-start gap-stack type-body">
            <MapPin className="mt-tight size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
            {branch.address}
            {branch.floor ? ` · ${branch.floor}` : ""}
          </p>
        ) : null}
        {branch.openingHours ? (
          <p className="flex items-start gap-stack type-body">
            <Clock className="mt-tight size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
            {branch.openingHours}
          </p>
        ) : null}
        {parking.length > 0 ? (
          <div className="flex items-start gap-stack type-body">
            <ParkingCircle className="mt-tight size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
            <ul className="flex flex-col gap-tight">
              {parking.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {/* Opens the maps app outside this app (Google Maps and the like), so it is a plain external link. */}
        {branch.mapsUrl ? (
          <Button asChild size="cta" variant="secondary">
            <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("directions")}
            </a>
          </Button>
        ) : null}
      </section>

      <section className="flex flex-col gap-stack">
        <h2 className="type-heading">{t("rooms")}</h2>
        <ul className="flex flex-col gap-stack">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/cinemas/${branch.id}/${room.id}`} className="flex min-h-row items-center gap-item rounded-xl border bg-card px-inset py-inset-sm">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="type-item-title">{room.name}</span>
                  <span className="type-secondary text-muted-foreground">{t("seatCount", { count: room.seatCount })}</span>
                </span>
                <ChevronRight className="size-icon shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
