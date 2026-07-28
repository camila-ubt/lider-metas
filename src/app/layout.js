import { Geist, Geist_Mono } from "next/font/google";
import FechamentoMensal from "@/components/FechamentoMensal";
import MascaraMoeda from "@/components/MascaraMoeda";
import ConferenciaAthos from "@/components/ConferenciaAthos";
import "./globals.css";
import "./meta-status.css";
import "./dashboard-compact.css";
import "./lancamento-cards.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Líder Metas",
  description: "Acompanhamento de metas das lojas CB, AA e AB",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <ConferenciaAthos />
        <MascaraMoeda />
        <FechamentoMensal />
      </body>
    </html>
  );
}
