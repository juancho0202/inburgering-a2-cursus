<script setup lang="ts">
import { RouterLink } from "vue-router";
import KeyGuide from "./KeyGuide.vue";
</script>

<template>
  <div class="grid gap-5">
    <section class="card p-6">
      <h2 class="text-xl font-bold">Wat is dit?</h2>
      <p class="mt-2">
        Een app om te oefenen voor het inburgeringsexamen (niveau A2): <strong>Lezen</strong>, <strong>KNM</strong> en <strong>Schrijven</strong>. Met lessen, woorden herhalen, oefeningen en proefexamens. Alles is in eenvoudig Nederlands.
      </p>
      <p class="mt-3 rounded-2xl bg-brand-bg px-4 py-3 font-semibold text-brand-strong">
        Deze app is <strong>niet van DUO</strong> en heeft er niets mee te maken. Alle teksten en vragen zijn zelf gemaakt. Een proefexamen hier zegt niets zeker over je echte score.
      </p>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold">Jouw gegevens blijven bij jou</h2>
      <ul class="mt-2 grid list-disc gap-1 pl-5">
        <li>Je voortgang staat <strong>alleen in deze browser</strong>, op dit apparaat. Er is geen account en er is geen server die je gegevens bewaart.</li>
        <li>Wis je de gegevens van je browser, dan is je voortgang weg. <strong>Bewaar hem daarom regelmatig</strong> met “Klaar voor vandaag”.</li>
        <li>Er is geen tracking en geen reclame.</li>
      </ul>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold">Op twee apparaten leren</h2>
      <p class="mt-2">
        Druk op <strong>Klaar voor vandaag</strong> en bewaar je voortgang als bestand. Zet dat bestand op je andere apparaat (op een iPhone kan dat met AirDrop) en kies daar <strong>Ga verder met een bestand</strong>. Je antwoorden worden samengevoegd. Er gaat nooit iets kwijt.
      </p>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold">Claude (optioneel)</h2>
      <p class="mt-2">
        Met je eigen API-sleutel van Anthropic krijg je feedback op je schrijfteksten, uitleg bij fouten en extra oefeningen. De sleutel wordt versleuteld op dit apparaat bewaard en gaat alleen naar Anthropic. <strong>Zonder sleutel werkt alles gewoon</strong>, alleen niet de Claude-hulp.
      </p>
      <KeyGuide class="mt-3" />
      <RouterLink to="/instellingen" class="mt-3 inline-block font-semibold text-brand-strong underline">Naar Instellingen</RouterLink>
    </section>
  </div>
</template>
