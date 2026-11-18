export type DeviceKind = "iphone" | "ipad" | "android" | "mac" | "windows" | "linux" | "other";

/** A rough name for a device from its user agent, only so a person can tell their devices apart in Settings. */
export function describeDevice(userAgent: string): DeviceKind {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone")) return "iphone";
  if (ua.includes("ipad")) return "ipad";
  if (ua.includes("android")) return "android";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "other";
}
