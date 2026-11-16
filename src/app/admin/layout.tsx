import { House, Menu } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";
import { Wordmark } from "@/components/wordmark";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts only sees the JWT; this re-reads role and status from the database.
  await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r p-4 md:flex">
        <span className="flex flex-col gap-0.5 px-3 py-2">
          <Logo size={44} wordmarkClassName="text-xl" />
          <span className="text-xs font-medium text-muted-foreground">{t("title")}</span>
        </span>
        <AdminNav />
        <div className="mt-auto flex flex-col">
          <Button asChild variant="ghost" className="h-11 w-full justify-start gap-2">
            <Link href="/">
              <House aria-hidden />
              {t("openApp")}
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-2 py-1 backdrop-blur md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label={t("openMenu")}>
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col gap-4 p-4">
              <SheetHeader className="p-0">
                <SheetTitle><Wordmark /> · {t("title")}</SheetTitle>
                <SheetDescription>{t("menuLabel")}</SheetDescription>
              </SheetHeader>
              <AdminNav insideSheet />
              <div className="mt-auto flex flex-col">
                <SheetClose asChild>
                  <Button asChild variant="ghost" className="h-11 w-full justify-start gap-2">
                    <Link href="/">
                      <House aria-hidden />
                      {t("openApp")}
                    </Link>
                  </Button>
                </SheetClose>
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">{t("title")}</span>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
