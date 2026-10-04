// LifeQuest AI — сервер-посредник между приложением и Claude API (Cloudflare Worker).
// Ключ API — только в секретах Cloudflare. Сервер не пропускает произвольный текст:
// приложение присылает поля навыка, запрос к Claude собирается здесь. Ничего не сохраняет, кроме счётчиков.
//
// POST /goals  { code, skill: { title, path[], level, levelName, goals[] }, wish? }  →  { stages, comment, remaining }
// GET  /quota?code=…  →  { remaining } — сколько запросов осталось сегодня (для подписи в приложении).
// Секреты: ANTHROPIC_API_KEY, INVITE_CODES ("код1,код2"). Переменные: MODEL, EFFORT, LIMIT_PER_CODE, LIMIT_TOTAL.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export interface Env {
  ANTHROPIC_API_KEY: string;
  INVITE_CODES: string;
  MODEL?: string;
  EFFORT?: 'low' | 'medium' | 'high';
  LIMIT_PER_CODE?: string;
  LIMIT_TOTAL?: string;
  USAGE: KVNamespace;
}

const ALLOWED_ORIGINS = ['https://yami-skh.github.io', 'https://localhost', 'http://localhost:5173'];

// ---- Вход: только поля, с ограничением длины ----
const Text = (max: number) => z.string().trim().min(1).max(max);
const GoalIn = z.object({ title: Text(120), kind: z.enum(['theory', 'practice']), stage: z.number().int().min(1).max(10), done: z.boolean() });
const GoalsRequest = z.object({
  code: Text(64),
  skill: z.object({
    title: Text(80),
    path: z.array(Text(80)).max(6),
    level: z.number().int().min(0).max(10),
    levelName: Text(40),
    goals: z.array(GoalIn).max(60),
  }),
  wish: z.string().trim().max(300).optional(),
});

// ---- Выход: схема ответа Claude ----
const GoalsResponse = z.object({
  stages: z.array(z.object({
    stage: z.number().int().min(1).max(10),
    goals: z.array(z.object({
      title: z.string().max(100),
      kind: z.enum(['theory', 'practice']),
    })).min(1).max(5),
  })).min(1).max(4),
  comment: z.string().max(300),
});

const SYSTEM = `Ты помогаешь вести личную RPG-систему саморазвития. У навыка есть цели двух видов:
- theory — узнать, понять (прочитать, разобраться, изучить);
- practice — сделать руками, применить (выполнить, приготовить, повторить N раз).
Цели разложены по ступеням: 1 — самое начало, дальше сложнее. Пиши по-русски, коротко (до 70 символов), конкретно и проверяемо: по цели должно быть ясно, выполнена она или нет. Практики должно быть не меньше теории. Не повторяй существующие цели и не дроби их. Если у навыка уже есть открытые цели на ступени, продолжай с неё; иначе начинай со следующей ступени после последней. Предложи 1–3 ступени по 2–5 целей. В comment — одно короткое предложение для человека: на что делать упор.`;

function buildPrompt(r: z.infer<typeof GoalsRequest>) {
  const s = r.skill;
  const goals = s.goals.length
    ? s.goals.map((g) => `- [${g.done ? 'x' : ' '}] ступень ${g.stage}, ${g.kind === 'theory' ? 'теория' : 'практика'}: ${g.title}`).join('\n')
    : '(целей пока нет)';
  return `Навык: ${s.title}
Путь в дереве: ${[...s.path, s.title].join(' › ')}
Уровень навыка: ${s.level} из 10 (${s.levelName})
Существующие цели:
${goals}
${r.wish ? `Пожелание человека: ${r.wish}` : ''}
Предложи новые цели.`;
}

// ---- Лимиты в KV: счётчики на сутки (UTC). Неудачный запрос (отказ, ошибка) возвращается в лимит. ----
type Quota = { error: string } | { remaining: number; refund: () => Promise<void> };
async function takeQuota(env: Env, code: string): Promise<Quota> {
  const day = new Date().toISOString().slice(0, 10);
  const perCode = Number(env.LIMIT_PER_CODE ?? 10);
  const total = Number(env.LIMIT_TOTAL ?? 20);
  const kCode = `n:${day}:${code}`;
  const kAll = `n:${day}:*`;
  const ttl = { expirationTtl: 60 * 60 * 48 };
  const read = async () => Promise.all([env.USAGE.get(kCode), env.USAGE.get(kAll)]).then(([c, a]) => [Number(c ?? 0), Number(a ?? 0)]);
  const [c, a] = await read();
  if (c >= perCode) return { error: 'Лимит на сегодня исчерпан — завтра снова можно.' };
  if (a >= total) return { error: 'Общий лимит на сегодня исчерпан.' };
  await Promise.all([env.USAGE.put(kCode, String(c + 1), ttl), env.USAGE.put(kAll, String(a + 1), ttl)]);
  return {
    remaining: perCode - c - 1,
    refund: async () => {
      const [c2, a2] = await read();
      await Promise.all([env.USAGE.put(kCode, String(Math.max(0, c2 - 1)), ttl), env.USAGE.put(kAll, String(Math.max(0, a2 - 1)), ttl)]);
    },
  };
}

// ---- HTTP ----
function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(req.url);
    // Терпимо к тому, как вставили секрет: кавычки, пробелы, переносы, невидимые символы.
    const codes = (env.INVITE_CODES ?? '').replace(/[﻿​"'`]/g, '').split(/[,;\s]+/).filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/quota') {
      const code = url.searchParams.get('code') ?? '';
      if (!codes.includes(code)) return json({ error: 'bad_code', message: 'Неверный код доступа' }, 403, origin);
      const used = Number((await env.USAGE.get(`n:${new Date().toISOString().slice(0, 10)}:${code}`)) ?? 0);
      return json({ remaining: Math.max(0, Number(env.LIMIT_PER_CODE ?? 10) - used) }, 200, origin);
    }
    if (req.method !== 'POST' || url.pathname !== '/goals') return json({ error: 'not_found' }, 404, origin);

    const parsed = GoalsRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'bad_request', message: 'Неверный запрос' }, 400, origin);
    const r = parsed.data;

    if (!codes.includes(r.code)) return json({ error: 'bad_code', message: 'Неверный код доступа' }, 403, origin);
    const quota = await takeQuota(env, r.code);
    if ('error' in quota) return json({ error: 'limit', message: quota.error, remaining: 0 }, 429, origin);
    const fail = async (body: { error: string; message: string }, status: number) => {
      await quota.refund();
      return json({ ...body, remaining: quota.remaining + 1 }, status, origin);
    };

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
    try {
      const msg = await client.beta.messages.parse({
        model: env.MODEL ?? 'claude-opus-5-5',
        // Предел ответа ограничивает цену одного запроса (Opus 5.5: до ~$0.17).
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: env.EFFORT ?? 'medium', format: betaZodOutputFormat(GoalsResponse) },
        system: SYSTEM,
        messages: [{ role: 'user', content: buildPrompt(r) }],
      });
      if (msg.stop_reason === 'refusal') return fail({ error: 'refusal', message: 'Claude не стал отвечать на этот запрос' }, 422);
      if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) return fail({ error: 'bad_answer', message: 'Ответ не получился, попробуй ещё раз' }, 502);
      return json({ ...msg.parsed_output, remaining: quota.remaining }, 200, origin);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return fail({ error: 'busy', message: 'Claude сейчас занят, попробуй через минуту' }, 503);
      if (e instanceof Anthropic.AuthenticationError) return fail({ error: 'server_key', message: 'Сервер настроен неправильно (ключ API)' }, 500);
      if (e instanceof Anthropic.APIError) return fail({ error: 'api', message: 'Ошибка Claude API, попробуй позже' }, 502);
      return fail({ error: 'internal', message: 'Не удалось связаться с Claude' }, 502);
    }
  },
} satisfies ExportedHandler<Env>;
