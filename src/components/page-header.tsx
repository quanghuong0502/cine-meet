import { BackButton } from "@/components/back-button";

interface PageHeaderProps {
  title: string;
  /** Where the back button goes. Every inner screen (not a tab) sets this: see `BackButton`. */
  backHref?: string;
  description?: string;
  /** A secondary action on the right of the header (for example Delete on an entry screen). */
  action?: React.ReactNode;
}

export function PageHeader({ title, backHref, description, action }: PageHeaderProps) {
  return (
    <header className="flex items-start gap-2">
      {backHref ? <BackButton href={backHref} /> : null}
      <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </header>
  );
}
