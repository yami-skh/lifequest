// Друзья, ступень 1: анонимный ключ игрока и напарники (docs/arch/11-friends.md).
// Логика — поверх тонкого интерфейса Sql: в Worker это D1, в тестах — node:sqlite.
// Сервер хранит только sha256 секрета, код игрока, пары друзей, карточки недели и реакции.
import { z } from 'zod';

export interface Sql {
  run(sql: string, ...args: unknown[]): Promise<void>;
  all<T>(sql: string, ...args: unknown[]): Promise<T[]>;
  first<T>(sql: string, ...args: unknown[]): Promise<T | null>;
}

export const d1 = (db: D1Database): Sql => ({
  run: async (sql, ...a) => { await db.prepare(sql).bind(...a).run(); },
  all: async <T>(sql: string, ...a: unknown[]) => (await db.prepare(sql).bind(...a).all<T>()).results,
  first: async <T>(sql: string, ...a: unknown[]) => db.prepare(sql).bind(...a).first<T>(),
});

export const MAX_FRIENDS = 20;
export const ADD_TRIES_PER_HOUR = 10;
export const KEEP_WEEKS = 8;
export const EMOJI = ['🔥', '💪', '👏', '🙌'] as const;
/** Без похожих символов (0/O, 1/I/L): код читают вслух и переписывают с экрана. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class FriendsError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const hashSecret = async (secret: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));

export function newCode(): string {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((x) => ALPHABET[x % ALPHABET.length]).join('');
}
/** «k7m-42q», «K7M 42Q» → «K7M42Q». */
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const Id = z.string().uuid();
const Secret = z.string().min(32).max(128);
const Week = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const WeekCard = z.object({
  name: z.string().trim().min(1).max(40),
  level: z.number().int().min(0).max(999),
  streak: z.number().int().min(0).max(10000),
  week: Week,
  days: z.number().int().min(0).max(7),
  goalsDone: z.number().int().min(0).max(1000),
  xp: z.number().int().min(0).max(1_000_000),
  areas: z.array(z.object({ title: z.string().max(40), color: z.string().max(16), note: z.string().max(60) })).max(6).optional(),
  skills: z.array(z.string().max(80)).max(10).optional(),
});
export type WeekCard = z.infer<typeof WeekCard>;

// ---------- вход: Authorization: Player <id>:<secret> ----------

export async function auth(sql: Sql, header: string | null): Promise<string> {
  const m = /^Player ([0-9a-f-]{36}):(.+)$/i.exec(header ?? '');
  if (!m) throw new FriendsError(401, 'no_key', 'Нет ключа игрока');
  const row = await sql.first<{ secret_hash: string }>('SELECT secret_hash FROM players WHERE id = ?', m[1]);
  if (!row || row.secret_hash !== (await hashSecret(m[2]))) throw new FriendsError(401, 'bad_key', 'Ключ игрока не подходит');
  await sql.run('UPDATE players SET last_seen = ? WHERE id = ?', Date.now(), m[1]);
  return m[1];
}

// ---------- игрок ----------

async function freeCode(sql: Sql): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = newCode();
    if (!(await sql.first('SELECT 1 FROM players WHERE code = ?', code))) return code;
  }
  throw new FriendsError(503, 'busy', 'Не удалось выдать код, попробуй ещё раз');
}

/** Регистрация: телефон сам придумал id и секрет. Повтор с тем же ключом — вернуть текущий код (обрыв связи). */
export async function createPlayer(sql: Sql, body: unknown): Promise<{ code: string }> {
  const p = z.object({ id: Id, secret: Secret }).safeParse(body);
  if (!p.success) throw new FriendsError(400, 'bad_request', 'Неверный запрос');
  const hash = await hashSecret(p.data.secret);
  const old = await sql.first<{ secret_hash: string; code: string }>('SELECT secret_hash, code FROM players WHERE id = ?', p.data.id);
  if (old) {
    if (old.secret_hash !== hash) throw new FriendsError(409, 'taken', 'Такой игрок уже есть');
    return { code: old.code };
  }
  const code = await freeCode(sql);
  const now = Date.now();
  await sql.run('INSERT INTO players (id, secret_hash, code, created_at, last_seen) VALUES (?, ?, ?, ?, ?)', p.data.id, hash, code, now, now);
  return { code };
}

export async function changeCode(sql: Sql, me: string): Promise<{ code: string }> {
  const code = await freeCode(sql);
  await sql.run('UPDATE players SET code = ? WHERE id = ?', code, me);
  return { code };
}

/** «Выйти из друзей и удалить данные с сервера»: всё о себе, у друзей тоже пропадаешь. */
export async function deletePlayer(sql: Sql, me: string): Promise<void> {
  await sql.run('DELETE FROM friends WHERE a = ? OR b = ?', me, me);
  await sql.run('DELETE FROM cards WHERE player = ?', me);
  await sql.run('DELETE FROM reactions WHERE from_p = ? OR to_p = ?', me, me);
  await sql.run('DELETE FROM attempts WHERE player = ?', me);
  await sql.run('DELETE FROM players WHERE id = ?', me);
}

// ---------- друзья ----------

export async function addFriend(sql: Sql, me: string, body: unknown, now = Date.now()): Promise<{ id: string }> {
  const p = z.object({ code: z.string().max(20) }).safeParse(body);
  if (!p.success) throw new FriendsError(400, 'bad_request', 'Неверный запрос');
  // Лимит попыток — против перебора кодов.
  const hour = new Date(now).toISOString().slice(0, 13);
  const tries = (await sql.first<{ n: number }>('SELECT n FROM attempts WHERE player = ? AND hour = ?', me, hour))?.n ?? 0;
  if (tries >= ADD_TRIES_PER_HOUR) throw new FriendsError(429, 'limit', 'Слишком много попыток, попробуй через час');
  await sql.run('INSERT INTO attempts (player, hour, n) VALUES (?, ?, 1) ON CONFLICT (player, hour) DO UPDATE SET n = n + 1', me, hour);
  await sql.run('DELETE FROM attempts WHERE hour < ?', new Date(now - 2 * 3600_000).toISOString().slice(0, 13));

  const other = await sql.first<{ id: string }>('SELECT id FROM players WHERE code = ?', normCode(p.data.code));
  if (!other) throw new FriendsError(404, 'no_code', 'Такого кода нет — проверь буквы');
  if (other.id === me) throw new FriendsError(400, 'self', 'Это твой собственный код');
  if (await sql.first('SELECT 1 FROM friends WHERE a = ? AND b = ?', me, other.id)) return { id: other.id };
  for (const who of [me, other.id]) {
    const n = (await sql.first<{ n: number }>('SELECT COUNT(*) AS n FROM friends WHERE a = ?', who))?.n ?? 0;
    if (n >= MAX_FRIENDS) throw new FriendsError(409, 'full', who === me ? `У тебя уже ${MAX_FRIENDS} друзей` : `У друга уже ${MAX_FRIENDS} друзей`);
  }
  await sql.run('INSERT INTO friends (a, b, since) VALUES (?, ?, ?), (?, ?, ?)', me, other.id, now, other.id, me, now);
  return { id: other.id };
}

export async function removeFriend(sql: Sql, me: string, other: string): Promise<void> {
  await sql.run('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me, other, other, me);
  await sql.run('DELETE FROM reactions WHERE (from_p = ? AND to_p = ?) OR (from_p = ? AND to_p = ?)', me, other, other, me);
}

const areFriends = async (sql: Sql, a: string, b: string) => !!(await sql.first('SELECT 1 FROM friends WHERE a = ? AND b = ?', a, b));

// ---------- карточка недели и реакции ----------

export async function putCard(sql: Sql, me: string, body: unknown, now = Date.now()): Promise<void> {
  const p = WeekCard.safeParse(body);
  if (!p.success) throw new FriendsError(400, 'bad_request', 'Неверная карточка');
  await sql.run('INSERT INTO cards (player, week, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (player, week) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at', me, p.data.week, JSON.stringify(p.data), now);
  const oldest = new Date(now - KEEP_WEEKS * 7 * 86400_000).toISOString().slice(0, 10);
  await sql.run('DELETE FROM cards WHERE player = ? AND week < ?', me, oldest);
  await sql.run('DELETE FROM reactions WHERE (from_p = ? OR to_p = ?) AND week < ?', me, me, oldest);
}

export async function putReaction(sql: Sql, me: string, body: unknown, now = Date.now()): Promise<void> {
  const p = z.object({ to: Id, week: Week, emoji: z.enum(EMOJI).nullable() }).safeParse(body);
  if (!p.success) throw new FriendsError(400, 'bad_request', 'Неверная реакция');
  if (!(await areFriends(sql, me, p.data.to))) throw new FriendsError(403, 'not_friend', 'Вы больше не друзья');
  if (p.data.emoji === null) await sql.run('DELETE FROM reactions WHERE from_p = ? AND to_p = ? AND week = ?', me, p.data.to, p.data.week);
  else await sql.run('INSERT INTO reactions (from_p, to_p, week, emoji, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (from_p, to_p, week) DO UPDATE SET emoji = excluded.emoji, at = excluded.at', me, p.data.to, p.data.week, p.data.emoji, now);
}

export interface FriendView {
  id: string;
  since: number;
  /** Последние две недели друга, новая первой. */
  cards: WeekCard[];
  /** Моя реакция на каждую неделю друга. */
  mine: Record<string, string>;
  /** Реакции друга на мои недели. */
  theirs: Record<string, string>;
}

export async function listFriends(sql: Sql, me: string): Promise<{ code: string; friends: FriendView[] }> {
  const code = (await sql.first<{ code: string }>('SELECT code FROM players WHERE id = ?', me))?.code ?? '';
  const pairs = await sql.all<{ b: string; since: number }>('SELECT b, since FROM friends WHERE a = ? ORDER BY since', me);
  const friends: FriendView[] = [];
  for (const { b, since } of pairs) {
    const cards = (await sql.all<{ data: string }>('SELECT data FROM cards WHERE player = ? ORDER BY week DESC LIMIT 2', b)).map((r) => JSON.parse(r.data) as WeekCard);
    const react = async (from: string, to: string) =>
      Object.fromEntries((await sql.all<{ week: string; emoji: string }>('SELECT week, emoji FROM reactions WHERE from_p = ? AND to_p = ?', from, to)).map((r) => [r.week, r.emoji]));
    friends.push({ id: b, since, cards, mine: await react(me, b), theirs: await react(b, me) });
  }
  return { code, friends };
}

// ---------- маршруты ----------

/** null — путь не про друзей (обработает остальной сервер). */
export async function handleFriends(sql: Sql, req: Request, path: string): Promise<{ status: number; body: unknown } | null> {
  const m = req.method;
  const body = m === 'POST' || m === 'PUT' ? await req.json().catch(() => null) : null;
  const ok = (b: unknown = { ok: true }) => ({ status: 200, body: b });
  if (m === 'POST' && path === '/player') return ok(await createPlayer(sql, body));
  if (!/^\/(player|friends|card|reaction)(\/|$)/.test(path)) return null;
  const me = await auth(sql, req.headers.get('Authorization'));
  if (m === 'POST' && path === '/player/code') return ok(await changeCode(sql, me));
  if (m === 'DELETE' && path === '/player') return ok(await deletePlayer(sql, me));
  if (m === 'GET' && path === '/friends') return ok(await listFriends(sql, me));
  if (m === 'POST' && path === '/friends/add') return ok(await addFriend(sql, me, body));
  const del = /^\/friends\/([0-9a-f-]{36})$/i.exec(path);
  if (m === 'DELETE' && del) return ok(await removeFriend(sql, me, del[1]));
  if (m === 'PUT' && path === '/card') return ok(await putCard(sql, me, body));
  if (m === 'PUT' && path === '/reaction') return ok(await putReaction(sql, me, body));
  return { status: 404, body: { error: 'not_found' } };
}
