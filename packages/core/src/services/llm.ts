/**
 * Resilient LLM calls with timeout, retries, and logging.
 * Re-exports AI SDK functions with sensible defaults for timeout and retries.
 */
import {
  generateText as baseGenerateText,
  generateObject as baseGenerateObject,
  streamText as baseStreamText,
} from "ai";

const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;

// Re-export with defaults applied using wrapper that preserves full type inference
export const generateText: typeof baseGenerateText = ((params: Parameters<typeof baseGenerateText>[0]) => {
  return baseGenerateText({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
  });
}) as typeof baseGenerateText;

export const generateObject: typeof baseGenerateObject = ((params: Parameters<typeof baseGenerateObject>[0]) => {
  return baseGenerateObject({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
  });
}) as typeof baseGenerateObject;

export const streamText: typeof baseStreamText = ((params: Parameters<typeof baseStreamText>[0]) => {
  return baseStreamText({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
  });
}) as typeof baseStreamText;
