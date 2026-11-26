import { UserAvatar } from "@/components/user-avatar";
import { PX } from "@/lib/ui-sizes";

/** Avatar and name (with optional second line) on one row; `children` are the buttons or badge on the right. */
export function PersonRow({
  name,
  avatar,
  sub,
  children,
}: {
  name: string;
  avatar?: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm">
      <UserAvatar name={name} image={avatar} size={PX.avatar} />
      <span className="flex min-w-0 flex-1 flex-col gap-tight">
        <span className="break-words type-item-title">{name}</span>
        {sub ? <span className="break-words type-secondary text-muted-foreground">{sub}</span> : null}
      </span>
      {children ? <span className="flex shrink-0 gap-stack">{children}</span> : null}
    </li>
  );
}
