import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  name: string;
  /** Which area the avatar sits in: each area has its own Profile page. */
  area?: "app" | "admin";
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? "?"];
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}

/** Avatar in the header (top right): one tap opens the Profile page, where Settings and Sign out are. */
export function UserMenu({ name, area = "app" }: UserMenuProps) {
  const t = useTranslations("account");
  return (
    <Button asChild variant="ghost" size="icon" className="size-target rounded-full">
      <Link href={area === "admin" ? "/admin/profile" : "/profile"} aria-label={t("profile")}>
        <span className="flex size-avatar items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {getInitials(name)}
        </span>
      </Link>
    </Button>
  );
}
