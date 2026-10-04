import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';
import { derive, loadWorld, WorldContext, type World } from './db/world';
import { unlockAchievements } from './db/actions';
import { evaluateAchievements } from './engine/achievements';
import { useRoute } from './lib/router';
import { toast, useToasts } from './lib/toast';
import { Icon } from './components/Icon';
import { Character } from './screens/Character';
import { Tree } from './screens/Tree';
import { Skill } from './screens/Skill';
import { Journal } from './screens/Journal';
import { More } from './screens/More';
import { Achievements } from './screens/Achievements';
import { EntrySheet, type EntryPreset } from './screens/EntrySheet';

export function App() {
  const [world, setWorld] = useState<World | null>(null);
  const [entry, setEntry] = useState<EntryPreset | null>(null);
  const route = useRoute();

  useEffect(() => {
    const sub = liveQuery(loadWorld).subscribe({ next: setWorld, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, []);

  const derived = useMemo(() => (world ? derive(world) : null), [world]);
  useGameEvents(derived);

  if (!derived) return <div class="loading">LifeQuest</div>;

  const [screen, param] = route;
  const openEntry = (p: EntryPreset = {}) => setEntry(p);

  let page;
  if (screen === 'tree') page = <Tree focusId={param} key={param ?? 'tree'} />;
  else if (screen === 'skill' && param) page = <Skill id={param} onAdd={openEntry} key={param} />;
  else if (screen === 'journal') page = <Journal />;
  else if (screen === 'more') page = <More />;
  else if (screen === 'achievements') page = <Achievements />;
  else page = <Character onAdd={() => openEntry()} />;

  const tab = screen === 'tree' || screen === 'skill' ? 'tree' : screen === 'journal' ? 'journal' : screen === 'more' || screen === 'achievements' ? 'more' : 'home';

  return (
    <WorldContext.Provider value={derived}>
      <main>{page}</main>
      <nav class="bottom-nav" aria-label="Разделы">
        <a href="#/" class={tab === 'home' ? 'on' : ''} aria-current={tab === 'home' ? 'page' : undefined}><Icon name="user" size={24} /><span>Персонаж</span></a>
        <a href="#/tree" class={tab === 'tree' ? 'on' : ''} aria-current={tab === 'tree' ? 'page' : undefined}><Icon name="tree" size={24} /><span>Дерево</span></a>
        <button type="button" class="fab" aria-label="Новая запись" onClick={() => openEntry(screen === 'skill' && param ? { skillId: param } : {})}>
          <span><Icon name="plus" size={28} stroke={2.6} /></span>
        </button>
        <a href="#/journal" class={tab === 'journal' ? 'on' : ''} aria-current={tab === 'journal' ? 'page' : undefined}><Icon name="journal" size={24} /><span>Журнал</span></a>
        <a href="#/more" class={tab === 'more' ? 'on' : ''} aria-current={tab === 'more' ? 'page' : undefined}><Icon name="menu" size={24} /><span>Ещё</span></a>
      </nav>
      {entry && <EntrySheet preset={entry} onClose={() => setEntry(null)} />}
      <Toasts />
    </WorldContext.Provider>
  );
}

/** Новый уровень, новые достижения: всплывашки и запись в базу. */
function useGameEvents(w: ReturnType<typeof derive> | null) {
  const prevLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!w) return;
    if (prevLevel.current !== null && w.level.level > prevLevel.current) {
      toast({ kind: 'level', title: `Уровень ${w.level.level}!`, sub: 'Персонаж стал сильнее' });
    }
    prevLevel.current = w.level.level;

    const have = new Set(w.unlocked.map((u) => u.achievementId));
    const fresh = evaluateAchievements(w.stats()).filter((a) => a.done && !have.has(a.def.id));
    if (fresh.length) {
      unlockAchievements(fresh.map((a) => a.def.id));
      fresh.forEach((a) => toast({ kind: 'achievement', title: a.def.title, sub: 'Новое достижение' }));
    }
  }, [w]);
}

function Toasts() {
  const list = useToasts();
  return (
    <div class="toasts" aria-live="polite">
      {list.map((t) => (
        <div class={`toast ${t.kind}`} key={t.id}>
          {t.kind === 'achievement' && <Icon name="trophy" size={20} />}
          {t.kind === 'level' && <Icon name="star" size={20} />}
          <div class="toast-text">
            <span class="toast-title">{t.title}</span>
            {t.sub && <span class="toast-sub">{t.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
