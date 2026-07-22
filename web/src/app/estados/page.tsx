import Link from "next/link";
import type { Metadata } from "next";
import { EstadosMapa, type StateFeature } from "@/components/EstadosMapa";

export const metadata: Metadata = { title: "Explorar por estado" };
export const revalidate = 86400 * 30; // rebusca a cada 30 dias (bordas não mudam)

// ── Projeção equirretangular ────────────────────────────────────────────────
// Cobre o bounding box do Brasil com 4px de padding.
const SVG_W = 600;
const SVG_H = 522;
const PAD = 4;
const MIN_LON = -74;
const MAX_LON = -28;
const MIN_LAT = -34;
const MAX_LAT = 6;

function project(lon: number, lat: number): [number, number] {
  const x = PAD + ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (SVG_W - 2 * PAD);
  const y = PAD + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (SVG_H - 2 * PAD);
  return [x, y];
}

// ── Conversão GeoJSON → string de path SVG ──────────────────────────────────
type Coord = [number, number];
type Ring  = Coord[];

function ringToD(ring: Ring): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

function geometryToD(geo: { type: string; coordinates: unknown }): string {
  if (geo.type === "Polygon") {
    return (geo.coordinates as Ring[]).map(ringToD).join("");
  }
  if (geo.type === "MultiPolygon") {
    return (geo.coordinates as Ring[][])
      .flatMap((poly) => poly.map(ringToD))
      .join("");
  }
  return "";
}

// ── Centroide visual (média dos vértices do anel exterior) ──────────────────
function ringCentroid(ring: Ring): [number, number] {
  const pts = ring.map(([lon, lat]) => project(lon, lat));
  const cx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const cy = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  return [cx, cy];
}

function geometryCentroid(geo: { type: string; coordinates: unknown }): [number, number] {
  if (geo.type === "Polygon") {
    const outer = (geo.coordinates as Ring[])[0];
    return ringCentroid(outer);
  }
  if (geo.type === "MultiPolygon") {
    // usa o anel exterior do maior polígono (mais vértices)
    const polys = geo.coordinates as Ring[][];
    const largest = polys.map((p) => p[0]).reduce((a, b) => (a.length >= b.length ? a : b));
    return ringCentroid(largest);
  }
  return [SVG_W / 2, SVG_H / 2];
}

// ── Fetch + processamento ───────────────────────────────────────────────────
const GEO_URL =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson";

interface GeoFeature {
  type: "Feature";
  properties: { sigla: string; name: string };
  geometry: { type: string; coordinates: unknown };
}

interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

async function buildFeatures(): Promise<StateFeature[]> {
  const res = await fetch(GEO_URL, { next: { revalidate: 86400 * 30 } });
  if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);
  const geo = (await res.json()) as GeoCollection;

  return geo.features
    .filter((f) => f.properties?.sigla && f.geometry)
    .map((f) => {
      const pathD = geometryToD(f.geometry);
      const [labelX, labelY] = geometryCentroid(f.geometry);
      return { uf: f.properties.sigla.toUpperCase(), pathD, labelX, labelY };
    });
}

// ── Página ──────────────────────────────────────────────────────────────────
export default async function EstadosPage() {
  let features: StateFeature[] = [];
  let fetchError = false;

  try {
    features = await buildFeatures();
  } catch {
    fetchError = true;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">
            Início
          </Link>
          <span>›</span>
          <span className="text-text-strong font-semibold">Explorar por estado</span>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-8">
        {/* Título */}
        <div className="pt-8 pb-6">
          <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong mb-2">
            Explore por estado
          </h1>
          <p className="text-[15px] text-text-body max-w-[580px] leading-relaxed">
            Selecione um estado para ver os deputados federais e senadores que representam
            a região.
          </p>
        </div>

        {fetchError ? (
          /* Fallback em caso de falha no CDN */
          <div className="py-12 text-center border border-border-base rounded-xl bg-surface-alt">
            <p className="text-text-body mb-4">
              Não foi possível carregar o mapa geográfico.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-[500px] mx-auto">
              {[
                "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
                "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
                "RO","RR","RS","SC","SE","SP","TO",
              ].map((uf) => (
                <Link
                  key={uf}
                  href={`/camara?uf=${uf}`}
                  className="px-3 py-1.5 rounded-lg bg-blue-bg text-brand-blue text-[13px] font-bold hover:bg-brand-blue hover:text-white transition-colors"
                >
                  {uf}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EstadosMapa features={features} />
        )}
      </div>
    </div>
  );
}
