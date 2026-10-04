// AI-помощник целей: запросы к серверу-посреднику (server/, Cloudflare Worker). Ключ Claude — только на сервере.
// В Claude уходят только поля навыка: название, путь, уровень, цели и пожелание. Записи, фото и заметки — нет.
import type { GoalKind } from '../engine/progress';

/** Адрес сервера. Для проверки с локальным сервером: VITE_AI_URL=http://localhost:8787 npm run dev. */
export const AI_URL = (import.meta.env.VITE_AI_URL as string | undefined) || 'https://lifequest-ai.lifequest-ai.workers.dev';

export interface AiGoal { title: string; kind: GoalKind }
export interface AiStage { stage: number; goals: AiGoal[] }
export interface AiGoalsAnswer { stages: AiStage[]; comment: string; remaining: number }
export interface AiSkillInput {
  title: string;
  path: string[];
  level: number;
  levelName: string;
  goals: { title: string; kind: GoalKind; stage: number; done: boolean }[];
}

export class AiError extends Error {
  constructor(message: string, public code: string, public remaining?: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(AI_URL + path, { ...init, headers: { 'Content-Type': 'application/json' } });
  } catch {
    throw new AiError('Нет связи с сервером — проверь интернет', 'network');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(body.message ?? 'Что-то пошло не так', body.error ?? 'unknown', body.remaining);
  return body as T;
}

export const askGoals = (code: string, skill: AiSkillInput, wish?: string) =>
  call<AiGoalsAnswer>('/goals', { method: 'POST', body: JSON.stringify({ code, skill, wish: wish?.trim() || undefined }) });

export const fetchQuota = (code: string) => call<{ remaining: number }>(`/quota?code=${encodeURIComponent(code)}`);
