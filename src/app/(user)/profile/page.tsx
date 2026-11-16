import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Hồ sơ" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Hồ sơ</h1>
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>
            {[user.email, user.username].filter(Boolean).join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>Vai trò: {user.role === "admin" ? "Quản trị viên" : "Người dùng"}</p>
          <p>Chỉnh sửa tên, ảnh đại diện và số điện thoại sẽ có ở Sprint 1.</p>
          <Button asChild variant="outline" className="h-11 w-fit">
            <Link href="/change-password">Đổi mật khẩu</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
