import { describe, expect, it } from 'vitest';
import {
  DEEPGRAM_API_TARGET,
  DEEPGRAM_PROXY_PATH,
  rewriteDeepgramProxyPath,
} from '../../../src/infrastructure/browser/deepgramProxy';

describe('deepgramProxy', () => {
  it('maps local Deepgram paths to the fixed Deepgram API target', () => {
    expect(DEEPGRAM_PROXY_PATH).toBe('/api/deepgram');
    expect(DEEPGRAM_API_TARGET).toBe('https://api.deepgram.com');
    expect(rewriteDeepgramProxyPath('/api/deepgram/v1/auth/token')).toBe('/v1/auth/token');
    expect(rewriteDeepgramProxyPath('/api/deepgram/v1/listen?model=nova-3')).toBe(
      '/v1/listen?model=nova-3'
    );
  });
});
