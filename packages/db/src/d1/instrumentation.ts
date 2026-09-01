import { AsyncLocalStorage } from "node:async_hooks";
import type { D1DatabaseLike, D1MetaLike, D1PreparedStatementLike } from "./types.ts";

export type D1QueryMetric = {
  query: string;
  durationMs: number;
  rowsRead: number;
  rowsWritten: number;
  changes: number;
  success: boolean;
  error?: string;
};

export type D1MetricsSummary = {
  queries: number;
  durationMs: number;
  rowsRead: number;
  rowsWritten: number;
  slowQueries: D1QueryMetric[];
};

export class D1MetricsCollector {
  private metrics: D1QueryMetric[] = [];
  private readonly slowQueryThresholdMs: number;

  constructor(options?: { slowQueryThresholdMs?: number }) {
    this.slowQueryThresholdMs = options?.slowQueryThresholdMs ?? 50;
  }

  record(metric: D1QueryMetric): void {
    this.metrics.push(metric);
  }

  getSummary(): D1MetricsSummary {
    let durationMs = 0;
    let rowsRead = 0;
    let rowsWritten = 0;
    const slowQueries: D1QueryMetric[] = [];

    for (const m of this.metrics) {
      durationMs += m.durationMs;
      rowsRead += m.rowsRead;
      rowsWritten += m.rowsWritten;
      if (m.durationMs >= this.slowQueryThresholdMs) {
        slowQueries.push(m);
      }
    }

    return {
      queries: this.metrics.length,
      durationMs: Number(durationMs.toFixed(2)),
      rowsRead,
      rowsWritten,
      slowQueries,
    };
  }

  getMetrics(): readonly D1QueryMetric[] {
    return this.metrics;
  }

  reset(): void {
    this.metrics = [];
  }
}

const asyncLocalStorage = new AsyncLocalStorage<D1MetricsCollector>();

export function runWithD1Metrics<T>(
  collector: D1MetricsCollector,
  fn: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run(collector, fn);
}

export function getActiveD1Metrics(): D1MetricsCollector | null {
  return asyncLocalStorage.getStore() ?? null;
}

export type InstrumentD1Options = {
  slowQueryThresholdMs?: number;
  onQuery?: (metric: D1QueryMetric) => void;
  collector?: D1MetricsCollector;
};

function extractMeta(meta?: Partial<D1MetaLike>): {
  rowsRead: number;
  rowsWritten: number;
  changes: number;
} {
  return {
    rowsRead: typeof meta?.rows_read === "number" ? meta.rows_read : 0,
    rowsWritten: typeof meta?.rows_written === "number" ? meta.rows_written : (meta?.changes ?? 0),
    changes: typeof meta?.changes === "number" ? meta.changes : 0,
  };
}

export function instrumentD1Database(
  db: D1DatabaseLike,
  options?: InstrumentD1Options,
): D1DatabaseLike {
  // If already instrumented, avoid wrapping multiple times
  if ((db as { __instrumented?: boolean }).__instrumented) {
    return db;
  }

  function reportMetric(metric: D1QueryMetric) {
    if (options?.collector) {
      options.collector.record(metric);
    }
    const active = getActiveD1Metrics();
    if (active && active !== options?.collector) {
      active.record(metric);
    }
    options?.onQuery?.(metric);
  }

  const instrumented: D1DatabaseLike = {
    prepare(query: string) {
      const stmt = db.prepare(query);
      return wrapStatement(stmt, query);
    },

    async batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]> {
      if (!db.batch) {
        throw new Error("D1 batch not supported on this database instance");
      }
      const start = performance.now();
      try {
        const results = await db.batch<T>(statements);
        const durationMs = Number((performance.now() - start).toFixed(2));

        let totalRowsRead = 0;
        let totalRowsWritten = 0;
        let totalChanges = 0;

        for (const res of results as unknown as Array<{ meta?: D1MetaLike }>) {
          const meta = extractMeta(res?.meta);
          totalRowsRead += meta.rowsRead;
          totalRowsWritten += meta.rowsWritten;
          totalChanges += meta.changes;
        }

        reportMetric({
          query: `BATCH (${statements.length} statements)`,
          durationMs,
          rowsRead: totalRowsRead,
          rowsWritten: totalRowsWritten,
          changes: totalChanges,
          success: true,
        });

        return results;
      } catch (err) {
        const durationMs = Number((performance.now() - start).toFixed(2));
        reportMetric({
          query: `BATCH (${statements.length} statements)`,
          durationMs,
          rowsRead: 0,
          rowsWritten: 0,
          changes: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };

  Object.defineProperty(instrumented, "__instrumented", { value: true, enumerable: false });

  function wrapStatement(stmt: D1PreparedStatementLike, query: string): D1PreparedStatementLike {
    return {
      bind(...values: unknown[]) {
        const boundStmt = stmt.bind(...values);
        return wrapStatement(boundStmt, query);
      },

      async first<T = Record<string, unknown>>() {
        const start = performance.now();
        try {
          const result = await stmt.first<T>();
          const durationMs = Number((performance.now() - start).toFixed(2));
          reportMetric({
            query,
            durationMs,
            rowsRead: result ? 1 : 0,
            rowsWritten: 0,
            changes: 0,
            success: true,
          });
          return result;
        } catch (err) {
          const durationMs = Number((performance.now() - start).toFixed(2));
          reportMetric({
            query,
            durationMs,
            rowsRead: 0,
            rowsWritten: 0,
            changes: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },

      async all<T = Record<string, unknown>>() {
        const start = performance.now();
        try {
          const result = await stmt.all<T>();
          const durationMs = Number((performance.now() - start).toFixed(2));
          const meta = extractMeta(result.meta);
          reportMetric({
            query,
            durationMs,
            rowsRead: meta.rowsRead || (result.results?.length ?? 0),
            rowsWritten: meta.rowsWritten,
            changes: meta.changes,
            success: true,
          });
          return result;
        } catch (err) {
          const durationMs = Number((performance.now() - start).toFixed(2));
          reportMetric({
            query,
            durationMs,
            rowsRead: 0,
            rowsWritten: 0,
            changes: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },

      async run() {
        const start = performance.now();
        try {
          const result = await stmt.run();
          const durationMs = Number((performance.now() - start).toFixed(2));
          const meta = extractMeta(result.meta);
          reportMetric({
            query,
            durationMs,
            rowsRead: meta.rowsRead,
            rowsWritten: meta.rowsWritten || meta.changes,
            changes: meta.changes,
            success: true,
          });
          return result;
        } catch (err) {
          const durationMs = Number((performance.now() - start).toFixed(2));
          reportMetric({
            query,
            durationMs,
            rowsRead: 0,
            rowsWritten: 0,
            changes: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },
    };
  }

  return instrumented;
}
