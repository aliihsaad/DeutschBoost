export const DEEPGRAM_PROXY_PATH = '/api/deepgram';
export const DEEPGRAM_API_TARGET = 'https://api.deepgram.com';

export function rewriteDeepgramProxyPath(path: string): string {
  return path.replace(new RegExp(`^${DEEPGRAM_PROXY_PATH}`), '');
}
