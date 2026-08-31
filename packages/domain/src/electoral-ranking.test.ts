import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  calculateConsistency,
  calculateUnlockedAwards,
  calculateWeeklyGoal,
  canInvitationBeUsed,
  canReferralAward,
  ELECTORAL_AWARDS,
  sortRanking,
} from "./electoral-ranking.ts";

test("partial week of up to four days requires one video", () => {
  assert.equal(calculateWeeklyGoal(4), 1);
  assert.equal(calculateWeeklyGoal(5), 2);
  assert.equal(calculateWeeklyGoal(7), 2);
});

test("awards are unlocked at defined thresholds", () => {
  assert.deepEqual(calculateUnlockedAwards(9), []);
  assert.deepEqual(calculateUnlockedAwards(10), ["ingresso_top1"]);
  assert.deepEqual(calculateUnlockedAwards(30), ["ingresso_top1", "bandeira_top2", "caneca_top3"]);
  assert.deepEqual(calculateUnlockedAwards(50), [
    "ingresso_top1",
    "bandeira_top2",
    "caneca_top3",
    "sorteio_constancia",
  ]);
});

test("vitrine milestones match calculateUnlockedAwards", () => {
  for (const { key, activeThreshold } of ELECTORAL_AWARDS) {
    assert.ok(
      calculateUnlockedAwards(activeThreshold).includes(key),
      `${key} should be unlocked with ${activeThreshold} active editors`,
    );
    assert.ok(
      !calculateUnlockedAwards(activeThreshold - 1).includes(key),
      `${key} should not be unlocked with ${activeThreshold - 1} active editors`,
    );
  }
  assert.deepEqual(
    ELECTORAL_AWARDS.map((p) => p.key),
    calculateUnlockedAwards(Infinity),
  );
});

test("tiebreak favors whoever reached count first", () => {
  const ranking = sortRanking([
    { editorId: 2, count: 4, reachedCountAt: new Date("2026-09-03T12:00:00Z") },
    { editorId: 1, count: 4, reachedCountAt: new Date("2026-09-02T12:00:00Z") },
    { editorId: 3, count: 5, reachedCountAt: new Date("2026-09-04T12:00:00Z") },
  ]);
  assert.deepEqual(
    ranking.map((item) => item.editorId),
    [3, 1, 2],
  );
});

test("invitation requires email match, valid expiration and no prior usage", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const base = {
    email: "voz@exemplo.com",
    expiresAt: new Date("2026-09-08T12:00:00Z"),
    usedAt: null,
    revokedAt: null,
  };
  assert.equal(canInvitationBeUsed(base, "VOZ@EXEMPLO.COM", now), true);
  assert.equal(canInvitationBeUsed(base, "outro@exemplo.com", now), false);
  assert.equal(canInvitationBeUsed({ ...base, usedAt: now }, base.email, now), false);
  assert.equal(
    canInvitationBeUsed({ ...base, expiresAt: new Date("2026-08-31T12:00:00Z") }, base.email, now),
    false,
  );
});

test("shield automatically saves a missed week", () => {
  assert.deepEqual(calculateConsistency([true, true, false, true], 1), {
    sequence: 4,
    sequencia: 4,
    consumedShields: 1,
    bloqueiosConsumidos: 1,
    eligibleForDraw: true,
    elegivelAoSorteio: true,
  });
  assert.deepEqual(calculateConsistency([true, true, false, true], 0), {
    sequence: 1,
    sequencia: 1,
    consumedShields: 0,
    bloqueiosConsumidos: 0,
    eligibleForDraw: false,
    elegivelAoSorteio: false,
  });
});

test("referral awards after two videos and caps at five per month", () => {
  assert.equal(canReferralAward(2, 4, false), true);
  assert.equal(canReferralAward(1, 4, false), false);
  assert.equal(canReferralAward(2, 5, false), false);
  assert.equal(canReferralAward(2, 0, true), false);
});

describe("constância com semana em curso", () => {
  test("semana ainda aberta não zera a sequência nem gasta bloqueio", () => {
    // três semanas cumpridas e a corrente ainda sem entrega
    const result = calculateConsistency([true, true, true, "pending"], 1);
    assert.equal(result.sequence, 3);
    assert.equal(result.consumedShields, 0);
  });

  test("semana encerrada sem entrega ainda quebra a sequência", () => {
    const result = calculateConsistency([true, true, false, "pending"], 0);
    assert.equal(result.sequence, 0);
  });

  test("bloqueio cobre semana encerrada, nunca a que está em curso", () => {
    const result = calculateConsistency([true, false, "pending"], 1);
    assert.equal(result.consumedShields, 1);
    assert.equal(result.sequence, 2);
  });
});
