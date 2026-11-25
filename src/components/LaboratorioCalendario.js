"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { preverFechamentoCalendario } from "@/lib/previsaoCalendario.mjs";
import { compararPrevisoesCalendario } from "@/lib/validacaoCalendario.mjs";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
function dataLocal(data) {
  return String(data.getFullYear()) + "-" + String(data.getMonth() + 1).padStart(2, "0") +
    "-" + String(data.getDate()).padStart(2, "0");
}

function intervalosTrimestrais(limite) {
  const fim = new Date(Number(limite.slice(0, 4)), Number(limite.slice(5, 7)) - 1, 1);
  const intervalos = [];
  let inicio = new Date(2024, 6, 1);
  while (inicio < fim) {
    const proximo = new Date(inicio.getFullYear(), inicio.getMonth() + 3, 1);
    const fimTrecho = proximo > fim ? fim : proximo;
    intervalos.push({ inicio: dataLocal(inicio), fim: dataLocal(fimTrecho) });
    inicio = proximo;
  }
  return intervalos;
}
function formatarErro(valor) {
  return Number.isFinite(valor) ? moeda.format(valor) : "—";
}
const celula = { textAlign: "right", padding: "5px 4px", whiteSpace: "nowrap" };

export default function LaboratorioCalendario({
  lojas, filtroLoja, filtroPeriodo, vendasAtuais = [],
  ano, numeroMes, diaLimite, mesEncerrado,
}) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const agora = new Date();
  const mesAtual = String(agora.getFullYear()) + "-" +
    String(agora.getMonth() + 1).padStart(2, "0");

  useEffect(() => {
    if (!aberto) return undefined;
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro("");
      const intervalos = intervalosTrimestrais(mesAtual);
      try {
        const respostas = await Promise.all(intervalos.map(({ inicio, fim }) =>
          supabase.from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido")
            .gte("data", inicio).lt("data", fim)));
        if (cancelado) return;
        const falha = respostas.find((item) => item.error);
        if (falha) {
          setErro("Não foi possível consultar o histórico: " + falha.error.message);
          setDados(null);
        } else {
          setDados({
            mesAtual,
            vendas: respostas.flatMap((item) => item.data || []),
          });
        }
      } catch {
        if (!cancelado) {
          setErro("Falha ao consultar o histórico para o modelo por calendário.");
          setDados(null);
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [aberto, mesAtual, supabase]);

  const comparativo = useMemo(() => dados?.mesAtual === mesAtual
    ? compararPrevisoesCalendario({
        vendas: dados.vendas, lojas, anoLimite: mesAtual,
        filtroLoja, filtroPeriodo,
      }) : null,
  [dados, lojas, mesAtual, filtroLoja, filtroPeriodo]);

  const previa = useMemo(() => {
    const exibido = String(ano) + "-" + String(numeroMes).padStart(2, "0");
    if (dados?.mesAtual !== mesAtual || mesEncerrado ||
        exibido !== mesAtual || diaLimite <= 7) return null;
    const diaCorte = diaLimite - 1; // Usa apenas turnos encerrados até ontem.
    const escolhidas = lojas.filter((loja) =>
      filtroLoja === "geral" || String(loja.id) === String(filtroLoja));
    const periodos = filtroPeriodo === "todos" ? ["manha", "noite"] : [filtroPeriodo];
    let total = 0;
    let menorAmostra = Infinity;
    for (const loja of escolhidas) {
      for (const periodo of periodos) {
        const calculo = preverFechamentoCalendario({
          vendas: vendasAtuais, historicos: dados.vendas,
          ano, numeroMes, diaCorte, lojaId: loja.id, periodo,
        });
        if (calculo.status !== "ok") return { status: calculo.status };
        total += calculo.previsto;
        menorAmostra = Math.min(menorAmostra, calculo.mesesHistoricos);
      }
    }
    return { status: "ok", valor: total, mesesHistoricos: menorAmostra, diaCorte };
  }, [dados, mesAtual, lojas, filtroLoja, filtroPeriodo,
    vendasAtuais, ano, numeroMes, diaLimite, mesEncerrado]);

  return (
    <section style={{ borderTop: "1px solid var(--border, #ddd)", paddingTop: 10 }}>
      <button type="button" aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        style={{ border: 0, padding: "4px 0", background: "transparent",
          color: "inherit", textAlign: "left", fontWeight: 700,
          fontSize: 13, cursor: "pointer" }}>
        {aberto ? "⌄ " : "› "}Modelo experimental: calendário e feriados
      </button>
      {aberto && (
        <div style={{ display: "grid", gap: 9, marginTop: 6, fontSize: 12 }}>
          <p style={{ margin: 0 }}>
            Compara a previsão oficial com um modelo que aprende, por loja e turno,
            o efeito dos dias da semana e dos feriados nacionais brasileiros,
            incluindo a Sexta-feira Santa. Não muda as projeções oficiais.
            Não inclui feriados locais, pontos facultativos ou eventos turísticos.
          </p>
          {carregando ? (
            <small role="status">Consultando histórico para comparar modelos...</small>
          ) : erro ? (
            <small role="alert">{erro}</small>
          ) : comparativo?.status !== "ok" ? (
            <small>Não há meses completos suficientes para testar os dois modelos no mesmo período.</small>
          ) : (
            <>
              {previa?.status === "ok" && (
                <small>
                  <strong>Prévia experimental do mês: {moeda.format(previa.valor)}</strong>
                  {" · "}Base até o dia {previa.diaCorte}; mínimo de {previa.mesesHistoricos} meses por loja/turno.
                </small>
              )}
              {previa && previa.status !== "ok" && (
                <small>Prévia não disponível: histórico ou lançamentos insuficientes no recorte.</small>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>Meses avaliados: <strong>{comparativo.metricas.meses}</strong></span>
                <span>MAE atual: <strong>{formatarErro(comparativo.metricas.maeAtual)}</strong></span>
                <span>MAE calendário: <strong>{formatarErro(comparativo.metricas.maeCalendario)}</strong></span>
                <span>Meses com menor erro: <strong>{comparativo.metricas.mesesMelhores}</strong></span>
              </div>
              <small>
                MAPE atual: {comparativo.metricas.mapeAtual === null ? "—" :
                  percentual.format(comparativo.metricas.mapeAtual) + "%"}
                {" · "}MAPE calendário: {comparativo.metricas.mapeCalendario === null ? "—" :
                  percentual.format(comparativo.metricas.mapeCalendario) + "%"}
              </small>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 355, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...celula, textAlign: "left" }}>Mês</th>
                      <th style={celula}>MAE atual</th>
                      <th style={celula}>MAE calendário</th>
                      <th style={celula}>Cortes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.meses.slice(-12).reverse().map((item) => (
                      <tr key={item.mes}>
                        <td style={{ ...celula, textAlign: "left" }}>{item.mes.slice(5) + "/" + item.mes.slice(0, 4)}</td>
                        <td style={celula}>{formatarErro(item.maeAtual)}</td>
                        <td style={{ ...celula,
                          color: item.maeCalendario <= item.maeAtual ? "#15803d" : "#b91c1c" }}>
                          {formatarErro(item.maeCalendario)}
                        </td>
                        <td style={celula}>{item.testes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small>
                Backtest com cortes nos dias 10, 15, 20 e 25. Cada mês entra uma
                vez na média dos erros, mesmo tendo vários cortes. Só compara
                meses com lançamentos completos e histórico anterior suficiente.
                Erro menor não é garantido: o modelo segue experimental.
              </small>
            </>
          )}
        </div>
      )}
    </section>
  );
}
