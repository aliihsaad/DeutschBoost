# DeutschBoost Deepgram TTS Release Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace misleading system TTS playback with provider-backed Deepgram TTS for settings tests, listening practice, vocabulary playback, and tutor reply playback before the next desktop release.

**Architecture:** Extend the existing `SpeechProvider` contract with `synthesize()` so Deepgram can own both STT and TTS behind one local settings key. Route Deepgram `/v1/speak` through the same Tauri/native bridge used for `/v1/listen`, and keep browser `speechSynthesis` only as an explicit fallback when no provider is configured.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri 2, Rust `reqwest`, Deepgram REST TTS `/v1/speak`, existing provider settings repository and Stronghold-backed secrets.

---

## File Map

- `src/domain/speech/speechProvider.ts`: add speech synthesis request/result types and `SpeechProvider.synthesize`.
- `src/domain/speech/deepgramProvider.ts`: implement REST Deepgram TTS and keep existing STT behavior.
- `tests/domain/speech/deepgramProvider.test.ts`: prove TTS URL, headers, binary result, and error handling.
- `src/domain/settings/providerSettings.ts`: add `ttsModel`, German Aura voice options, defaults, snapshots.
- `src/domain/settings/providerSettingsRepository.ts`: normalize/migrate missing `ttsModel`.
- `tests/domain/settings/providerSettings.test.ts`: prove provider creation and default TTS model.
- `tests/domain/settings/providerSettingsRepository.test.ts`: prove older saved settings receive `ttsModel`.
- `src/infrastructure/native/deepgramFetch.ts`: proxy `/api/deepgram/v1/speak` to a Tauri command.
- `tests/infrastructure/native/deepgramFetch.test.ts`: prove native bridge routes TTS without leaking keys.
- `src-tauri/src/lib.rs`: add `deepgram_speak` command returning binary audio bytes.
- `pages/LocalSettingsPage.tsx`: add TTS voice dropdown and "Play test voice" button.
- `tests/pages/LocalSettingsPage.test.tsx`: prove TTS voice selection and generated test sample.
- `MainApp.tsx`: pass `speechProvider` to `ActivityPage`.
- `tests/MainApp.providerRuntime.test.tsx`: prove activity routes receive Deepgram provider.
- `pages/ActivityPage.tsx`: use `speechProvider.synthesize` for listening and vocabulary playback; system TTS only fallback.
- `tests/pages/ActivityPage.voice.test.tsx`: prove listening/vocabulary playback uses Deepgram provider.
- `pages/SpeakingActivityPage.tsx`: use `speechProvider.synthesize` for tutor reply playback.
- `tests/pages/SpeakingActivityPage.test.tsx`: prove tutor reply playback uses Deepgram TTS.
- `docs/release/native-release-readiness.md`: update release blocker note after implementation.

## Task 1: Extend Speech Provider With Deepgram TTS

**Files:**
- Modify: `src/domain/speech/speechProvider.ts`
- Modify: `src/domain/speech/deepgramProvider.ts`
- Test: `tests/domain/speech/deepgramProvider.test.ts`

- [ ] **Step 1: Write failing Deepgram TTS tests**

Add these tests to `tests/domain/speech/deepgramProvider.test.ts`:

```ts
it('synthesizes German speech through Deepgram Aura TTS', async () => {
  const audioBytes = new Uint8Array([1, 2, 3, 4]);
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(audioBytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'dg-request-id': 'deepgram-tts-1',
      },
    })
  );
  const provider = createDeepgramSpeechProvider({
    apiKey: 'deepgram-key',
    model: 'nova-3',
    language: 'de',
    ttsModel: 'aura-2-viktoria-de',
    fetchFn,
  });

  const result = await provider.synthesize({
    feature: 'listening-practice',
    text: 'Guten Morgen. Wie geht es dir?',
  });

  expect(new Uint8Array(result.audio)).toEqual(audioBytes);
  expect(result.mimeType).toBe('audio/mpeg');
  expect(result.providerMetadata).toEqual(
    expect.objectContaining({ requestId: 'deepgram-tts-1' })
  );
  expect(fetchFn).toHaveBeenCalledWith(
    '/api/deepgram/v1/speak?model=aura-2-viktoria-de',
    expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Token deepgram-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Guten Morgen. Wie geht es dir?' }),
    })
  );
});

it('allows a per-request Deepgram TTS voice override', async () => {
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(new Uint8Array([5]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  );
  const provider = createDeepgramSpeechProvider({
    apiKey: 'deepgram-key',
    ttsModel: 'aura-2-viktoria-de',
    fetchFn,
  });

  await provider.synthesize({
    feature: 'vocabulary-pronunciation',
    text: 'der Bahnhof',
    options: { ttsModel: 'aura-2-julius-de' },
  });

  expect(fetchFn).toHaveBeenCalledWith(
    '/api/deepgram/v1/speak?model=aura-2-julius-de',
    expect.any(Object)
  );
});

it('reports a provider error when Deepgram TTS returns app HTML', async () => {
  const fetchFn = vi.fn().mockResolvedValue(
    new Response('<!DOCTYPE html><html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  );
  const provider = createDeepgramSpeechProvider({
    apiKey: 'deepgram-key',
    fetchFn,
  });

  await expect(
    provider.synthesize({
      feature: 'settings-deepgram-tts-test',
      text: 'Hallo.',
    })
  ).rejects.toMatchObject({
    message: 'Deepgram endpoint returned the app HTML instead of audio. Check the desktop provider bridge.',
    provider: 'deepgram',
    feature: 'settings-deepgram-tts-test',
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test:run -- tests/domain/speech/deepgramProvider.test.ts
```

Expected: FAIL because `ttsModel`, `SpeechProvider.synthesize`, and the TTS implementation do not exist yet.

- [ ] **Step 3: Extend the speech provider contract**

Change `src/domain/speech/speechProvider.ts` to include:

```ts
export interface SpeechSynthesisOptions {
  ttsModel?: string;
  language?: string;
  format?: 'mp3';
  speed?: number;
}

export interface SpeechSynthesisRequest {
  feature: string;
  text: string;
  options?: SpeechSynthesisOptions;
}

export interface SpeechSynthesisResult {
  audio: ArrayBuffer;
  mimeType: string;
  providerMetadata?: Record<string, unknown>;
}

export interface SpeechProvider {
  id: string;
  displayName: string;
  transcribe(request: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult>;
  synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
}
```

- [ ] **Step 4: Implement Deepgram TTS**

In `src/domain/speech/deepgramProvider.ts`:

```ts
interface DeepgramSpeechProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  ttsBaseUrl?: string;
  model?: string;
  ttsModel?: string;
  language?: string;
  fetchFn?: FetchLike;
  now?: () => string;
}

const DEFAULT_TTS_BASE_URL = '/api/deepgram/v1/speak';
const DEFAULT_TTS_MODEL = 'aura-2-viktoria-de';

const buildSynthesisUrl = (
  providerOptions: DeepgramSpeechProviderOptions,
  request: SpeechSynthesisRequest
): string => {
  const params = new URLSearchParams();
  params.set('model', request.options?.ttsModel ?? providerOptions.ttsModel ?? DEFAULT_TTS_MODEL);

  if (request.options?.speed !== undefined) {
    params.set('speed', String(request.options.speed));
  }

  return `${providerOptions.ttsBaseUrl ?? DEFAULT_TTS_BASE_URL}?${params.toString()}`;
};

const readAudioResponse = async (response: Response): Promise<ArrayBuffer> => {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('text/html')) {
    await response.text();
    throw new Error('Deepgram endpoint returned the app HTML instead of audio. Check the desktop provider bridge.');
  }

  return response.arrayBuffer();
};
```

Add `synthesize` to the returned provider:

```ts
async synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
  if (!options.apiKey?.trim()) {
    throw new SpeechProviderError('Deepgram API key is required', {
      provider: providerId,
      feature: request.feature,
      retryable: false,
    });
  }

  const response = await fetchFn(buildSynthesisUrl(options, request), {
    method: 'POST',
    headers: {
      Authorization: `Token ${options.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: request.text }),
  });

  if (!response.ok) {
    throw new SpeechProviderError(`Deepgram TTS request failed: ${await readErrorMessage(response)}`, {
      provider: providerId,
      feature: request.feature,
      retryable: isRetryableStatus(response.status),
    });
  }

  try {
    return {
      audio: await readAudioResponse(response),
      mimeType: response.headers.get('Content-Type') ?? 'audio/mpeg',
      providerMetadata: {
        requestId: response.headers.get('dg-request-id') ?? undefined,
        model: response.headers.get('dg-model-name') ?? undefined,
      },
    };
  } catch (error) {
    throw new SpeechProviderError(
      error instanceof Error ? error.message : String(error),
      {
        provider: providerId,
        feature: request.feature,
        retryable: false,
      }
    );
  }
}
```

- [ ] **Step 5: Run the focused test**

Run:

```powershell
npm run test:run -- tests/domain/speech/deepgramProvider.test.ts
```

Expected: PASS.

## Task 2: Add Deepgram TTS Settings

**Files:**
- Modify: `src/domain/settings/providerSettings.ts`
- Modify: `src/domain/settings/providerSettingsRepository.ts`
- Test: `tests/domain/settings/providerSettings.test.ts`
- Test: `tests/domain/settings/providerSettingsRepository.test.ts`

- [ ] **Step 1: Write failing settings tests**

Add to `tests/domain/settings/providerSettings.test.ts`:

```ts
it('defaults Deepgram TTS to a German Aura voice', () => {
  const settings = createDefaultLocalProviderSettings();

  expect(settings.speech.ttsModel).toBe('aura-2-viktoria-de');
});

it('passes Deepgram TTS model into the speech provider', async () => {
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({
      results: { channels: [{ alternatives: [{ transcript: 'Hallo', confidence: 0.9 }] }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  );
  const provider = createSpeechProviderFromSettings(
    {
      enabled: true,
      provider: 'deepgram',
      apiKey: 'deepgram-key',
      model: 'nova-3',
      ttsModel: 'aura-2-julius-de',
      language: 'de',
    },
    { fetchFn }
  );

  await provider?.synthesize({
    feature: 'settings-test',
    text: 'Hallo.',
  });

  expect(fetchFn).toHaveBeenCalledWith(
    '/api/deepgram/v1/speak?model=aura-2-julius-de',
    expect.any(Object)
  );
});
```

Add to `tests/domain/settings/providerSettingsRepository.test.ts`:

```ts
it('migrates older Deepgram settings without a TTS model', async () => {
  const storage = createMemoryStorage({
    [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
      ai: { enabled: false, provider: 'openrouter', model: 'openrouter/auto' },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
      },
    }),
  });
  const repository = createStorageProviderSettingsRepository({ storage });

  const loaded = await repository.load();

  expect(loaded.speech.ttsModel).toBe('aura-2-viktoria-de');
});
```

- [ ] **Step 2: Run the failing settings tests**

Run:

```powershell
npm run test:run -- tests/domain/settings/providerSettings.test.ts tests/domain/settings/providerSettingsRepository.test.ts
```

Expected: FAIL because `ttsModel` and `DEEPGRAM_TTS_MODEL_OPTIONS` do not exist yet.

- [ ] **Step 3: Add TTS model options and defaults**

In `src/domain/settings/providerSettings.ts`:

```ts
export interface LocalSpeechProviderSettings {
  enabled: boolean;
  provider: SpeechProviderSetting;
  apiKey?: string;
  model: string;
  ttsModel: string;
  language: string;
}

const DEFAULT_DEEPGRAM_TTS_MODEL = 'aura-2-viktoria-de';

export const DEEPGRAM_TTS_MODEL_OPTIONS: ProviderModelOption[] = [
  { value: 'aura-2-viktoria-de', label: 'Viktoria (German)' },
  { value: 'aura-2-julius-de', label: 'Julius (German)' },
  { value: 'aura-2-elara-de', label: 'Elara (German)' },
  { value: 'aura-2-fabian-de', label: 'Fabian (German)' },
];
```

Update `createDefaultLocalProviderSettings()`:

```ts
speech: {
  enabled: false,
  provider: 'deepgram',
  model: DEFAULT_DEEPGRAM_MODEL,
  ttsModel: DEFAULT_DEEPGRAM_TTS_MODEL,
  language: DEFAULT_DEEPGRAM_LANGUAGE,
},
```

Update `createSpeechProviderFromSettings()`:

```ts
return createDeepgramSpeechProvider({
  apiKey: settings.apiKey,
  model: settings.model,
  ttsModel: settings.ttsModel,
  language: settings.language,
  fetchFn: dependencies.fetchFn,
  now: dependencies.now,
});
```

- [ ] **Step 4: Normalize older settings**

In `src/domain/settings/providerSettingsRepository.ts`, import `DEEPGRAM_TTS_MODEL_OPTIONS` and add:

```ts
ttsModel: normalizeModelOption(speech.ttsModel, DEEPGRAM_TTS_MODEL_OPTIONS, defaults.speech.ttsModel),
```

inside the normalized `speech` object.

Update existing exact settings literals in `tests/domain/settings/providerSettingsRepository.test.ts` and `tests/pages/LocalSettingsPage.test.tsx` so saved Deepgram settings include:

```ts
ttsModel: 'aura-2-viktoria-de',
```

When a test intentionally represents older saved data, omit `ttsModel` and assert the normalized result includes the default.

- [ ] **Step 5: Run settings tests**

Run:

```powershell
npm run test:run -- tests/domain/settings/providerSettings.test.ts tests/domain/settings/providerSettingsRepository.test.ts
```

Expected: PASS.

## Task 3: Route Deepgram TTS Through Tauri

**Files:**
- Modify: `src/infrastructure/native/deepgramFetch.ts`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/infrastructure/native/deepgramFetch.test.ts`

- [ ] **Step 1: Write failing Tauri bridge test**

Add to `tests/infrastructure/native/deepgramFetch.test.ts`:

```ts
it('routes Deepgram TTS requests through the native bridge', async () => {
  const invoke = vi.fn().mockResolvedValue({
    status: 200,
    body: '',
    body_bytes: [9, 8, 7],
    content_type: 'audio/mpeg',
  });
  const fetchFn = createTauriDeepgramFetch(invoke);

  const response = await fetchFn('/api/deepgram/v1/speak?model=aura-2-viktoria-de', {
    method: 'POST',
    headers: {
      Authorization: 'Token deepgram-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: 'Hallo.' }),
  });

  expect(invoke).toHaveBeenCalledWith('deepgram_speak', {
    apiKey: 'deepgram-key',
    model: 'aura-2-viktoria-de',
    text: 'Hallo.',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
});
```

- [ ] **Step 2: Run the failing bridge test**

Run:

```powershell
npm run test:run -- tests/infrastructure/native/deepgramFetch.test.ts
```

Expected: FAIL because `/v1/speak` is not routed.

- [ ] **Step 3: Extend the TypeScript bridge**

In `src/infrastructure/native/deepgramFetch.ts`, change the response interface:

```ts
interface DeepgramProxyResponse {
  status: number;
  body?: string;
  body_bytes?: number[];
  bodyBytes?: number[];
  content_type?: string;
  contentType?: string;
}
```

Add route handling:

```ts
if (request.path === '/v1/speak') {
  const payload = await readJsonBody<{ text?: string }>(init?.body);
  return proxyResponseToFetchResponse(
    await invoke<DeepgramProxyResponse>('deepgram_speak', {
      apiKey,
      model: request.searchParams.get('model') ?? 'aura-2-viktoria-de',
      text: payload.text ?? '',
    })
  );
}
```

Add helper:

```ts
async function readJsonBody<T>(body: BodyInit | null | undefined): Promise<T> {
  if (!body) {
    return {} as T;
  }

  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return JSON.parse(await body.text()) as T;
  }

  if (body instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  }

  if (ArrayBuffer.isView(body)) {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  }

  throw new Error('Unsupported Deepgram JSON body type');
}
```

Update `proxyResponseToFetchResponse()`:

```ts
const bodyBytes = response.body_bytes ?? response.bodyBytes;
const body = bodyBytes ? new Uint8Array(bodyBytes) : (response.body ?? '');
return new Response(body, {
  status: response.status,
  headers: {
    'Content-Type': response.content_type ?? response.contentType ?? 'application/json',
  },
});
```

- [ ] **Step 4: Extend the Rust bridge**

In `src-tauri/src/lib.rs`, update the response struct:

```rust
#[derive(serde::Serialize)]
struct DeepgramProxyResponse {
    status: u16,
    body: String,
    body_bytes: Option<Vec<u8>>,
    content_type: String,
}
```

Set `body_bytes: None` in the existing text response helper.

Add command:

```rust
#[tauri::command]
async fn deepgram_speak(
    api_key: String,
    model: String,
    text: String,
) -> Result<DeepgramProxyResponse, String> {
    let mut url = reqwest::Url::parse("https://api.deepgram.com/v1/speak")
        .map_err(|error| format!("Could not build Deepgram TTS URL: {error}"))?;

    {
        let mut query = url.query_pairs_mut();
        query.append_pair("model", &model);
    }

    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "text": text }))
        .send()
        .await
        .map_err(|error| format!("Deepgram TTS request failed: {error}"))?;

    binary_response_to_proxy_response(response).await
}
```

Add helper:

```rust
async fn binary_response_to_proxy_response(
    response: reqwest::Response,
) -> Result<DeepgramProxyResponse, String> {
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("audio/mpeg")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read Deepgram TTS response: {error}"))?;

    Ok(DeepgramProxyResponse {
        status,
        body: String::new(),
        body_bytes: Some(bytes.to_vec()),
        content_type,
    })
}
```

Register `deepgram_speak` in `tauri::generate_handler!`.

- [ ] **Step 5: Run bridge tests and Rust format**

Run:

```powershell
npm run test:run -- tests/infrastructure/native/deepgramFetch.test.ts
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; cargo fmt --check
```

Expected: both PASS.

## Task 4: Add Settings Deepgram Speak Test

**Files:**
- Modify: `pages/LocalSettingsPage.tsx`
- Modify: `tests/pages/LocalSettingsPage.test.tsx`

- [ ] **Step 1: Write failing settings UI test**

Add to `tests/pages/LocalSettingsPage.test.tsx`:

```ts
it('generates and plays a Deepgram TTS test sample', async () => {
  const repository = createStorageProviderSettingsRepository({
    storage: createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: {
          enabled: false,
          provider: 'openrouter',
          model: 'openrouter/auto',
        },
        speech: {
          enabled: true,
          provider: 'deepgram',
          apiKey: 'deepgram-key',
          model: 'nova-3',
          ttsModel: 'aura-2-viktoria-de',
          language: 'de',
        },
      }),
    }),
  });
  const deepgramTtsTester = vi.fn().mockResolvedValue({
    audio: new Uint8Array([1, 2]).buffer,
    mimeType: 'audio/mpeg',
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:deepgram-tts-test');

  render(
    <LocalSettingsPage
      repository={repository}
      deepgramTtsTester={deepgramTtsTester}
    />
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Play test voice' }));

  await waitFor(() => {
    expect(deepgramTtsTester).toHaveBeenCalledWith({
      apiKey: 'deepgram-key',
      ttsModel: 'aura-2-viktoria-de',
      text: expect.stringContaining('Hallo'),
    });
  });
  expect(screen.getByLabelText('Deepgram TTS test playback')).toHaveAttribute(
    'src',
    'blob:deepgram-tts-test'
  );
  expect(screen.getByText('Deepgram voice sample is ready')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the failing settings UI test**

Run:

```powershell
npm run test:run -- tests/pages/LocalSettingsPage.test.tsx
```

Expected: FAIL because the TTS test prop/button do not exist.

- [ ] **Step 3: Add TTS tester prop and default**

In `pages/LocalSettingsPage.tsx`, import `DEEPGRAM_TTS_MODEL_OPTIONS` and `type SpeechSynthesisResult`. Add:

```ts
type DeepgramTtsTester = (request: DeepgramTtsTestRequest) => Promise<SpeechSynthesisResult>;

interface DeepgramTtsTestRequest {
  apiKey: string;
  ttsModel: string;
  text: string;
}
```

Extend props:

```ts
deepgramTtsTester?: DeepgramTtsTester;
```

Add default tester:

```ts
const defaultDeepgramTtsTester: DeepgramTtsTester = request =>
  createDeepgramSpeechProvider({
    apiKey: request.apiKey,
    ttsModel: request.ttsModel,
    fetchFn: createInstalledNativeDeepgramFetch() ?? undefined,
  }).synthesize({
    feature: 'settings-deepgram-tts-test',
    text: request.text,
    options: { ttsModel: request.ttsModel },
  });
```

- [ ] **Step 4: Add UI state and button**

Add state:

```ts
const [deepgramTtsTest, setDeepgramTtsTest] = useState<{
  state: ConnectionTestState;
  message: string | null;
}>({ state: 'idle', message: null });
const [ttsPlaybackUrl, setTtsPlaybackUrl] = useState<string | null>(null);
```

Add handler:

```ts
async function handlePlayDeepgramTts() {
  const apiKey = selectSecret(apiKeyDrafts.speech, settings.speech.apiKey);

  if (!apiKey) {
    setDeepgramTtsTest({ state: 'error', message: 'Add a Deepgram API key first' });
    return;
  }

  setDeepgramTtsTest({ state: 'testing', message: null });

  try {
    const result = await deepgramTtsTester({
      apiKey,
      ttsModel: settings.speech.ttsModel,
      text: 'Hallo, ich bin deine DeutschBoost Stimme.',
    });
    const url = URL.createObjectURL(new Blob([result.audio], { type: result.mimeType }));
    setTtsPlaybackUrl(current => {
      releasePlaybackUrl(current);
      return url;
    });
    setDeepgramTtsTest({ state: 'success', message: 'Deepgram voice sample is ready' });
  } catch (error) {
    setDeepgramTtsTest({ state: 'error', message: getErrorMessage(error) });
  }
}
```

Add controls near the existing Deepgram test buttons:

```tsx
<button
  className="db-inline-button"
  type="button"
  onClick={handlePlayDeepgramTts}
  disabled={loading || deepgramTtsTest.state === 'testing'}
>
  {deepgramTtsTest.state === 'testing' ? 'Generating...' : 'Play test voice'}
</button>
{ttsPlaybackUrl ? (
  <audio
    className="db-provider-test-audio"
    controls
    src={ttsPlaybackUrl}
    aria-label="Deepgram TTS test playback"
  />
) : null}
<ProviderTestMessage state={deepgramTtsTest.state} message={deepgramTtsTest.message} />
<SelectField
  label="Deepgram TTS voice"
  value={settings.speech.ttsModel}
  options={DEEPGRAM_TTS_MODEL_OPTIONS}
  onChange={value =>
    setSettings(current => ({
      ...current,
      speech: { ...current.speech, ttsModel: value },
    }))
  }
/>
```

- [ ] **Step 5: Run settings UI tests**

Run:

```powershell
npm run test:run -- tests/pages/LocalSettingsPage.test.tsx
```

Expected: PASS.

## Task 5: Route Activity Playback Through SpeechProvider

**Files:**
- Modify: `MainApp.tsx`
- Modify: `pages/ActivityPage.tsx`
- Modify: `tests/MainApp.providerRuntime.test.tsx`
- Create: `tests/pages/ActivityPage.voice.test.tsx`

- [ ] **Step 1: Write failing MainApp route test**

In `tests/MainApp.providerRuntime.test.tsx`, change `activityPageProps` to capture speech:

```ts
const activityPageProps = vi.hoisted(() => ({
  latest: null as null | { aiProvider?: { id: string }; speechProvider?: { id: string } },
}));
```

Update the mock:

```ts
default: (props: { aiProvider?: { id: string }; speechProvider?: { id: string } }) => {
  activityPageProps.latest = props;
  return <main>Activity</main>;
},
```

Add test:

```ts
it('passes the saved Deepgram provider into activity routes', async () => {
  providerSettingsRepository.load.mockResolvedValue({
    ai: {
      enabled: true,
      provider: 'openrouter',
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
    },
    speech: {
      enabled: true,
      provider: 'deepgram',
      apiKey: 'deepgram-key',
      model: 'nova-3',
      ttsModel: 'aura-2-viktoria-de',
      language: 'de',
    },
  });

  const { default: MainApp } = await import('../MainApp');

  render(
    <MemoryRouter initialEntries={['/activity?type=listening&topic=Weather&description=Audio&level=A2']}>
      <MainApp />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(activityPageProps.latest?.speechProvider?.id).toBe('deepgram');
  });
});
```

Update the default `providerSettingsRepository.load.mockResolvedValue` in this test file so the speech settings include:

```ts
ttsModel: 'aura-2-viktoria-de',
```

- [ ] **Step 2: Write failing ActivityPage voice test**

Create `tests/pages/ActivityPage.voice.test.tsx`:

```ts
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityPage from '../../pages/ActivityPage';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';

const activityService = vi.hoisted(() => ({
  generateActivity: vi.fn(),
  evaluateWriting: vi.fn(),
}));
const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
}));

vi.mock('../../services/activityService', () => activityService);
vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

function createSpeechProvider(): SpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    transcribe: vi.fn(),
    synthesize: vi.fn().mockResolvedValue({
      audio: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'audio/mpeg',
    }),
  };
}

describe('ActivityPage speech playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({ motherLanguage: 'english' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:deepgram-audio');
    vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    })));
  });

  it('uses Deepgram synthesis for listening playback', async () => {
    const speechProvider = createSpeechProvider();
    activityService.generateActivity.mockResolvedValue({
      topic: 'Weather',
      level: 'A2',
      questions: [{
        audio_text: 'Heute scheint die Sonne.',
        question: 'Wie ist das Wetter?',
        options: ['Sonnig', 'Kalt', 'Regnerisch', 'Windig'],
        correct_option: 0,
      }],
    });

    render(
      <MemoryRouter initialEntries={['/activity?type=listening&topic=Weather&description=Audio&level=A2']}>
        <ActivityPage speechProvider={speechProvider} />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Play Audio/i }));

    await waitFor(() => {
      expect(speechProvider.synthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'listening-practice',
          text: 'Heute scheint die Sonne.',
        })
      );
    });
    expect(await screen.findByText(/Audio played/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm run test:run -- tests/MainApp.providerRuntime.test.tsx tests/pages/ActivityPage.voice.test.tsx
```

Expected: FAIL because `ActivityPage` does not accept `speechProvider`.

- [ ] **Step 4: Pass provider from MainApp**

In `MainApp.tsx`:

```tsx
<Route path="/activity" element={<ActivityPage aiProvider={runtimeAiProvider} speechProvider={runtimeSpeechProvider} />} />
```

- [ ] **Step 5: Use provider-backed playback in ActivityPage**

In `pages/ActivityPage.tsx`, update props:

```ts
import type { SpeechProvider } from '../src/domain/speech/speechProvider';

interface ActivityPageProps {
  aiProvider?: AiProvider;
  speechProvider?: SpeechProvider;
}
```

Add helper inside the component:

```ts
const playGermanAudio = async (text: string, feature: string): Promise<'provider' | 'system'> => {
  if (speechProvider) {
    const result = await speechProvider.synthesize({
      feature,
      text,
      options: { language: 'de' },
    });
    const playbackUrl = URL.createObjectURL(new Blob([result.audio], { type: result.mimeType }));
    try {
      await new Audio(playbackUrl).play();
    } finally {
      setTimeout(() => URL.revokeObjectURL(playbackUrl), 30000);
    }
    return 'provider';
  }

  await speakText(text, 'de-DE');
  return 'system';
};
```

Replace `speakGermanWord(card.german)` and `speakGermanWord(card.example_sentence)` calls with:

```ts
void playGermanAudio(card.german, 'vocabulary-pronunciation').catch(error => {
  toast.error(`Audio error: ${getErrorMessage(error)}`);
});
```

and:

```ts
void playGermanAudio(card.example_sentence, 'vocabulary-example').catch(error => {
  toast.error(`Audio error: ${getErrorMessage(error)}`);
});
```

In `handlePlayAudio`, replace `await speakText(audioText, 'de-DE')` with:

```ts
await playGermanAudio(audioText, 'listening-practice');
```

Add helper at file bottom:

```ts
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Audio playback failed';
}
```

- [ ] **Step 6: Run activity tests**

Run:

```powershell
npm run test:run -- tests/MainApp.providerRuntime.test.tsx tests/pages/ActivityPage.voice.test.tsx
```

Expected: PASS.

## Task 6: Route Tutor Reply Playback Through SpeechProvider

**Files:**
- Modify: `pages/SpeakingActivityPage.tsx`
- Modify: `tests/pages/SpeakingActivityPage.test.tsx`

- [ ] **Step 1: Write failing tutor playback test**

In `tests/pages/SpeakingActivityPage.test.tsx`, update `createSpeechProvider()`:

```ts
synthesize: vi.fn().mockResolvedValue({
  audio: new Uint8Array([1, 2, 3]).buffer,
  mimeType: 'audio/mpeg',
}),
```

In the second test, after the tutor response appears:

```ts
vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tutor-reply');
vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
})));

fireEvent.click(screen.getByRole('button', { name: 'Play tutor reply' }));

await waitFor(() => {
  expect(speechProvider.synthesize).toHaveBeenCalledWith(
    expect.objectContaining({
      feature: 'conversation-tutor-reply',
      text: 'Fast richtig: Ich mochte einen Kaffee. Trinkst du Kaffee gern mit Milch?',
    })
  );
});
```

- [ ] **Step 2: Run failing tutor playback test**

Run:

```powershell
npm run test:run -- tests/pages/SpeakingActivityPage.test.tsx
```

Expected: FAIL because tutor playback uses `SpeechSynthesisUtterance`.

- [ ] **Step 3: Implement provider-backed tutor playback**

In `pages/SpeakingActivityPage.tsx`, change the handler:

```ts
async function handlePlayTutorTurn(text: string) {
  if (!speechProvider) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setMessage('German playback is not available in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    setMessage('Playing with system voice because Deepgram is not configured.');
    return;
  }

  try {
    const result = await speechProvider.synthesize({
      feature: 'conversation-tutor-reply',
      text,
      options: { language: 'de' },
    });
    const playbackUrl = URL.createObjectURL(new Blob([result.audio], { type: result.mimeType }));
    await new Audio(playbackUrl).play();
    setTimeout(() => URL.revokeObjectURL(playbackUrl), 30000);
  } catch (error) {
    setMessage(getErrorMessage(error));
  }
}
```

Update prop type for `TranscriptBubble`:

```ts
onPlayTutorTurn: (text: string) => void | Promise<void>;
```

Keep the click handler:

```tsx
onClick={() => void onPlayTutorTurn(turn.text)}
```

- [ ] **Step 4: Run tutor playback test**

Run:

```powershell
npm run test:run -- tests/pages/SpeakingActivityPage.test.tsx
```

Expected: PASS.

## Task 7: Update Release Docs And Verify

**Files:**
- Modify: `docs/release/native-release-readiness.md`

- [ ] **Step 1: Update release readiness notes**

Add a release blocker note:

```md
Known release note: v0.0.3 must include provider-backed Deepgram TTS for listening, vocabulary, and tutor playback. Do not publish a new desktop tag while active playback still silently uses system speechSynthesis when Deepgram is configured.
```

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npm run test:run -- tests/domain/speech/deepgramProvider.test.ts tests/domain/settings/providerSettings.test.ts tests/domain/settings/providerSettingsRepository.test.ts tests/infrastructure/native/deepgramFetch.test.ts tests/pages/LocalSettingsPage.test.tsx tests/MainApp.providerRuntime.test.tsx tests/pages/ActivityPage.voice.test.tsx tests/pages/SpeakingActivityPage.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm run test:run
npm run build
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; cargo fmt --check
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; npm run tauri:build
```

Expected:

- Vitest reports all test files passing.
- Vite production build exits 0. Existing Browserslist/chunk warnings may remain.
- Cargo format exits 0.
- Tauri build exits 0 and produces the NSIS installer.

- [ ] **Step 4: Packaged desktop smoke**

Launch the release executable with WebView2 debugging, then verify through CDP or manual UI:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'; Start-Process -FilePath "C:\Users\Mini\Desktop\Projects\DeutschBoost\src-tauri\target\release\deutschboost.exe" -WorkingDirectory "C:\Users\Mini\Desktop\Projects\DeutschBoost\src-tauri\target\release"
```

Required checks:

- Settings shows OpenRouter ready and Deepgram ready.
- "Test key" succeeds.
- "Play test voice" creates a playable Deepgram audio element.
- Practice > Listening > Play Audio uses `speechProvider.synthesize` and marks audio played.
- Conversation tutor reply play button uses `speechProvider.synthesize`.
- Placement test still starts with OpenRouter and reaches learning plan generation.

- [ ] **Step 5: Save Vault memory**

Save a Vault memory with:

- Root cause: Deepgram only covered STT while active playback used browser/system TTS.
- Fix: `SpeechProvider.synthesize`, Deepgram `/v1/speak`, settings TTS voice, ActivityPage and SpeakingActivityPage provider-backed playback.
- Verification evidence: focused tests, full tests, build, Tauri build, packaged desktop smoke.
- Open loops: near-live conversation rewrite, optional Gemini Live provider, Android/APK, release hygiene.

- [ ] **Step 6: Commit after verification**

Stage only intended files:

```powershell
git add src/domain/speech/speechProvider.ts src/domain/speech/deepgramProvider.ts tests/domain/speech/deepgramProvider.test.ts src/domain/settings/providerSettings.ts src/domain/settings/providerSettingsRepository.ts tests/domain/settings/providerSettings.test.ts tests/domain/settings/providerSettingsRepository.test.ts src/infrastructure/native/deepgramFetch.ts tests/infrastructure/native/deepgramFetch.test.ts src-tauri/src/lib.rs pages/LocalSettingsPage.tsx tests/pages/LocalSettingsPage.test.tsx MainApp.tsx tests/MainApp.providerRuntime.test.tsx pages/ActivityPage.tsx tests/pages/ActivityPage.voice.test.tsx pages/SpeakingActivityPage.tsx tests/pages/SpeakingActivityPage.test.tsx docs/release/native-release-readiness.md docs/superpowers/specs/2026-05-16-deutschboost-realtime-voice-redesign.md docs/superpowers/plans/2026-05-16-deutschboost-deepgram-tts-release-fix.md
git commit -m "fix: route voice playback through Deepgram TTS"
```

Do not push/tag until the user-visible packaged smoke passes.
