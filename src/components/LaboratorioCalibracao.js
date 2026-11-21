"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DIAS_CALIBRACAO,
  NIVEIS_CALIBRACAO,
  resumirCalibracaoProbabilidades,
  validarCalibracaoProbabilidades,
} from "@/lib/validacaoProbabilidades.mjs";

const percentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

function textoPercentual(valor) {
  return valor === null || !Number.isFinite(valor)
    ? "—" : percentual.format(valor) + "%";
}

function textoPontos(valor) {
  return valor === null || !Number.isFinite(valor)
    ? "—" : (valor > 0 ? "+" : "") + percentual.format(valor) + " p.p.";
}

function dataLocal(data) {
  return String(data.getFullYear()) + "-" +
    String(data.getMonth() + 1).padStart(2, "0") + "-" +
    String(data.getDate()).padStart(2, "0");
}

function intervalosVendas(anoLimite) {
  const [ano, mes] = anoLimite.split("-").map(Number);
  const limite = new Date(ano, mes - 1, 1);
  const intervalos = [];
  let inicio = new Date(2024, 6, 1);
  while (inicio < limite) {
    const proximo = new Date(inicio.getFullYear(), inicio.getMonth() + 3, 1);
    const fim = proximo > limite ? limite : proximo;
    intervalos.push({ inicio: dataLocal(inicio), fim: dataLocal(fim) });
    inicio = proximo;
  }
  return intervalos;
}

const th = {
  textAlign: "right", padding: "6px 5px",
  borderBottom: "1px solid var(--border, #ddd)", whiteSpace: "nowrap",
};
const td = { textAlign: "right", padding: "6px 5px", whiteSpace: "nowrap" };

export default function LaboratorioCalibracao({
  lojas, filtroLoja, filtroPeriodo,
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [diaCorte, setDiaCorte] = useState(20);
  const [nivelDetalhado, setNivelDetalhado] = useState("meta");

  // Limite exclusivo: mês corrente nunca é tratado como fechamento real.
  const hoje = new Date();
  const anoLimite = String(hoje.getFullYear()) + "-" +
    String(hoje.getMonth() + 1).padStart(2, "0");

  useEffect(() => {
    if (!aberto) return undefined;
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      const intervalos = intervalosVendas(anoLimite);
      const anos = [...new Set(intervalos.map((item) =>
        Number(item.inicio.slice(0, 4))))];

      const requisicoes = [
        ...intervalos.map(({ inicio, fim }) =>
          supabase.from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido")
            .gte("data", inicio).lt("data", fim)),
        ...anos.map((ano) =>
          supabase.from("metas_mensais")
            .select("mes,loja_id,periodo,valor_meta")
            .gte("mes", String(ano) + "-01-01")
            .lt("mes", String(ano + 1) + "-01-01")),
      ];

      try {
        const respostas = await Promise.all(requisicoes);
        if (cancelado) return;
        const falha = respostas.find((resposta) => resposta.error);
        if (falha) {
          setErro("Não foi possível carregar o histórico: " + falha.error.message);
          setDados(null);
        } else {
          setDados({
            anoLimite,
            vendas: respostas.slice(0, intervalos.length).flatMap((item) => item.data || []),
            metas: respostas.slice(intervalos.length).flatMap((item) => item.data || []),
          });
        }
      } catch {
        if (!cancelado) {
          setErro("Falha ao consultar o histórico.");
          setDados(null);
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => { cancelado = true; };
  }, [aberto, anoLimite, supabase]);

  const resultado = useMemo(() => dados?.anoLimite === anoLimite
    ? validarCalibracaoProbabilidades({
        ...dados, anoLimite, lojas, filtroLoja, filtroPeriodo,
      })
    : null, [dados, anoLimite, lojas, filtroLoja, filtroPeriodo]);

  const observacoes = useMemo(() => (resultado?.observacoes || [])
    .filter((item) => item.diaCorte === diaCorte),
  [resultado, diaCorte]);

  const resumo = useMemo(() => resumirCalibracaoProbabilidades(
    resultado?.observacoes || [], diaCorte,
  ), [resultado, diaCorte]);

  const indicador = resumo.niveis[nivelDetalhado];

  return (
    <section style={{
      borderTop: "1px solid var(--border, #ddd)",
      paddingTop: 10, display: "grid", gap: 9,
    }} aria-label="Calibração histórica das probabilidades">
      <button
        type="button" aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        style={{
          cursor: "pointer", border: 0, padding: "4px 0",
          background: "transparent", color: "inherit",
          textAlign: "left", fontWeight: 700, fontSize: 13,
        }}
      >
        {aberto ? "⌄ " : "› "}Calibração de Meta, Supermeta e Megameta
      </button>

      {aberto && (
        <>
          <p style={{ margin: 0 }}>
            Testa mês a mês as chances que o sistema teria informado nos dias
            5, 10, 15, 20 e 25, comparando-as com o resultado real.
            Usa os filtros de loja e período acima. Apenas meses completos e
            anteriores ao atual entram na avaliação.
          </p>

          {carregando ? (
            <p role="status" style={{ margin: 0 }}>Conferindo histórico e recalculando chances...</p>
          ) : erro ? (
            <p role="alert" style={{ margin: 0 }}>{erro}</p>
          ) : resultado?.status !== "ok" ? (
            <p role="status" style={{ margin: 0 }}>
              Ainda não há meses completos com histórico anterior suficiente
              para conferir as probabilidades neste recorte.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label>
                  Dia da previsão{" "}
                  <select value={diaCorte}
                    onChange={(evento) => setDiaCorte(Number(evento.target.value))}
                    aria-label="Dia da previsão a avaliar">
                    {DIAS_CALIBRACAO.map((dia) => (
                      <option key={dia} value={dia}>Dia {dia}</option>
                    ))}
                  </select>
                </label>
                <span>Meses avaliados: <b>{resumo.meses}</b></span>
                <span>Sem registros completos: <b>{resultado.mesesInvalidos}</b></span>
                <span>Sem histórico para estimar: <b>{resultado.mesesSemReferencia}</b></span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Nível", "Chance média", "Atingiu", "Diferença", "Brier"].map((nome) => (
                        <th key={nome} style={th} scope="col">{nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NIVEIS_CALIBRACAO.map(({ id, nome }) => {
                      const item = resumo.niveis[id];
                      return (
                        <tr key={id}>
                          <td style={{ ...td, textAlign: "left" }}>{nome}</td>
                          <td style={td}>{textoPercentual(item.chanceMedia)}</td>
                          <td style={td}>{textoPercentual(item.frequenciaReal)}</td>
                          <td style={{
                            ...td, color: item.desvioPp > 0 ? "#b91c1c" :
                              item.desvioPp < 0 ? "#15803d" : "inherit",
                          }}>{textoPontos(item.desvioPp)}</td>
                          <td style={td}>{item.brier === null ? "—" : numero.format(item.brier)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <small>
                Diferença positiva: chance estimada otimista. Negativa: conservadora.
                Brier mede o erro das probabilidades (0 é melhor; 1 é pior).
                O mesmo mês é analisado em cinco datas, mas cada dia é avaliado separadamente.
                Com poucos meses, as porcentagens observadas ainda oscilam bastante.
              </small>

              <label>
                Conferir calibração por faixa:{" "}
                <select
                  value={nivelDetalhado}
                  onChange={(evento) => setNivelDetalhado(evento.target.value)}
                  aria-label="Nível para verificar faixas de probabilidade"
                >
                  {NIVEIS_CALIBRACAO.map(({ id, nome }) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </label>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 360, borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Chance informada", "Meses", "Chance média", "Atingiu"].map((nome) => (
                        <th key={nome} scope="col" style={th}>{nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indicador.faixas.map((faixa) => (
                      <tr key={faixa.rotulo}>
                        <td style={{ ...td, textAlign: "left" }}>{faixa.rotulo}</td>
                        <td style={td}>{faixa.meses}</td>
                        <td style={td}>{textoPercentual(faixa.chanceMedia)}</td>
                        <td style={td}>{textoPercentual(faixa.frequenciaReal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <strong>Conferência mês a mês — dia {diaCorte}</strong>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 540, borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Mês", "Meta", "Real", "Supermeta", "Real", "Megameta", "Real"].map((nome, i) => (
                        <th key={nome + i} scope="col" style={th}>{nome}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {observacoes.map((item) => (
                      <tr key={item.mes}>
                        <td style={{ ...td, textAlign: "left" }}>{item.mes.slice(5, 7)}/{item.mes.slice(0, 4)}</td>
                        {NIVEIS_CALIBRACAO.map(({ id }) => (
                          <FragmentoNivel key={id}
                            probabilidade={item.probabilidades[id]}
                            atingiu={item.atingiu[id]} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small>
                “Real” indica se o fechamento atingiu o nível indicado.
                Simulações retrospectivas não são previsões armazenadas na época.
                Nenhuma chance exibida no painel é recalibrada automaticamente por esta análise.
              </small>
            </>
          )}
        </>
      )}
    </section>
  );
}

function FragmentoNivel({ probabilidade, atingiu }) {
  return (
    <>
      <td style={td}>{textoPercentual(probabilidade)}</td>
      <td style={td}>{atingiu ? "Sim" : "Não"}</td>
    </>
  );
}
