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

export const metadata: Metadata = {
  title: { default: "Capivara Parlamentar", template: "%s · Capivara Parlamentar" },
  description:
    "Acompanhe custos, proposições e verbas de deputados e senadores. Dados oficiais, sem login e sem rastreamento.",
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
