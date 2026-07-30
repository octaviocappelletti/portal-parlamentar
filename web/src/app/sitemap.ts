import type { MetadataRoute } from "next";
import { apiFetch } from "@/lib/api";

const BASE = "https://www.capivaraparlamentar.com.br";

interface ParlamentarMin {
  casa: string;
  id_externo: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE,              lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/camara`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/senado`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/gastos`,  lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/proposicoes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/sobre`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];

  let parlamentares: ParlamentarMin[] = [];
  try {
    const res = await apiFetch<{ data: ParlamentarMin[] }>(
      "/parlamentares?limit=1000&offset=0",
      86400,
    );
    parlamentares = res.data;
  } catch {
    // Se a API falhar, o sitemap retorna só as páginas estáticas
  }

  const dinamicas: MetadataRoute.Sitemap = parlamentares.map((p) => ({
    url: `${BASE}/${p.casa}/${p.id_externo}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...estaticas, ...dinamicas];
}
