import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("appointment service", () => {
  let svc: typeof import("./appointment.service");
  let friends: typeof import("./friend.service");
  let models: {
    User: typeof import("@/models/user").User;
    Movie: typeof import("@/models/movie").Movie;
    Showtime: typeof import("@/models/showtime").Showtime;
    Appointment: typeof import("@/models/appointment").Appointment;
    Friendship: typeof import("@/models/friendship").Friendship;
  };
  let creator: string;
  let u1: string;
  let u2: string;
  let u3: string;
  let stranger: string;
  let movie: string;
  const hours = (h: number) => new Date(Date.now() + h * 3600_000);

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./appointment.service");
    friends = await import("./friend.service");
    models = {
      User: (await import("@/models/user")).User,
      Movie: (await import("@/models/movie")).Movie,
      Showtime: (await import("@/models/showtime")).Showtime,
      Appointment: (await import("@/models/appointment")).Appointment,
      Friendship: (await import("@/models/friendship")).Friendship,
    };
    await (await import("@/lib/db")).connectToDatabase();
    await models.Friendship.init();
    await models.User.init();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all(Object.values(models).map((m) => (m as { deleteMany(f: object): Promise<unknown> }).deleteMany({})));
    const make = async (name: string) => String((await models.User.create({ name, username: name }))._id);
    [creator, u1, u2, u3, stranger] = await Promise.all(["creator", "u1", "u2", "u3", "stranger"].map(make)) as [string, string, string, string, string];
    for (const other of [u1, u2, u3]) {
      await models.Friendship.create({ userA: creator, userB: other, status: "accepted", pairKey: friends.pairKey(creator, other) });
    }
    movie = String((await models.Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" } as never))._id);
  });

  async function inviting(extra: { options?: number } = {}) {
    const created = await svc.createAppointment(creator, {
      movieId: movie,
      options: Array.from({ length: extra.options ?? 2 }, (_, i) => ({ startAt: hours(24 + i * 24) })),
      inviteeIds: [u1, u2, u3],
      send: true,
    });
    if (!created.ok) throw new Error(created.error);
    return created.id;
  }

  describe("create", () => {
    it("starts INVITING with everyone invited", async () => {
      const id = await inviting();
      const view = await svc.getAppointment(creator, id);
      expect(view?.status).toBe("INVITING");
      expect(view?.participants.map((p) => p.status)).toEqual(["invited", "invited", "invited"]);
      expect(view?.options).toHaveLength(2);
    });

    it("rejects someone who is not a friend, a locked friend, a past time, a missing movie", async () => {
      const base = { movieId: movie, options: [{ startAt: hours(5) }], inviteeIds: [u1], send: true };
      expect(await svc.createAppointment(creator, { ...base, inviteeIds: [stranger] })).toEqual({ ok: false, error: "not_friends" });
      await models.User.updateOne({ _id: u1 }, { status: "locked" });
      expect(await svc.createAppointment(creator, base)).toEqual({ ok: false, error: "not_friends" });
      expect(await svc.createAppointment(creator, { ...base, inviteeIds: [u2], options: [{ startAt: hours(-1) }] })).toEqual({ ok: false, error: "invalid_option" });
      expect(await svc.createAppointment(creator, { ...base, inviteeIds: [u2], movieId: "6".repeat(24) })).toEqual({ ok: false, error: "movie_not_found" });
      expect(await svc.createAppointment(creator, { ...base, inviteeIds: [u2], options: [{ startAt: hours(5) }, { startAt: hours(5) }] })).toEqual({ ok: false, error: "duplicate" });
    });

    it("a showtime option takes its start from the showtime, and must be of the same movie", async () => {
      const other = String((await models.Movie.create({ title: "Khác", durationMin: 90, releaseDate: "2026-01-01" } as never))._id);
      const mk = (movieId: string) => models.Showtime.create({ movieId, auditoriumId: stranger, layoutId: stranger, formatId: stranger, startAt: hours(30), endAt: hours(32) });
      const mine = String((await mk(movie))._id);
      const wrong = String((await mk(other))._id);
      const ok = await svc.createAppointment(creator, { movieId: movie, options: [{ showtimeId: mine }], inviteeIds: [u1], send: true });
      expect(ok.ok).toBe(true);
      if (ok.ok) expect((await svc.getAppointment(creator, ok.id))?.options[0]?.showtimeId).toBe(mine);
      expect(await svc.createAppointment(creator, { movieId: movie, options: [{ showtimeId: wrong }], inviteeIds: [u1], send: true })).toEqual({ ok: false, error: "invalid_option" });
    });

    it("a draft is invisible to the invited until it is sent", async () => {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(5) }], inviteeIds: [u1], send: false });
      if (!created.ok) throw new Error();
      expect(created.status).toBe("DRAFT");
      expect(await svc.getAppointment(u1, created.id)).toBeNull();
      expect((await svc.listAppointments(u1)).active).toHaveLength(0);
      expect(await svc.setVote(u1, created.id, "x".repeat(24), "yes")).toMatchObject({ ok: false });
      expect(await svc.sendInvitations(u1, created.id)).toEqual({ ok: false, error: "forbidden" });
      expect(await svc.sendInvitations(creator, created.id)).toMatchObject({ ok: true });
      expect((await svc.getAppointment(u1, created.id))?.status).toBe("INVITING");
      expect(await svc.sendInvitations(creator, created.id)).toEqual({ ok: false, error: "bad_state" });
    });
  });

  describe("voting and answering", () => {
    it("a yes anywhere means in; taking it back means undecided again", async () => {
      const id = await inviting();
      const [a, b] = (await svc.getAppointment(u1, id))!.options;
      expect(await svc.setVote(u1, id, a!.id, "yes")).toMatchObject({ ok: true, becameAccepted: true });
      expect(await svc.setVote(u1, id, b!.id, "yes")).toMatchObject({ ok: true, becameAccepted: false });
      await svc.setVote(u1, id, a!.id, "no");
      expect((await svc.getAppointment(u1, id))?.myStatus).toBe("accepted");
      await svc.setVote(u1, id, b!.id, null);
      const view = await svc.getAppointment(u1, id);
      expect(view?.myStatus).toBe("invited");
      expect(view?.options.map((o) => o.myVote)).toEqual(["no", undefined]);
    });

    it("declining clears the votes; voting again brings the person back", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(u1, id))!.options[0]!;
      await svc.setVote(u1, id, a.id, "yes");
      expect(await svc.declineInvitation(u1, id, "  bận  ")).toMatchObject({ ok: true, creatorId: creator });
      let view = await svc.getAppointment(creator, id);
      expect(view?.participants.find((p) => p.id === u1)).toMatchObject({ status: "declined", declineReason: "bận" });
      expect(view?.options[0]?.votes).toEqual([]);
      await svc.setVote(u1, id, a.id, "yes");
      view = await svc.getAppointment(creator, id);
      expect(view?.participants.find((p) => p.id === u1)).toMatchObject({ status: "accepted", declineReason: undefined });
    });

    it("only invited people can answer, and only while inviting", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      expect(await svc.setVote(stranger, id, a.id, "yes")).toEqual({ ok: false, error: "not_found" });
      expect(await svc.setVote(creator, id, a.id, "yes")).toEqual({ ok: false, error: "not_found" });
      expect(await svc.setVote(u1, id, "6".repeat(24), "yes")).toEqual({ ok: false, error: "invalid_option" });
      await svc.setVote(u1, id, a.id, "yes");
      await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1] });
      expect(await svc.setVote(u2, id, a.id, "yes")).toEqual({ ok: false, error: "bad_state" });
      expect(await svc.declineInvitation(u2, id)).toEqual({ ok: false, error: "bad_state" });
    });

    it("suggesting another time adds it with the suggester's yes; the poll has a limit and no duplicates", async () => {
      const id = await inviting();
      const when = hours(100);
      const result = await svc.proposeOption(u1, id, { startAt: when });
      expect(result).toMatchObject({ ok: true, creatorId: creator });
      const view = await svc.getAppointment(creator, id);
      expect(view?.options).toHaveLength(3);
      const added = view!.options[2]!;
      expect(added.proposedBy?.id).toBe(u1);
      expect(added.votes).toEqual([{ userId: u1, vote: "yes" }]);
      expect(view?.participants.find((p) => p.id === u1)?.status).toBe("accepted");
      expect(await svc.proposeOption(u2, id, { startAt: when })).toEqual({ ok: false, error: "duplicate" });
      expect(await svc.proposeOption(u2, id, { startAt: hours(-3) })).toEqual({ ok: false, error: "invalid_option" });
      expect(await svc.proposeOption(stranger, id, { startAt: hours(200) })).toEqual({ ok: false, error: "not_found" });
    });

    it("an unanswered person is overdue after the deadline, but the appointment does not cancel", async () => {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(48) }], inviteeIds: [u1, u2], responseDeadline: hours(1), send: true });
      if (!created.ok) throw new Error();
      const a = (await svc.getAppointment(creator, created.id))!.options[0]!;
      await svc.setVote(u1, created.id, a.id, "yes");
      const later = new Date(Date.now() + 2 * 3600_000);
      const view = await svc.getAppointment(creator, created.id, later);
      expect(view?.participants.map((p) => [p.id, p.overdue])).toEqual([[u1, false], [u2, true]]);
      expect(view?.status).toBe("INVITING");
      expect(await svc.lockParticipants(creator, created.id, { optionId: a.id, attendeeIds: [u1] })).toMatchObject({ ok: true });
    });
  });

  describe("locking", () => {
    it("locks the chosen time and list: others are excluded, declined stay declined", async () => {
      const id = await inviting();
      const [a, b] = (await svc.getAppointment(creator, id))!.options;
      await svc.setVote(u1, id, a!.id, "yes");
      await svc.setVote(u2, id, b!.id, "yes"); // yes to a different time
      await svc.declineInvitation(u3, id);
      expect(await svc.lockParticipants(creator, id, { optionId: a!.id, attendeeIds: [u1] })).toEqual({ ok: true, attendeeIds: [u1], excludedIds: [u2] });
      const view = await svc.getAppointment(creator, id);
      expect(view?.status).toBe("PARTICIPANTS_LOCKED");
      expect(view?.chosenOptionId).toBe(a!.id);
      expect(Object.fromEntries(view!.participants.map((p) => [p.id, p.status]))).toEqual({ [u1]: "accepted", [u2]: "excluded", [u3]: "declined" });
    });

    it("someone who voted yes to a different time is not in the list unless the creator adds them", async () => {
      const id = await inviting();
      const [a, b] = (await svc.getAppointment(creator, id))!.options;
      await svc.setVote(u1, id, a!.id, "yes");
      await svc.setVote(u2, id, b!.id, "yes");
      const { yesVoterIds } = await import("@/lib/appointment/state");
      const defaults = yesVoterIds((await svc.getAppointment(creator, id))!.options.find((o) => o.id === a!.id)!.votes);
      expect(defaults).toEqual([u1]);
      expect(await svc.lockParticipants(creator, id, { optionId: a!.id, attendeeIds: [u1, u2] })).toMatchObject({ ok: true, attendeeIds: [u1, u2], excludedIds: [u3] });
    });

    it("the creator can add someone who has not answered, but not a declined or unknown person, and not nobody", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      await svc.declineInvitation(u3, id);
      expect(await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u3] })).toEqual({ ok: false, error: "needs_attendee" });
      expect(await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [stranger] })).toEqual({ ok: false, error: "needs_attendee" });
      expect(await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [] })).toEqual({ ok: false, error: "needs_attendee" });
      expect(await svc.lockParticipants(creator, id, { optionId: "6".repeat(24), attendeeIds: [u1] })).toEqual({ ok: false, error: "invalid_option" });
      expect(await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1] })).toMatchObject({ ok: true });
    });

    it("only the creator locks, and only once: the list cannot change afterwards", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      expect(await svc.lockParticipants(u1, id, { optionId: a.id, attendeeIds: [u1] })).toEqual({ ok: false, error: "forbidden" });
      await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1] });
      expect(await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1, u2] })).toEqual({ ok: false, error: "bad_state" });
    });
  });

  describe("withdraw and cancel", () => {
    async function locked() {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1, u2] });
      return id;
    }

    it("an attendee leaves and the creator is told who to notify", async () => {
      const id = await locked();
      expect(await svc.withdraw(u1, id)).toEqual({ ok: true, creatorId: creator });
      expect((await svc.getAppointment(creator, id))?.participants.find((p) => p.id === u1)?.status).toBe("dropped");
      expect(await svc.withdraw(u1, id)).toEqual({ ok: false, error: "not_found" });
    });

    it("cannot leave when never in, while still inviting, or after the showtime started", async () => {
      const inviteId = await inviting();
      expect(await svc.withdraw(u1, inviteId)).toEqual({ ok: false, error: "not_found" });
      const id = await locked();
      expect(await svc.withdraw(u3, id)).toEqual({ ok: false, error: "not_found" }); // excluded
      expect(await svc.withdraw(u2, id, hours(24 * 5))).toEqual({ ok: false, error: "late" });
    });

    it("only the creator cancels; people who declined or left are not told", async () => {
      const id = await locked();
      await svc.withdraw(u2, id);
      expect(await svc.cancelAppointment(u1, id)).toEqual({ ok: false, error: "forbidden" });
      const result = await svc.cancelAppointment(creator, id, "  hết vé ");
      expect(result).toMatchObject({ ok: true, wasDraft: false });
      if (result.ok) expect(result.recipientIds).toEqual([u1]);
      expect(await svc.cancelAppointment(creator, id)).toEqual({ ok: false, error: "bad_state" });
      const view = await svc.getAppointment(u1, id);
      expect(view).toMatchObject({ status: "CANCELLED", cancelReason: "hết vé" });
    });

    it("cancelling a draft tells nobody", async () => {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(5) }], inviteeIds: [u1], send: false });
      if (!created.ok) throw new Error();
      expect(await svc.cancelAppointment(creator, created.id)).toEqual({ ok: true, wasDraft: true, recipientIds: [] });
    });
  });

  describe("lists", () => {
    it("split into current and finished, and flag what needs this person's answer", async () => {
      const first = await inviting();
      const second = await inviting();
      await svc.cancelAppointment(creator, second);
      const mine = await svc.listAppointments(u1);
      expect(mine.active.map((s) => [s.id, s.needsReply, s.isCreator])).toEqual([[first, true, false]]);
      expect(mine.past.map((s) => s.id)).toEqual([second]);
      const a = (await svc.getAppointment(u1, first))!.options[0]!;
      await svc.setVote(u1, first, a.id, "yes");
      expect((await svc.listAppointments(u1)).active[0]?.needsReply).toBe(false);
      expect((await svc.listAppointments(stranger)).active).toEqual([]);
    });

    it("someone not involved cannot read an appointment", async () => {
      const id = await inviting();
      expect(await svc.getAppointment(stranger, id)).toBeNull();
      expect(await svc.getAppointment(creator, "nope")).toBeNull();
    });
  });

  it("two people voting at the same time do not lose each other's vote", async () => {
    const id = await inviting();
    const a = (await svc.getAppointment(creator, id))!.options[0]!;
    await Promise.all([svc.setVote(u1, id, a.id, "yes"), svc.setVote(u2, id, a.id, "yes"), svc.setVote(u3, id, a.id, "no")]);
    const votes = (await svc.getAppointment(creator, id))!.options[0]!.votes.map((v) => v.userId).sort();
    expect(votes).toEqual([u1, u2, u3].sort());
  });
});
