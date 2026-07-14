import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal Parlamentar",
  description:
    "Acompanhe a atuação de senadores e deputados federais. Dados oficiais, sem login e sem rastreamento.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-gray-900 antialiased">
        <header className="border-b px-6 py-3 flex items-center gap-4">
          <a href="/" className="font-semibold text-lg">Portal Parlamentar</a>
          <nav className="flex gap-4 text-sm text-gray-600">
            <a href="/camara" className="hover:text-gray-900">Câmara</a>
            <a href="/senado" className="hover:text-gray-900">Senado</a>
          </nav>
        </header>
        {children}
        <footer className="border-t mt-16 px-6 py-4 text-xs text-gray-400 text-center">
          Dados oficiais provenientes da API da Câmara dos Deputados e do Senado Federal (LAI 12.527/2011).
          Sem rastreamento. Código aberto.
        </footer>
      </body>
    </html>
  );
}
