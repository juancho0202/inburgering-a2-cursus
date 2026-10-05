/**
 * Security headers for the deployed site (Netlify `_headers`) and for `vite preview` (so the browser tests run
 * with the same Content-Security-Policy as production). See docs/production-readiness.md §5.
 *
 * The CSP is the main protection for the learner's API key: scripts only from our own files, and network
 * calls only to ourselves and to Anthropic.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** Contents of Netlify's `_headers` file. */
export function netlifyHeadersFile(): string {
  const block = (path: string, headers: Record<string, string>) => `${path}\n${Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n`;
  return [
    block("/*", SECURITY_HEADERS),
    // Hashed files never change, so they can be cached for a year.
    block("/assets/*", { "Cache-Control": "public, max-age=31536000, immutable" }),
    // These must be re-checked every time, or a new version of the app would not reach installed copies.
    ...["/index.html", "/sw.js", "/registerSW.js", "/manifest.webmanifest"].map((p) => block(p, { "Cache-Control": "no-cache" })),
  ].join("\n");
}
