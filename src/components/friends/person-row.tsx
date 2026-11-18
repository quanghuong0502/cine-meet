import { UserAvatar } from "@/components/user-avatar";
import { PX } from "@/lib/ui-sizes";

/** Avatar and name on one line; `children` are the buttons on the right. */
export function PersonRow({ name, avatar, children }: { name: string; avatar?: string; children?: React.ReactNode }) {
  return (
    <li className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm">
      <UserAvatar name={name} image={avatar} size={PX.avatar} />
      <span className="min-w-0 flex-1 break-words type-item-title">{name}</span>
      {children ? <span className="flex shrink-0 gap-stack">{children}</span> : null}
    </li>
  );
}
