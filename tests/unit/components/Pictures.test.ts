// @vitest-environment jsdom
// Pictures in lessons and beside questions, and the read-along button.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ScenePicture from "../../../src/components/ScenePicture.vue";
import FadeImage from "../../../src/components/ui/FadeImage.vue";
import ReadAlongButton from "../../../src/components/ui/ReadAlongButton.vue";
import sceneAlts from "../../../src/assets/scenes/index.json";
import "../../helpers/component";

afterEach(() => vi.restoreAllMocks());

/** jsdom never downloads images; this makes every image look already downloaded (in the cache). */
function imagesAreCached() {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(480);
}

describe("FadeImage", () => {
  it("a picture that is already downloaded shows at once, without fading", async () => {
    imagesAreCached();
    const w = mount(FadeImage, { props: { src: "/a.svg", alt: "Een markt" } });
    await nextTick();
    const img = w.find("img");
    expect(img.classes()).toContain("opacity-100");
    expect(img.classes()).not.toContain("transition-opacity");
    expect(img.attributes("alt")).toBe("Een markt");
  });

  it("a picture that still has to load is hidden, then fades in when it has loaded", async () => {
    const img = mount(FadeImage, { props: { src: "/a.svg", alt: "" } }).find("img");
    expect(img.classes()).toContain("opacity-0");
    await img.trigger("load");
    expect(img.classes()).toContain("opacity-100");
    expect(img.classes()).toContain("transition-opacity");
  });

  it("a picture that failed to load (no size) is treated as not loaded yet", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true); // "complete" is also true after an error
    const w = mount(FadeImage, { props: { src: "/broken.svg", alt: "" } });
    await nextTick();
    const img = w.find("img");
    expect(img.classes()).toContain("opacity-0");
    expect(img.classes()).toContain("transition-opacity");
  });
});

describe("ScenePicture", () => {
  const [id, alt] = Object.entries(sceneAlts as Record<string, string>)[0];

  it("shows the drawing with its description for screen readers, and the caption", () => {
    const w = mount(ScenePicture, { props: { id, caption: "Op de markt" } });
    const img = w.find("img");
    expect(img.attributes("src")).toMatch(new RegExp(`${id}.*\\.svg`));
    expect(img.attributes("alt")).toBe(alt);
    expect(w.find("figcaption").text()).toBe("Op de markt");
  });

  it("without a caption there is no empty caption", () => {
    expect(mount(ScenePicture, { props: { id } }).find("figcaption").exists()).toBe(false);
  });

  it("an unknown drawing (e.g. a typo in the course) shows nothing instead of a broken image", () => {
    expect(mount(ScenePicture, { props: { id: "bestaat-niet" } }).html()).not.toContain("<figure");
  });
});

describe("ReadAlongButton", () => {
  it("shows its label while not reading, 'Stop' while reading, and says which state it is in", async () => {
    const w = mount(ReadAlongButton, { props: { reading: false, label: "Lees voor" } });
    expect(w.text()).toContain("Lees voor");
    expect(w.attributes("aria-pressed")).toBe("false");
    await w.setProps({ reading: true });
    expect(w.text()).toContain("Stop");
    expect(w.text()).not.toContain("Lees voor");
    expect(w.attributes("aria-pressed")).toBe("true");
  });

  it("a click asks to start or stop", async () => {
    const w = mount(ReadAlongButton, { props: { reading: false, label: "Lees voor" } });
    await w.trigger("click");
    expect(w.emitted("toggle")).toHaveLength(1);
  });
});
