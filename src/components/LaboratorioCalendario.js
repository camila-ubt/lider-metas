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

  const previa = (() => {
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
  })();

  const diferencaErro = comparativo?.metricas
    ? comparativo.metricas.maeAtual - comparativo.metricas.maeCalendario : null;
  const resultadoComparacao = diferencaErro === null ? "" :
    Math.abs(diferencaErro) < 0.01
      ? "As duas previsões tiveram praticamente o mesmo erro médio."
      : diferencaErro > 0
        ? "A previsão com calendário ficou mais próxima das vendas reais."
        : "A previsão atual ficou mais próxima das vendas reais.";

  return (
    <section style={{ borderTop: "1px solid var(--border, #ddd)", paddingTop: 10 }}>
      <button type="button" aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        style={{ border: 0, padding: "4px 0", background: "transparent",
          color: "inherit", textAlign: "left", fontWeight: 700,
          fontSize: 13, cursor: "pointer" }}>
        {aberto ? "⌄ " : "› "}Comparar previsões: dias da semana e feriados
      </button>
      {aberto && (
        <div style={{ display: "grid", gap: 9, marginTop: 6, fontSize: 12 }}>
          <p style={{ margin: 0 }}>
            Será que considerar os dias da semana e os feriados ajuda a prever
            quanto a loja vai vender até o fim do mês? Aqui comparamos a
            previsão que já usamos com uma nova versão em teste.
          </p>
          {carregando ? (
            <small role="status">Conferindo as vendas dos meses anteriores...</small>
          ) : erro ? (
            <small role="alert">{erro}</small>
          ) : comparativo?.status !== "ok" ? (
            <small>Ainda faltam meses com dados completos para comparar as duas previsões.</small>
          ) : (
            <>
              {previa?.status === "ok" && (
                <div style={{ display: "grid", gap: 3 }}>
                  <strong>Nova previsão para o fim deste mês: {moeda.format(previa.valor)}</strong>
                  <small>
                    Valor estimado usando vendas registradas até o dia {previa.diaCorte}.
                    É apenas um teste; não substitui a previsão atual.
                  </small>
                </div>
              )}
              {previa && previa.status !== "ok" && (
                <small>Sem previsão de teste para este mês: faltam registros ou dados anteriores.</small>
              )}
              <div style={{ display: "grid", gap: 5 }}>
                <strong>Qual previsão errou menos nos meses anteriores?</strong>
                <span>{resultadoComparacao}</span>
                <small>
                  Comparação de {comparativo.metricas.meses} meses encerrados.
                  Quanto menor o erro, mais perto ficou das vendas reais.
                </small>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>Erro médio da previsão atual: <strong>{formatarErro(comparativo.metricas.maeAtual)}</strong></span>
                <span>Erro médio com calendário: <strong>{formatarErro(comparativo.metricas.maeCalendario)}</strong></span>
              </div>
              <small>
                Em {comparativo.metricas.mesesMelhores} de {comparativo.metricas.meses} meses,
                a previsão com calendário teve um erro menor.
                {comparativo.metricas.meses < 3 &&
                  " A comparação ainda é pequena; o resultado não é conclusivo."}
              </small>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 355, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...celula, textAlign: "left" }}>Mês</th>
                      <th style={celula}>Erro atual</th>
                      <th style={celula}>Erro com calendário</th>
                      <th style={{ ...celula, textAlign: "left" }}>Errou menos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.meses.slice(-12).reverse().map((item) => (
                      <tr key={item.mes}>
                        <td style={{ ...celula, textAlign: "left" }}>{item.mes.slice(5) + "/" + item.mes.slice(0, 4)}</td>
                        <td style={celula}>{formatarErro(item.maeAtual)}</td>
                        <td style={celula}>{formatarErro(item.maeCalendario)}</td>
                        <td style={{ ...celula, textAlign: "left" }}>
                          {Math.abs(item.maeCalendario - item.maeAtual) < 0.01
                            ? "Empate" : item.maeCalendario < item.maeAtual
                              ? "Calendário" : "Atual"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small>
                Exemplo: se a loja vendeu R$ 100 mil e a previsão indicou R$ 95 mil,
                o erro foi de R$ 5 mil. A tabela mostra o erro médio de cada mês.
              </small>
              <details>
                <summary style={{ cursor: "pointer" }}>Como foi feita essa comparação?</summary>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <span>
                    Recalculamos o fechamento que cada previsão estimaria nos
                    dias 10, 15, 20 e 25, usando só as vendas disponíveis até
                    aquela data. Depois comparamos com o faturamento real.
                  </span>
                  <span>
                    Erro percentual médio: atual{" "}
                    {comparativo.metricas.mapeAtual === null ? "—" :
                      percentual.format(comparativo.metricas.mapeAtual) + "%"}
                    {" · "}com calendário{" "}
                    {comparativo.metricas.mapeCalendario === null ? "—" :
                      percentual.format(comparativo.metricas.mapeCalendario) + "%"}.
                    Quanto menor esse percentual, melhor.
                  </span>
                  <span>
                    Usamos apenas meses com registros completos. A nova versão
                    considera feriados nacionais, mas ainda não inclui feriados
                    locais, pontos facultativos ou eventos turísticos.
                    Ela continua em teste e não muda o cálculo oficial.
                  </span>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
