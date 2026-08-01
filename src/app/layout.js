import { Geist, Geist_Mono } from "next/font/google";
import FechamentoPainelNovo from "@/components/FechamentoPainelNovo";
import PersistenciaNavegacao from "@/components/PersistenciaNavegacao";
import MascaraMoeda from "@/components/MascaraMoeda";
import ConferenciaAthos from "@/components/ConferenciaAthos";
import InteligenciaGerencial from "@/components/InteligenciaGerencial";
import PainelReuniao from "@/components/PainelReuniao";
import RemoverLancamento from "@/components/RemoverLancamento";
import FluxoPendenciasLancamento from "@/components/FluxoPendenciasLancamento";
import "./globals.css";
import "./branding.css";
import "./meta-status.css";
import "./dashboard-compact.css";
import "./lancamento-cards.css";
import "./fluxo-pendencias.css";
import "./inteligencia-gerencial.css";
import "./persistencia-navegacao.css";

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
        <FechamentoPainelNovo />
        <RemoverLancamento />
        <FluxoPendenciasLancamento />
      </body>
    </html>
  );
}
