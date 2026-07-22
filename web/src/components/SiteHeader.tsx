"use client";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white border-b-[3px] border-brand-yellow">
      <div className="max-w-[1180px] mx-auto flex items-center gap-3 px-4 sm:px-8 py-[14px] sm:py-[18px]">
        <Link href="/" className="flex items-center gap-3 sm:gap-4 shrink-0" onClick={() => setOpen(false)}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-blue flex items-center justify-center text-white font-black text-[17px] sm:text-[19px] select-none">
            CP
          </div>
          <div>
            <div className="font-extrabold text-[16px] sm:text-[19px] tracking-tight text-text-strong leading-tight">
              Capivara Parlamentar
            </div>
            <div className="text-xs text-text-muted font-semibold uppercase tracking-[0.02em] hidden sm:block">
              Transparência do Congresso Nacional
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-auto hidden md:flex gap-[26px] text-sm font-semibold">
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

        {/* Hamburger */}
        <button
          className="ml-auto md:hidden p-2 -mr-1 rounded-lg text-text-body hover:bg-surface-alt transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-border-base bg-white px-4 pb-2 flex flex-col">
          {NAV.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className={`py-4 text-[15px] font-semibold border-b border-border-base last:border-0 ${
                pathname === href ? "text-brand-blue" : "text-text-strong"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
