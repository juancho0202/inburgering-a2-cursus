/** How much of a part must be on screen before it counts as reached: about its first line. */
const FIRST_LINE = 32;

/**
 * Resolves once the reader has scrolled to `el`: its first line is above `bottom()` (the lowest point of the screen
 * not covered by a bar), or the reader went past it. Until then it listens to scrolling and resizing; `signal` stops
 * the wait, which then resolves too. Either way the listeners are removed.
 */
export function whenReached(el: Element, bottom: () => number, signal: AbortSignal): Promise<void> {
  const reached = () => {
    const box = el.getBoundingClientRect();
    return box.top + Math.min(FIRST_LINE, box.height) <= bottom();
  };
  return new Promise((done) => {
    if (signal.aborted || reached()) return done();
    const check = () => {
      if (reached()) finish();
    };
    const finish = () => {
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
      signal.removeEventListener("abort", finish);
      done();
    };
    // capture: also when a box inside the page scrolls, not only the page
    window.addEventListener("scroll", check, { capture: true, passive: true });
    window.addEventListener("resize", check, { passive: true });
    signal.addEventListener("abort", finish);
  });
}
