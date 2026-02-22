// Minimal polyfills for Web Fetch API classes used by `next/server` during tests.
// These are intentionally small — tests only need basic shape (Request/Response/Headers).

if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = class Request {
    constructor(input, init) {
      this.input = input;
      this.init = init;
      this.method = (init && init.method) || 'GET';
      this.headers = (init && init.headers) || {};
      this.url = typeof input === 'string' ? input : input?.url;
      this.nextUrl = { searchParams: new URL(this.url || 'http://localhost').searchParams };
    }
    async arrayBuffer() {
      return new ArrayBuffer(0);
    }
    async text() {
      return '';
    }
  };
}

if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class Response {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.headers = new globalThis.Headers(init.headers || {});
    }
    static json(data, init = {}) {
      return new Response(JSON.stringify(data), init);
    }
    get body() {
      return this._body;
    }

    async json() {
      if (typeof this._body === 'string') return JSON.parse(this._body);
      return this._body;
    }

    async arrayBuffer() {
      if (this._body instanceof ArrayBuffer) return this._body;
      if (Buffer.isBuffer(this._body)) return this._body.buffer.slice(this._body.byteOffset, this._body.byteOffset + this._body.byteLength);
      if (typeof this._body === 'string') return Buffer.from(this._body).buffer;
      return new ArrayBuffer(0);
    }

    async text() {
      if (typeof this._body === 'string') return this._body;
      return '';
    }
  };
}

if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = class Headers {
    constructor(init = {}) {
      this.map = Object.assign({}, init);
    }
    get(k) {
      return this.map[k.toLowerCase()] || this.map[k];
    }
    set(k, v) {
      this.map[k.toLowerCase()] = v;
    }
    has(k) {
      return Object.prototype.hasOwnProperty.call(this.map, k.toLowerCase());
    }
  };
}

// Provide a no-op fetch so imports that reference it won't crash in tests.
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = async () => new Response(null, { status: 204 });
}

// TextEncoder (used in tests for binary data)
if (typeof globalThis.TextEncoder === 'undefined') {
  // Node's util exports TextEncoder in modern versions
  try {
    const { TextEncoder } = require('util');
    globalThis.TextEncoder = TextEncoder;
  } catch (e) {
    globalThis.TextEncoder = class TextEncoder { encode(s) { return Buffer.from(String(s)); } };
  }
}

// Patch NextResponse prototype (when next/server is loaded in tests) so instances
// expose a working json() method that returns the parsed body. This keeps tests
// consistent when route handlers return NextResponse objects.
try {
  // require('next/server') is a CJS wrapper that exposes NextResponse
  const nextServer = require('next/server');
  if (nextServer && nextServer.NextResponse) {
    const NR = nextServer.NextResponse;
    if (!NR.prototype.json) {
      NR.prototype.json = async function () {
        // prefer string body
        const body = (this && this.body) || (this && this._body);
        if (typeof body === 'string') return JSON.parse(body);
        if (body && typeof body === 'object') return body;
        return {};
      };
    }
  }
} catch (e) {
  // next/server may not be available while running isolated unit tests; ignore
}

