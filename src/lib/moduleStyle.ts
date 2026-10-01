export interface ModuleStyle {
  emoji: string;
  tile: string; // tailwind classes for the icon tile
  bar: string;
}

const styles: Record<string, ModuleStyle> = {
  basis: { emoji: "📚", tile: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", bar: "bg-sky-500" },
  lezen: { emoji: "📖", tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", bar: "bg-emerald-500" },
  knm: { emoji: "🏛️", tile: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300", bar: "bg-violet-500" },
  schrijven: { emoji: "✍️", tile: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", bar: "bg-rose-500" },
  exams: { emoji: "⏱️", tile: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", bar: "bg-amber-500" },
};

export const moduleStyle = (id: string): ModuleStyle =>
  styles[id] ?? { emoji: "📘", tile: "bg-surface-2 text-ink", bar: "bg-brand" };
