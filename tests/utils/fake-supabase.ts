/**
 * Minimal chainable fake of the supabase-js PostgREST query builder for data-layer unit tests.
 * Records every call so tests can assert exactly what would be sent to the database.
 */
export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface FakeResult {
  data: unknown;
  error: unknown;
}

export function createFakeSupabase(result: FakeResult) {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  const settle =
    (method: string) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      return result;
    };
  const builder = {
    select: record('select'),
    insert: record('insert'),
    update: record('update'),
    delete: record('delete'),
    eq: record('eq'),
    order: record('order'),
    single: settle('single'),
    maybeSingle: settle('maybeSingle'),
    // Awaiting the builder directly (list queries) resolves to the result.
    then: (resolve: (value: FakeResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  const client = {
    from: (table: string) => (calls.push({ method: 'from', args: [table] }), builder),
    rpc: async (fn: string, args: unknown) => {
      calls.push({ method: 'rpc', args: [fn, args] });
      return result;
    },
  };
  return { client, calls };
}
