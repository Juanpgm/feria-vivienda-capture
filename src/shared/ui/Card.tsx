import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
      {title && <h2 className="mb-3 text-lg font-bold text-primary-strong">{title}</h2>}
      {children}
    </section>
  );
}
