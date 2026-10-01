<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="app-shell">
    <nav class="app-nav">
      <RouterLink to="/">Dashboard</RouterLink>
      <RouterLink to="/instellingen">Instellingen</RouterLink>
    </nav>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
