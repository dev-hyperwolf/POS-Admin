// test/helpers.mjs — a fetch-shaped fake HTTP client. Never touches the network: every
// BlazeProvider/HwposProvider test injects this instead of global fetch.

export function jsonResponse(status, body, headers = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    status,
    headers: { get: (name) => (h.has(name.toLowerCase()) ? h.get(name.toLowerCase()) : null) },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

/**
 * Builds a fake `http(url, opts)` function from an ordered list of matcher/response pairs.
 * Each entry: {match: (url, opts) => boolean, respond: (url, opts, callIndex) => responseLike}.
 * Records every call in `.calls` for assertions.
 */
export function makeFakeHttp(handlers) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const h of handlers) {
      if (h.match(url, opts)) return h.respond(url, opts, calls.length - 1);
    }
    throw new Error(`no handler matched ${opts.method || 'GET'} ${url}`);
  };
  fn.calls = calls;
  return fn;
}

export function noopSleep() {
  return Promise.resolve();
}
