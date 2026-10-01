import { computed, ref } from "vue";
import { useSettingsStore } from "../stores/settings";

const voice = ref<SpeechSynthesisVoice | null>(null);
const ready = ref(false);

function pickVoice() {
  if (typeof speechSynthesis === "undefined") return;
  const voices = speechSynthesis.getVoices();
  voice.value = voices.find((v) => v.lang === "nl-NL") ?? voices.find((v) => v.lang.startsWith("nl")) ?? null;
  ready.value = true;
}

if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

export function useSpeech() {
  const settings = useSettingsStore();
  const available = computed(() => voice.value !== null);

  function speak(text: string) {
    if (!voice.value) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "nl-NL";
    u.voice = voice.value;
    u.rate = settings.settings?.speechRate ?? 0.95;
    speechSynthesis.speak(u);
  }

  return { available, ready, speak };
}
