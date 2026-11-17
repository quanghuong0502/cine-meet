import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

interface UserMenuProps {
  name: string;
  image?: string;
  /** Which area the avatar sits in: each area has its own Profile page. */
  area?: "app" | "admin";
}

/** Avatar in the header (top right): one tap opens the Profile page, where Settings and Sign out are. */
export function UserMenu({ name, image, area = "app" }: UserMenuProps) {
  const t = useTranslations("account");
  return (
    <Button asChild variant="ghost" size="icon" className="size-target rounded-full">
      <Link href={area === "admin" ? "/admin/profile" : "/profile"} aria-label={t("profile")}>
        <UserAvatar name={name} image={image} size={40} />
      </Link>
    </Button>
  );
}
