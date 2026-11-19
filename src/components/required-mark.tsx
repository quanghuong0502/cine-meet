/**
 * The "*" after the label of a required field. Optional fields get no mark at all (see `.claude/rules/ui.md`, "Form").
 * Hidden from screen readers: the field itself carries `aria-required`.
 */
export function RequiredMark() {
  return (
    <span aria-hidden className="ml-tight text-destructive">
      *
    </span>
  );
}
