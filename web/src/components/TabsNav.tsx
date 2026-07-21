"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Visão geral",  suffix: "",            enabled: true  },
  { label: "Gastos",       suffix: "/gastos",      enabled: true  },
  { label: "Proposições",  suffix: "/proposicoes", enabled: true  },
  { label: "Votações",     suffix: "/votacoes",    enabled: false },
  { label: "Patrimônio",   suffix: "/patrimonio",  enabled: false },
] as const;

export default function TabsNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-border-base overflow-x-auto">
      {TABS.map(({ label, suffix, enabled }) => {
        if (!enabled) {
          return (
            <span
              key={label}
              className="shrink-0 px-5 py-[14px] text-sm text-text-muted font-semibold select-none cursor-default opacity-50"
              title="Em breve"
            >
              {label}
            </span>
          );
        }
        const href = `${basePath}${suffix}`;
        const isActive = suffix === "" ? pathname === basePath : pathname === href;
        return (
          <Link
            key={label}
            href={href}
            className={`shrink-0 px-5 py-[14px] text-sm transition-colors ${
              isActive
                ? "text-brand-blue font-bold border-b-[3px] border-brand-blue -mb-px"
                : "text-text-body font-semibold hover:text-text-strong"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
