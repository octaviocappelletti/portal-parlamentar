const API_BASE = process.env.API_URL!;
const API_KEY  = process.env.API_SECRET_KEY!;

export async function apiFetch<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-api-key': API_KEY },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function apiFetchOptional<T>(
  path: string,
  revalidate = 60,
): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-api-key': API_KEY },
    next: { revalidate },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}
