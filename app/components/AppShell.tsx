"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

export type AppSection =
  | "home"
  | "projects"
  | "templates"
  | "style"
  | "transcript"
  | "timeline"
  | "analytics"
  | "brand"
  | "settings";

const navItems: Array<{ id: AppSection; label: string; icon: string; ready: boolean }> = [
  { id: "home", label: "Главная", icon: "⌂", ready: true },
  { id: "projects", label: "Проекты", icon: "▣", ready: true },
  { id: "templates", label: "Шаблоны", icon: "◫", ready: false },
  { id: "style", label: "Стиль субтитров", icon: "✎", ready: true },
  { id: "transcript", label: "Текст и чистка", icon: "☷", ready: true },
  { id: "timeline", label: "Таймлайн", icon: "⌁", ready: true },
  { id: "analytics", label: "Аналитика", icon: "↗", ready: false },
  { id: "brand", label: "Бренд-кит", icon: "◇", ready: false },
  { id: "settings", label: "Настройки", icon: "⚙", ready: false }
];

export function AppShell({
  activeSection,
  title,
  subtitle,
  action,
  searchPlaceholder = "Поиск проектов, стилей, субтитров...",
  children,
  onNavigate
}: {
  activeSection: AppSection;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  searchPlaceholder?: string;
  children: ReactNode;
  onNavigate?: (section: AppSection) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="app-brand-row">
          <Link className="app-brand" href="/">
            <span className="brand-mark">M</span>
            <strong>Montazhor</strong>
          </Link>
          <button className="icon-button" type="button" aria-label="Свернуть меню" onClick={() => setCollapsed((value) => !value)}>
            ☰
          </button>
        </div>

        <nav className="app-nav" aria-label="Главная навигация">
          {navItems.map((item) => {
            const active = item.id === activeSection;
            return (
              <button
                className={active ? "active" : ""}
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {!item.ready ? <span className="nav-soon">скоро</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>Локальный MVP</strong>
            <span>Предпросмотр субтитров</span>
          </div>
        </div>
      </aside>

      <section className="app-workspace">
        <header className="app-topbar">
          <button className="mobile-menu-button" type="button" aria-label="Открыть меню" onClick={() => setCollapsed((value) => !value)}>
            ☰
          </button>
          <div className="topbar-title">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <label className="topbar-search">
            <span>⌕</span>
            <input placeholder={searchPlaceholder} />
          </label>
          <div className="topbar-action">{action}</div>
        </header>
        {children}
      </section>
    </main>
  );
}

export function ComingSoonPanel({ title = "Этот раздел появится позже" }: { title?: string }) {
  return (
    <section className="placeholder-panel">
      <span>Скоро</span>
      <h2>{title}</h2>
      <p>Сейчас рабочий маршрут: загрузка, анализ, текстовая проверка, live preview субтитров и отдельный экспорт MP4.</p>
    </section>
  );
}
