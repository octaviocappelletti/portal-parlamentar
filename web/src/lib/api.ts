const API_BASE = process.env.API_URL!;
const API_KEY  = process.env.API_SECRET_KEY!;
const TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, init: RequestInit & { next?: { revalidate?: number } }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export async function apiFetch<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    headers: { 'x-api-key': API_KEY },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiFetchOptional<T>(
  path: string,
  revalidate = 60,
): Promise<T | null> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    headers: { 'x-api-key': API_KEY },
    next: { revalidate },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}
