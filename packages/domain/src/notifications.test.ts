import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildAdminNotifications } from "./notifications.ts";

const NOW = new Date("2026-09-11T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("admin notifications", () => {
  test("available mission stalled 3+ days without editor raises a queue alert", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [{ id: 1, title: "Corte A", status: "disponivel", createdAt: daysAgo(3) }],
        inFlight: [],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].category, "queue_stalled");
    assert.equal(notifications[0].href, "/inspetor/panorama");
  });

  test("available mission under 3 days raises no alert", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [{ id: 1, title: "Corte A", status: "disponivel", createdAt: daysAgo(2) }],
        inFlight: [],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 0);
  });

  test("offered mission (pending offer) does not count as stalled in queue", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [{ id: 1, title: "Corte A", status: "oferecida", createdAt: daysAgo(10) }],
        inFlight: [],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 0);
  });

  test("mission reserved 5+ days by the same editor raises an editing-stalled alert", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [],
        inFlight: [{ id: 2, title: "Corte B", status: "reservada", since: daysAgo(5) }],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].category, "editing_stalled");
  });

  test("mission reserved under 5 days raises no alert", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [],
        inFlight: [{ id: 2, title: "Corte B", status: "reservada", since: daysAgo(4) }],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 0);
  });

  test("mission in review always raises an alert, even if just submitted", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [],
        inFlight: [{ id: 3, title: "Corte C", status: "em_revisao", since: daysAgo(0) }],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].category, "awaiting_review");
    assert.equal(notifications[0].href, "/inspetor");
  });

  test("open report raises an alert; resolved report does not", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [],
        inFlight: [],
        reports: [
          {
            id: 9,
            missionId: 3,
            missionTitle: "Corte C",
            status: "aberta",
            createdAt: daysAgo(1),
          },
          {
            id: 10,
            missionId: 4,
            missionTitle: "Corte D",
            status: "resolvida",
            createdAt: daysAgo(1),
          },
        ],
      },
      NOW,
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].category, "report_open");
    assert.equal(notifications[0].reportId, 9);
  });

  test("resolving the report makes its alert disappear on the next read", () => {
    const withOpenReport = buildAdminNotifications(
      {
        queue: [],
        inFlight: [],
        reports: [
          { id: 9, missionId: 3, missionTitle: "Corte C", status: "aberta", createdAt: daysAgo(1) },
        ],
      },
      NOW,
    );
    assert.equal(withOpenReport.length, 1);

    const afterResolved = buildAdminNotifications(
      {
        queue: [],
        inFlight: [],
        reports: [
          {
            id: 9,
            missionId: 3,
            missionTitle: "Corte C",
            status: "resolvida",
            createdAt: daysAgo(1),
          },
        ],
      },
      NOW,
    );
    assert.equal(afterResolved.length, 0);
  });

  test("sorts oldest alert first", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [{ id: 1, title: "Corte A", status: "disponivel", createdAt: daysAgo(3) }],
        inFlight: [{ id: 2, title: "Corte B", status: "reservada", since: daysAgo(10) }],
        reports: [],
      },
      NOW,
    );
    assert.deepEqual(
      notifications.map((n) => n.id),
      ["editing_stalled:2", "queue_stalled:1"],
    );
  });

  test("irrelevant statuses (approved, completed) raise no alert", () => {
    const notifications = buildAdminNotifications(
      {
        queue: [],
        inFlight: [
          { id: 5, title: "Corte E", status: "aprovada", since: daysAgo(30) },
          { id: 6, title: "Corte F", status: "finalizada", since: daysAgo(30) },
        ],
        reports: [],
      },
      NOW,
    );
    assert.equal(notifications.length, 0);
  });
});
