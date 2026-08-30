export type D1ResultLike = { meta: { changes: number } };

export type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1ResultLike>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
};
