import { useSettingsStore } from "../stores/settings";
import { playComplete, playCorrect, playLessonMelody, playWrong, stopMusic } from "../lib/sound";

/** The game sounds, switched off by the settings. */
export function useSounds() {
  const settings = useSettingsStore();
  const effects = () => settings.settings?.soundEffects !== false;
  return {
    correct: () => effects() && playCorrect(),
    wrong: () => effects() && playWrong(),
    complete: (passed: boolean) => effects() && playComplete(passed),
    stopMusic: () => stopMusic(),
    /** Plays the lesson tune; returns when the voice should come in, in ms (0 when the music is off). */
    lessonMelody: (lessonNumber: number, moduleIndex: number) =>
      settings.settings?.lessonMusic === false ? 0 : playLessonMelody(lessonNumber, moduleIndex),
  };
}
