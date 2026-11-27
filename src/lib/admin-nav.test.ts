import { describe, expect, it } from "vitest";
import { isFocusedAdminRoute, showsAdminBar } from "./admin-nav";

describe("showsAdminBar", () => {
  it("shows the bar on list pages and hides it on entry screens", () => {
    expect(showsAdminBar("/admin/master-data", false)).toBe(true);
    expect(showsAdminBar("/admin/master-data/branches/abc", false)).toBe(false);
    expect(showsAdminBar("/admin/master-data/branches/new", false)).toBe(false);
  });

  it("hides the bar on auditorium entry screens only", () => {
    expect(showsAdminBar("/admin/auditoriums", false)).toBe(true);
    expect(showsAdminBar("/admin/auditoriums/new", false)).toBe(false);
    expect(showsAdminBar("/admin/auditoriums/abc", false)).toBe(false);
  });

  it("hides the bar on movie and showtime entry screens, keeps it on the two lists", () => {
    expect(showsAdminBar("/admin/movies", false)).toBe(true);
    expect(showsAdminBar("/admin/movies/showtimes", false)).toBe(true);
    expect(showsAdminBar("/admin/movies/new", false)).toBe(false);
    expect(showsAdminBar("/admin/movies/abc", false)).toBe(false);
    expect(showsAdminBar("/admin/movies/showtimes/bulk", false)).toBe(false);
    expect(showsAdminBar("/admin/movies/showtimes/import", false)).toBe(false);
  });

  it("keeps the bar while an entry screen is still loading", () => {
    expect(isFocusedAdminRoute("/admin/master-data/branches/abc")).toBe(true);
    expect(showsAdminBar("/admin/master-data/branches/abc", true)).toBe(true);
  });

  it("treats /admin/profile and its sub-routes as focused screens", () => {
    expect(isFocusedAdminRoute("/admin/profile")).toBe(true);
    expect(isFocusedAdminRoute("/admin/profile/edit")).toBe(true);
    expect(showsAdminBar("/admin/profile", false)).toBe(false);
  });
});
