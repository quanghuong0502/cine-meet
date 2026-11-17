/** VND money in the language in use (whole dong). */
export function formatVnd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}
