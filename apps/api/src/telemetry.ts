export type AnalyticsEngineDataset = {
  writeDataPoint(data: {
    blobs?: (string | null | undefined)[];
    doubles?: (number | null | undefined)[];
    indexes?: (string | null | undefined)[];
  }): void;
};

export type ApiTelemetryEvent = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  role?: string;
  environment?: string;
  d1?: {
    queries: number;
    rowsRead: number;
    rowsWritten: number;
    durationMs: number;
  };
};

export type BackgroundTelemetryEvent = {
  task: string;
  durationMs: number;
  success: boolean;
  environment?: string;
  d1?: {
    queries: number;
    rowsRead: number;
    rowsWritten: number;
    durationMs: number;
  };
};

export function recordApiTelemetry(
  dataset: AnalyticsEngineDataset | undefined,
  event: ApiTelemetryEvent,
): void {
  if (!dataset) return;

  try {
    const statusCategory = event.status >= 500 ? "5xx" : event.status >= 400 ? "4xx" : "2xx";
    dataset.writeDataPoint({
      blobs: [
        event.environment ?? "production",
        event.method,
        event.path,
        event.role ?? "anonymous",
        statusCategory,
      ],
      doubles: [
        event.durationMs,
        event.status,
        event.d1?.queries ?? 0,
        event.d1?.rowsRead ?? 0,
        event.d1?.rowsWritten ?? 0,
        event.d1?.durationMs ?? 0,
      ],
      indexes: [event.requestId],
    });
  } catch (err) {
    // Telemetry must never crash the request path
    console.error("[telemetry] Failed to record API data point:", err);
  }
}

export function recordBackgroundTelemetry(
  dataset: AnalyticsEngineDataset | undefined,
  event: BackgroundTelemetryEvent,
): void {
  if (!dataset) return;

  try {
    dataset.writeDataPoint({
      blobs: [
        event.environment ?? "production",
        "BACKGROUND",
        event.task,
        event.success ? "success" : "failure",
      ],
      doubles: [
        event.durationMs,
        event.success ? 1 : 0,
        event.d1?.queries ?? 0,
        event.d1?.rowsRead ?? 0,
        event.d1?.rowsWritten ?? 0,
        event.d1?.durationMs ?? 0,
      ],
      indexes: [event.task],
    });
  } catch (err) {
    console.error("[telemetry] Failed to record background data point:", err);
  }
}
