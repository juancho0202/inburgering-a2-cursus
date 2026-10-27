/**
 * Resolves when the image is downloaded and decoded. Older browsers (e.g. Safari before 11.1) have no `decode`;
 * there the load event is the best we have.
 */
export function whenDecoded(img: HTMLImageElement): Promise<unknown> {
  if (typeof img.decode === "function") return img.decode();
  return new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
}
