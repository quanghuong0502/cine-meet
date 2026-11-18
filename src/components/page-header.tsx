import { BackButton } from "@/components/back-button";

interface PageHeaderProps {
  /** Omit it on a screen whose content already starts with its own title: the bar then holds only the back button. */
  title?: string;
  /** Where the back button goes. Every inner screen (not a tab) sets this: see `BackButton`. */
  backHref?: string;
  description?: string;
}

/**
 * Title of a screen. An inner screen (with a back button) is a navigation bar like iOS: a title that stays at the top while the page
 * scrolls, so back is always one tap away. A tab screen draws no title: the bottom menu already shows which tab this is, and a big
 * title would take about 60px of a phone; the title and description stay in the page for screen readers (`sr-only`), so the page still has its h1.
 * Every page puts it first inside a `p-4` container: the bar cancels that padding (negative margins) to reach the screen edges.
 */
export function PageHeader({ title, backHref, description }: PageHeaderProps) {
  if (!backHref) {
    return (
      <header className="sr-only">
        {title ? <h1>{title}</h1> : null}
        {description ? <p>{description}</p> : null}
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-2 bg-background/95 px-4 py-0 backdrop-blur">
      <BackButton href={backHref} />
      {title ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
    </header>
  );
}
