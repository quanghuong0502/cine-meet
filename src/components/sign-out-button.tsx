import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("account");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <form action={handleSignOut}>
      <Button type="submit" variant="ghost" className="h-target w-full justify-start gap-stack">
        <LogOut aria-hidden />
        {t("signOut")}
      </Button>
    </form>
  );
}
