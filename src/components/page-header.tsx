import { BackButton } from "@/components/back-button";

interface PageHeaderProps {
  /** Omit it on a screen whose content already starts with its own title: the bar then holds only the back button. */
  title?: string;
  /** Where the back button goes. Every inner screen (not a tab) sets this: see `BackButton`. */
  backHref?: string;
  description?: string;
  /** Create/edit screens: the title is not drawn beside the back arrow (the form says what it is); it stays as the page's h1 for screen readers. */
  hideTitle?: boolean;
}

/**
 * Title of a screen. An inner screen (with a back button) is a navigation bar like iOS: a title that stays at the top while the page
 * scrolls, so back is always one tap away. A tab screen draws no title: the bottom menu already shows which tab this is, and a big
 * title would take about 60px of a phone; the title and description stay in the page for screen readers (`sr-only`), so the page still has its h1.
 * Every page puts it first inside a `p-inset` container: the bar cancels that padding (negative margins) to reach the screen edges.
 */
export function PageHeader({ title, backHref, description, hideTitle }: PageHeaderProps) {
  if (!backHref) {
    return (
      <header className="sr-only">
        {title ? <h1 className="sr-only">{title}</h1> : null}
        {description ? <p className="sr-only">{description}</p> : null}
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-20 -mx-inset -mt-inset flex items-center gap-stack bg-background/95 px-inset py-0 backdrop-blur">
      <BackButton href={backHref} />
      {title && hideTitle ? <h1 className="sr-only">{title}</h1> : null}
      {title && !hideTitle ? (
        <div className="flex min-w-0 flex-col gap-tight">
          <h1 className="truncate type-heading">{title}</h1>
          {description ? <p className="type-secondary text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
    </header>
  );
}
