import type { ReactNode } from "react";
import { BackButton } from "@/components/back-button";

interface PageHeaderProps {
  /** Omit when the page content already provides a heading. */
  title?: string;
  /** Destination of the back button on an inner screen. */
  backHref?: string;
  description?: string;
  /** One trailing action on the bar (only shown together with `backHref`), e.g. "report a problem". */
  children?: ReactNode;
}

/** Inner screens get a sticky back bar. Page headings are available to screen readers. */
export function PageHeader({ title, backHref, description, children }: PageHeaderProps) {
  return (
    <header
      className={
        backHref
          ? "sticky top-0 z-20 -mx-inset -mt-inset flex items-center bg-background/95 px-inset py-0 backdrop-blur"
          : "sr-only"
      }
    >
      {backHref ? <BackButton href={backHref} /> : null}
      {title ? <h1 className="sr-only">{title}</h1> : null}
      {description ? <p className="sr-only">{description}</p> : null}
      {backHref && children ? <div className="ml-auto">{children}</div> : null}
    </header>
  );
}
