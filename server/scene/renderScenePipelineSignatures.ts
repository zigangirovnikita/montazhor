import type { DirectorPlan, SemanticBlock } from "../../lib/types";

export function buildSemanticBlockSignature(block: SemanticBlock, templateId: string | undefined) {
  return JSON.stringify({
    blockId: block.id,
    text: block.text,
    start: block.start,
    end: block.end,
    templateId: templateId ?? null,
    transcriptWordRange: block.transcriptWordRange ?? null,
  });
}

export function buildSemanticBlockSignatures(semanticBlocks: SemanticBlock[], templateId: string | undefined) {
  return semanticBlocks.map((block) => buildSemanticBlockSignature(block, templateId));
}

export function buildScreenCopyBlockSignature(block: DirectorPlan["blocks"][number], templateId: string | undefined) {
  return JSON.stringify({
    blockId: block.blockId,
    recipeId: block.recipeId,
    start: block.start,
    end: block.end,
    templateId: templateId ?? null,
  });
}

export function buildScreenCopyBlockSignatures(directorPlan: DirectorPlan) {
  return directorPlan.blocks.map((block) => buildScreenCopyBlockSignature(block, directorPlan.templateId));
}
