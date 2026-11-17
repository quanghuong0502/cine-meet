import { createHash } from "node:crypto";

/** Avatars are cropped to a 256px square around the face when they are uploaded, so only a small image is ever stored. */
const AVATAR_TRANSFORMATION = "c_fill,g_face,w_256,h_256";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Reads the account from the environment; null when it is not set up (the avatar upload then says so). */
export function cloudinaryConfig(env: NodeJS.ProcessEnv = process.env): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** Cloudinary's signature: the signed parameters sorted by name, joined as name=value&..., plus the secret, hashed with SHA-1. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export interface AvatarUploadTicket {
  uploadUrl: string;
  /** Form fields to send with the file, straight from the browser to Cloudinary (the secret never leaves the server). */
  fields: Record<string, string>;
}

/**
 * A signed ticket to upload one avatar for `userId`. The image always lands at avatars/<userId> and replaces the old one,
 * so there is never more than one stored per person.
 */
export function createAvatarUploadTicket(userId: string, config: CloudinaryConfig, nowMs: number = Date.now()): AvatarUploadTicket {
  const signed = {
    invalidate: "true",
    overwrite: "true",
    public_id: `avatars/${userId}`,
    timestamp: Math.floor(nowMs / 1000),
    transformation: AVATAR_TRANSFORMATION,
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    fields: {
      ...Object.fromEntries(Object.entries(signed).map(([key, value]) => [key, String(value)])),
      api_key: config.apiKey,
      signature: signParams(signed, config.apiSecret),
    },
  };
}

/** Only this person's own avatar on our Cloudinary account is accepted as a profile picture (the form cannot point it elsewhere). */
export function isOwnAvatarUrl(url: string, userId: string, config: CloudinaryConfig): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === "res.cloudinary.com" &&
    parsed.pathname.startsWith(`/${config.cloudName}/image/upload/`) &&
    /\/avatars\/([0-9a-f]{24})\.[a-z0-9]+$/i.exec(parsed.pathname)?.[1] === userId
  );
}
