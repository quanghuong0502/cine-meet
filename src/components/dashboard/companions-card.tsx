import { HandHeartIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { IconBadge } from "@/components/ui/icon-badge";
import { UserAvatar } from "@/components/user-avatar";
import { PX } from "@/lib/ui-sizes";
import type { CompanionStat } from "@/services/dashboard.service";

/** Who this person has watched with the most (design 3.1), built only from their own completed appointments. */
export function CompanionsCard({ companions }: { companions: CompanionStat[] }) {
  const t = useTranslations("dashboard.companions");
  if (companions.length === 0) return null;
  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <div className="flex items-center gap-item">
        <IconBadge tone="primary">
          <HandHeartIcon />
        </IconBadge>
        <h2 className="type-heading">{t("title")}</h2>
      </div>
      <ul className="flex flex-col gap-group">
        {companions.map((c) => (
          <li key={c.id} className="flex items-center gap-item">
            <UserAvatar name={c.name} image={c.avatar} size={PX.avatar} />
            <span title={c.name} className="min-w-0 flex-1 truncate type-item-title">{c.name}</span>
            <span className="type-secondary text-muted-foreground tabular-nums">{t("count", { count: c.count })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
