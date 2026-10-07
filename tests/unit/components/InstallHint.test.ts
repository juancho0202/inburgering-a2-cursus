// @vitest-environment jsdom
// "Op je telefoon of beginscherm": installing the app and protecting its storage.
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstallHint from "../../../src/components/InstallHint.vue";
import { buttonWith, clickButton, flushPromises, mountApp } from "../../helpers/component";

const storage = vi.hoisted(() => ({
  isInstalled: vi.fn(() => false),
  isIos: vi.fn(() => false),
  requestPersistentStorage: vi.fn(async () => true),
  storageStatus: vi.fn(async () => ({ persisted: false as boolean | null, usedMb: 12.5 as number | null, quotaMb: 500 as number | null })),
}));
vi.mock("../../../src/lib/storage", () => storage);

beforeEach(() => {
  vi.clearAllMocks();
  storage.isInstalled.mockReturnValue(false);
  storage.isIos.mockReturnValue(false);
  storage.storageStatus.mockResolvedValue({ persisted: false, usedMb: 12.5, quotaMb: 500 });
});

const browserOffersInstall = () => {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void> };
  event.prompt = vi.fn(async () => {});
  window.dispatchEvent(event);
  return event;
};

describe("installing", () => {
  it("the install button only appears once the browser offers installation, and the browser's own banner is held back", async () => {
    const { wrapper } = await mountApp(InstallHint);
    expect(buttonWith(wrapper, "Installeer de app")).toBeUndefined();
    const event = browserOffersInstall();
    await flushPromises();
    expect(event.defaultPrevented).toBe(true);
    expect(buttonWith(wrapper, "Installeer de app")).toBeDefined();
  });

  it("pressing it shows the browser's install prompt and then hides the button", async () => {
    const { wrapper } = await mountApp(InstallHint);
    const event = browserOffersInstall();
    await flushPromises();
    await clickButton(wrapper, "Installeer de app");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(buttonWith(wrapper, "Installeer de app")).toBeUndefined();
  });

  it("after the app has been installed it only says so", async () => {
    const { wrapper } = await mountApp(InstallHint);
    window.dispatchEvent(new Event("appinstalled"));
    await flushPromises();
    expect(wrapper.text()).toContain("De app is geïnstalleerd op dit apparaat.");
    expect(wrapper.text()).not.toContain("Zet de app op je beginscherm");
  });

  it("already running as an installed app: no instructions at all", async () => {
    storage.isInstalled.mockReturnValue(true);
    const { wrapper } = await mountApp(InstallHint);
    expect(wrapper.text()).toContain("De app is geïnstalleerd");
    expect(wrapper.text()).not.toContain("Zet op beginscherm");
  });

  it("an iPhone gets the Safari steps (there is no install button there)", async () => {
    storage.isIos.mockReturnValue(true);
    const { wrapper } = await mountApp(InstallHint);
    expect(wrapper.text()).toContain("iPhone of iPad:");
    expect(wrapper.text()).toContain("Zet op beginscherm");
  });

  it("other browsers without an install offer get a general hint", async () => {
    const { wrapper } = await mountApp(InstallHint);
    expect(wrapper.text()).toContain("App installeren");
  });

  it("stops listening for the browser's offer when it is removed", async () => {
    const { wrapper } = await mountApp(InstallHint);
    wrapper.unmount();
    const event = browserOffersInstall();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("protecting the stored progress", () => {
  it("shows whether storage is protected and how much is used", async () => {
    const { wrapper } = await mountApp(InstallHint);
    expect(wrapper.text()).toContain("nog niet");
    expect(wrapper.text()).toContain("in gebruik: 12.5 MB");
  });

  it("asking for protection re-reads the status", async () => {
    const { wrapper } = await mountApp(InstallHint);
    storage.storageStatus.mockResolvedValue({ persisted: true, usedMb: 12.5, quotaMb: 500 });
    await clickButton(wrapper, "Vraag bescherming aan");
    expect(storage.requestPersistentStorage).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("ja");
    expect(buttonWith(wrapper, "Vraag bescherming aan")).toBeUndefined();
  });

  it("when the browser cannot tell, it says 'onbekend' and offers no button", async () => {
    storage.storageStatus.mockResolvedValue({ persisted: null, usedMb: null, quotaMb: null });
    const { wrapper } = await mountApp(InstallHint);
    expect(wrapper.text()).toContain("onbekend");
    expect(wrapper.text()).not.toContain("in gebruik");
    expect(buttonWith(wrapper, "Vraag bescherming aan")).toBeUndefined();
  });
});
