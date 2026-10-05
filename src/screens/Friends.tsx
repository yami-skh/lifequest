// «Друзья» (эксперимент friends): напарники по коду, итоги недели и реакции. Макет: холст, страница «Друзья».
// #/friends — список или приглашение; #/friends/<id> — неделя друга; #/friends/share — что видят друзья;
// #/friends/invite — мой код; #/friends/add/<код> — ссылка-приглашение.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useEffect, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { setFriendsShare, toggleExperiment } from '../db/actions';
import { DEFAULT_SHARE, type WeekCard } from '../engine/friends';
import { addDays, localDate } from '../engine/dates';
import { weekStart } from '../engine/quests';
import {
  EMOJI, FriendsError, addFriend, ensurePlayer, inviteLink, leave, listFriends, myCard, newCode, prettyCode, pushCard, react, removeFriend,
  type FriendView, type Player,
} from '../lib/friends';
import { go } from '../lib/router';
import { toast } from '../lib/toast';
import { logError } from '../lib/errorlog';
import { Icon } from '../components/Icon';
import { Confirm, SectionLabel, TopBar } from '../components/ui';
import { Toggle } from './Settings';
import { plural } from './Character';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const short = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const weekLabel = (week: string) => `${short(week)} – ${short(addDays(week, 6))}`;
const sinceLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; player: Player; friends: FriendView[] };

/** Ключ + список друзей + отправка своей карточки. Один на экран. */
function useFriends(): [Load, () => void] {
  const w = useWorld();
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const player = await ensurePlayer(w.profile);
        await pushCard(player, myCard(w)).catch((e) => logError(e, 'Друзья: карточка'));
        const r = await listFriends(player);
        if (alive) setState({ kind: 'ok', player: { ...player, code: r.code || player.code }, friends: r.friends });
      } catch (e) {
        if (!(e instanceof FriendsError) || e.code !== 'network') logError(e, 'Друзья');
        if (alive) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Что-то пошло не так' });
      }
    })();
    return () => { alive = false; };
  }, [n]);
  return [state, () => setN((x) => x + 1)];
}

export function Friends({ sub, arg }: { sub?: string; arg?: string }) {
  if (sub === 'add' && arg) return <AddByLink code={arg} />;
  if (sub === 'share') return <ShareSettings />;
  return <FriendsMain sub={sub} />;
}

function FriendsMain({ sub }: { sub?: string }) {
  const [state, reload] = useFriends();
  if (state.kind === 'loading') return <div class="page"><TopBar title="Друзья" /><p class="muted center">Загрузка…</p></div>;
  if (state.kind === 'error') {
    return (
      <div class="page">
        <TopBar title="Друзья" />
        <div class="notice error"><span class="small">{state.message}</span></div>
        <button type="button" class="btn ghost" onClick={reload}>Попробовать ещё раз</button>
      </div>
    );
  }
  const { player, friends } = state;
  const friend = sub && friends.find((f) => f.id === sub);
  if (friend) return <FriendWeek player={player} f={friend} onChange={reload} />;
  if (sub === 'invite' || friends.length === 0) return <Invite player={player} onAdded={reload} />;
  return <FriendsList player={player} friends={friends} onChange={reload} />;
}

// ---------- 1. Пригласить и добавить ----------

async function shareInvite(code: string) {
  const text = `Давай качаться вместе в LifeQuest! Мой код игрока: ${prettyCode(code)}\n${inviteLink(code)}`;
  try {
    if (Capacitor.isNativePlatform()) return void (await Share.share({ title: 'LifeQuest: друзья', text }));
    if (navigator.share) return void (await navigator.share({ title: 'LifeQuest: друзья', text }));
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError' || /cancel/i.test(String((e as Error)?.message))) return;
  }
  await navigator.clipboard?.writeText(text);
  toast({ kind: 'info', title: 'Приглашение скопировано', sub: 'Вставь его в Telegram' });
}

function Invite({ player, onAdded }: { player: Player; onAdded: () => void }) {
  return (
    <div class="page">
      <TopBar title="Друзья" crumbs="напарники по приглашению" right={<a class="icon-btn" href="#/friends/share" aria-label="Что видят друзья"><Icon name="settings" /></a>} />
      <section class="card stack-12 fr-code-card">
        <span class="section-label gold">Твой код игрока</span>
        <span class="fr-code">{prettyCode(player.code)}</span>
        <span class="muted small center">Отправь код или ссылку другу — он добавит тебя одним нажатием. Код можно сменить в любой момент.</span>
        <button type="button" class="btn primary" onClick={() => shareInvite(player.code)}>Пригласить: ссылка в Telegram</button>
        <button type="button" class="btn ghost" onClick={async () => {
          await navigator.clipboard?.writeText(prettyCode(player.code));
          toast({ kind: 'info', title: 'Код скопирован' });
        }}>Скопировать код</button>
      </section>
      <AddByCode player={player} onAdded={onAdded} />
      <Privacy />
    </div>
  );
}

function AddByCode({ player, onAdded }: { player: Player; onAdded: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await addFriend(player, code);
      toast({ kind: 'info', title: 'Друг добавлен', sub: 'Его неделя — в списке друзей' });
      setCode('');
      go('friends');
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section class="card stack-8">
      <label class="section-label" for="fr-add">Добавить друга</label>
      <div class="input-row">
        <input id="fr-add" class="input fr-input" placeholder="___-___" maxLength={8} autoComplete="off" autoCapitalize="characters" value={code}
          onInput={(e) => setCode(e.currentTarget.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && submit()} />
        <button type="button" class="btn primary small" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length !== 6} onClick={submit}>Добавить</button>
      </div>
      {err && <span class="small fr-err">{err}</span>}
    </section>
  );
}

const Privacy = () => (
  <div class="ai-privacy"><Icon name="shield" size={18} /><span>Без регистрации, почты и пароля. Друг видит только имя персонажа, уровень и итоги недели. Действия, цели, заметки и фото остаются на телефоне.</span></div>
);

// ---------- 2. Список ----------

function Dots({ n }: { n: number }) {
  return <span class="fr-dots">{Array.from({ length: 7 }, (_, i) => <span key={i} class={i < n ? 'on' : ''} />)}</span>;
}

function Reactions({ player, f, week, onChange }: { player: Player; f: FriendView; week: string; onChange: () => void }) {
  const [mine, setMine] = useState<string | undefined>(f.mine[week]);
  const pick = async (e: string) => {
    const next = mine === e ? null : e;
    setMine(next ?? undefined);
    try {
      await react(player, f.id, week, next);
    } catch (err) {
      setMine(f.mine[week]);
      toast({ kind: 'info', title: err instanceof Error ? err.message : 'Не получилось' });
      onChange();
    }
  };
  return (
    <div class="fr-reacts">
      {EMOJI.map((e) => (
        <button type="button" key={e} class={mine === e ? 'fr-react on' : 'fr-react'} aria-pressed={mine === e} onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); pick(e); }}>{e}</button>
      ))}
    </div>
  );
}

function Avatar({ card }: { card?: WeekCard }) {
  const name = card?.name ?? '?';
  return <span class="fr-ava">{name.slice(0, 1).toUpperCase()}<span class="fr-lvl">{card?.level ?? '–'}</span></span>;
}

function FriendsList({ player, friends, onChange }: { player: Player; friends: FriendView[]; onChange: () => void }) {
  const today = localDate();
  const week = weekStart(today);
  const left = 7 - ((new Date().getDay() + 6) % 7);
  const theirs = friends.flatMap((f) => (f.theirs[week] ? [`${f.cards[0]?.name ?? 'Друг'}: ${f.theirs[week]}`] : []));
  return (
    <div class="page">
      <TopBar title="Друзья" crumbs={`${friends.length} ${plural(friends.length, 'напарник', 'напарника', 'напарников')}`} right={<a class="icon-btn" href="#/friends/share" aria-label="Что видят друзья"><Icon name="settings" /></a>} />
      {theirs.length > 0 && <div class="notice"><span class="small">Тебя поддержали на этой неделе: {theirs.join(', ')}</span></div>}
      <SectionLabel>Эта неделя · до понедельника {left} {plural(left, 'день', 'дня', 'дней')}</SectionLabel>
      {friends.map((f) => {
        const c = f.cards[0];
        const fresh = c && c.week === week;
        return (
          <a class="card stack-12 fr-card" href={`#/friends/${f.id}`} key={f.id}>
            <span class="fr-head">
              <Avatar card={c} />
              <span class="stack-4 fr-who">
                <span class="strong">{c?.name ?? 'Друг'}</span>
                <span class="muted small">{c ? `закрыто ${fresh ? c.goalsDone : 0} ${plural(fresh ? c.goalsDone : 0, 'цель', 'цели', 'целей')} · серия ${c.streak} дн.` : 'ещё не заходил на этой неделе'}</span>
              </span>
              <Icon name="right" size={18} />
            </span>
            <span class="fr-week"><span class="muted small strong">Неделя: {fresh ? c.days : 0} из 7 дней</span><Dots n={fresh ? c.days : 0} /></span>
            {fresh && <Reactions player={player} f={f} week={week} onChange={onChange} />}
          </a>
        );
      })}
      <a class="card fr-more" href="#/friends/invite">
        <span class="fr-plus">+</span>
        <span class="stack-4"><span class="strong">Пригласить ещё</span><span class="muted small">код {prettyCode(player.code)}</span></span>
      </a>
      <div class="ai-privacy"><Icon name="flag" size={18} /><span>Сравнения и рейтинга нет: только как прошла неделя у каждого. Дуэли и общие квесты — позже.</span></div>
    </div>
  );
}

// ---------- 3. Неделя друга ----------

function FriendWeek({ player, f, onChange }: { player: Player; f: FriendView; onChange: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const c = f.cards[0];
  const prev = f.cards[1];
  return (
    <div class="page">
      <TopBar title={c?.name ?? 'Друг'} crumbs={`${c ? `ур. ${c.level} · ` : ''}в друзьях с ${sinceLabel(f.since)}`} />
      {c ? (
        <>
          <WeekBlock c={c} />
          <section class="card stack-8">
            <span class="section-label">Поддержать</span>
            <Reactions player={player} f={f} week={c.week} onChange={onChange} />
            <span class="muted small">{c.name} увидит твою реакцию. Без переписки — для неё есть Telegram.</span>
          </section>
          {prev && <WeekBlock c={prev} />}
        </>
      ) : <p class="muted center">Друг ещё не открывал «Друзей» — его неделя появится, когда он зайдёт.</p>}
      <button type="button" class="link small fr-danger" onClick={() => setConfirm(true)}>Убрать из друзей</button>
      <Confirm open={confirm} title="Убрать из друзей?" text="Вы перестанете видеть недели друг друга. Добавиться снова можно по коду." action="Убрать"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await removeFriend(player, f.id);
            go('friends');
            onChange();
          } catch (e) {
            toast({ kind: 'info', title: e instanceof Error ? e.message : 'Не получилось' });
          }
        }} />
    </div>
  );
}

function WeekBlock({ c }: { c: WeekCard }) {
  return (
    <section class="card stack-12">
      <span class="section-label gold">Неделя {weekLabel(c.week)}</span>
      <div class="fr-stats">
        <span><b>{c.days}/7</b><small>дней с действием</small></span>
        <span><b>{c.goalsDone}</b><small>{plural(c.goalsDone, 'цель закрыта', 'цели закрыто', 'целей закрыто')}</small></span>
        <span><b>+{c.xp}</b><small>XP</small></span>
      </div>
      {c.areas && c.areas.length > 0 && (
        <div class="stack-4">
          <span class="muted small strong">Больше всего занимался</span>
          {c.areas.map((a) => (
            <div class="fr-area" key={a.title}><span class="dot" style={{ background: a.color || 'var(--muted)' }} /><span class="strong">{a.title}</span><span class="muted small">{a.note}</span></div>
          ))}
        </div>
      )}
      {c.skills && c.skills.length > 0 && <span class="muted small">Навыки: {c.skills.join(', ')}</span>}
    </section>
  );
}

// ---------- 4. Что видят друзья ----------

function ShareSettings() {
  const w = useWorld();
  const share = w.profile?.friendsShare ?? DEFAULT_SHARE;
  const player = w.profile?.player;
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof share) => setFriendsShare({ ...share, [k]: !share[k] });
  return (
    <div class="page">
      <TopBar title="Что видят друзья" />
      <section class="stack-8">
        <div class="menu-row"><span class="menu-row-text"><span class="strong">Имя персонажа и уровень</span><span class="muted small">без этого друг тебя не узнает</span></span><span class="muted small">всегда</span></div>
        <Toggle on={share.week} title="Итоги недели" sub="дни с действием, сколько целей закрыто, XP" onClick={() => set('week')} />
        <Toggle on={share.areas} title="Направления недели" sub="например «Тело: 3 действия»" onClick={() => set('areas')} />
        <Toggle on={share.skills} title="Названия навыков" sub="по умолчанию скрыты" onClick={() => set('skills')} />
      </section>
      {player && (
        <section class="card stack-12">
          <span class="section-label">Ключ игрока</span>
          <span class="muted small">Аккаунта нет — вместо него телефон хранит секретный ключ. Он сохраняется в <b>резервной копии</b>: восстановишь копию на новом телефоне — друзья останутся.</span>
          <button type="button" class="btn ghost" onClick={async () => {
            try {
              const p = await newCode(player);
              toast({ kind: 'info', title: `Новый код: ${prettyCode(p.code)}`, sub: 'Старый больше не работает, друзья остались' });
            } catch (e) {
              toast({ kind: 'info', title: e instanceof Error ? e.message : 'Не получилось' });
            }
          }}>Сменить код игрока · {prettyCode(player.code)}</button>
          <button type="button" class="link small fr-danger" onClick={() => setConfirm(true)}>Выйти из друзей и удалить данные с сервера</button>
        </section>
      )}
      <div class="ai-privacy"><Icon name="shield" size={18} /><span>На сервер уходит только включённое выше — когда открываешь «Друзей». Без ключа данные с сервера не прочитать и не изменить.</span></div>
      <Confirm open={confirm} title="Выйти из друзей?" text="С сервера удалится всё: код, друзья, недели и реакции. У друзей ты тоже пропадёшь. Твой путь на телефоне не изменится." action="Выйти и удалить"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await leave(player!);
            await toggleExperiment('friends');
            toast({ kind: 'info', title: 'Данные удалены с сервера' });
            go('more');
          } catch (e) {
            toast({ kind: 'info', title: e instanceof Error ? e.message : 'Не получилось' });
          }
        }} />
    </div>
  );
}

// ---------- ссылка-приглашение ----------

function AddByLink({ code }: { code: string }) {
  const w = useWorld();
  const [msg, setMsg] = useState('Добавляю друга…');
  useEffect(() => {
    (async () => {
      try {
        // Открыл приглашение — значит, хочет «Друзей»: включаем эксперимент.
        if (!w.hasExp('friends')) await toggleExperiment('friends');
        const player = await ensurePlayer(w.profile);
        await addFriend(player, code);
        toast({ kind: 'info', title: 'Друг добавлен' });
        go('friends');
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Не получилось');
      }
    })();
  }, [code]);
  return (
    <div class="page">
      <TopBar title="Приглашение" />
      <p class="center">{msg}</p>
      <a class="btn ghost" href="#/friends">К друзьям</a>
    </div>
  );
}
