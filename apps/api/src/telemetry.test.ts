import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  type AnalyticsEngineDataset,
  recordApiTelemetry,
  recordBackgroundTelemetry,
} from "./telemetry.ts";

describe("telemetria do Analytics Engine", () => {
  test("grava métricas da API com categorias e tempos corretos", () => {
    const recorded: unknown[] = [];
    const mockDataset: AnalyticsEngineDataset = {
      writeDataPoint(data) {
        recorded.push(data);
      },
    };

    recordApiTelemetry(mockDataset, {
      requestId: "req-123",
      method: "GET",
      path: "/editor/queue/next",
      status: 200,
      durationMs: 14.5,
      role: "editor",
      environment: "staging",
      d1: {
        queries: 3,
        rowsRead: 10,
        rowsWritten: 1,
        durationMs: 4.2,
      },
    });

    assert.equal(recorded.length, 1);
    const point = recorded[0] as {
      blobs: (string | null | undefined)[];
      doubles: (number | null | undefined)[];
      indexes: (string | null | undefined)[];
    };

    assert.deepEqual(point.blobs, ["staging", "GET", "/editor/queue/next", "editor", "2xx"]);
    assert.deepEqual(point.doubles, [14.5, 200, 3, 10, 1, 4.2]);
    assert.deepEqual(point.indexes, ["req-123"]);
  });

  test("classifica erros 4xx e 5xx na telemetria", () => {
    const recorded: unknown[] = [];
    const mockDataset: AnalyticsEngineDataset = {
      writeDataPoint(data) {
        recorded.push(data);
      },
    };

    recordApiTelemetry(mockDataset, {
      requestId: "req-404",
      method: "GET",
      path: "/rota-inexistente",
      status: 404,
      durationMs: 2.1,
    });

    recordApiTelemetry(mockDataset, {
      requestId: "req-500",
      method: "POST",
      path: "/api/missions",
      status: 500,
      durationMs: 10.3,
    });

    assert.equal(recorded.length, 2);
    const p1 = recorded[0] as { blobs: string[] };
    const p2 = recorded[1] as { blobs: string[] };
    assert.equal(p1.blobs[4], "4xx");
    assert.equal(p2.blobs[4], "5xx");
  });

  test("grava métricas de tarefas em segundo plano", () => {
    const recorded: unknown[] = [];
    const mockDataset: AnalyticsEngineDataset = {
      writeDataPoint(data) {
        recorded.push(data);
      },
    };

    recordBackgroundTelemetry(mockDataset, {
      task: "mission-queue-sweep",
      durationMs: 35.8,
      success: true,
      environment: "production",
      d1: {
        queries: 5,
        rowsRead: 25,
        rowsWritten: 2,
        durationMs: 18.2,
      },
    });

    assert.equal(recorded.length, 1);
    const point = recorded[0] as {
      blobs: (string | null | undefined)[];
      doubles: (number | null | undefined)[];
      indexes: (string | null | undefined)[];
    };
    assert.deepEqual(point.blobs, ["production", "BACKGROUND", "mission-queue-sweep", "success"]);
    assert.deepEqual(point.doubles, [35.8, 1, 5, 25, 2, 18.2]);
    assert.deepEqual(point.indexes, ["mission-queue-sweep"]);
  });

  test("ignora em silêncio quando dataset não está configurado", () => {
    // Não deve lançar erro
    recordApiTelemetry(undefined, {
      requestId: "req-1",
      method: "GET",
      path: "/health",
      status: 200,
      durationMs: 1,
    });
    recordBackgroundTelemetry(undefined, {
      task: "cron",
      durationMs: 5,
      success: true,
    });
  });
});
