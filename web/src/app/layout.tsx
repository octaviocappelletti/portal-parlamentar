import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Portal Parlamentar", template: "%s · Portal Parlamentar" },
  description:
    "Acompanhe a atuação de senadores e deputados federais. Dados oficiais, sem login e sem rastreamento.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold text-slate-900 text-lg tracking-tight hover:text-marinho-700 transition-colors">
              Portal Parlamentar
            </Link>
            <nav className="flex items-center gap-1 ml-2">
              <Link href="/camara" className="btn-ghost">Câmara</Link>
              <Link href="/senado" className="btn-ghost">Senado</Link>
            </nav>
            <span className="ml-auto text-xs text-slate-500 hidden sm:block">
              Dados oficiais · LAI 12.527/2011
            </span>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-slate-200 bg-white mt-16">
          <div className="max-w-7xl mx-auto px-6 py-5 text-xs text-slate-500 flex flex-wrap gap-4 justify-between">
            <span>
              Dados da{" "}
              <a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 transition-colors">
                API da Câmara
              </a>{" "}
              e do{" "}
              <a href="https://legis.senado.leg.br/dadosabertos" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 transition-colors">
                Senado Federal
              </a>
              . Sem rastreamento. Código aberto.
            </span>
            <span>Portal somente-leitura</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
