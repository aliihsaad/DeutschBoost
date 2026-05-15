import { AiProviderError, type AiJsonRequest, type AiProvider } from './aiProvider';

const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const generateJsonWithProvider = async <T>(
  provider: AiProvider,
  request: AiJsonRequest
): Promise<T> => {
  try {
    return await provider.generateJson<T>(request);
  } catch (error) {
    throw new AiProviderError(
      `${request.feature} failed with ${provider.id}: ${errorMessage(error)}`,
      {
        provider: provider.id,
        feature: request.feature,
        cause: error,
      }
    );
  }
};
