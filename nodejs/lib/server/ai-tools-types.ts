// Type definitions shared between ai-tools.ts (factories + invocation
// helpers) and providers-config.ts (YAML loader). Lives separately so
// the loader doesn't pull in @ai-sdk/* runtime imports just to read the
// type shapes — pure type-only file, no runtime cost.

import type { LanguageModel } from 'ai'

export interface ModelInfo {
  id: string
  label: string
}

export type ProviderCategory = 'cloud' | 'local'

// Factory: given a model id, return an AI SDK LanguageModel. Captures any
// per-provider construction needs (local providers need a baseURL up front,
// gemini needs explicit env-var precedence, etc.).
export type ModelFactory = (modelId: string) => LanguageModel

export interface ProviderInfo {
  id: string
  label: string
  category: ProviderCategory
  envKey?: string                  // cloud: env var that must be set
  baseURLEnv?: string              // local: env var that overrides baseURL
  defaultBaseURL?: string          // local: fallback baseURL
  defaultModel: string
  models: ModelInfo[]
  createModel: ModelFactory
}

export interface PublicProviderInfo {
  id: string
  label: string
  category: ProviderCategory
  available: boolean
  defaultModel: string
  models: ModelInfo[]
}
