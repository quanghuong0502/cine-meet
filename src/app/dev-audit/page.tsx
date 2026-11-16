import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { AuditRunner } from "./audit-runner";

const USER_ROUTES = ["/", "/profile", "/settings", "/change-password"];
const ADMIN_ROUTES = ["/admin", "/admin/master-data", "/admin/master-data?tab=cinemas", "/admin/profile", "/admin/settings", "/change-password"];

/**
 * Development tool, not part of the product: open it on a phone to measure the real screens in that phone's own browser.
 * It loads each screen in a same-origin frame of the phone's size and sends what it measured to /api/dev/audit.
 */
export default async function DevAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const user = await requireUser({ allowPasswordChange: true });
  return <AuditRunner routes={user.role === "admin" ? ADMIN_ROUTES : USER_ROUTES} />;
}
