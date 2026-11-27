import type { Metadata } from "next";
import { StarIcon } from "@solar-icons/react/bold";
import { AltArrowRightIcon, ClapperboardPlayIcon, ClockCircleIcon, GarageIcon, MapPointIcon, SquareTopDownIcon } from "@solar-icons/react/line-duotone";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RemoteImage } from "@/components/remote-image";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { requireUser } from "@/lib/auth/guards";
import { formatVnd } from "@/lib/money";
import { resolveUserBackHref } from "@/lib/user-back-href";
import { getCinema, type CinemaRoom } from "@/services/cinema.service";
import { PX } from "@/lib/ui-sizes";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchId } = await params;
  const cinema = await getCinema(branchId);
  return { title: cinema?.branch.name };
}

export default async function CinemaPage({ params, searchParams }: Props) {
  const [user, { branchId }, sp, t, locale] = await Promise.all([
    requireUser(),
    params,
    searchParams,
    getTranslations("cinemas"),
    getLocale(),
  ]);
  const backHref = resolveUserBackHref(sp.back, "/cinemas");
  const currentUrl = backHref !== "/cinemas" ? `/cinemas/${branchId}?back=${encodeURIComponent(backHref)}` : `/cinemas/${branchId}`;
  const cinema = await getCinema(branchId, user.userId);
  if (!cinema) notFound();
  const { branch, brand, rooms } = cinema;
  const parking = [
    branch.parkingFee !== null ? { key: "fee", text: t("parkingFee", { fee: formatVnd(branch.parkingFee, locale) }) } : null,
    branch.parkingLocation ? { key: "location", text: branch.parkingLocation } : null,
    branch.parkingEntrance ? { key: "entrance", text: branch.parkingEntrance } : null,
  ].filter((item): item is { key: string; text: string } => item !== null);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={branch.name} backHref={backHref} />

      {branch.imageUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
          <RemoteImage src={branch.imageUrl} alt="" fill sizes={`(max-width: ${PX.column}px) 100vw, ${PX.column}px`} className="object-cover" preload />
        </div>
      ) : null}

      <section className="flex flex-col gap-item">
        <div className="flex flex-col gap-tight">
          <p className="type-secondary text-muted-foreground">{brand.name}</p>
          <h2 className="type-heading">{branch.name}</h2>
        </div>
        {branch.address ? (
          <p className="flex items-start gap-item type-body">
            <IconBadge tone="primary">
              <MapPointIcon />
            </IconBadge>
            <span className="pt-tight">
              {branch.address}
              {branch.floor ? ` · ${branch.floor}` : ""}
            </span>
          </p>
        ) : null}
        {branch.openingHours ? (
          <p className="flex items-start gap-item type-body">
            <IconBadge tone="info">
              <ClockCircleIcon />
            </IconBadge>
            <span className="pt-tight">{branch.openingHours}</span>
          </p>
        ) : null}
        {parking.length > 0 ? (
          <div className="flex items-start gap-item type-body">
            <IconBadge tone="warning">
              <GarageIcon />
            </IconBadge>
            <ul className="flex flex-col gap-tight pt-tight">
              {parking.map((line) => (
                <li key={line.key}>{line.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-stack sm:flex-row">
          {/* Opens the maps app outside this app (Google Maps and the like), so it is a plain external link. */}
          {branch.mapsUrl ? (
            <Button asChild size="cta" variant="secondary" className="min-w-0 sm:flex-1">
              <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer">
                <SquareTopDownIcon aria-hidden />
                {t("directions")}
              </a>
            </Button>
          ) : null}
          <Button asChild size="cta" variant="outline" className="min-w-0 sm:flex-1">
            <Link href={`/showtimes?branch=${branch.id}`} prefetch={false}>
              <ClapperboardPlayIcon aria-hidden />
              {t("viewShowtimes")}
            </Link>
          </Button>
        </div>
      </section>

      <section className={rooms.length === 0 ? "flex flex-1 flex-col gap-item" : "flex flex-col gap-item"}>
        <h2 className="type-heading">{t("rooms")}</h2>
        {rooms.length === 0 ? (
          <EmptyState mascot="bubu-sleepy" title={t("emptyRooms")} />
        ) : (
          <ul className="flex flex-col gap-item">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/cinemas/${branch.id}/${room.id}?back=${encodeURIComponent(currentUrl)}`}
                  prefetch={false}
                  className="flex min-h-row items-center gap-item rounded-xl border bg-card px-inset py-inset-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-stack">
                    <span className="flex flex-col">
                      <span className="type-item-title">{room.name}</span>
                      <span className="type-secondary text-muted-foreground tabular-nums">{t("seatCount", { count: room.seatCount })}</span>
                    </span>
                    <RoomTags room={room} locale={locale} />
                  </span>
                  <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** What sets a room apart, as small tags: its special seat types, the formats it shows, and the seats the person marked. */
async function RoomTags({ room, locale }: { room: CinemaRoom; locale: string }) {
  const t = await getTranslations("cinemas");
  const special = (room.seatTypes.length > 1 ? room.seatTypes.slice(1) : room.seatTypes).map((type) => (locale === "en" && type.nameEn ? type.nameEn : type.name));
  if (special.length === 0 && room.formats.length === 0 && room.markCount === 0) return null;
  return (
    <span className="flex flex-wrap gap-stack">
      {room.formats.map((format) => (
        <Badge key={`f-${format}`} variant="outline">
          {format}
        </Badge>
      ))}
      {special.map((name) => (
        <Badge key={`t-${name}`} variant="secondary">
          {name}
        </Badge>
      ))}
      {room.markCount > 0 ? (
        <Badge variant="accent">
          <StarIcon aria-hidden />
          {t("markedSeats", { count: room.markCount })}
        </Badge>
      ) : null}
    </span>
  );
}
