/**
 * Resilient LLM calls with timeout, retries, and logging.
 * Wraps AI SDK functions with sensible defaults.
 */
import {
  generateText as baseGenerateText,
  generateObject as baseGenerateObject,
  streamText as baseStreamText,
  type GenerateTextResult,
  type StreamTextResult,
} from "ai";

const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;

type GenerateTextParams = Parameters<typeof baseGenerateText>[0];
type GenerateObjectParams = Parameters<typeof baseGenerateObject>[0];
type StreamTextParams = Parameters<typeof baseStreamText>[0];

// Re-export with defaults applied
export async function generateText(
  params: GenerateTextParams
): Promise<Awaited<ReturnType<typeof baseGenerateText>>> {
  return baseGenerateText({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
  });
}

export async function generateObject<T>(
  params: GenerateObjectParams
): Promise<{ object: T }> {
  const result = await baseGenerateObject({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
  });
  return result as { object: T };
}

export function streamText(
  params: StreamTextParams
): ReturnType<typeof baseStreamText> {
  return baseStreamText({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
  });
}
