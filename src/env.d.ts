/** Версия из package.json, подставляется при сборке (vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv { readonly VITE_AI_URL?: string }
