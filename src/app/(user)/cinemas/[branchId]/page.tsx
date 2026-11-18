import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Clock, ExternalLink, MapPin, ParkingCircle, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { formatVnd } from "@/lib/money";
import { getCinema, type CinemaRoom } from "@/services/cinema.service";
import { PX } from "@/lib/ui-sizes";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ branchId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchId } = await params;
  const cinema = await getCinema(branchId);
  return { title: cinema?.branch.name };
}

export default async function CinemaPage({ params }: Props) {
  const user = await requireUser();
  const { branchId } = await params;
  const cinema = await getCinema(branchId, user.userId);
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
      <PageHeader backHref="/cinemas" />

      {branch.imageUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
          <Image src={branch.imageUrl} alt="" fill sizes={`(max-width: ${PX.column}px) 100vw, ${PX.column}px`} unoptimized className="object-cover" priority />
        </div>
      ) : null}

      <section className="flex flex-col gap-item">
        <div className="flex flex-col gap-tight">
          <p className="type-secondary text-muted-foreground">{brand.name}</p>
          <h1 className="type-heading">{branch.name}</h1>
        </div>
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
                <span className="flex min-w-0 flex-1 flex-col gap-stack">
                  <span className="flex flex-col">
                    <span className="type-item-title">{room.name}</span>
                    <span className="type-secondary text-muted-foreground">{t("seatCount", { count: room.seatCount })}</span>
                  </span>
                  <RoomTags room={room} locale={locale} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** What sets a room apart, as small tags: its special seat types (all but the ordinary one), the formats it shows, and the seats the person marked. */
async function RoomTags({ room, locale }: { room: CinemaRoom; locale: string }) {
  const t = await getTranslations("cinemas");
  const special = room.seatTypes.slice(1).map((type) => (locale === "en" && type.nameEn ? type.nameEn : type.name));
  if (special.length === 0 && room.formats.length === 0 && room.markCount === 0) return null;
  return (
    <span className="flex flex-wrap gap-stack">
      {room.formats.map((format) => (
        <Badge key={`f-${format}`} variant="outline" className="h-auto py-hair type-tag">
          {format}
        </Badge>
      ))}
      {special.map((name) => (
        <Badge key={`t-${name}`} variant="secondary" className="h-auto py-hair type-tag">
          {name}
        </Badge>
      ))}
      {room.markCount > 0 ? (
        <Badge variant="secondary" className="h-auto py-hair type-tag">
          <Star aria-hidden />
          {t("markedSeats", { count: room.markCount })}
        </Badge>
      ) : null}
    </span>
  );
}
