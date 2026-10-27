import assert from "node:assert/strict";
import test from "node:test";
import { type BoardMission, filterBoardMissions } from "./mission-board.ts";

test("mural filtra título, porta-voz e formato sem alterar a lista", () => {
  const missions = [
    { id: 1, title: "Vídeo da cidade", spokesperson: "Ana", format: "short" },
    { id: 2, title: "Entrevista", spokesperson: "Bia", format: "long" },
  ] as BoardMission[];
  assert.deepEqual(
    filterBoardMissions(missions, " VÍDEO ", "short").map((m) => m.id),
    [1],
  );
  assert.deepEqual(
    filterBoardMissions(missions, "bia", "").map((m) => m.id),
    [2],
  );
  assert.deepEqual(filterBoardMissions(missions, "bia", "short"), []);
  assert.equal(filterBoardMissions(missions, "", "").length, 2);
  assert.equal(missions.length, 2);
});
