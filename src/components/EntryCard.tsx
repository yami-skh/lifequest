import { useState } from 'preact/hooks';
import type { Entry } from '../db/db';
import { useWorld } from '../db/world';
import { ENTRY_TYPE_LABEL } from '../engine/xp';
import { humanDate } from '../engine/dates';
import { usePhotoUrl } from '../lib/photo';
import { go } from '../lib/router';
import { deleteEntry } from '../db/actions';
import { Icon } from './Icon';
import { AreaTile, Confirm } from './ui';

function Thumb({ id, size = 56 }: { id: string; size?: number }) {
  const url = usePhotoUrl(id);
  return url ? <img class="thumb" src={url} alt="" width={size} height={size} style={{ width: `${size}px`, height: `${size}px` }} /> : <span class="thumb" style={{ width: `${size}px`, height: `${size}px` }} />;
}

export function EntryCard({ entry, showDate = true }: { entry: Entry; showDate?: boolean }) {
  const w = useWorld();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const links = w.skillsOfEntry.get(entry.id) ?? [];
  const primary = links.find((l) => l.role === 'primary');
  const primaryNode = primary ? w.nodeById.get(primary.skillId) : undefined;
  const fixed = entry.fixesEntryId ? w.entries.find((e) => e.id === entry.fixesEntryId) : undefined;
  const title = entry.text || entry.failNote || `${ENTRY_TYPE_LABEL[entry.type]}${primaryNode ? ': ' + primaryNode.title : ''}`;

  return (
    <div class="entry">
      <button type="button" class="entry-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        {entry.photoIds[0] ? (
          <Thumb id={entry.photoIds[0]} />
        ) : entry.type === 'bonus' ? (
          <span class="entry-icon bonus"><Icon name="trophy" size={22} stroke={2.2} /></span>
        ) : entry.outcome === 'fail' ? (
          <span class="entry-icon fail"><Icon name="x" size={22} stroke={2.4} /></span>
        ) : (
          <AreaTile node={primaryNode ? w.areaOf(primaryNode.id) : undefined} size={56} />
        )}
        <span class="entry-text">
          <span class="entry-title">{title}</span>
          <span class="entry-sub">
            {showDate && `${humanDate(entry.date)} · `}
            {links.map((l) => w.nodeById.get(l.skillId)?.title ?? 'удалён').join(', ')}
            {entry.outcome === 'fail' && ' · ошибка'}
          </span>
        </span>
        <span class="entry-xp">+{primary?.xp ?? entry.rewardXp ?? 0}</span>
      </button>
      {open && (
        <div class="entry-details">
          <div class="chips">
            <span class="chip">{ENTRY_TYPE_LABEL[entry.type]}</span>
            {links.map((l) => (
              <a class="chip" href={`#/skill/${l.skillId}`} key={l.skillId}>
                {w.nodeById.get(l.skillId)?.title ?? 'удалён'} +{l.xp}
              </a>
            ))}
          </div>
          {entry.failNote && <p class="fail-note">Что пошло не так: {entry.failNote}</p>}
          {fixed && <p class="fix-note">Исправляет: {fixed.failNote || fixed.text}</p>}
          {entry.photoIds.length > 1 && (
            <div class="photo-row">{entry.photoIds.map((id) => <Thumb id={id} key={id} size={72} />)}</div>
          )}
          <div class="row-2">
            {primaryNode && <button type="button" class="btn ghost small" onClick={() => go(`skill/${primaryNode.id}`)}>Открыть навык</button>}
            <button type="button" class="btn ghost small danger-text" onClick={() => setConfirm(true)}>Удалить запись</button>
          </div>
        </div>
      )}
      <Confirm
        open={confirm}
        title="Удалить запись?"
        text={`XP за неё (${primary?.xp ?? 0}) пропадёт. Закрытые цели останутся закрытыми.`}
        action="Удалить"
        onConfirm={() => deleteEntry(entry.id)}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

export { Thumb };
