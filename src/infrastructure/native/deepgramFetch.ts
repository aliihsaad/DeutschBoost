type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type InvokeLike = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface DeepgramProxyResponse {
  status: number;
  body: string;
  content_type?: string;
  contentType?: string;
}

interface NativeDeepgramGlobal {
  isTauri?: boolean;
  __TAURI_INTERNALS__?: unknown;
}

const LOCAL_DEEPGRAM_PREFIX = '/api/deepgram';
const DEEPGRAM_ORIGIN = 'https://api.deepgram.com';

let installedInvokePromise: Promise<InvokeLike> | null = null;

export function createInstalledNativeDeepgramFetch(
  globalScope: NativeDeepgramGlobal = globalThis as NativeDeepgramGlobal
): FetchLike | null {
  if (!globalScope.isTauri && !globalScope.__TAURI_INTERNALS__) {
    return null;
  }

  return createTauriDeepgramFetch(async (command, args) => {
    const invoke = await loadInstalledInvoke();
    return invoke(command, args);
  });
}

export function createTauriDeepgramFetch(invoke: InvokeLike): FetchLike {
  return async (input, init) => {
    const request = parseDeepgramRequest(input);

    if (!request) {
      return fetch(input, init);
    }

    const apiKey = readDeepgramApiKey(init?.headers);

    if (!apiKey) {
      return jsonResponse(401, {
        err_msg: 'Deepgram API key is required',
      });
    }

    if (request.path === '/v1/auth/token') {
      return proxyResponseToFetchResponse(
        await invoke<DeepgramProxyResponse>('deepgram_auth_token', { apiKey })
      );
    }

    if (request.path === '/v1/listen') {
      const audio = await bodyToNumberArray(init?.body);
      return proxyResponseToFetchResponse(
        await invoke<DeepgramProxyResponse>('deepgram_transcribe', {
          apiKey,
          model: request.searchParams.get('model') ?? 'nova-3',
          language: request.searchParams.get('language') ?? 'de',
          audio,
          mimeType: readHeader(init?.headers, 'Content-Type') ?? 'application/octet-stream',
          punctuate: readOptionalBoolean(request.searchParams, 'punctuate'),
          smartFormat: readOptionalBoolean(request.searchParams, 'smart_format'),
          diarize: readOptionalBoolean(request.searchParams, 'diarize'),
        })
      );
    }

    return fetch(input, init);
  };
}

async function loadInstalledInvoke(): Promise<InvokeLike> {
  installedInvokePromise ??= import('@tauri-apps/api/core').then(api => api.invoke as InvokeLike);
  return installedInvokePromise;
}

function parseDeepgramRequest(input: string): { path: string; searchParams: URLSearchParams } | null {
  const url = new URL(input, 'http://tauri.localhost');

  if (url.origin === DEEPGRAM_ORIGIN) {
    return {
      path: url.pathname,
      searchParams: url.searchParams,
    };
  }

  if (url.origin === 'http://tauri.localhost' && url.pathname.startsWith(LOCAL_DEEPGRAM_PREFIX)) {
    return {
      path: url.pathname.slice(LOCAL_DEEPGRAM_PREFIX.length),
      searchParams: url.searchParams,
    };
  }

  return null;
}

function readDeepgramApiKey(headers: HeadersInit | undefined): string | null {
  const authorization = readHeader(headers, 'Authorization');
  const token = authorization?.match(/^Token\s+(.+)$/i)?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

function readHeader(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) {
    return null;
  }

  return new Headers(headers).get(name);
}

async function bodyToNumberArray(body: BodyInit | null | undefined): Promise<number[]> {
  if (!body) {
    return [];
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return Array.from(new Uint8Array(await body.arrayBuffer()));
  }

  if (body instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(body));
  }

  if (ArrayBuffer.isView(body)) {
    return Array.from(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  }

  if (typeof body === 'string') {
    return Array.from(new TextEncoder().encode(body));
  }

  throw new Error('Unsupported Deepgram audio body type');
}

function readOptionalBoolean(params: URLSearchParams, key: string): boolean | null {
  const value = params.get(key);

  if (value === null) {
    return null;
  }

  return value === 'true';
}

function proxyResponseToFetchResponse(response: DeepgramProxyResponse): Response {
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.content_type ?? response.contentType ?? 'application/json',
    },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
