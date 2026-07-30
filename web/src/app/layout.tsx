import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import GovBar from "@/components/GovBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-raleway",
  display: "swap",
});

const SITE_URL = "https://www.capivaraparlamentar.com.br";
const DESCRICAO =
  "Acompanhe gastos, proposições e presença de deputados e senadores. Dados oficiais do governo, sem login e sem rastreamento.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Capivara Parlamentar", template: "%s · Capivara Parlamentar" },
  description: DESCRICAO,
  keywords: [
    "deputados federais", "senadores", "câmara dos deputados", "senado federal",
    "gastos parlamentares", "CEAP", "proposições", "transparência", "dados abertos",
    "acompanhamento parlamentar", "política brasileira",
  ],
  authors: [{ name: "Capivara Parlamentar" }],
  creator: "Capivara Parlamentar",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Capivara Parlamentar",
    title: "Capivara Parlamentar",
    description: DESCRICAO,
  },
  twitter: {
    card: "summary_large_image",
    title: "Capivara Parlamentar",
    description: DESCRICAO,
  },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${raleway.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <GovBar />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
