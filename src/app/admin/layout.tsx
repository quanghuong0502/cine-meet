import { Menu } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Wordmark } from "@/components/wordmark";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
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

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r p-4 md:flex">
        <span className="px-3 py-2 text-lg"><Wordmark /> <span className="font-normal text-muted-foreground">· Admin</span></span>
        <AdminNav />
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-2 py-1 backdrop-blur md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Mở menu quản trị">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col gap-4 p-4">
              <SheetHeader className="p-0">
                <SheetTitle><Wordmark /> · Admin</SheetTitle>
                <SheetDescription>Menu quản trị</SheetDescription>
              </SheetHeader>
              <AdminNav insideSheet />
              <div className="mt-auto">
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Admin</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
