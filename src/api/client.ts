export interface ApiError {
  error: { code: string; message: string };
}

/** Error from the local API. `body` keeps extra fields such as `submissionId`. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json();
  if (!res.ok) {
    const message = (body as ApiError)?.error?.message ?? "Er ging iets mis.";
    throw new ApiRequestError(message, (body as ApiError)?.error?.code ?? "error", body as Record<string, unknown>);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
};
