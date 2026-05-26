import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import type { AiCallResult, AiUsageSource } from "@/lib/types";

interface RecordAiUsageInput {
  projectId?: string;
  source: AiUsageSource;
  phase: string;
  result: AiCallResult;
}

export async function recordAiUsage(input: RecordAiUsageInput) {
  if (!input.projectId) return;

  const usage = input.result.usage;
  await prisma.aiUsage.create({
    data: {
      projectId: input.projectId,
      source: input.source,
      phase: input.phase,
      model: input.result.model,
      responseId: input.result.responseId,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      reasoningTokens: usage?.reasoningTokens,
      cachedTokens: usage?.cachedTokens,
      cacheWriteTokens: usage?.cacheWriteTokens,
      audioTokens: usage?.audioTokens,
      cost: usage?.cost,
      upstreamCost: usage?.upstreamCost,
      metadataJson: JSON.stringify({ usage: usage ?? null })
    }
  });

  await logProject(input.projectId, "info", formatAiUsageLog(input.source, input.phase, input.result));
}

export async function logProjectAiUsageSummary(projectId: string) {
  const rows = await prisma.aiUsage.findMany({ where: { projectId } });
  const totals = rows.reduce(
    (sum, row) => ({
      promptTokens: sum.promptTokens + (row.promptTokens ?? 0),
      completionTokens: sum.completionTokens + (row.completionTokens ?? 0),
      totalTokens: sum.totalTokens + (row.totalTokens ?? 0),
      cost: sum.cost + (row.cost ?? 0)
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
  );

  if (rows.length === 0) {
    await logProject(projectId, "info", "AI usage total: no paid LLM calls recorded for this project.");
    return;
  }

  await logProject(
    projectId,
    "info",
    `AI usage total: ${rows.length} calls, prompt ${totals.promptTokens}, completion ${totals.completionTokens}, total ${totals.totalTokens}, cost ${totals.cost}.`
  );
}

function formatAiUsageLog(source: AiUsageSource, phase: string, result: AiCallResult) {
  const usage = result.usage;
  if (!usage) {
    return `AI usage: ${source}/${phase}: usage data was not returned by provider.`;
  }

  const parts = [
    `prompt ${formatNumber(usage.promptTokens)}`,
    `completion ${formatNumber(usage.completionTokens)}`,
    `total ${formatNumber(usage.totalTokens)}`
  ];

  if (usage.reasoningTokens !== undefined) parts.push(`reasoning ${formatNumber(usage.reasoningTokens)}`);
  if (usage.cachedTokens !== undefined) parts.push(`cached ${formatNumber(usage.cachedTokens)}`);
  if (usage.cost !== undefined) parts.push(`cost ${usage.cost}`);

  return `AI usage: ${source}/${phase}: ${parts.join(", ")}.`;
}

function formatNumber(value: number | undefined) {
  return value === undefined ? "unknown" : String(value);
}
