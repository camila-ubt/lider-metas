"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  avaliarMetodosEmVariosMeses,
  avaliarSeisMesesPorLojaTurno,
  listarMesesAvaliacao,
} from "@/lib/comparacaoHistoricaMetodos.mjs";

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
});

function pct(valor) {
  return valor === null || !Number.isFinite(valor)
    ? "—" : percentual.format(valor) + "%";
}

function periodoNome(periodo) {
  return periodo === "manha" ? "Manhã" : "Noite";
}

function intervalo(ano, mes) {
  const prefixo = ano + "-" + String(mes).padStart(2, "0") + "-";
  return {
    inicio: prefixo + "01",
    fim: prefixo + String(new Date(ano, mes, 0).getDate()).padStart(2, "0"),
  };
}

export default function ComparativoSeisMeses({
  ano, numeroMes, lojas, filtroLoja, filtroPeriodo,
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const chave = ano + "-" + String(numeroMes).padStart(2, "0");

  useEffect(() => {
    if (!aberto) return undefined;
    let cancelado = false;

    async function buscar() {
      setCarregando(true);
      setErro("");
      const meses = listarMesesAvaliacao(ano, numeroMes);
      const selecoes = meses.flatMap((item) => [
        intervalo(item.ano, item.numeroMes),
        intervalo(item.ano - 1, item.numeroMes),
      ]);

      const respostas = await Promise.all(selecoes.map(({ inicio, fim }) =>
        supabase.from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido")
          .gte("data", inicio)
          .lte("data", fim)
          .order("data", { ascending: true })));

      if (cancelado) return;
      const falha = respostas.find((item) => item.error);
      if (falha) {
        setErro(falha.error.message);
        setDados(null);
      } else {
        setDados({
          chave,
          meses: meses.map((item, indice) => ({
            ...item,
            vendas: respostas[indice * 2].data || [],
            vendasReferencia: respostas[indice * 2 + 1].data || [],
          })),
        });
      }
      setCarregando(false);
    }

    buscar();
    return () => { cancelado = true; };
  }, [aberto, ano, numeroMes, chave, supabase]);

  const pronto = dados?.chave === chave;
  const resultado = useMemo(() => !aberto || !pronto ? null :
    avaliarMetodosEmVariosMeses({
      meses: dados.meses,
      lojas,
      periodo: filtroPeriodo,
    }), [aberto, pronto, dados, lojas, filtroPeriodo]);

  const porTurno = useMemo(() => !resultado || resultado.status !== "ok" ||
    filtroLoja !== "geral" || filtroPeriodo !== "todos" ? [] :
    avaliarSeisMesesPorLojaTurno({ meses: dados.meses, lojas }),
  [resultado, dados, lojas, filtroLoja, filtroPeriodo]);

  return (
    <section style={{
      borderTop: "1px solid var(--border, #ded9e6)",
      paddingTop: 12, display: "grid", gap: 10,
    }}>
      <button type="button" onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto} style={{ cursor: "pointer", width: "fit-content" }}>
        {aberto ? "Recolher comparação dos 6 meses" : "Comparar últimos 6 meses"}
      </button>
      {aberto && (
        <>
          <small>
            Considera até seis meses completos encerrados até a data selecionada.
            Exige pelo menos três meses comparáveis para apontar o menor erro médio.
          </small>
          {erro ? (
            <p role="alert">{erro}</p>
          ) : carregando || !pronto ? (
            <p role="status">Lendo os meses e seus históricos de referência...</p>
          ) : resultado?.status !== "ok" ? (
            <p role="status">
              Dados insuficientes. Foram encontrados {resultado?.mesesComBase || 0}
              {" "}meses com fechamento completo e resultado positivo.
              É necessário ter pelo menos três meses comparáveis.
            </p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                <b>Menor erro médio:</b> {resultado.melhor.nome}{" "}
                ({pct(resultado.melhor.mape)}) em{" "}
                {resultado.mesesComparaveis} meses comparáveis.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {resultado.metodos.map((modelo) => (
                  <div key={modelo.id} style={{
                    display: "flex", justifyContent: "space-between",
                    gap: 10, alignItems: "baseline",
                    borderBottom: "1px solid var(--border, #ded9e6)", paddingBottom: 6,
                  }}>
                    <span>{modelo.nome}</span>
                    <strong style={{ whiteSpace: "nowrap" }}>{pct(modelo.mape)}</strong>
                  </div>
                ))}
              </div>
              <small>
                Meses utilizados: {resultado.mesesUsados.join(", ")}.
                O erro percentual de cada mês tem o mesmo peso.
                Não há mudança automática nas projeções oficiais.
              </small>
              {porTurno.length > 0 && (
                <details>
                  <summary style={{ cursor: "pointer" }}>
                    Menor erro por loja e turno nos últimos meses
                  </summary>
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {porTurno.map((item) => (
                      <div key={item.lojaId + "-" + item.periodo} style={{
                        display: "grid", gap: 2,
                        padding: "7px 0", borderBottom: "1px solid var(--border, #ded9e6)",
                      }}>
                        <b>{item.lojaNome} · {periodoNome(item.periodo)}</b>
                        <span>{item.avaliacao.melhor
                          ? item.avaliacao.melhor.nome + " · " +
                            pct(item.avaliacao.melhor.mape) + " em " +
                            item.avaliacao.mesesComparaveis + " meses"
                          : "Histórico ainda insuficiente para recomendar método"}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
