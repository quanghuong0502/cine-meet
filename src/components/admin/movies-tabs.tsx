import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The two lists of the Movies page: the movies, and their showtimes. */
export async function MoviesTabs({ active }: { active: "movies" | "showtimes" }) {
  const t = await getTranslations("admin.movies");
  const tabs = [
    { key: "movies", href: "/admin/movies", label: t("tabs.movies") },
    { key: "showtimes", href: "/admin/movies/showtimes", label: t("tabs.showtimes") },
  ] as const;
  return (
    <nav aria-label={t("tabs.label")} className="flex gap-stack">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "flex h-target items-center rounded-full border px-inset type-label",
            tab.key === active ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
