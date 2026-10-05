import type { ProgressFile } from "@shared/schemas/transfer";

/** `inburgering-a2-voortgang-2026-10-05-laptop.json` */
export function progressFileName(device: string | null, date = new Date()): string {
  const slug = (device ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `inburgering-a2-voortgang-${date.toISOString().slice(0, 10)}${slug ? `-${slug}` : ""}.json`;
}

export function makeProgressFile(bundle: ProgressFile, name: string): File {
  return new File([JSON.stringify(bundle)], name, { type: "application/json" });
}

/** Can this browser share a file (the share sheet with AirDrop, Messages, Files, ...)? */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type SaveResult = "shared" | "downloaded" | "cancelled";

/**
 * Hands the file to the person: the share sheet where the browser has one (phones, Safari), otherwise a download.
 * Must be called straight from a click, with the file already made, or the browser may refuse to share.
 */
export async function saveProgressFile(file: File): Promise<SaveResult> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: "Mijn voortgang" });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled";
      // sharing failed for another reason: fall back to a download
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

export const readJsonFile = async (file: File): Promise<unknown> => JSON.parse(await file.text());
