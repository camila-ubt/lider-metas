"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ComparativoSeisMeses from "./ComparativoSeisMeses";
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
const nomesCurtos = {
  atual: "Ritmo do mês",
  recente: "Últimos 7 dias",
  sazonal: "Mesmo mês do ano anterior",
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
  const [modeloDetalhe, setModeloDetalhe] = useState("atual");
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

  const detalhe = resultado?.modelos.find((modelo) =>
    modelo.id === modeloDetalhe && modelo.disponivel
  ) || resultado?.modelos.find((modelo) => modelo.disponivel);

  return (
    <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 100px", display: "grid", gap: 4 }}>
          <span>Ano</span>
          <select value={anosAtras} onChange={(evento) => setAnosAtras(evento.target.value)}
            aria-label="Ano da comparação">
            <option value="0">{ano}</option>
            <option value="1">{ano - 1}</option>
            <option value="2">{ano - 2}</option>
          </select>
        </label>
        <label style={{ flex: "1 1 140px", display: "grid", gap: 4 }}>
          <span>Mês</span>
          <select value={mesTeste} onChange={(evento) => setMesTeste(Number(evento.target.value))}
            aria-label="Mês da comparação">
            {MESES.map((nome, indice) => (
              <option key={nome} value={indice + 1}>{nome}</option>
            ))}
          </select>
        </label>
      </div>

      <p style={{ margin: 0 }}>
        Compara quanto cada método previa vender <b>até o fim do mês</b>,
        com base nas vendas acumuladas até os dias 5, 10, 15, 20 e 25.
        Usa os filtros de loja e turno acima.
      </p>

      {!encerrado ? (
        <p role="status">Selecione um mês já encerrado para comparar as previsões.</p>
      ) : erro ? (
        <p role="alert">{erro}</p>
      ) : carregando || !dadosProntos ? (
        <p role="status">Consultando histórico de vendas...</p>
      ) : resultado?.status === "base_incompleta" ? (
        <p role="status">
          Histórico incompleto: {resultado.faltantes} lançamentos ausentes,{" "}
          {resultado.duplicados} duplicados e {resultado.invalidos} inválidos.
          Não é possível comparar as previsões sem esses registros.
        </p>
      ) : resultado?.status !== "ok" ? (
        <p role="status">Não há dados suficientes para esta seleção.</p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 4 }}>
            <span>Fechamento real: <b>{emReais(resultado.totalRealizado)}</b></span>
            <span>
              Menor erro neste mês:{" "}
              <b>{resultado.melhor
                ? nomesCurtos[resultado.melhor.id] + " (" + emPorcentagem(resultado.melhor.mape) + ")"
                : "sem comparação disponível"}</b>
            </span>
          </div>

          <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--border, #ddd)", paddingTop: 10 }}>
            <strong>Erro médio de cada método</strong>
            {resultado.modelos.map((modelo) => (
              <div key={modelo.id} style={linha}>
                <span>{nomesCurtos[modelo.id] || modelo.nome}</span>
                <strong style={{ whiteSpace: "nowrap" }}>
                  {modelo.disponivel ? emPorcentagem(modelo.metricas.mape) : "Sem histórico"}
                </strong>
              </div>
            ))}
            <small>Quanto menor o percentual, mais perto do fechamento real ficaram as previsões.</small>
          </div>

          <details>
            <summary style={{ cursor: "pointer" }}>Ver como as previsões mudaram durante o mês</summary>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Método</span>
                <select value={detalhe?.id || "atual"}
                  onChange={(evento) => setModeloDetalhe(evento.target.value)}>
                  {resultado.modelos.filter((modelo) => modelo.disponivel).map((modelo) => (
                    <option value={modelo.id} key={modelo.id}>{nomesCurtos[modelo.id]}</option>
                  ))}
                </select>
              </label>
              <small>
                Cada data é um momento em que o sistema estimou o resultado final,
                não o valor vendido apenas naquele dia.
              </small>
              {detalhe?.avaliacoes.map((item) => (
                <div key={item.diaCorte} style={linha}>
                  <span>Dia {item.diaCorte}: {emReais(item.previsto)}</span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    Erro {emPorcentagem(item.erroPercentual)}
                  </span>
                </div>
              ))}
              <small>O valor real ao terminar o mês foi {emReais(resultado.totalRealizado)}.</small>
            </div>
          </details>

          <ComparativoSeisMeses
            ano={anoTeste}
            numeroMes={mesTeste}
            lojas={lojasFiltradas}
            filtroLoja={filtroLoja}
            filtroPeriodo={filtroPeriodo}
          />

          {turnos.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer" }}>Ver o resultado por loja e turno</summary>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {turnos.map((item) => (
                  <div key={item.lojaId + "-" + item.periodo} style={linha}>
                    <span>{item.lojaNome} · {item.periodo === "manha" ? "Manhã" : "Noite"}</span>
                    <span style={{ textAlign: "right" }}>
                      {item.status !== "ok" ? "Histórico incompleto"
                        : item.melhor
                          ? (nomesCurtos[item.melhor.id] || item.melhor.nome)
                            + " · " + emPorcentagem(item.melhor.mape)
                          : "Sem comparação"}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <details>
            <summary style={{ cursor: "pointer" }}>Entender as métricas técnicas</summary>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <small>MAPE: erro percentual médio. MAE: erro médio em reais.
                Viés: tendência de prever acima (positivo) ou abaixo (negativo) do real.
                A comparação deste mês, isoladamente, não garante a precisão futura.</small>
              {resultado.modelos.filter((modelo) => modelo.disponivel).map((modelo) => (
                <div key={modelo.id} style={{ display: "grid", gap: 3 }}>
                  <b>{nomesCurtos[modelo.id]}</b>
                  <span>MAPE {emPorcentagem(modelo.metricas.mape)} · MAE {emReais(modelo.metricas.mae)} · Viés {emReais(modelo.metricas.vies)}</span>
                </div>
              ))}
              <small>Os cinco momentos são observações do mesmo mês, não cinco meses independentes.
                A projeção oficial do painel continua sem alterações.</small>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
