import Link from "next/link";
import AvatarFoto from "./AvatarFoto";

type CfgStatus = {
  faixa: string;
  badgeBg: string;
  badgeText: string;
  avatarBg: string;
  avatarText: string;
};

const STATUS_MAP: Array<[string, CfgStatus]> = [
  [
    "licencia",
    { faixa: "#9aa7b6", badgeBg: "#eef2f7", badgeText: "#7a8798", avatarBg: "#eef2f7", avatarText: "#7a8798" },
  ],
  [
    "exerc",
    { faixa: "#168821", badgeBg: "#e7f4ea", badgeText: "#168821", avatarBg: "#e8f0fb", avatarText: "#1351B4" },
  ],
  [
    "titular",
    { faixa: "#1351B4", badgeBg: "#e8f0fb", badgeText: "#1351B4", avatarBg: "#e8f0fb", avatarText: "#1351B4" },
  ],
];

const DEFAULT_CFG: CfgStatus = {
  faixa: "#1351B4",
  badgeBg: "#e8f0fb",
  badgeText: "#1351B4",
  avatarBg: "#e8f0fb",
  avatarText: "#1351B4",
};

function resolveCfg(situacao: string | null | undefined): CfgStatus {
  const s = (situacao ?? "").toLowerCase();
  for (const [kw, cfg] of STATUS_MAP) {
    if (s.includes(kw)) return cfg;
  }
  return DEFAULT_CFG;
}

function fmtGasto(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1_000)
    return `R$ ${Math.round(v / 1_000).toLocaleString("pt-BR")} mil`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export type ParlamentarCardProps = {
  nome: string;
  partido: string | null | undefined;
  uf: string | null | undefined;
  gasto2025: number | null;
  mediaGasto: number;
  presencaPct: number | null;
  situacao: string | null | undefined;
  iniciais: string;
  href: string;
  fotoUrl?: string | null;
};

export default function ParlamentarCard({
  nome,
  partido,
  uf,
  gasto2025,
  mediaGasto,
  presencaPct,
  situacao,
  iniciais,
  href,
  fotoUrl,
}: ParlamentarCardProps) {
  const cfg = resolveCfg(situacao);
  const gastoStr = fmtGasto(gasto2025);
  const acimaDaMedia = !!gasto2025 && mediaGasto > 0 && gasto2025 > mediaGasto;

  return (
    <Link
      href={href}
      className="block border border-border-base rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-px transition-all"
    >
      {/* Faixa de cor */}
      <div className="h-[6px]" style={{ backgroundColor: cfg.faixa }} />

      {/* Corpo */}
      <div className="p-[22px]">
        {/* Avatar + nome */}
        <div className="flex items-center gap-3 mb-4">
          <AvatarFoto
            url={fotoUrl}
            iniciais={iniciais}
            size={56}
            rounded="rounded-xl"
            avatarBg={cfg.avatarBg}
            avatarText={cfg.avatarText}
          />
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold text-text-strong leading-tight line-clamp-2">
              {nome}
            </p>
            <p className="text-[13px] text-text-body mt-0.5">
              {partido ?? "—"} · {uf ?? "—"}
            </p>
          </div>
        </div>

        {/* Mini-stats */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-surface-alt rounded-lg p-[10px]">
            <p className="text-[11px] text-text-muted font-semibold mb-1">Gasto 2025</p>
            <p
              className="text-[14px] font-extrabold"
              style={{ color: acimaDaMedia ? "#c0392b" : "#071d41" }}
            >
              {gastoStr}
            </p>
          </div>
          <div className="flex-1 bg-surface-alt rounded-lg p-[10px]">
            <p className="text-[11px] text-text-muted font-semibold mb-1">Presença</p>
            <p
              className="text-[14px] font-extrabold"
              style={{
                color:
                  presencaPct === null
                    ? "#9aa7b6"
                    : presencaPct >= 75
                    ? "#168821"
                    : "#c0392b",
              }}
            >
              {presencaPct !== null ? `${presencaPct}%` : "N/D"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {situacao && (
            <span
              className="text-[11px] font-bold px-3 py-1 rounded-full truncate max-w-[60%]"
              style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeText }}
            >
              {situacao}
            </span>
          )}
          <span className="text-[13px] text-brand-blue font-bold ml-auto shrink-0">
            Ver perfil →
          </span>
        </div>
      </div>
    </Link>
  );
}
