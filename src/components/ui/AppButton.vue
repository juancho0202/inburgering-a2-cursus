<script setup lang="ts">
withDefaults(defineProps<{ variant?: "primary" | "secondary" | "ghost" | "good" | "bad"; size?: "md" | "lg"; disabled?: boolean }>(), {
  variant: "primary",
  size: "md",
});
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
    :class="[
      size === 'lg' ? 'px-6 py-3.5 text-lg' : 'px-4 py-2',
      {
        'bg-brand text-white shadow-[0_3px_0_var(--brand-strong)] hover:brightness-105': variant === 'primary',
        'border-2 border-line bg-surface text-ink hover:bg-surface-2': variant === 'secondary',
        'text-muted hover:bg-surface-2 hover:text-ink': variant === 'ghost',
        'bg-good text-white hover:brightness-110 dark:text-black': variant === 'good',
        'bg-bad text-white hover:brightness-110 dark:text-black': variant === 'bad',
      },
    ]"
  >
    <slot />
  </button>
</template>
