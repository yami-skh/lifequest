// «Друзья»: ключ игрока и запросы к серверу (server/src/friends.ts, docs/arch/11-friends.md).
// Ключ создаёт сам телефон; на сервере — только хэш секрета. Уходит только карточка недели (engine/friends.ts).
import { setPlayer } from '../db/actions';
import type { Profile } from '../db/db';
import { buildWeekCard, DEFAULT_SHARE, type WeekCard } from '../engine/friends';
import type { Derived } from '../db/world';
import { AI_URL } from './ai';
import { localDate } from '../engine/dates';

export type Player = NonNullable<Profile['player']>;
export const EMOJI = ['🔥', '💪', '👏', '🙌'] as const;

export interface FriendView {
  id: string;
  since: number;
  cards: WeekCard[];
  mine: Record<string, string>;
  theirs: Record<string, string>;
}

export class FriendsError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

async function call<T>(path: string, init: RequestInit & { player?: Player } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.player) headers.Authorization = `Player ${init.player.id}:${init.player.secret}`;
  let res: Response;
  try {
    res = await fetch(AI_URL + path, { ...init, headers });
  } catch {
    throw new FriendsError('Нет связи с сервером — проверь интернет', 'network');
  }
  const body = await res.json().catch(() => ({}));
  // Старый сервер без «Друзей» отвечает not_found без текста.
  if (res.status === 404 && body.error === 'not_found') throw new FriendsError('Друзья на сервере ещё не включены', 'off');
  if (!res.ok) throw new FriendsError(body.message ?? 'Что-то пошло не так', body.error ?? 'unknown');
  return body as T;
}

const randomSecret = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Ключ есть — вернуть; нет — создать на телефоне и зарегистрировать на сервере. */
export async function ensurePlayer(p: Profile | undefined): Promise<Player> {
  if (p?.player) return p.player;
  const id = crypto.randomUUID();
  const secret = randomSecret();
  const { code } = await call<{ code: string }>('/player', { method: 'POST', body: JSON.stringify({ id, secret }) });
  const player = { id, secret, code };
  await setPlayer(player);
  return player;
}

/** «K7M42Q» → «K7M-42Q». */
export const prettyCode = (c: string) => (c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c);
export const inviteLink = (code: string) => `https://yami-skh.github.io/lifequest/#/friends/add/${code}`;

export const listFriends = (player: Player) => call<{ code: string; friends: FriendView[] }>('/friends', { player });
export const addFriend = (player: Player, code: string) => call<{ id: string }>('/friends/add', { method: 'POST', player, body: JSON.stringify({ code }) });
export const removeFriend = (player: Player, id: string) => call('/friends/' + id, { method: 'DELETE', player });
export const react = (player: Player, to: string, week: string, emoji: string | null) =>
  call('/reaction', { method: 'PUT', player, body: JSON.stringify({ to, week, emoji }) });

export async function newCode(player: Player): Promise<Player> {
  const { code } = await call<{ code: string }>('/player/code', { method: 'POST', player });
  const next = { ...player, code };
  await setPlayer(next);
  return next;
}

/** Выйти из друзей: всё о себе удаляется с сервера, ключ — с телефона. */
export async function leave(player: Player) {
  await call('/player', { method: 'DELETE', player });
  await setPlayer(undefined);
}

export function myCard(w: Derived): WeekCard {
  return buildWeekCard({
    name: w.profile?.name ?? '',
    level: w.level.level,
    streak: w.streak,
    today: localDate(),
    entries: w.entries,
    entrySkills: w.entrySkills,
    goals: w.goals,
    areaOf: (id) => w.areaOf(id),
    skillTitle: (id) => w.nodeById.get(id)?.title,
  }, w.profile?.friendsShare ?? DEFAULT_SHARE);
}

const SENT_KEY = 'lq.friendsCard';
/** Отправить свою карточку, если она изменилась с прошлого раза (не чаще, чем нужно). */
export async function pushCard(player: Player, card: WeekCard, force = false) {
  const json = JSON.stringify(card);
  try {
    if (!force && localStorage.getItem(SENT_KEY) === json) return;
  } catch { /* без localStorage — просто отправим */ }
  await call('/card', { method: 'PUT', player, body: json });
  try { localStorage.setItem(SENT_KEY, json); } catch { /* ничего */ }
}
