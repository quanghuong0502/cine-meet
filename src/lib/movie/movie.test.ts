import { describe, expect, it } from "vitest";
import { movieStatus, vietnamToday } from "./status";
import { parseYoutubeId } from "./youtube";

describe("parseYoutubeId", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&t=30s`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `youtube.com/watch?v=${id}`,
    id,
  ])("finds the id in %s", (link) => expect(parseYoutubeId(link)).toBe(id));

  it.each(["", "https://vimeo.com/12345678901", "https://www.youtube.com/watch", "https://youtu.be/short", "not a link"])(
    "rejects %s",
    (link) => expect(parseYoutubeId(link)).toBeNull(),
  );
});

describe("movieStatus", () => {
  const movie = { releaseDate: "2026-11-10", endDate: "2026-12-10" };
  it("follows the dates", () => {
    expect(movieStatus(movie, "2026-11-09")).toBe("upcoming");
    expect(movieStatus(movie, "2026-11-10")).toBe("showing");
    expect(movieStatus(movie, "2026-12-10")).toBe("showing");
    expect(movieStatus(movie, "2026-12-11")).toBe("ended");
  });
  it("keeps showing when there is no end date", () => {
    expect(movieStatus({ releaseDate: "2026-01-01" }, "2030-01-01")).toBe("showing");
  });
  it("uses Vietnam time for today", () => {
    expect(vietnamToday(new Date("2026-11-17T18:00:00Z"))).toBe("2026-11-18");
  });
});
