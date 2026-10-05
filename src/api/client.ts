import { createApiRouter, type Method } from "@shared/services/router";
import { getEnv } from "./env";

export interface ApiError {
  error: { code: string; message: string };
}

/** Error from the in-browser API. `body` keeps extra fields such as `submissionId`. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

// The screens call the same paths as in the server version; the answers now come from the browser itself.
const router = createApiRouter(getEnv);

async function request<T>(method: Method, path: string, data?: unknown): Promise<T> {
  const res = await router.handle(method, path, data);
  if (res.status >= 400) {
    const err = (res.body as ApiError | null)?.error;
    throw new ApiRequestError(err?.message ?? "Er ging iets mis.", err?.code ?? "error", (res.body ?? {}) as Record<string, unknown>);
  }
  return res.body as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, data?: unknown) => request<T>("POST", path, data),
  put: <T>(path: string, data?: unknown) => request<T>("PUT", path, data),
};
