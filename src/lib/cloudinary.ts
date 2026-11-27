import { createHash, randomBytes } from "node:crypto";

/** Avatars are cropped to a 256px square around the face when they are uploaded, so only a small image is ever stored. */
const AVATAR_TRANSFORMATION = "c_fill,g_face,w_256,h_256";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Top folder that keeps one environment's pictures apart from another's (seatmate_dev, seatmate_production); empty = none. */
  rootFolder?: string;
}

/** Reads the account from the environment; null when it is not set up (the avatar upload then says so). */
export function cloudinaryConfig(env: NodeJS.ProcessEnv = process.env): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  const rootFolder = env.CLOUDINARY_ROOT_FOLDER?.trim().replace(/^\/+|\/+$/g, "");
  return rootFolder ? { cloudName, apiKey, apiSecret, rootFolder } : { cloudName, apiKey, apiSecret };
}

/** Where a kind of picture lives in the Media Library: <root folder>/<kind>, or just <kind> when no root folder is set. */
export function assetFolder(kind: string, config: CloudinaryConfig): string {
  return config.rootFolder ? `${config.rootFolder}/${kind}` : kind;
}

/** Cloudinary's signature: the signed parameters sorted by name, joined as name=value&..., plus the secret, hashed with SHA-1. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export interface UploadTicket {
  uploadUrl: string;
  /** Form fields to send with the file, straight from the browser to Cloudinary (the secret never leaves the server). */
  fields: Record<string, string>;
}

/** A signed one-time ticket for one upload: where the image lands (`publicId`), how it is resized on arrival, and whether it replaces an old one. */
export function createUploadTicket(
  options: { publicId: string; folder: string; transformation: string; overwrite: boolean },
  config: CloudinaryConfig,
  nowMs: number = Date.now(),
): UploadTicket {
  const signed: Record<string, string | number> = {
    // The account uses dynamic folders: a "/" in public_id is only part of the name, so the folder is its own signed field.
    asset_folder: assetFolder(options.folder, config),
    public_id: options.publicId,
    timestamp: Math.floor(nowMs / 1000),
    transformation: options.transformation,
    ...(options.overwrite ? { invalidate: "true", overwrite: "true" } : {}),
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

/**
 * A signed ticket to upload one avatar for `userId`. The image always lands at avatars/<userId> and replaces the old one,
 * so there is never more than one stored per person.
 */
export function createAvatarUploadTicket(userId: string, config: CloudinaryConfig, nowMs: number = Date.now()): UploadTicket {
  return createUploadTicket({ publicId: `avatars/${userId}`, folder: "avatars", transformation: AVATAR_TRANSFORMATION, overwrite: true }, config, nowMs);
}

/** A ticket for a brand logo: kept whole (no crop) and at most 512px, under its own new name each time. */
export function createBrandLogoUploadTicket(config: CloudinaryConfig, nowMs: number = Date.now()): UploadTicket {
  const unique = `${nowMs.toString(36)}${randomBytes(4).toString("hex")}`;
  return createUploadTicket({ publicId: `brands/${unique}`, folder: "brands", transformation: "c_limit,w_512,h_512", overwrite: false }, config, nowMs);
}

/** A ticket for a branch photo: kept whole (no crop) and at most 1280px, under its own new name each time. */
export function createBranchImageUploadTicket(config: CloudinaryConfig, nowMs: number = Date.now()): UploadTicket {
  const unique = `${nowMs.toString(36)}${randomBytes(4).toString("hex")}`;
  return createUploadTicket({ publicId: `branches/${unique}`, folder: "branches", transformation: "c_limit,w_1280,h_1280", overwrite: false }, config, nowMs);
}

/** A ticket for a movie poster: kept whole (no crop) and at most 1000px, under its own new name each time. */
export function createMoviePosterUploadTicket(config: CloudinaryConfig, nowMs: number = Date.now()): UploadTicket {
  const unique = `${nowMs.toString(36)}${randomBytes(4).toString("hex")}`;
  return createUploadTicket({ publicId: `movies/${unique}`, folder: "movies", transformation: "c_limit,w_1000,h_1500", overwrite: false }, config, nowMs);
}

/** A ticket for a 3D auditorium screen still image: kept whole (no crop) and up to Full HD 1920×1080. */
export function createScreenImageUploadTicket(config: CloudinaryConfig, nowMs: number = Date.now()): UploadTicket {
  const unique = `${nowMs.toString(36)}${randomBytes(4).toString("hex")}`;
  return createUploadTicket({ publicId: `room-3d-screens/${unique}`, folder: "room-3d-screens", transformation: "c_limit,w_1920,h_1080", overwrite: false }, config, nowMs);
}

/** A ticket for a 3D auditorium surface texture (wall, ceiling, carpet/floor): kept whole up to 1024×1024 for smooth mobile WebGL. */
export function createSurfaceTextureUploadTicket(config: CloudinaryConfig, nowMs: number = Date.now()): UploadTicket {
  const unique = `${nowMs.toString(36)}${randomBytes(4).toString("hex")}`;
  return createUploadTicket({ publicId: `room-3d-textures/${unique}`, folder: "room-3d-textures", transformation: "c_limit,w_1024,h_1024", overwrite: false }, config, nowMs);
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
