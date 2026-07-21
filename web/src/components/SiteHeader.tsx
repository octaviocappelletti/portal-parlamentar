"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Deputados",   href: "/camara" },
  { label: "Senadores",   href: "/senado" },
  { label: "Gastos",      href: "/gastos" },
  { label: "Proposições", href: "/proposicoes" },
  { label: "Sobre",       href: "/sobre" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b-[3px] border-brand-yellow">
      <div className="max-w-[1180px] mx-auto flex items-center gap-4 px-8 py-[18px]">
        <Link href="/" className="flex items-center gap-4 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-brand-blue flex items-center justify-center text-white font-black text-[19px] select-none">
            CP
          </div>
          <div>
            <div className="font-extrabold text-[19px] tracking-tight text-text-strong">
              Capivara Parlamentar
            </div>
            <div className="text-xs text-text-muted font-semibold uppercase tracking-[0.02em]">
              Transparência do Congresso Nacional
            </div>
          </div>
        </Link>

        <nav className="ml-auto flex gap-[26px] text-sm font-semibold">
          {NAV.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={
                pathname === href
                  ? "text-brand-blue"
                  : "text-[#33404f] hover:text-brand-blue transition-colors"
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
