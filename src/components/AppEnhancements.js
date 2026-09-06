"use client";

import { usePathname } from "next/navigation";
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
import ManualUsuario from "@/components/ManualUsuario";
import PesquisaManual from "@/components/PesquisaManual";
import CorrecaoAbaManual from "@/components/CorrecaoAbaManual";
import AtualizarTextosNiveis from "@/components/AtualizarTextosNiveis";
import RodapeAutoria from "@/components/RodapeAutoria";

export default function AppEnhancements() {
  const pathname = usePathname();
  // The recovery route must not mount dashboard clients that consume auth codes.
  if (pathname === "/recuperar-senha") return null;
  return <>
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
        <ManualUsuario />
        <PesquisaManual />
        <CorrecaoAbaManual />
        <AtualizarTextosNiveis />
        <RodapeAutoria />
  </>;
}
