/**
 * Centralized application configuration.
 * Reads environment variables and exposes typed config objects.
 */

export type AiProvider = "openrouter" | "kie";
export type AiTask = "script_selector_pass_1" | "script_selector_pass_2" | "visual_planner";

export interface AiConfig {
  /** Provider name for logging and provider-specific request details */
  provider: AiProvider;
  /** API key for AI-powered analysis */
  apiKey: string;
  /** Model identifier for logging and providers that expect a model body param */
  model: string;
  /** Full chat completions URL */
  completionsUrl: string;
  /** Whether to include model in the request body */
  includeModelInRequest: boolean;
  /** Maximum tokens for the response */
  maxTokens: number;
  /** Temperature for generation (lower = more deterministic) */
  temperature: number;
}

export function getAiConfig(provider: AiProvider = resolveAiProvider(process.env.AI_PROVIDER)): AiConfig {
  if (provider === "kie") return getKieAiConfig();
  return getOpenRouterAiConfig();
}

export function getAiConfigForTask(task: AiTask): AiConfig {
  return getAiConfig(resolveAiProvider(providerEnvForTask(task)));
}

export function isAiConfigured(task?: AiTask): boolean {
  if (task) return Boolean(getAiConfigForTask(task).apiKey);
  return Boolean(getAiConfig().apiKey);
}

function getOpenRouterAiConfig(): AiConfig {
  const baseUrl = process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1";
  return {
    provider: "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "google/gemini-3.1-flash-lite",
    completionsUrl: `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    includeModelInRequest: true,
    maxTokens: Number(process.env.AI_MAX_TOKENS ?? "4096"),
    temperature: Number(process.env.AI_TEMPERATURE ?? "0.1"),
  };
}

function getKieAiConfig(): AiConfig {
  return {
    provider: "kie",
    apiKey: process.env.KIE_API_KEY ?? "",
    model: process.env.KIE_AI_MODEL ?? "gemini-3.1-pro",
    completionsUrl: process.env.KIE_AI_COMPLETIONS_URL ?? "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions",
    includeModelInRequest: false,
    maxTokens: Number(process.env.KIE_AI_MAX_TOKENS ?? process.env.AI_MAX_TOKENS ?? "4096"),
    temperature: Number(process.env.KIE_AI_TEMPERATURE ?? process.env.AI_TEMPERATURE ?? "0.1"),
  };
}

function providerEnvForTask(task: AiTask): string | undefined {
  if (task === "script_selector_pass_1") {
    return process.env.SCRIPT_SELECTOR_PASS1_AI_PROVIDER ?? process.env.SCRIPT_SELECTOR_AI_PROVIDER ?? process.env.AI_PROVIDER;
  }
  if (task === "script_selector_pass_2") {
    return process.env.SCRIPT_SELECTOR_PASS2_AI_PROVIDER ?? process.env.SCRIPT_SELECTOR_AI_PROVIDER ?? process.env.AI_PROVIDER;
  }
  if (task === "visual_planner") {
    return process.env.VISUAL_PLANNER_AI_PROVIDER ?? process.env.AI_PROVIDER;
  }
  return process.env.AI_PROVIDER;
}

function resolveAiProvider(value: string | undefined): AiProvider {
  if (value === "kie") return "kie";
  return "openrouter";
}
