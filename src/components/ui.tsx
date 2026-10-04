import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Icon } from './Icon';
import { back } from '../lib/router';
import type { Node } from '../db/db';

export function ProgressBar({ pct, color = 'var(--green)', height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div class="bar" style={{ height: `${height}px` }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div class="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function LevelBadge({ level, name, pct, left }: { level: number; name: string; pct: number; left: number }) {
  return (
    <div class="level-badge">
      <span class="level-badge-title">ур. {level} · {name}</span>
      <ProgressBar pct={pct} color="var(--gold)" height={4} />
      <span class="level-badge-sub">{level >= 10 ? 'максимум' : `до ур. ${level + 1} ещё ${left} XP`}</span>
    </div>
  );
}

export function AreaTile({ node, size = 40 }: { node: Node | undefined; size?: number }) {
  const color = node?.color ?? 'var(--muted)';
  return (
    <span class="area-tile" style={{ width: `${size}px`, height: `${size}px`, color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
      {node?.icon ? <Icon name={node.icon} size={Math.round(size * 0.55)} /> : node?.title.slice(0, 1) ?? '?'}
    </span>
  );
}

export function TopBar({ title, crumbs, right }: { title?: string; crumbs?: string; right?: ComponentChildren }) {
  return (
    <div class="topbar">
      <button type="button" class="icon-btn" aria-label="Назад" onClick={() => back()}>
        <Icon name="back" />
      </button>
      <div class="topbar-text">
        {crumbs && <div class="crumbs">{crumbs}</div>}
        {title && <div class="topbar-title">{title}</div>}
      </div>
      {right}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-handle" />
        <div class="sheet-head">
          <h2 class="sheet-title">{title}</h2>
          <button type="button" class="icon-btn round" aria-label="Закрыть" onClick={onClose}>
            <Icon name="x" size={20} stroke={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, text, action, onConfirm, onClose }: {
  open: boolean; title: string; text: string; action: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p class="muted">{text}</p>
      <div class="row-2">
        <button type="button" class="btn ghost" onClick={onClose}>Отмена</button>
        <button type="button" class="btn danger" onClick={() => { onConfirm(); onClose(); }}>{action}</button>
      </div>
    </Sheet>
  );
}

export function SectionLabel({ children, right }: { children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <div class="section-label">
      <span>{children}</span>
      {right}
    </div>
  );
}

export function Check({ done }: { done: boolean }) {
  return <span class={done ? 'check on' : 'check'}>{done && <Icon name="check" size={16} stroke={3} />}</span>;
}

export const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
