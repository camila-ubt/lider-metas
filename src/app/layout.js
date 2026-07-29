import { Geist, Geist_Mono } from "next/font/google";
import FechamentoMensal from "@/components/FechamentoMensal";
import MascaraMoeda from "@/components/MascaraMoeda";
import ConferenciaAthos from "@/components/ConferenciaAthos";
import AnaliseGerencial from "@/components/AnaliseGerencial";
import AlvoAnaliseFechamento from "@/components/AlvoAnaliseFechamento";
import ResumoLojasFechamento from "@/components/ResumoLojasFechamento";
import AjusteProbabilidades from "@/components/AjusteProbabilidades";
import FeedbackTurnos from "@/components/FeedbackTurnos";
import "./globals.css";
import "./branding.css";
import "./meta-status.css";
import "./dashboard-compact.css";
import "./lancamento-cards.css";
import "./fechamento-posicao.css";
import "./relatorio-enxuto.css";
import "./fechamento-impressao.css";
import "./analise-ajustes.css";

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
  icons: {
    icon: [{ url: "/lider-metas-icon.svg", type: "image/svg+xml" }],
    shortcut: "/lider-metas-icon.svg",
    apple: "/lider-metas-icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <ConferenciaAthos />
        <AnaliseGerencial modo="painel" />
        <MascaraMoeda />
        <FechamentoMensal />
        <AlvoAnaliseFechamento />
        <ResumoLojasFechamento />
        <AnaliseGerencial modo="fechamento" />
        <AjusteProbabilidades />
        <FeedbackTurnos />
      </body>
    </html>
  );
}
