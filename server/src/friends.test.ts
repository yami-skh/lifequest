// Логика друзей на настоящем SQL: node:sqlite в памяти + та же миграция, что у D1.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ADD_TRIES_PER_HOUR, FriendsError, MAX_FRIENDS, addFriend, auth, changeCode, createPlayer, deletePlayer,
  handleFriends, listFriends, normCode, putCard, putReaction, removeFriend, type Sql,
} from './friends';

const MIGRATION = readFileSync(new URL('../migrations/0001_friends.sql', import.meta.url), 'utf8');

function memory(): Sql {
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION);
  const args = (a: unknown[]) => a as (string | number | null)[];
  return {
    run: async (sql, ...a) => { db.prepare(sql).run(...args(a)); },
    all: async <T>(sql: string, ...a: unknown[]) => db.prepare(sql).all(...args(a)) as T[],
    first: async <T>(sql: string, ...a: unknown[]) => (db.prepare(sql).get(...args(a)) as T | undefined) ?? null,
  };
}

const secret = (n: number) => `secret-${n}-`.padEnd(40, 'x');
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const key = (n: number) => `Player ${uuid(n)}:${secret(n)}`;
const card = (week: string, extra: object = {}) => ({ name: 'Yami', level: 7, streak: 9, week, days: 5, goalsDone: 4, xp: 640, ...extra });
const fail = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { if (e instanceof FriendsError) return e.code; throw e; }
  return 'ok';
};

let sql: Sql;
let codes: string[];
beforeEach(async () => {
  sql = memory();
  codes = [];
  for (let i = 1; i <= 3; i++) codes.push((await createPlayer(sql, { id: uuid(i), secret: secret(i) })).code);
});

describe('ключ игрока', () => {
  it('код — 6 символов без похожих букв; повтор регистрации с тем же ключом возвращает тот же код', async () => {
    expect(codes[0]).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(await createPlayer(sql, { id: uuid(1), secret: secret(1) })).toEqual({ code: codes[0] });
    expect(await fail(createPlayer(sql, { id: uuid(1), secret: secret(9) }))).toBe('taken');
  });
  it('на сервере только хэш секрета; чужой или пустой ключ не пускает', async () => {
    const row = await sql.first<{ secret_hash: string }>('SELECT secret_hash FROM players WHERE id = ?', uuid(1));
    expect(row!.secret_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.secret_hash).not.toContain('secret');
    expect(await auth(sql, key(1))).toBe(uuid(1));
    expect(await fail(auth(sql, `Player ${uuid(1)}:${secret(2)}`))).toBe('bad_key');
    expect(await fail(auth(sql, null))).toBe('no_key');
  });
  it('смена кода: старый больше не находит, друзья остаются', async () => {
    await addFriend(sql, uuid(1), { code: codes[1] });
    const { code } = await changeCode(sql, uuid(2));
    expect(code).not.toBe(codes[1]);
    expect(await fail(addFriend(sql, uuid(3), { code: codes[1] }))).toBe('no_code');
    expect((await listFriends(sql, uuid(1))).friends.map((f) => f.id)).toEqual([uuid(2)]);
  });
});

describe('добавить по коду', () => {
  it('пара сразу взаимная, код терпит регистр и дефис, повтор не дублирует', async () => {
    const c = codes[1];
    await addFriend(sql, uuid(1), { code: `${c.slice(0, 3).toLowerCase()}-${c.slice(3)}` });
    await addFriend(sql, uuid(1), { code: c });
    await addFriend(sql, uuid(2), { code: codes[0] });
    expect((await listFriends(sql, uuid(1))).friends.map((f) => f.id)).toEqual([uuid(2)]);
    expect((await listFriends(sql, uuid(2))).friends.map((f) => f.id)).toEqual([uuid(1)]);
    expect(normCode('k7m 42q')).toBe('K7M42Q');
  });
  it('свой код и несуществующий — понятная ошибка', async () => {
    expect(await fail(addFriend(sql, uuid(1), { code: codes[0] }))).toBe('self');
    expect(await fail(addFriend(sql, uuid(1), { code: 'ZZZZZZ' }))).toBe('no_code');
  });
  it(`не больше ${ADD_TRIES_PER_HOUR} попыток в час (перебор кодов)`, async () => {
    const t = Date.UTC(2026, 9, 6, 12);
    for (let i = 0; i < ADD_TRIES_PER_HOUR; i++) await fail(addFriend(sql, uuid(1), { code: 'ZZZZZZ' }, t));
    expect(await fail(addFriend(sql, uuid(1), { code: codes[1] }, t))).toBe('limit');
    expect(await fail(addFriend(sql, uuid(1), { code: codes[1] }, t + 3600_000))).toBe('ok');
  });
  it(`не больше ${MAX_FRIENDS} друзей`, async () => {
    for (let i = 10; i < 10 + MAX_FRIENDS; i++) {
      await createPlayer(sql, { id: uuid(i), secret: secret(i) });
      await addFriend(sql, uuid(i), { code: codes[0] }, Date.UTC(2026, 9, 6, i));
    }
    expect(await fail(addFriend(sql, uuid(2), { code: codes[0] }))).toBe('full');
  });
});

describe('карточки и реакции', () => {
  beforeEach(async () => { await addFriend(sql, uuid(1), { code: codes[1] }); });

  it('друг видит две последние недели; карточка заменяется, лишние поля режутся', async () => {
    await putCard(sql, uuid(2), card('2026-09-22'));
    await putCard(sql, uuid(2), card('2026-09-29', { days: 3 }));
    await putCard(sql, uuid(2), card('2026-09-29', { days: 5, notes: 'секрет' }));
    await putCard(sql, uuid(2), card('2026-09-15'));
    const f = (await listFriends(sql, uuid(1))).friends[0];
    expect(f.cards.map((c) => [c.week, c.days])).toEqual([['2026-09-29', 5], ['2026-09-22', 5]]);
    expect(JSON.stringify(f.cards)).not.toContain('секрет');
  });
  it('неверная карточка не принимается', async () => {
    expect(await fail(putCard(sql, uuid(2), card('2026-09-29', { days: 8 })))).toBe('bad_request');
    expect(await fail(putCard(sql, uuid(2), { week: '2026-09-29' }))).toBe('bad_request');
  });
  it('старые карточки (больше 8 недель) удаляются', async () => {
    const now = Date.UTC(2026, 9, 6);
    await putCard(sql, uuid(2), card('2026-07-06'), now);
    await putCard(sql, uuid(2), card('2026-10-06'), now);
    expect(await sql.all('SELECT week FROM cards WHERE player = ?', uuid(2))).toEqual([{ week: '2026-10-06' }]);
  });
  it('реакция: одна на неделю, замена и снятие; видна обоим', async () => {
    await putReaction(sql, uuid(1), { to: uuid(2), week: '2026-09-29', emoji: '🔥' });
    await putReaction(sql, uuid(1), { to: uuid(2), week: '2026-09-29', emoji: '💪' });
    expect((await listFriends(sql, uuid(1))).friends[0].mine).toEqual({ '2026-09-29': '💪' });
    expect((await listFriends(sql, uuid(2))).friends[0].theirs).toEqual({ '2026-09-29': '💪' });
    await putReaction(sql, uuid(1), { to: uuid(2), week: '2026-09-29', emoji: null });
    expect((await listFriends(sql, uuid(1))).friends[0].mine).toEqual({});
    expect(await fail(putReaction(sql, uuid(1), { to: uuid(2), week: '2026-09-29', emoji: '💩' }))).toBe('bad_request');
  });
  it('не другу реагировать и смотреть нельзя', async () => {
    await putCard(sql, uuid(2), card('2026-09-29'));
    expect(await fail(putReaction(sql, uuid(3), { to: uuid(2), week: '2026-09-29', emoji: '🔥' }))).toBe('not_friend');
    expect((await listFriends(sql, uuid(3))).friends).toEqual([]);
  });
  it('убрать из друзей — у обоих, вместе с реакциями', async () => {
    await putReaction(sql, uuid(1), { to: uuid(2), week: '2026-09-29', emoji: '🔥' });
    await removeFriend(sql, uuid(2), uuid(1));
    expect((await listFriends(sql, uuid(1))).friends).toEqual([]);
    expect(await sql.all('SELECT * FROM reactions')).toEqual([]);
  });
  it('удалить себя — ничего не остаётся, у друга тоже пропадаешь', async () => {
    await putCard(sql, uuid(1), card('2026-09-29'));
    await putReaction(sql, uuid(2), { to: uuid(1), week: '2026-09-29', emoji: '🔥' });
    await deletePlayer(sql, uuid(1));
    for (const t of ['cards', 'reactions', 'attempts']) expect(await sql.all(`SELECT * FROM ${t}`), t).toEqual([]);
    expect(await sql.first('SELECT 1 FROM players WHERE id = ?', uuid(1))).toBeNull();
    expect((await listFriends(sql, uuid(2))).friends).toEqual([]);
  });
});

describe('маршруты', () => {
  const req = (method: string, path: string, body?: unknown, n = 1) =>
    new Request(`https://x${path}`, { method, headers: { Authorization: key(n), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  it('полный круг через HTTP: добавить, карточка, список', async () => {
    expect(await handleFriends(sql, req('POST', '/friends/add', { code: codes[1] }), '/friends/add')).toEqual({ status: 200, body: { id: uuid(2) } });
    await handleFriends(sql, req('PUT', '/card', card('2026-09-29'), 2), '/card');
    const r = await handleFriends(sql, req('GET', '/friends'), '/friends');
    expect((r!.body as { friends: { cards: unknown[] }[] }).friends[0].cards).toHaveLength(1);
  });
  it('чужие пути не трогает; без ключа — 401', async () => {
    expect(await handleFriends(sql, req('POST', '/goals', {}), '/goals')).toBeNull();
    expect(await fail(handleFriends(sql, new Request('https://x/friends'), '/friends'))).toBe('no_key');
  });
});
