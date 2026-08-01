import { Geist, Geist_Mono } from "next/font/google";
import FechamentoMensal from "@/components/FechamentoMensal";
import MascaraMoeda from "@/components/MascaraMoeda";
import ConferenciaAthos from "@/components/ConferenciaAthos";
import AnaliseGerencial from "@/components/AnaliseGerencial";
import PainelReuniao from "@/components/PainelReuniao";
import InteligenciaGerencialUnificada from "@/components/InteligenciaGerencialUnificada";
import OrganizarRelatorio from "@/components/OrganizarRelatorio";
import AlvoAnaliseFechamento from "@/components/AlvoAnaliseFechamento";
import ResumoLojasFechamento from "@/components/ResumoLojasFechamento";
import AjusteProbabilidades from "@/components/AjusteProbabilidades";
import FeedbackTurnos from "@/components/FeedbackTurnos";
import RemoverLancamento from "@/components/RemoverLancamento";
import AjusteDiasEquivalentes from "@/components/AjusteDiasEquivalentes";
import FluxoPendenciasLancamento from "@/components/FluxoPendenciasLancamento";
import "./globals.css";
import "./branding.css";
import "./meta-status.css";
import "./dashboard-compact.css";
import "./lancamento-cards.css";
import "./fluxo-pendencias.css";
import "./fechamento-posicao.css";
import "./relatorio-enxuto.css";
import "./fechamento-impressao.css";
import "./analise-ajustes.css";
import "./inteligencia-gerencial.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  applicationName: "Metas Líder",
  title: "Líder Metas",
  description: "Acompanhamento de metas das lojas CB, AA e AB",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Metas Líder",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/lider-metas-icon.svg", type: "image/svg+xml" }],
    shortcut: "/lider-metas-icon.svg",
    apple: "/lider-metas-icon.svg",
  },
};

export const viewport = {
  themeColor: "#7650a7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <ConferenciaAthos />
        <PainelReuniao />
        <AnaliseGerencial modo="painel" />
        <InteligenciaGerencialUnificada />
        <OrganizarRelatorio />
        <MascaraMoeda />
        <FechamentoMensal />
        <AlvoAnaliseFechamento />
        <ResumoLojasFechamento />
        <AnaliseGerencial modo="fechamento" />
        <AjusteProbabilidades />
        <FeedbackTurnos />
        <RemoverLancamento />
        <AjusteDiasEquivalentes />
        <FluxoPendenciasLancamento />
      </body>
    </html>
  );
}
