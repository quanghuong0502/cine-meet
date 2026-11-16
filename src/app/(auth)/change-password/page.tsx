import type { Metadata } from "next";
import { Mascot } from "@/components/mascot";
import { ChangePasswordForm } from "./change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <Mascot pose="duo-watching" size={144} decorative priority />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Đổi mật khẩu</CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? "Đây là lần đăng nhập đầu hoặc mật khẩu vừa được đặt lại. Hãy đặt mật khẩu mới của riêng bạn."
              : "Nhập mật khẩu hiện tại và mật khẩu mới."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
