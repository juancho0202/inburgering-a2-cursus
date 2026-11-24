import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, type Ref } from "vue";
import type { WritingFeedback } from "@shared/schemas/claude";

type Correction = WritingFeedback["corrections"][number];

/**
 * The explanation of one correction in the learner's own text, shown as a tooltip: on hover with a mouse, on tap,
 * or on keyboard focus. A tap (or click) pins it until the next tap, its ✕, Escape, or a tap anywhere else; only one
 * is open at a time. Used by the Taalcafé chat (`m` = message) and the writing feedback (one text, `m` = 0).
 *
 * The box is the positioned element that holds the corrected chunks (`data-fix="m-c"`) and the tooltip (`data-tooltip`).
 */
export type CorrectionTips = ReturnType<typeof useCorrectionTip>;

export function useCorrectionTip(box: Ref<HTMLElement | null>, correctionAt: (m: number, c: number) => Correction | null) {
  const tip = ref<{ m: number; c: number; pinned: boolean } | null>(null);
  /** Where the tooltip goes, in px inside the box: above the corrected chunk, the triangle pointing at its middle. */
  const place = ref({ left: 0, top: 0, width: 0, arrow: 0 });
  const GAP = 12; // room for the triangle
  const uid = useId();
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  // Closing gives the focus back to the correction; that focus must not open the tooltip again.
  let refocusing = false;

  const isOpen = (m: number, c: number) => tip.value?.m === m && tip.value.c === c;
  const tipId = (m: number, c: number) => `tip-${uid}-${m}-${c}`;
  const chunkEl = (m: number, c: number) => box.value?.querySelector<HTMLElement>(`[data-fix="${m}-${c}"]`) ?? null;
  const openCorrection = computed(() => (tip.value ? correctionAt(tip.value.m, tip.value.c) : null));

  /** Measures the chunk (its first line, when it wraps) and puts the tooltip above it, inside the box. */
  function positionTip() {
    const area = box.value?.getBoundingClientRect();
    const t = tip.value;
    const chunk = t && chunkEl(t.m, t.c);
    if (!area || !chunk) return;
    const first = chunk.getClientRects()[0] ?? chunk.getBoundingClientRect();
    // A phone gets (almost) the whole width: the page's own side margin is the padding. Wider screens: a card of 20rem.
    const narrow = window.innerWidth < 640;
    const width = narrow ? area.width : Math.min(320, area.width);
    const centre = first.left + first.width / 2 - area.left;
    const left = narrow ? 0 : Math.min(Math.max(centre - width / 2, 0), Math.max(area.width - width, 0));
    place.value = { left, width, top: first.top - area.top - GAP, arrow: Math.min(Math.max(centre - left, 16), Math.max(width - 16, 16)) };
  }

  /** A tooltip opened on purpose (tap, keyboard) must be readable: scroll up a little when its top is under the header or off screen. */
  function revealTip() {
    const el = box.value?.querySelector<HTMLElement>("[data-tooltip]");
    if (!el) return;
    // The app's bar stays at the top of the screen (sticky): the tooltip must end up below it.
    const bars = Array.from(document.querySelectorAll("header")).filter((h) => ["sticky", "fixed"].includes(getComputedStyle(h).position));
    const covered = Math.max(0, ...bars.map((h) => h.getBoundingClientRect().bottom));
    const over = covered + 8 - el.getBoundingClientRect().top;
    if (over > 0) window.scrollBy({ top: -over, behavior: "smooth" });
  }

  async function open(m: number, c: number, pinned: boolean, reveal = pinned) {
    clearTimeout(leaveTimer);
    tip.value = { m, c, pinned };
    await nextTick();
    positionTip();
    if (reveal) {
      await nextTick();
      revealTip();
    }
  }
  function close(returnFocus = false) {
    const t = tip.value;
    clearTimeout(leaveTimer);
    tip.value = null;
    if (returnFocus && t) {
      refocusing = true;
      chunkEl(t.m, t.c)?.focus();
      refocusing = false;
    }
  }

  function hoverIn(e: PointerEvent, m: number, c: number) {
    // A finger also sends pointerenter: only a mouse opens on hover, a tap goes through onTap.
    if (e.pointerType !== "mouse" || tip.value?.pinned) return;
    open(m, c, false);
  }
  function hoverOut(e: PointerEvent) {
    if (e.pointerType !== "mouse" || !tip.value || tip.value.pinned) return;
    // A moment to move the mouse onto the tooltip (to its ✕) before it goes.
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => tip.value && !tip.value.pinned && close(), 200);
  }
  /** The mouse reached the tooltip: it stays, so its ✕ can be clicked. */
  function keepTip() {
    clearTimeout(leaveTimer);
  }
  function onTap(m: number, c: number) {
    if (isOpen(m, c) && tip.value!.pinned) close();
    else open(m, c, true);
  }
  // Keyboard focus shows the tooltip (not pinned: it goes with the focus). A tap also focuses first, then its click pins it.
  function onFocus(m: number, c: number) {
    if (!tip.value && !refocusing) open(m, c, false, true);
  }
  function onBlur(e: FocusEvent, m: number, c: number) {
    if (isOpen(m, c) && !tip.value!.pinned && !(e.relatedTarget as Element | null)?.closest?.("[data-tooltip]")) close();
  }

  // A tap outside this box's chunks and tooltip closes it (a page can have several boxes, e.g. the writing history).
  function closeOnOutside(e: Event) {
    const target = e.target as Element | null;
    if (tip.value && !(target && box.value?.contains(target) && target.closest?.("[data-fix], [data-tooltip]"))) close();
  }
  function closeOnEscape(e: KeyboardEvent) {
    if (e.key !== "Escape" || !tip.value) return;
    // Handled: other Escape handlers (a menu, leaving the exercise) leave this press alone.
    e.preventDefault();
    close(true);
  }
  onMounted(() => {
    document.addEventListener("click", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionTip);
  });
  onBeforeUnmount(() => {
    clearTimeout(leaveTimer);
    document.removeEventListener("click", closeOnOutside);
    document.removeEventListener("keydown", closeOnEscape);
    window.removeEventListener("resize", positionTip);
  });

  return { tip, place, openCorrection, isOpen, tipId, close, hoverIn, hoverOut, keepTip, onTap, onFocus, onBlur };
}
