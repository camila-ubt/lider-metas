import { Geist, Geist_Mono } from "next/font/google";
import PersistenciaNavegacao from "@/components/PersistenciaNavegacao";
import MascaraMoeda from "@/components/MascaraMoeda";
import ConferenciaAthos from "@/components/ConferenciaAthos";
import InteligenciaGerencial from "@/components/InteligenciaGerencial";
import PainelReuniao from "@/components/PainelReuniao";
import AjusteProbabilidades from "@/components/AjusteProbabilidades";
import FeedbackTurnos from "@/components/FeedbackTurnos";
import RemoverLancamento from "@/components/RemoverLancamento";
import AjusteDiasEquivalentes from "@/components/AjusteDiasEquivalentes";
import FluxoPendenciasLancamento from "@/components/FluxoPendenciasLancamento";
import ConfiguracaoHorarios from "@/components/ConfiguracaoHorarios";
import OrdenarGraficoPainel from "@/components/OrdenarGraficoPainel";
import DetalhesMetasRanking from "@/components/DetalhesMetasRanking";
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
import "./persistencia-navegacao.css";
import "./fechamento-print-fix.css";
import "./fechamento-botao-final.css";

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
        <PersistenciaNavegacao />
        <ConferenciaAthos />
        <PainelReuniao />
        <InteligenciaGerencial />
        <MascaraMoeda />
        <AjusteProbabilidades />
        <FeedbackTurnos />
        <RemoverLancamento />
        <AjusteDiasEquivalentes />
        <FluxoPendenciasLancamento />
        <ConfiguracaoHorarios />
        <OrdenarGraficoPainel />
        <DetalhesMetasRanking />
      </body>
    </html>
  );
}
