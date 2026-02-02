/**
 * Resilient LLM calls with timeout, retries, and logging.
 * Re-exports AI SDK functions with sensible defaults for timeout and retries.
 * Includes user-friendly error handling for API key and authentication issues.
 */
import {
  generateText as baseGenerateText,
  generateObject as baseGenerateObject,
  streamText as baseStreamText,
} from "ai";

const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;

// Custom error for LLM API failures with helpful messages
export class LLMError extends Error {
  constructor(
    public originalError: Error,
    public modelId: string,
    message: string
  ) {
    super(message);
    this.name = "LLMError";
  }
}

// Check if an error is an authentication/API key error
function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("authentication") ||
    msg.includes("invalid api key") ||
    msg.includes("invalid_api_key") ||
    msg.includes("api key") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("permission denied")
  );
}

// Check if an error is a model not found error
function isModelNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("model not found") ||
    msg.includes("does not exist") ||
    msg.includes("not available") ||
    msg.includes("invalid model") ||
    msg.includes("unknown model") ||
    msg.includes("404")
  );
}

// Get friendly error message for API errors
function getFriendlyErrorMessage(error: unknown, modelId: string): string {
  if (!(error instanceof Error)) {
    return `Unknown error while calling model "${modelId}"`;
  }

  if (isAuthError(error)) {
    return (
      `Authentication failed for model "${modelId}".\n\n` +
      `This usually means:\n` +
      `  • Your API key is invalid or expired\n` +
      `  • Your API key doesn't have access to this model\n` +
      `  • You're using the wrong API key for this provider\n\n` +
      `Check your .env file and ensure the correct API key is set.`
    );
  }

  if (isModelNotFoundError(error)) {
    return (
      `Model "${modelId}" was not found.\n\n` +
      `This usually means:\n` +
      `  • The model ID is misspelled\n` +
      `  • The model isn't available on this provider\n` +
      `  • Your account doesn't have access to this model\n\n` +
      `Run "bun run start -- --help" to see available models.`
    );
  }

  // Return original message for other errors
  return error.message;
}

// Wrap async function to catch and re-throw with friendly errors
async function withFriendlyErrors<T>(
  fn: () => Promise<T>,
  modelId: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const friendlyMessage = getFriendlyErrorMessage(error, modelId);
    throw new LLMError(
      error instanceof Error ? error : new Error(String(error)),
      modelId,
      friendlyMessage
    );
  }
}

// Extract model ID from params if available
function getModelIdFromParams(params: Record<string, unknown>): string {
  const model = params.model as { modelId?: string } | string | undefined;
  if (typeof model === "string") return model;
  if (model && typeof model === "object" && "modelId" in model) {
    return String(model.modelId);
  }
  return "unknown";
}

// Re-export with defaults applied using wrapper that preserves full type inference
export const generateText: typeof baseGenerateText = ((params: Parameters<typeof baseGenerateText>[0]) => {
  const modelId = getModelIdFromParams(params as Record<string, unknown>);
  return withFriendlyErrors(
    () => baseGenerateText({
      ...params,
      maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
    }),
    modelId
  );
}) as typeof baseGenerateText;

export const generateObject: typeof baseGenerateObject = ((params: Parameters<typeof baseGenerateObject>[0]) => {
  const modelId = getModelIdFromParams(params as Record<string, unknown>);
  return withFriendlyErrors(
    () => baseGenerateObject({
      ...params,
      maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
    }),
    modelId
  );
}) as typeof baseGenerateObject;

export const streamText: typeof baseStreamText = ((params: Parameters<typeof baseStreamText>[0]) => {
  // Note: streamText returns immediately, errors happen during streaming
  // We can't easily wrap this, but the APIKeyError from model-provider.ts
  // will still be thrown synchronously when getting the model
  return baseStreamText({
    ...params,
    maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
  });
}) as typeof baseStreamText;
