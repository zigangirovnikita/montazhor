import { useCallback, useEffect } from "react";
import { sanitizeTemplateData } from "@/lib/templateBuilder";
import type { StoredTemplate, VisualTemplateData } from "@/lib/templateBuilder";
import { upsertTemplate } from "../utils/upsertTemplate";

import type { UseTemplatePersistProps } from "../types";

export function useTemplatePersist({
  current,
  setCurrent,
  draft,
  setDraft,
  setTemplates,
  setSnapshot,
  setStatus,
  setOpenSection,
  setSectionSnapshot,
  isDirty
}: UseTemplatePersistProps) {
  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/templates", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load");
      const payload = await response.json();
      const list = Array.isArray(payload.templates) ? payload.templates as StoredTemplate[] : [];
      setTemplates(list);
      const selected = list.find((item) => item.isDefault && !item.isPreset) ?? list.find((item) => !item.isPreset) ?? list[0];
      if (selected) {
        setCurrent(selected);
        setDraft(sanitizeTemplateData(selected.data, selected.name));
        setSnapshot(JSON.stringify(selected.data));
      }
    } catch {
      setStatus("error");
    }
  }, [setCurrent, setDraft, setSnapshot, setStatus, setTemplates]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function persistTemplate(data: VisualTemplateData) {
    const body = JSON.stringify({ name: data.name, data: sanitizeTemplateData(data, data.name) });
    const response = current && !current.isPreset
      ? await fetch(`/api/templates/${current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
      : await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!response.ok) throw new Error("Template save failed");
    return (await response.json()).template as StoredTemplate;
  }

  async function saveSection(): Promise<boolean> {
    // Bug 2 fix: only save if isDirty
    if (!isDirty) {
      setStatus("saved");
      return true;
    }
    setStatus("saving");
    try {
      const saved = await persistTemplate(draft);
      setCurrent(saved);
      setTemplates((items: StoredTemplate[]) => upsertTemplate(items, saved));
      setDraft(sanitizeTemplateData(saved.data, saved.name));
      setSnapshot(JSON.stringify(saved.data));
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }

  async function saveEditorSection() {
    const ok = await saveSection();
    if (ok) {
      setOpenSection(null);
      setSectionSnapshot(null);
    }
  }

  async function duplicateTemplate(template = current) {
    if (!template) return;
    setStatus("saving");
    try {
      const response = await fetch(`/api/templates/${template.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${template.name} copy` })
      });
      if (!response.ok) throw new Error("Duplicate failed");
      const payload = await response.json();
      const next = payload.template as StoredTemplate;
      setCurrent(next);
      setDraft(sanitizeTemplateData(next.data, next.name));
      setSnapshot(JSON.stringify(next.data));
      setTemplates((items: StoredTemplate[]) => upsertTemplate(items, next));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function makeDefault() {
    setStatus("saving");
    let target = current;
    if (!target) {
      setStatus("idle");
      return;
    }
    try {
      if (target.isPreset) {
        const duplicateResponse = await fetch(`/api/templates/${target.id}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `${target.name} default`, makeDefault: true })
        });
        if (!duplicateResponse.ok) throw new Error("Duplicate failed");
        target = (await duplicateResponse.json()).template as StoredTemplate;
      } else {
        target = await persistTemplate(draft);
        const response = await fetch(`/api/templates/${target.id}/default`, { method: "POST" });
        if (!response.ok) throw new Error("Set default failed");
        target = (await response.json()).template as StoredTemplate;
      }
      setCurrent(target);
      setDraft(sanitizeTemplateData(target.data, target.name));
      setSnapshot(JSON.stringify(target.data));
      setTemplates((items: StoredTemplate[]) => upsertTemplate(items.map((item) => ({ ...item, isDefault: false })), target!));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return { loadTemplates, saveSection, saveEditorSection, duplicateTemplate, makeDefault };
}
