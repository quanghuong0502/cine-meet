import { describe, expect, it } from "vitest";
import { landingPathForRole, POST_LOGIN_PATH, resolvePostLoginTarget } from "./post-login";

describe("landingPathForRole", () => {
  it("sends admins to the admin area and users to the app", () => {
    expect(landingPathForRole("admin")).toBe("/admin");
    expect(landingPathForRole("user")).toBe("/");
  });
});

describe("resolvePostLoginTarget", () => {
  it("routes a plain sign-in through /post-login", () => {
    expect(resolvePostLoginTarget("/")).toBe(POST_LOGIN_PATH);
  });

  it("keeps a page the person was heading to", () => {
    expect(resolvePostLoginTarget("/admin/master-data/brands")).toBe("/admin/master-data/brands");
    expect(resolvePostLoginTarget("/profile")).toBe("/profile");
  });
});
