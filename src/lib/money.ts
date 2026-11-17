/** VND money in the language in use (whole dong). */
export function formatVnd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * "60.000 – 120.000 ₫" (the symbol once, at the end, the Vietnamese way) or "₫60,000 – ₫120,000" in English.
 * The two amounts differ; for one price use `formatVnd`.
 */
export function formatVndRange(min: number, max: number, locale: string): string {
  if (locale === "en") return `${formatVnd(min, locale)} – ${formatVnd(max, locale)}`;
  const plain = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(min);
  return `${plain} – ${formatVnd(max, locale)}`;
}
