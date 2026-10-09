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

/** Per-method results for `client.storage.from(bucket)`; defaults to success. */
export interface FakeStorageResults {
  upload?: FakeResult;
  remove?: FakeResult;
  createSignedUrl?: FakeResult;
}

/**
 * Result for a query chain. Either one fixed result for every chain, or a resolver keyed by the
 * chain's target: the table name for `from(table)`, or `rpc:<fn>` for `rpc(fn)`.
 */
export type FakeResultSource = FakeResult | ((target: string) => FakeResult);

export function createFakeSupabase(
  result: FakeResultSource,
  storageResults: FakeStorageResults = {},
) {
  const calls: RecordedCall[] = [];
  const resolve = (target: string): FakeResult =>
    typeof result === 'function' ? result(target) : result;

  // Each from()/rpc() starts its own chain, so concurrent queries never share state.
  const chain = (target: string) => {
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
        return resolve(target);
      };
    const builder = {
      select: record('select'),
      insert: record('insert'),
      update: record('update'),
      delete: record('delete'),
      eq: record('eq'),
      or: record('or'),
      order: record('order'),
      single: settle('single'),
      maybeSingle: settle('maybeSingle'),
      // Awaiting the builder directly (list queries) resolves to the result.
      then: (onFulfilled: (value: FakeResult) => unknown) =>
        Promise.resolve(resolve(target)).then(onFulfilled),
    };
    return builder;
  };
  const storageCall =
    (bucket: string, method: keyof FakeStorageResults, fallback: FakeResult) =>
    async (...args: unknown[]) => {
      // Binary bodies are recorded by type only, to keep assertions readable.
      const recorded = args.map((arg) => (arg instanceof ArrayBuffer ? 'ArrayBuffer' : arg));
      calls.push({ method: `storage.${method}`, args: [bucket, ...recorded] });
      return storageResults[method] ?? fallback;
    };
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: storageCall(bucket, 'upload', { data: { path: 'ok' }, error: null }),
        remove: storageCall(bucket, 'remove', { data: [], error: null }),
        createSignedUrl: storageCall(bucket, 'createSignedUrl', {
          data: { signedUrl: 'https://example.test/signed' },
          error: null,
        }),
      }),
    },
    from: (table: string) => (calls.push({ method: 'from', args: [table] }), chain(table)),
    // rpc() is chainable (e.g. `.rpc(...).single()`) and also awaitable directly.
    rpc: (fn: string, args: unknown) => (
      calls.push({ method: 'rpc', args: [fn, args] }),
      chain(`rpc:${fn}`)
    ),
  };
  return { client, calls };
}
