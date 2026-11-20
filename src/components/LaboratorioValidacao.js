"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  compararMetodosPorLojaTurno,
  compararMetodosProjecao,
} from "@/lib/comparacaoMetodosProjecao.mjs";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const porcentagem = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function emReais(valor) {
  return valor === null || !Number.isFinite(valor) ? "—" : moeda.format(valor);
}
function emPorcentagem(valor) {
  return valor === null || !Number.isFinite(valor) ? "—" : porcentagem.format(valor) + "%";
}
function mesEncerrado(ano, mes) {
  const hoje = new Date();
  return ano < hoje.getFullYear() ||
    (ano === hoje.getFullYear() && mes < hoje.getMonth() + 1);
}
function intervalo(ano, mes) {
  const prefixo = ano + "-" + String(mes).padStart(2, "0") + "-";
  return {
    inicio: prefixo + "01",
    fim: prefixo + String(new Date(ano, mes, 0).getDate()).padStart(2, "0"),
  };
}
const linha = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 };
const caixa = {
  border: "1px solid var(--border, #ded9e6)", borderRadius: 12,
  padding: "12px", display: "grid", gap: 8,
};

export default function LaboratorioValidacao({
  lojas, ano, numeroMes, filtroLoja, filtroPeriodo,
}) {
  const supabase = useMemo(() => createClient(), []);
  const [anosAtras, setAnosAtras] = useState("1");
  const [mesTeste, setMesTeste] = useState(numeroMes);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const anoTeste = ano - Number(anosAtras);
  const chave = anoTeste + "-" + String(mesTeste).padStart(2, "0");
  const encerrado = mesEncerrado(anoTeste, mesTeste);

  useEffect(() => setMesTeste(numeroMes), [numeroMes]);

  useEffect(() => {
    if (!encerrado) return undefined;
    let cancelado = false;

    async function consultar() {
      setCarregando(true);
      setErro("");
      const mesAtual = intervalo(anoTeste, mesTeste);
      const mesAnterior = intervalo(anoTeste - 1, mesTeste);
      const colunas = "data,loja_id,periodo,valor_vendido";

      const respostas = await Promise.all(
        [mesAtual, mesAnterior].map(({ inicio, fim }) =>
          supabase.from("vendas_diarias")
            .select(colunas)
            .gte("data", inicio)
            .lte("data", fim)
            .order("data", { ascending: true }),
        ),
      );
      if (cancelado) return;
      const falha = respostas.find((resposta) => resposta.error);
      if (falha) {
        setErro(falha.error.message);
        setDados(null);
      } else {
        setDados({
          chave,
          vendas: respostas[0].data || [],
          vendasReferencia: respostas[1].data || [],
        });
      }
      setCarregando(false);
    }

    consultar();
    return () => { cancelado = true; };
  }, [anoTeste, mesTeste, chave, encerrado, supabase]);

  const lojasFiltradas = useMemo(() => lojas.filter((loja) =>
    filtroLoja === "geral" || String(loja.id) === String(filtroLoja)), [lojas, filtroLoja]);

  const dadosProntos = dados && dados.chave === chave;
  const resultado = useMemo(() => !encerrado || !dadosProntos ? null : compararMetodosProjecao({
    ...dados,
    lojas: lojasFiltradas,
    ano: anoTeste, numeroMes: mesTeste,
    periodo: filtroPeriodo,
  }), [encerrado, dadosProntos, dados, lojasFiltradas, anoTeste, mesTeste, filtroPeriodo]);

  const turnos = useMemo(() => !resultado || resultado.status !== "ok" ||
    filtroLoja !== "geral" || filtroPeriodo !== "todos" ? [] : compararMetodosPorLojaTurno({
      ...dados, lojas: lojasFiltradas, ano: anoTeste, numeroMes: mesTeste,
    }), [resultado, dados, lojasFiltradas, anoTeste, mesTeste, filtroLoja, filtroPeriodo]);

  return (
    <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 110px", display: "grid", gap: 4 }}>
          <span>Ano avaliado</span>
          <select value={anosAtras} onChange={(evento) => setAnosAtras(evento.target.value)}
            aria-label="Ano da comparação">
            <option value="0">{ano}</option>
            <option value="1">{ano - 1}</option>
            <option value="2">{ano - 2}</option>
          </select>
        </label>
        <label style={{ flex: "1 1 140px", display: "grid", gap: 4 }}>
          <span>Mês avaliado</span>
          <select value={mesTeste} onChange={(evento) => setMesTeste(Number(evento.target.value))}
            aria-label="Mês da comparação">
            {MESES.map((nome, indice) => (
              <option key={nome} value={indice + 1}>{nome}</option>
            ))}
          </select>
        </label>
      </div>

      <p style={{ margin: 0 }}>
        Simula o fechamento nos dias 5, 10, 15, 20 e 25 com três métodos.
        Usa os filtros de loja e período do comparativo acima.
      </p>

      {!encerrado ? (
        <p role="status">Este mês ainda está em andamento. Selecione um mês já encerrado.</p>
      ) : erro ? (
        <p role="alert">{erro}</p>
      ) : carregando || !dadosProntos ? (
        <p role="status">Consultando vendas históricas...</p>
      ) : resultado?.status === "base_incompleta" ? (
        <p role="status">
          Não é possível testar este conjunto: {resultado.faltantes} lançamentos ausentes,{" "}
          {resultado.duplicados} duplicados e {resultado.invalidos} inválidos.
          Um dia sem lançamento não equivale a venda zero.
        </p>
      ) : resultado?.status !== "ok" ? (
        <p role="status">Não há dados suficientes para esta seleção.</p>
      ) : (
        <>
          <div style={{ ...linha, flexWrap: "wrap" }}>
            <span><b>Fechamento real:</b> {emReais(resultado.totalRealizado)}</span>
            <span><b>Ano de referência:</b> {resultado.anoReferencia}</span>
          </div>
          <p style={{ margin: 0 }}>
            {resultado.melhor
              ? <>Menor erro neste mês: <b>{resultado.melhor.nome}</b> (MAPE {emPorcentagem(resultado.melhor.mape)}).</>
              : "Sem comparação percentual disponível neste mês."}
          </p>

          {resultado.modelos.map((modelo) => (
            <section key={modelo.id} style={caixa}>
              <div style={linha}>
                <strong>{modelo.nome}</strong>
                {resultado.melhor?.id === modelo.id && (
                  <span style={{ fontSize: 11 }}>Menor erro</span>
                )}
              </div>
              {!modelo.disponivel ? (
                <small>{modelo.motivo || "Dados insuficientes para o cálculo."}</small>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span><b>MAPE</b> {emPorcentagem(modelo.metricas.mape)}</span>
                    <span><b>MAE</b> {emReais(modelo.metricas.mae)}</span>
                    <span><b>Viés</b> {emReais(modelo.metricas.vies)}</span>
                  </div>
                  <details>
                    <summary style={{ cursor: "pointer" }}>Ver previsões dos cinco dias</summary>
                    <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                      {modelo.avaliacoes.map((item) => (
                        <div key={item.diaCorte} style={linha}>
                          <span>Dia {item.diaCorte}: {emReais(item.previsto)}</span>
                          <span>Erro {emPorcentagem(item.erroPercentual)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </section>
          ))}

          {turnos.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer" }}>Comparar cada loja e turno</summary>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {turnos.map((item) => (
                  <div key={item.lojaId + "-" + item.periodo} style={caixa}>
                    <b>{item.lojaNome} · {item.periodo === "manha" ? "Manhã" : "Noite"}</b>
                    <span>{item.status !== "ok"
                      ? "Histórico incompleto"
                      : item.melhor
                        ? item.melhor.nome + " · MAPE " + emPorcentagem(item.melhor.mape)
                        : "Sem métrica comparável"}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <small>
            MAPE mede o erro percentual absoluto médio; MAE, o erro médio em reais.
            Viés negativo indica previsão abaixo do real. Os cinco cortes pertencem
            ao mesmo mês e não são cinco meses independentes.
            O menor erro observado aqui não garante melhor desempenho futuro.
            Nenhum cálculo oficial foi alterado.
          </small>
        </>
      )}
    </div>
  );
}
