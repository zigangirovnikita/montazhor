import { useEffect } from "react";
import { sanitizeTemplateData } from "@/lib/templateBuilder";
import type { StoredTemplate, VisualTemplateData } from "@/lib/templateBuilder";
import { upsertTemplate } from "../utils/upsertTemplate";

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
}: any) {
  useEffect(() => {
    void loadTemplates();
  }, []);

  async function loadTemplates() {
    const response = await fetch("/api/templates", { cache: "no-store" });
    const payload = await response.json();
    const list = Array.isArray(payload.templates) ? payload.templates as StoredTemplate[] : [];
    setTemplates(list);
    const selected = list.find((item) => item.isDefault && !item.isPreset) ?? list.find((item) => !item.isPreset) ?? list[0];
    if (selected) {
      setCurrent(selected);
      setDraft(sanitizeTemplateData(selected.data, selected.name));
      setSnapshot(JSON.stringify(selected.data));
    }
  }

  async function persistTemplate(data: VisualTemplateData) {
    const body = JSON.stringify({ name: data.name, data: sanitizeTemplateData(data, data.name) });
    const response = current && !current.isPreset
      ? await fetch(`/api/templates/${current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
      : await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!response.ok) throw new Error("Template save failed");
    return (await response.json()).template as StoredTemplate;
  }

  async function saveSection() {
    // Bug 2 fix: only save if isDirty
    if (!isDirty) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      const saved = await persistTemplate(draft);
      setCurrent(saved);
      setTemplates((items: StoredTemplate[]) => upsertTemplate(items, saved));
      setDraft(sanitizeTemplateData(saved.data, saved.name));
      setSnapshot(JSON.stringify(saved.data));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  function saveEditorSection() {
    void saveSection();
    setOpenSection(null);
    setSectionSnapshot(null);
  }

  async function duplicateTemplate(template = current) {
    if (!template) return;
    setStatus("saving");
    const response = await fetch(`/api/templates/${template.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${template.name} copy` })
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const payload = await response.json();
    const next = payload.template as StoredTemplate;
    setCurrent(next);
    setDraft(sanitizeTemplateData(next.data, next.name));
    setSnapshot(JSON.stringify(next.data));
    setTemplates((items: StoredTemplate[]) => upsertTemplate(items, next));
    setStatus("saved");
  }

  async function makeDefault() {
    setStatus("saving");
    let target = current;
    if (!target) return;
    if (target.isPreset) {
      const duplicateResponse = await fetch(`/api/templates/${target.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${target.name} default`, makeDefault: true })
      });
      if (!duplicateResponse.ok) {
        setStatus("error");
        return;
      }
      target = (await duplicateResponse.json()).template as StoredTemplate;
    } else {
      target = await persistTemplate(draft);
      const response = await fetch(`/api/templates/${target.id}/default`, { method: "POST" });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      target = (await response.json()).template as StoredTemplate;
    }
    setCurrent(target);
    setDraft(sanitizeTemplateData(target.data, target.name));
    setSnapshot(JSON.stringify(target.data));
    setTemplates((items: StoredTemplate[]) => upsertTemplate(items.map((item) => ({ ...item, isDefault: false })), target!));
    setStatus("saved");
  }

  return { loadTemplates, saveSection, saveEditorSection, duplicateTemplate, makeDefault };
}
