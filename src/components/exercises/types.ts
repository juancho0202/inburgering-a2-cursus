export interface EvalResult {
  correct: boolean;
  /** 0–1 contribution to the unit score; null = not scored (e.g. free writing). */
  score: number | null;
  answer: unknown;
  /** Human-readable correct answer shown in the feedback panel. */
  correctAnswer?: string;
  /** For exercises that contain several questions (reading). */
  parts?: { itemId: string; correct: boolean; answer: unknown }[];
}

/** What every exercise component exposes to the shell. */
export interface ExerciseHandle {
  ready: boolean;
  evaluate: () => EvalResult;
}

export const shuffled = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
