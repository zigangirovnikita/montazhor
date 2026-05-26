import type { AiConfig } from "@/lib/config";
import type { AiCallResult, AiTokenUsage } from "@/lib/types";

const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? "90000");
const MAX_ATTEMPTS = 3;

export async function callChatCompletion(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AiCallResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const body: Record<string, unknown> = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };
      if (config.includeModelInRequest) {
        body.model = config.model;
      }
      // Only request json_object mode on first attempt — some models don't support it
      if (attempt === 1) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(config.completionsUrl, {
        method: "POST",
        signal: controller.signal,
        headers: requestHeaders(config),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown error");
        throw new Error(`${config.provider} API returned ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as {
        id?: string;
        model?: string;
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
        usage?: OpenRouterUsage;
      };

      if (data.error) {
        throw new Error(`${config.provider} API error: ${data.error.message}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`${config.provider} returned empty response.`);
      }

      return {
        content,
        responseId: data.id,
        model: data.model ?? config.model,
        usage: parseOpenRouterUsage(data.usage)
      };
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      await delay(500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${config.provider} request failed after ${MAX_ATTEMPTS} attempts: ${message}`);
}

export const callOpenRouter = callChatCompletion;

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  prompt_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
    audio_tokens?: number;
  };
  cost_details?: {
    upstream_inference_cost?: number;
  };
}

function parseOpenRouterUsage(usage: OpenRouterUsage | undefined): AiTokenUsage | undefined {
  if (!usage) return undefined;

  return {
    promptTokens: numberOrUndefined(usage.prompt_tokens),
    completionTokens: numberOrUndefined(usage.completion_tokens),
    totalTokens: numberOrUndefined(usage.total_tokens),
    reasoningTokens: numberOrUndefined(usage.completion_tokens_details?.reasoning_tokens),
    cachedTokens: numberOrUndefined(usage.prompt_tokens_details?.cached_tokens),
    cacheWriteTokens: numberOrUndefined(usage.prompt_tokens_details?.cache_write_tokens),
    audioTokens: numberOrUndefined(usage.prompt_tokens_details?.audio_tokens),
    cost: numberOrUndefined(usage.cost),
    upstreamCost: numberOrUndefined(usage.cost_details?.upstream_inference_cost)
  };
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestHeaders(config: AiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://montazhor.local";
    headers["X-Title"] = "Montazhor Video Editor";
  }

  return headers;
}
