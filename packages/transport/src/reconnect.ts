export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  factor?: number;
};

export const getBackoffDelayMs = (attempt: number, options: BackoffOptions = {}): number => {
  const baseMs = options.baseMs ?? 250;
  const maxMs = options.maxMs ?? 5000;
  const factor = options.factor ?? 1.8;
  return Math.min(maxMs, Math.round(baseMs * factor ** Math.max(0, attempt)));
};
