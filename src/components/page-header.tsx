import { BackButton } from "@/components/back-button";

interface PageHeaderProps {
  title: string;
  /** Where the back button goes. Every inner screen (not a tab) sets this: see `BackButton`. */
  backHref?: string;
  description?: string;
}

export function PageHeader({ title, backHref, description }: PageHeaderProps) {
  return (
    <header className="flex items-start gap-2">
      {backHref ? <BackButton href={backHref} /> : null}
      <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </header>
  );
}
