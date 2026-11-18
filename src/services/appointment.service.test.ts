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
    Notification: typeof import("@/models/notification").Notification;
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
      Notification: (await import("@/models/notification")).Notification,
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

  describe("answer-by time", () => {
    it("after it, nobody can vote, suggest a time, decline or be invited; the creator can still lock", async () => {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(48) }], inviteeIds: [u1, u2], responseDeadline: hours(1), send: true });
      if (!created.ok) throw new Error();
      const id = created.id;
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      await svc.setVote(u1, id, a.id, "yes"); // before the deadline: fine

      const later = new Date(Date.now() + 2 * 3600_000);
      expect(await svc.setVote(u1, id, a.id, "no", later)).toEqual({ ok: false, error: "deadline_passed" });
      expect(await svc.setVote(u2, id, a.id, "yes", later)).toEqual({ ok: false, error: "deadline_passed" });
      expect(await svc.proposeOption(u2, id, { startAt: hours(100) }, later)).toEqual({ ok: false, error: "deadline_passed" });
      expect(await svc.declineInvitation(u2, id, "bận", later)).toEqual({ ok: false, error: "deadline_passed" });
      const friend4 = String((await models.User.create({ name: "u4", username: "u4" }))._id);
      await models.Friendship.create({ userA: creator, userB: friend4, status: "accepted", pairKey: friends.pairKey(creator, friend4) });
      expect(await svc.inviteMore(creator, id, [friend4], later)).toEqual({ ok: false, error: "deadline_passed" });

      const view = await svc.getAppointment(u2, id, later);
      expect(view?.deadlinePassed).toBe(true);
      expect(view?.options[0]?.votes).toEqual([{ userId: u1, vote: "yes" }]); // nothing changed
      expect(view?.participants.find((p) => p.id === u2)?.status).toBe("invited");
      expect((await svc.getAppointment(u2, id))?.deadlinePassed).toBe(false);
      expect(await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1] })).toMatchObject({ ok: true });
    });

    it("with no answer-by time, replies are never closed", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      const farFuture = new Date(Date.now() + 365 * 24 * 3600_000);
      expect(await svc.setVote(u1, id, a.id, "yes", farFuture)).toMatchObject({ ok: true });
      expect((await svc.getAppointment(u1, id, farFuture))?.deadlinePassed).toBe(false);
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

  describe("invite more", () => {
    let u4: string;
    beforeEach(async () => {
      u4 = String((await models.User.create({ name: "u4", username: "u4" }))._id);
      await models.Friendship.create({ userA: creator, userB: u4, status: "accepted", pairKey: friends.pairKey(creator, u4) });
    });

    async function invitingTwo() {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(30) }], inviteeIds: [u1, u2], send: true });
      if (!created.ok) throw new Error(created.error);
      return created.id;
    }

    it("adds the new person and tells only them", async () => {
      const id = await invitingTwo();
      await models.Notification.deleteMany({});
      expect(await svc.inviteMore(creator, id, [u4])).toEqual({ ok: true, addedIds: [u4] });
      const view = await svc.getAppointment(creator, id);
      expect(view?.participants.map((p) => [p.id, p.status])).toEqual([[u1, "invited"], [u2, "invited"], [u4, "invited"]]);
      const rows = await models.Notification.find({}).lean();
      expect(rows.map((n) => [String(n.recipientId), n.type])).toEqual([[u4, "appointment_invited"]]);
    });

    it("a draft takes more people without telling anyone; sending then tells everyone", async () => {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(30) }], inviteeIds: [u1], send: false });
      if (!created.ok) throw new Error();
      expect(await svc.inviteMore(creator, created.id, [u4])).toMatchObject({ ok: true });
      expect(await models.Notification.countDocuments()).toBe(0);
      await svc.sendInvitations(creator, created.id);
      expect((await models.Notification.find({}).lean()).map((n) => String(n.recipientId)).sort()).toEqual([u1, u4].sort());
    });

    it("only the creator, only friends, nobody already in (even if they declined), and not past the limit", async () => {
      const id = await invitingTwo();
      await svc.declineInvitation(u2, id);
      expect(await svc.inviteMore(u1, id, [u4])).toEqual({ ok: false, error: "forbidden" });
      expect(await svc.inviteMore(creator, id, [stranger])).toEqual({ ok: false, error: "not_friends" });
      expect(await svc.inviteMore(creator, id, [u2])).toEqual({ ok: false, error: "duplicate" });
      expect(await svc.inviteMore(creator, id, [u4, u1])).toEqual({ ok: false, error: "duplicate" });
      expect(await svc.inviteMore(creator, id, [])).toEqual({ ok: false, error: "needs_attendee" });
      expect(await svc.getAppointment(creator, id).then((v) => v?.participants.length)).toBe(2);

      const { MAX_INVITEES } = await import("@/lib/appointment/limits");
      const many = await Promise.all(Array.from({ length: MAX_INVITEES }, async (_, i) => {
        const user = String((await models.User.create({ name: `m${i}`, username: `m${i}` }))._id);
        await models.Friendship.create({ userA: creator, userB: user, status: "accepted", pairKey: friends.pairKey(creator, user) });
        return user;
      }));
      expect(await svc.inviteMore(creator, id, many.slice(0, MAX_INVITEES - 1))).toEqual({ ok: false, error: "limit" });
    });

    it("not once the list is locked or the plan is cancelled", async () => {
      const id = await invitingTwo();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1] });
      expect(await svc.inviteMore(creator, id, [u4])).toEqual({ ok: false, error: "bad_state" });
      await svc.cancelAppointment(creator, id);
      expect(await svc.inviteMore(creator, id, [u4])).toEqual({ ok: false, error: "bad_state" });
    });

    it("a locked account cannot be invited", async () => {
      const id = await invitingTwo();
      await models.User.updateOne({ _id: u4 }, { status: "locked" });
      expect(await svc.inviteMore(creator, id, [u4])).toEqual({ ok: false, error: "not_friends" });
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

    it("counts how many invited people have answered (a yes or a decline)", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      expect((await svc.listAppointments(creator)).active[0]).toMatchObject({ participantCount: 3, answeredCount: 0 });
      await svc.setVote(u1, id, a.id, "yes");
      await svc.declineInvitation(u2, id);
      await svc.setVote(u3, id, a.id, "no"); // voting no everywhere is not yet an answer
      expect((await svc.listAppointments(creator)).active[0]).toMatchObject({ participantCount: 3, answeredCount: 2 });
    });

    it("someone not involved cannot read an appointment", async () => {
      const id = await inviting();
      expect(await svc.getAppointment(stranger, id)).toBeNull();
      expect(await svc.getAppointment(creator, "nope")).toBeNull();
    });
  });

  describe("notifications", () => {
    const sent = async () =>
      (await models.Notification.find({}).sort({ createdAt: 1 }).lean()).map((n) => ({
        to: String(n.recipientId),
        type: n.type,
        kind: (n.payload as { kind?: string }).kind,
        included: (n.payload as { included?: boolean }).included,
      }));

    it("#1 everyone invited is told, with the movie and the creator's name", async () => {
      await inviting();
      const rows = await models.Notification.find({}).lean();
      expect(rows.map((n) => String(n.recipientId)).sort()).toEqual([u1, u2, u3].sort());
      expect(rows.every((n) => n.type === "appointment_invited")).toBe(true);
      expect(rows[0]?.payload).toMatchObject({ movieTitle: "Phim", actorName: "creator" });
    });

    it("a draft tells nobody until it is sent", async () => {
      const created = await svc.createAppointment(creator, { movieId: movie, options: [{ startAt: hours(5) }], inviteeIds: [u1], send: false });
      if (!created.ok) throw new Error();
      expect(await sent()).toEqual([]);
      await svc.sendInvitations(creator, created.id);
      expect(await sent()).toEqual([{ to: u1, type: "appointment_invited", kind: undefined, included: undefined }]);
    });

    it("#2 the creator hears about the first yes, a decline and a suggestion, but not every vote change", async () => {
      const id = await inviting();
      await models.Notification.deleteMany({});
      const [a, b] = (await svc.getAppointment(creator, id))!.options;
      await svc.setVote(u1, id, a!.id, "yes");
      await svc.setVote(u1, id, b!.id, "yes"); // already in: not news
      await svc.setVote(u1, id, a!.id, "no");
      await svc.declineInvitation(u2, id, "bận");
      await svc.proposeOption(u3, id, { startAt: hours(300) });
      expect(await sent()).toEqual([
        { to: creator, type: "appointment_reply", kind: "agree", included: undefined },
        { to: creator, type: "appointment_reply", kind: "decline", included: undefined },
        { to: creator, type: "appointment_reply", kind: "propose", included: undefined },
      ]);
    });

    it("#4 locking tells the whole group, and says who was left out", async () => {
      const id = await inviting();
      await models.Notification.deleteMany({});
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      await svc.declineInvitation(u3, id);
      await models.Notification.deleteMany({});
      await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1] });
      const rows = await sent();
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.to === u1)).toMatchObject({ type: "participants_locked", included: true });
      expect(rows.find((r) => r.to === u2)).toMatchObject({ type: "participants_locked", included: false });
    });

    it("#13 leaving tells the creator, #7 cancelling tells those still in", async () => {
      const id = await inviting();
      const a = (await svc.getAppointment(creator, id))!.options[0]!;
      await svc.lockParticipants(creator, id, { optionId: a.id, attendeeIds: [u1, u2] });
      await models.Notification.deleteMany({});
      await svc.withdraw(u1, id);
      await svc.cancelAppointment(creator, id, "hết vé");
      expect(await sent()).toEqual([
        { to: creator, type: "participant_withdrew", kind: undefined, included: undefined },
        { to: u2, type: "appointment_cancelled", kind: undefined, included: undefined },
      ]);
    });

    it("a failed attempt tells nobody", async () => {
      const id = await inviting();
      await models.Notification.deleteMany({});
      await svc.setVote(stranger, id, "6".repeat(24), "yes");
      await svc.lockParticipants(u1, id, { optionId: "6".repeat(24), attendeeIds: [u1] });
      expect(await sent()).toEqual([]);
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
