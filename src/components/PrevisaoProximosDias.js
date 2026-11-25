"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { planejarProximosSeteDias } from "@/lib/planejamentoSeteDias.mjs";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});
const nomeData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", weekday: "short", timeZone: "UTC",
});
const formatoMes = (data) => String(data.getFullYear()) + "-" +
  String(data.getMonth() + 1).padStart(2, "0");
const formatoData = (data) => formatoMes(data) + "-" +
  String(data.getDate()).padStart(2, "0");
const turno = (periodo) => periodo === "manha" ? "Manhã" : "Noite";
const dataLegivel = (data) => nomeData.format(new Date(data + "T12:00:00Z"));

function intervalosHistoricos(hoje) {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  let inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 24, 1);
  const intervalos = [];
  while (inicio < fim) {
    const fimTrecho = new Date(inicio.getFullYear(), inicio.getMonth() + 3, 1);
    intervalos.push({ inicio: formatoData(inicio),
      fim: formatoData(fimTrecho < fim ? fimTrecho : fim) });
    inicio = fimTrecho;
  }
  return intervalos;
}
function rotuloLinha(item) {
  return item.loja + " · " + turno(item.periodo);
}
function textoPrevisao(item) {
  if (item.previsto === null) return "Sem previsão: faltam registros ou histórico.";
  if (item.meta === null) return "Meta do mês ainda não cadastrada.";
  if (item.situacao === "atencao") return "Pode ficar " + dinheiro.format(item.falta) + " abaixo da meta.";
  return "Previsão igual ou acima da meta.";
}

export default function PrevisaoProximosDias({ lojas, vendasAtuais, metasAtuais }) {
  const supabase = useMemo(() => createClient(), []);
  const [historico, setHistorico] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const hoje = new Date();
  const dataHoje = formatoData(hoje);
  const mesAtual = formatoMes(hoje);
  const mesSeguinte = formatoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));

  useEffect(() => {
    if (!lojas.length) return undefined;
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const intervalos = intervalosHistoricos(new Date(dataHoje + "T12:00:00"));
        const consultas = [
          ...intervalos.map(({ inicio, fim }) =>
            supabase.from("vendas_diarias")
              .select("data,loja_id,periodo,valor_vendido")
              .gte("data", inicio).lt("data", fim)),
          supabase.from("metas_mensais")
            .select("mes,loja_id,periodo,valor_meta")
            .eq("mes", mesSeguinte + "-01"),
        ];
        const respostas = await Promise.all(consultas);
        if (cancelado) return;
        const falha = respostas.find((resposta) => resposta.error);
        if (falha) {
          setErro("Não foi possível consultar o histórico para as previsões.");
          setHistorico(null);
        } else {
          setHistorico({
            chave: dataHoje,
            vendas: respostas.slice(0, -1).flatMap((resposta) => resposta.data || []),
            metasProximoMes: respostas.at(-1).data || [],
          });
        }
      } catch {
        if (!cancelado) {
          setErro("Não foi possível carregar as previsões. Tente abrir o painel novamente.");
          setHistorico(null);
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [dataHoje, mesSeguinte, supabase, lojas.length]);

  const planejamento = historico?.chave === dataHoje && !carregando && !erro
    ? planejarProximosSeteDias({
        hoje: dataHoje, lojas, vendasAtuais, historicos: historico.vendas,
        metasAtuais, metasProximoMes: historico.metasProximoMes,
      }) : null;
  const candidatos = planejamento?.alertas || [];
  const chaves = new Set();
  const prioridades = candidatos.filter((item) => {
    const chave = String(item.lojaId) + "|" + item.periodo;
    if (chaves.has(chave)) return false;
    chaves.add(chave);
    return true;
  }).slice(0, 4);
  const avaliados = planejamento
    ? planejamento.totalTurnos - planejamento.semPrevisao - planejamento.semMeta : 0;

  return (
    <details open style={{
      border: "1px solid var(--border, #ded9e6)", borderRadius: 12,
      marginBottom: 10, background: "var(--surface, #fff)", padding: "10px 12px",
      color: "inherit",
    }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
        📅 Próximos 7 dias — onde preciso agir?
      </summary>
      <div style={{ display: "grid", gap: 9, paddingTop: 9, fontSize: 12 }}>
        <span style={{ opacity: 0.8 }}>
          De amanhã até o sétimo dia, considerando cada loja e turno.
          Uma previsão abaixo da meta indica onde vale agir antecipadamente.
        </span>
        {carregando || !planejamento ? (
          <small role="status">
            {erro || "Analisando os registros para os próximos dias..."}
          </small>
        ) : planejamento.status !== "ok" ? (
          <small role="status">Sem dados suficientes para montar o planejamento.</small>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline",
              gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 17 }}>
                {candidatos.length} turno{candidatos.length === 1 ? "" : "s"} em atenção
              </strong>
              <span style={{ opacity: 0.8 }}>
                nos próximos 7 dias · {avaliados} de {planejamento.totalTurnos} avaliados
              </span>
            </div>
            {prioridades.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Prioridades para acompanhar</strong>
                {prioridades.map((item) => (
                  <div key={item.data + item.lojaId + item.periodo}
                    style={{ display: "grid", gap: 3,
                      borderBottom: "1px solid var(--border, #eee)", paddingBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      gap: 8, flexWrap: "wrap" }}>
                      <strong>{dataLegivel(item.data)} · {rotuloLinha(item)}</strong>
                      <strong style={{ color: "#b42318" }}>
                        {Math.round(item.percentualAbaixo)}% abaixo da meta
                      </strong>
                    </div>
                    <span>
                      Previsão: {dinheiro.format(item.previsto)} · Meta diária fixa:
                      {" "}{dinheiro.format(item.meta)} · Diferença: {dinheiro.format(item.falta)}
                    </span>
                  </div>
                ))}
                <small>Vale reforçar as ações de venda nesses turnos antes da data.</small>
              </div>
            ) : (
              <small>
                {avaliados === 0
                  ? "Não há previsões suficientes para apontar quais turnos precisam de atenção."
                  : "Nenhum dos turnos com dados suficientes está previsto abaixo da meta."}
              </small>
            )}
            {(planejamento.semPrevisao > 0 || planejamento.semMeta > 0) && (
              <small role="status" style={{ opacity: 0.85 }}>
                {planejamento.semPrevisao > 0 &&
                  planejamento.semPrevisao + " turnos sem previsão por falta de dados completos. "}
                {planejamento.semMeta > 0 &&
                  planejamento.semMeta + " turnos sem meta cadastrada para a data."}
              </small>
            )}
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                Ver os 7 dias, todas as lojas e turnos
              </summary>
              <div style={{ display: "grid", gap: 10, paddingTop: 8 }}>
                {planejamento.dias.map((dia) => (
                  <section key={dia.data} style={{ display: "grid", gap: 5 }}>
                    <strong>{dataLegivel(dia.data)}</strong>
                    {dia.linhas.map((item) => (
                      <div key={item.lojaId + "|" + item.periodo}
                        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto",
                          gap: "2px 8px", borderBottom: "1px solid var(--border, #eee)",
                          padding: "2px 0 5px" }}>
                        <strong>{rotuloLinha(item)}</strong>
                        <span style={{ textAlign: "right" }}>
                          {item.previsto === null ? "—" : dinheiro.format(item.previsto)}
                        </span>
                        <span style={{ opacity: 0.76 }}>
                          {item.meta === null ? "Meta não definida"
                            : "Meta fixa: " + dinheiro.format(item.meta)}
                        </span>
                        <span style={{ textAlign: "right",
                          color: item.situacao === "atencao" ? "#b42318" : undefined }}>
                          {item.situacao === "atencao"
                            ? Math.round(item.percentualAbaixo) + "% abaixo"
                            : item.situacao === "sem_alerta" ? "Dentro da meta" : "—"}
                        </span>
                        {(item.situacao === "sem_meta" || item.situacao === "sem_previsao") && (
                          <small style={{ gridColumn: "1 / -1", opacity: 0.75 }}>
                            {textoPrevisao(item)}
                          </small>
                        )}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </details>
            <small style={{ opacity: 0.75 }}>
              Estimativa experimental baseada nos últimos dias registrados e no padrão
              histórico de cada turno. Considera feriados nacionais, mas não feriados
              locais ou eventos turísticos. Não altera a meta nem a previsão oficial;
              os valores podem variar.
            </small>
          </>
        )}
      </div>
    </details>
  );
}
