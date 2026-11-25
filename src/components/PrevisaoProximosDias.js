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
const mesDoDia = (data) => new Intl.DateTimeFormat("pt-BR", {
  month: "long", timeZone: "UTC",
}).format(new Date(data + "T12:00:00Z"));

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
  if (item.previsto === null) {
    return item.motivoSemPrevisao === "historico_insuficiente"
      ? "Sem previsão: faltam meses completos no histórico deste turno."
      : "Sem previsão: confira os lançamentos dos últimos dias deste turno.";
  }
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
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasNaPrevisao = Math.min(7, Math.max(0, fimDoMes - hoje.getDate()));
  const dataLimite = String(fimDoMes).padStart(2, "0") + "/" +
    String(hoje.getMonth() + 1).padStart(2, "0");

  useEffect(() => {
    if (!lojas.length || diasNaPrevisao === 0) return undefined;
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const intervalos = intervalosHistoricos(new Date(dataHoje + "T12:00:00"));
        const consultas = intervalos.map(({ inicio, fim }) =>
          supabase.from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido")
            .gte("data", inicio).lt("data", fim));
        const respostas = await Promise.all(consultas);
        if (cancelado) return;
        const falha = respostas.find((resposta) => resposta.error);
        if (falha) {
          setErro("Não foi possível consultar o histórico para as previsões.");
          setHistorico(null);
        } else {
          setHistorico({
            chave: dataHoje,
            vendas: respostas.flatMap((resposta) => resposta.data || []),
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
  }, [dataHoje, diasNaPrevisao, supabase, lojas.length]);

  const planejamento = historico?.chave === dataHoje && !carregando && !erro
    ? planejarProximosSeteDias({
        hoje: dataHoje, lojas, vendasAtuais, historicos: historico.vendas,
        metasAtuais,
      }) : null;
  const candidatos = planejamento?.alertas || [];
  // Cada alerta é uma ocorrência em uma data. Agrupar evita repetir a
  // mesma loja/turno e mostra quantos dias exigem atenção.
  const grupos = new Map();
  const pendenciasVendas = new Map();
  const pendenciasMetas = new Set();
  for (const dia of planejamento?.dias || []) {
    for (const item of dia.linhas) {
      const chave = String(item.lojaId) + "|" + item.periodo;
      if (item.situacao === "atencao") {
        if (!grupos.has(chave)) grupos.set(chave, { exemplo: item, dias: 0 });
        const grupo = grupos.get(chave);
        grupo.dias++;
        if (item.percentualAbaixo > grupo.exemplo.percentualAbaixo) {
          grupo.exemplo = item;
        }
      } else if (item.situacao === "sem_previsao") {
        pendenciasVendas.set(chave, item);
      } else if (item.situacao === "sem_meta") {
        pendenciasMetas.add(mesDoDia(item.data));
      }
    }
  }
  const prioridades = [...grupos.values()]
    .sort((a, b) => b.dias - a.dias ||
      b.exemplo.percentualAbaixo - a.exemplo.percentualAbaixo)
    .slice(0, 4);
  const avaliados = planejamento
    ? planejamento.totalTurnos - planejamento.semPrevisao - planejamento.semMeta : 0;

  return (
    <details open style={{
      border: "1px solid var(--border, #ded9e6)", borderRadius: 12,
      marginBottom: 10, background: "var(--surface, #fff)", padding: "10px 12px",
      color: "inherit",
    }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
        📅 {diasNaPrevisao === 0 ? "Fechamento do mês" : `Próximos ${diasNaPrevisao} dias`} — onde preciso agir?
      </summary>
      <div style={{ display: "grid", gap: 9, paddingTop: 9, fontSize: 12 }}>
        <span style={{ opacity: 0.8 }}>
          {diasNaPrevisao === 0
            ? "Hoje é o último dia do mês. Não há datas futuras neste período para prever."
            : `De amanhã até ${dataLimite}, sem misturar metas de outros meses.
                Uma previsão abaixo da meta indica onde agir antecipadamente.`}
        </span>
        {diasNaPrevisao === 0 ? null : carregando || !planejamento ? (
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
                {candidatos.length} {candidatos.length === 1 ? "previsão" : "previsões"} abaixo da meta
              </strong>
              <span style={{ opacity: 0.8 }}>
                em {grupos.size} {grupos.size === 1 ? "combinação" : "combinações"} de loja e turno
              </span>
            </div>
            {prioridades.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Onde concentrar a atenção</strong>
                {prioridades.map((grupo) => (
                  <div key={grupo.exemplo.lojaId + "|" + grupo.exemplo.periodo}
                    style={{ display: "grid", gap: 3,
                      borderBottom: "1px solid var(--border, #eee)", paddingBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      gap: 8, flexWrap: "wrap" }}>
                      <strong>{rotuloLinha(grupo.exemplo)}</strong>
                      <strong style={{ color: "#b42318" }}>
                        {grupo.dias} dia{grupo.dias === 1 ? "" : "s"} abaixo da meta
                      </strong>
                    </div>
                    <span>
                      Maior risco: {dataLegivel(grupo.exemplo.data)} ·
                      {" "}{Math.round(grupo.exemplo.percentualAbaixo)}% abaixo da meta
                    </span>
                    <span>
                      Venda prevista: {dinheiro.format(grupo.exemplo.previsto)} ·
                      {" "}Meta do turno: {dinheiro.format(grupo.exemplo.meta)} ·
                      {" "}Faltariam: {dinheiro.format(grupo.exemplo.falta)}
                    </span>
                  </div>
                ))}
                <small>Prepare ações de venda para esses turnos. As datas estão na visão completa abaixo.</small>
              </div>
            ) : (
              <small>
                {avaliados === 0
                  ? "Não há previsões suficientes para apontar quais turnos precisam de atenção."
                  : "Nenhum dos turnos com dados suficientes está previsto abaixo da meta."}
              </small>
            )}
            <div role="status" style={{
              display: "grid", gap: 4, padding: "7px 0",
              borderTop: "1px solid var(--border, #eee)",
            }}>
              <strong>
                Conferência dos dados: {avaliados} de {planejamento.totalTurnos} previsões avaliadas
              </strong>
              {avaliados < planejamento.totalTurnos && (
                <small>
                  Atenção: o resultado cobre apenas parte dos dias e turnos.
                  Sem previsão não significa que a meta será atingida.
                </small>
              )}
              {pendenciasVendas.size > 0 && (
                <small>
                  Faltam dados para prever: {[
                    ...pendenciasVendas.values(),
                  ].map((item) => rotuloLinha(item) + " (" +
                    (item.motivoSemPrevisao === "historico_insuficiente"
                      ? "histórico insuficiente" : "conferir vendas recentes") + ")").join("; ")}.
                  Isso afeta {planejamento.semPrevisao} datas/turnos.
                </small>
              )}
              {pendenciasMetas.size > 0 && (
                <small>
                  Há {planejamento.semMeta} datas/turnos sem meta cadastrada
                  {": " + [...pendenciasMetas].join(", ")}.
                </small>
              )}
            </div>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                Ver todos os {diasNaPrevisao} dias, lojas e turnos
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
