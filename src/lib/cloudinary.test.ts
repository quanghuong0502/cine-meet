import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assetFolder, cloudinaryConfig, createAvatarUploadTicket, createBranchImageUploadTicket, createBrandLogoUploadTicket, createMoviePosterUploadTicket, isOwnAvatarUrl, signParams } from "./cloudinary";

const CONFIG = { cloudName: "demo", apiKey: "key123", apiSecret: "s3cret", rootFolder: "seatmate_dev" };
const USER = "6afbb4609e156d9ab456f6d3";

describe("signParams", () => {
  it("sorts the parameters and appends the secret, as Cloudinary documents", () => {
    // Example from Cloudinary's docs shape: sorted name=value pairs joined by &, then the secret, SHA-1.
    const expected = createHash("sha1").update("public_id=sample&timestamp=1315060510s3cret").digest("hex");
    expect(signParams({ timestamp: 1315060510, public_id: "sample" }, "s3cret")).toBe(expected);
  });
});

describe("createAvatarUploadTicket", () => {
  it("signs a replace-in-place upload to avatars/<userId> and never includes the secret", () => {
    const ticket = createAvatarUploadTicket(USER, CONFIG, 1_700_000_000_000);
    expect(ticket.uploadUrl).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    expect(ticket.fields).toMatchObject({ public_id: `avatars/${USER}`, overwrite: "true", invalidate: "true", timestamp: "1700000000", api_key: "key123" });
    expect(ticket.fields.transformation).toContain("w_256");
    expect(JSON.stringify(ticket)).not.toContain("s3cret");

    const { api_key: _key, signature, ...signed } = ticket.fields;
    void _key;
    expect(signature).toBe(signParams(signed, "s3cret"));
  });
});

describe("createBrandLogoUploadTicket", () => {
  it("lands under brands/ with a new name each time, keeps the whole image and does not overwrite", () => {
    const a = createBrandLogoUploadTicket(CONFIG, 1_700_000_000_000);
    const b = createBrandLogoUploadTicket(CONFIG, 1_700_000_000_000);
    expect(a.fields.public_id).toMatch(/^brands\/[0-9a-z]+$/);
    expect(a.fields.public_id).not.toBe(b.fields.public_id);
    expect(a.fields.transformation).toBe("c_limit,w_512,h_512");
    expect(a.fields).not.toHaveProperty("overwrite");
    const { api_key: _key, signature, ...signed } = a.fields;
    void _key;
    expect(signature).toBe(signParams(signed, "s3cret"));
  });
});

describe("createBranchImageUploadTicket", () => {
  it("lands under branches/ with a new name each time, at most 1280px, and does not overwrite", () => {
    const a = createBranchImageUploadTicket(CONFIG, 1_700_000_000_000);
    const b = createBranchImageUploadTicket(CONFIG, 1_700_000_000_000);
    expect(a.fields.public_id).toMatch(/^branches\/[0-9a-z]+$/);
    expect(a.fields.public_id).not.toBe(b.fields.public_id);
    expect(a.fields.transformation).toBe("c_limit,w_1280,h_1280");
    expect(a.fields).not.toHaveProperty("overwrite");
  });
});

describe("asset folders", () => {
  const signedOk = (fields: Record<string, string>) => {
    const { api_key: _key, signature, ...signed } = fields;
    void _key;
    return signature === signParams(signed, "s3cret");
  };

  it("puts every kind of picture under the environment's root folder, and signs the folder", () => {
    const tickets = {
      "seatmate_dev/avatars": createAvatarUploadTicket(USER, CONFIG),
      "seatmate_dev/brands": createBrandLogoUploadTicket(CONFIG),
      "seatmate_dev/branches": createBranchImageUploadTicket(CONFIG),
      "seatmate_dev/movies": createMoviePosterUploadTicket(CONFIG),
    };
    for (const [folder, ticket] of Object.entries(tickets)) {
      expect(ticket.fields.asset_folder).toBe(folder);
      expect(signedOk(ticket.fields)).toBe(true);
    }
    expect(tickets["seatmate_dev/movies"].fields.public_id).toMatch(/^movies\/[0-9a-z]+$/);
  });

  it("uses the plain kind folder when no root folder is set", () => {
    const { rootFolder: _root, ...bare } = CONFIG;
    void _root;
    expect(assetFolder("avatars", bare)).toBe("avatars");
    expect(createBrandLogoUploadTicket(bare).fields.asset_folder).toBe("brands");
  });

  it("separates dev from production", () => {
    expect(assetFolder("movies", { ...CONFIG, rootFolder: "seatmate_production" })).toBe("seatmate_production/movies");
  });
});

describe("isOwnAvatarUrl", () => {
  const good = `https://res.cloudinary.com/demo/image/upload/v17/avatars/${USER}.jpg`;

  it("accepts the person's own avatar", () => {
    expect(isOwnAvatarUrl(good, USER, CONFIG)).toBe(true);
    expect(isOwnAvatarUrl(`https://res.cloudinary.com/demo/image/upload/c_fill,w_256/v17/avatars/${USER}.png`, USER, CONFIG)).toBe(true);
  });

  it("refuses another person's avatar, another account, another host or a non-image path", () => {
    expect(isOwnAvatarUrl(good, "6afbb4609e156d9ab456f6d4", CONFIG)).toBe(false);
    expect(isOwnAvatarUrl(good.replace("/demo/", "/other/"), USER, CONFIG)).toBe(false);
    expect(isOwnAvatarUrl(good.replace("res.cloudinary.com", "evil.example"), USER, CONFIG)).toBe(false);
    expect(isOwnAvatarUrl(good.replace("https", "http"), USER, CONFIG)).toBe(false);
    expect(isOwnAvatarUrl("https://res.cloudinary.com/demo/raw/upload/x.js", USER, CONFIG)).toBe(false);
    expect(isOwnAvatarUrl("not a url", USER, CONFIG)).toBe(false);
  });
});

describe("cloudinaryConfig", () => {
  it("is null unless all three variables are set", () => {
    expect(cloudinaryConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(cloudinaryConfig({ CLOUDINARY_CLOUD_NAME: "a", CLOUDINARY_API_KEY: "b" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(cloudinaryConfig({ CLOUDINARY_CLOUD_NAME: "a", CLOUDINARY_API_KEY: "b", CLOUDINARY_API_SECRET: "c" } as unknown as NodeJS.ProcessEnv)).toEqual({ cloudName: "a", apiKey: "b", apiSecret: "c" });
  });

  it("reads the root folder and trims stray slashes and spaces", () => {
    const env = { CLOUDINARY_CLOUD_NAME: "a", CLOUDINARY_API_KEY: "b", CLOUDINARY_API_SECRET: "c", CLOUDINARY_ROOT_FOLDER: " /seatmate_dev/ " } as unknown as NodeJS.ProcessEnv;
    expect(cloudinaryConfig(env)?.rootFolder).toBe("seatmate_dev");
  });
});
