"use client";

import type { ReactNode } from "react";

export function StyleFlowModal({
  title,
  text,
  children
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="flow-modal-backdrop">
      <section className="flow-modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flow-modal-head">
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
        {children}
      </section>
    </div>
  );
}
