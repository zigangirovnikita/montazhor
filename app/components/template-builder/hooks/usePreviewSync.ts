import { useEffect, useRef } from "react";

export function usePreviewSync(dependencies: React.DependencyList) {
  const shellRef = useRef<HTMLElement | null>(null);
  const previewColumnRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shellRef.current || !previewColumnRef.current || typeof ResizeObserver === "undefined") return;

    const syncPreviewHeight = () => {
      if (!shellRef.current || !previewColumnRef.current) return;
      shellRef.current.style.setProperty("--mobile-preview-height", `${Math.ceil(previewColumnRef.current.getBoundingClientRect().height)}px`);
    };

    syncPreviewHeight();

    const observer = new ResizeObserver(() => syncPreviewHeight());
    observer.observe(previewColumnRef.current);

    window.addEventListener("resize", syncPreviewHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncPreviewHeight);
    };
  }, dependencies);

  return { shellRef, previewColumnRef, stageRef };
}
