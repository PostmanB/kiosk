export type RuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_KIOSK_PIN?: string;
  VITE_STATS_PIN?: string;
};

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

export const getRuntimeEnv = (): RuntimeEnv => {
  if (typeof window === "undefined") return {};
  return window.__ENV__ ?? {};
};

export const readEnv = (key: keyof RuntimeEnv): string | undefined => {
  const runtimeValue = getRuntimeEnv()[key];
  if (runtimeValue && runtimeValue.length > 0) return runtimeValue;
  const buildValue = (import.meta.env[key] as string | undefined) ?? undefined;
  if (buildValue && buildValue.length > 0) return buildValue;
  return undefined;
};
