/**
 * Vietnamese mobile numbers are stored as "84" + 9 digits (for example 84912345678), so the same person typing
 * "0912 345 678", "+84 912.345.678" or "84912345678" is one number. Returns null when the text is not a mobile number.
 */
export function normalizeVietnamPhone(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  const digits = compact.replace(/^\+/, "");

  let national: string;
  if (digits.startsWith("84")) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else return null;

  // Mobile numbers have 9 digits after the country code and start with 3, 5, 7, 8 or 9.
  if (!/^[35789]\d{8}$/.test(national)) return null;
  return `84${national}`;
}

/** 84912345678 -> "0912 345 678", for showing a stored number. */
export function formatVietnamPhone(stored: string): string {
  const match = /^84(\d{3})(\d{3})(\d{3})$/.exec(stored);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : stored;
}
