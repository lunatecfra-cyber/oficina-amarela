export type D1MetaLike = {
  changes: number;
  duration?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
};

export type D1ResultLike = {
  meta: D1MetaLike;
  results?: unknown[];
  success?: boolean;
};

export type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta?: Partial<D1MetaLike> }>;
  run(): Promise<D1ResultLike>;
  raw?<T = unknown[]>(): Promise<T[]>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
  batch?<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
};
