import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { DEFAULT_MODEL_ID } from "../types/agent.js";

// Backend = the API we're calling (OpenAI, Anthropic, Google, OpenRouter)
export type Backend = "openai" | "anthropic" | "google" | "openrouter";

// Custom error for API key issues
export class APIKeyError extends Error {
  constructor(
    public backend: Backend,
    public envVar: string,
    public modelId: string,
    message: string
  ) {
    super(message);
    this.name = "APIKeyError";
  }
}

// Get user-friendly backend name
function getBackendDisplayName(backend: Backend): string {
  switch (backend) {
    case "openai": return "OpenAI";
    case "anthropic": return "Anthropic";
    case "google": return "Google (Gemini)";
    case "openrouter": return "OpenRouter";
  }
}

// Get the full friendly error message for missing API key
function getMissingKeyMessage(backend: Backend, envVar: string, modelId: string): string {
  const intro = `Open Debate uses AI models to run debates. To get started, you need an API key.`;

  const recommendation = backend === "openrouter"
    ? `\nOpenRouter is recommended - it gives you access to many models with one key.`
    : ``;

  const getKeyInfo: Record<Backend, { url: string; example: string; note: string }> = {
    openrouter: {
      url: "https://openrouter.ai/keys",
      example: "sk-or-v1-abc123...",
      note: "Works with GPT, Claude, Gemini, Llama, and many more models",
    },
    openai: {
      url: "https://platform.openai.com/api-keys",
      example: "sk-abc123...",
      note: "For GPT models directly from OpenAI",
    },
    anthropic: {
      url: "https://console.anthropic.com/settings/keys",
      example: "sk-ant-abc123...",
      note: "For Claude models directly from Anthropic",
    },
    google: {
      url: "https://aistudio.google.com/apikey",
      example: "AIza...",
      note: "For Gemini models directly from Google",
    },
  };

  const info = getKeyInfo[backend];

  return `${intro}${recommendation}

The model "${modelId}" requires ${getBackendDisplayName(backend)}.

Setup:
  1. Get a free API key from: ${info.url}
  2. Create a .env file in your project root (if you don't have one)
  3. Add this line: ${envVar}=${info.example}

${info.note}

Alternative: Use a different model with --model flag
  Example: --model google/gemini-2.5-flash (requires OPENROUTER_API_KEY)`;
}

interface ParsedModel {
  backend: Backend;
  modelId: string; // Backend-specific model ID
}

// Model metadata for UI display
export interface ModelInfo {
  id: string; // Full model ID with backend prefix
  name: string; // Display name
  backend: Backend; // Which API to call
  description: string; // User-friendly description
  apiKeyEnv: string; // Required env var
}

export const MODEL_REGISTRY: ModelInfo[] = [
  // === OpenAI models ===
  {
    id: "openai:gpt-5.2",
    name: "GPT-5.2 (Direct)",
    backend: "openai",
    description: "Powers ChatGPT. Fast, smart, great all-rounder.",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  {
    id: "openrouter:openai/gpt-5.2",
    name: "GPT-5.2 (via OpenRouter)",
    backend: "openrouter",
    description: "Same model, pay via OpenRouter credits.",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },

  // === Google models ===
  {
    id: "google:gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Direct)",
    backend: "google",
    description: "Google's fastest. Very cheap, great for high-volume.",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
  {
    id: "openrouter:google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash (via OpenRouter)",
    backend: "openrouter",
    description: "Same model, pay via OpenRouter credits.",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
  {
    id: "google:gemini-3-pro-preview",
    name: "Gemini 3 Pro (Direct)",
    backend: "google",
    description: "Google's smartest. High quality reasoning.",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
  },

  // === Anthropic models ===
  {
    id: "anthropic:claude-sonnet-4-5-20251101",
    name: "Claude Sonnet 4.5 (Direct)",
    backend: "anthropic",
    description: "Anthropic's balanced model. Smart and fast.",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "openrouter:anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5 (via OpenRouter)",
    backend: "openrouter",
    description: "Same model, pay via OpenRouter credits.",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
  {
    id: "anthropic:claude-opus-4-5-20251101",
    name: "Claude Opus 4.5 (Direct)",
    backend: "anthropic",
    description: "Anthropic's best. Highest quality reasoning.",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "openrouter:anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5 (via OpenRouter)",
    backend: "openrouter",
    description: "Same model, pay via OpenRouter credits.",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },

  // === OpenRouter-only models ===
  {
    id: "qwen/qwen3-next-80b-a3b-instruct",
    name: "Qwen 3 80B",
    backend: "openrouter",
    description: "Open-source powerhouse. Great value. (default)",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
];

// Singleton instances for each provider
let openrouterInstance: ReturnType<typeof createOpenRouter> | null = null;
let openaiInstance: ReturnType<typeof createOpenAI> | null = null;
let anthropicInstance: ReturnType<typeof createAnthropic> | null = null;
let googleInstance: ReturnType<typeof createGoogleGenerativeAI> | null = null;

// Track which model is being requested for better error messages
let currentModelId = "";

function requireEnvKey(backend: Backend): string {
  const keyMap: Record<Backend, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };

  const keyName = keyMap[backend];
  const key = process.env[keyName];

  if (!key) {
    throw new APIKeyError(
      backend,
      keyName,
      currentModelId,
      getMissingKeyMessage(backend, keyName, currentModelId)
    );
  }

  return key;
}

function getOpenRouter() {
  if (!openrouterInstance) {
    const apiKey = requireEnvKey("openrouter");
    openrouterInstance = createOpenRouter({ apiKey });
  }
  return openrouterInstance;
}

function getOpenAI() {
  if (!openaiInstance) {
    const apiKey = requireEnvKey("openai");
    openaiInstance = createOpenAI({ apiKey });
  }
  return openaiInstance;
}

function getAnthropic() {
  if (!anthropicInstance) {
    const apiKey = requireEnvKey("anthropic");
    anthropicInstance = createAnthropic({ apiKey });
  }
  return anthropicInstance;
}

function getGoogle() {
  if (!googleInstance) {
    const apiKey = requireEnvKey("google");
    googleInstance = createGoogleGenerativeAI({ apiKey });
  }
  return googleInstance;
}

function parseModelId(fullModelId: string): ParsedModel {
  // Format: "backend:model" or just "model" (defaults to openrouter)
  const colonIndex = fullModelId.indexOf(":");
  if (colonIndex > 0) {
    const backend = fullModelId.slice(0, colonIndex) as Backend;
    const modelId = fullModelId.slice(colonIndex + 1);

    // Validate backend
    if (["openai", "anthropic", "google", "openrouter"].includes(backend)) {
      return { backend, modelId };
    }
  }
  // No prefix or unknown prefix = OpenRouter (backward compatible)
  return { backend: "openrouter", modelId: fullModelId };
}

function getOpenAIModel(modelId: string): LanguageModel {
  // Note: To disable reasoning, pass providerOptions: { openai: { reasoningEffort: 'none' } }
  // in generateText/streamText calls
  return getOpenAI()(modelId);
}

function getGoogleModel(modelId: string): LanguageModel {
  // Note: To configure thinking, pass providerOptions in generateText/streamText calls:
  // - Gemini 2.5 Flash: { google: { thinkingConfig: { thinkingBudget: 0 } } }
  // - Gemini 3 Pro: { google: { thinkingConfig: { thinkingLevel: 'low' } } }
  return getGoogle()(modelId);
}

function getAnthropicModel(modelId: string): LanguageModel {
  return getAnthropic()(modelId);
}

function getOpenRouterModel(modelId: string): LanguageModel {
  return getOpenRouter().chat(modelId);
}

export function getModel(
  fullModelId: string = DEFAULT_MODEL_ID
): LanguageModel {
  currentModelId = fullModelId; // Track for error messages
  const { backend, modelId } = parseModelId(fullModelId);

  switch (backend) {
    case "openai":
      return getOpenAIModel(modelId);
    case "anthropic":
      return getAnthropicModel(modelId);
    case "google":
      return getGoogleModel(modelId);
    case "openrouter":
    default:
      return getOpenRouterModel(modelId);
  }
}

// Get backend info for a model ID (useful for error messages)
export function getModelBackend(fullModelId: string): { backend: Backend; envVar: string } {
  const { backend } = parseModelId(fullModelId);
  const keyMap: Record<Backend, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  return { backend, envVar: keyMap[backend] };
}

export { DEFAULT_MODEL_ID, getBackendDisplayName };
