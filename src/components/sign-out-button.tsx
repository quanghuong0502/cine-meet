import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <form action={handleSignOut}>
      <Button type="submit" variant="ghost" className="h-11 w-full justify-start gap-2">
        <LogOut aria-hidden />
        Đăng xuất
      </Button>
    </form>
  );
}
