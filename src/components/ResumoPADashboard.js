"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ResumoPADashboard.module.css";

function formatarPa(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",");
}

function inicioMes(mes) {
  return `${mes}-01`;
}

function mesAnterior(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function calcularPa(itens) {
  const totais = itens.reduce(
    (acc, item) => ({
      vendas: acc.vendas + Number(item.vendas || 0),
      pecas: acc.pecas + Number(item.pecas || 0),
    }),
    { vendas: 0, pecas: 0 },
  );

  return totais.vendas > 0 ? totais.pecas / totais.vendas : 0;
}

function nomeVendedora(item) {
  if (!item) return "Sem destaque";
  return item.numero_athos ? `${item.numero_athos} — ${item.nome}` : item.nome;
}

export default function ResumoPADashboard({ mes }) {
  const supabase = useMemo(() => createClient(), []);
  const [resumos, setResumos] = useState([]);
  const [porLoja, setPorLoja] = useState([]);
  const [resumosAnteriores, setResumosAnteriores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");

      const anterior = mesAnterior(mes);
      const [resumoResp, lojasResp, anteriorResp] = await Promise.all([
        supabase
          .from("resumo_pa_mensal")
          .select("usuario_id,nome,numero_athos,dias_validos,vendas,pecas,pa")
          .eq("mes", inicioMes(mes)),
        supabase
          .from("resumo_pa_mensal_loja")
          .select("loja_id,loja,loja_nome,vendas,pecas,pa")
          .eq("mes", inicioMes(mes)),
        supabase
          .from("resumo_pa_mensal")
          .select("vendas,pecas,pa")
          .eq("mes", inicioMes(anterior)),
      ]);

      if (cancelado) return;

      const falha = resumoResp.error || lojasResp.error || anteriorResp.error;
      if (falha) {
        setErro("Não foi possível carregar o resumo de PA.");
        setResumos([]);
        setPorLoja([]);
        setResumosAnteriores([]);
      } else {
        setResumos(resumoResp.data || []);
        setPorLoja(lojasResp.data || []);
        setResumosAnteriores(anteriorResp.data || []);
      }

      setCarregando(false);
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [mes, supabase]);

  const dados = useMemo(() => {
    const comVendas = resumos.filter((item) => Number(item.vendas || 0) > 0);
    const ranking = [...comVendas].sort((a, b) => Number(b.pa || 0) - Number(a.pa || 0));
    const elegiveis = ranking.filter((item) => Number(item.dias_validos || 0) >= 15);
    const destaque = elegiveis[0] || null;
    const previa = destaque ? null : ranking[0] || null;

    const lojasAgrupadas = new Map();
    porLoja.forEach((item) => {
      const chave = Number(item.loja_id);
      const atual = lojasAgrupadas.get(chave) || {
        loja_id: chave,
        loja: item.loja,
        loja_nome: item.loja_nome,
        vendas: 0,
        pecas: 0,
      };
      atual.vendas += Number(item.vendas || 0);
      atual.pecas += Number(item.pecas || 0);
      lojasAgrupadas.set(chave, atual);
    });

    const lojas = [...lojasAgrupadas.values()]
      .map((item) => ({
        ...item,
        pa: item.vendas > 0 ? item.pecas / item.vendas : 0,
      }))
      .sort((a, b) => b.pa - a.pa);

    const paGeral = calcularPa(resumos);
    const paAnterior = calcularPa(resumosAnteriores);
    const diferenca = paAnterior > 0 ? paGeral - paAnterior : null;

    return {
      ranking,
      elegiveis,
      destaque,
      previa,
      lojas,
      lojaDestaque: lojas[0] || null,
      paGeral,
      paAnterior,
      diferenca,
      abaixo: comVendas.filter((item) => Number(item.pa || 0) < 2.2).length,
      faixa100: comVendas.filter((item) => Number(item.pa || 0) >= 2.2 && Number(item.pa || 0) < 2.6).length,
      faixa150: comVendas.filter((item) => Number(item.pa || 0) >= 2.6).length,
    };
  }, [resumos, porLoja, resumosAnteriores]);

  const destaqueExibicao = dados.destaque || dados.previa;
  const destaqueParcial = !dados.destaque && Boolean(dados.previa);

  return (
    <article className={styles.card}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <div className={styles.highlight}>
            <div>
              <p className={styles.eyebrow}>Destaque de PA</p>
              {carregando ? (
                <strong>Carregando...</strong>
              ) : destaqueExibicao ? (
                <>
                  <strong>{nomeVendedora(destaqueExibicao)}</strong>
                  <span>
                    PA {formatarPa(destaqueExibicao.pa)}
                    {destaqueParcial
                      ? ` · prévia com ${Number(destaqueExibicao.dias_validos || 0)} dias`
                      : ` · ${Number(destaqueExibicao.dias_validos || 0)} dias`}
                  </span>
                </>
              ) : (
                <>
                  <strong>Ainda sem lançamentos</strong>
                  <span>O destaque aparece quando houver dados de PA no mês.</span>
                </>
              )}
            </div>
          </div>
          <span className={styles.more}>
            Ver resumo do PA <i aria-hidden="true">⌄</i>
          </span>
        </summary>

        <div className={styles.content}>
          {erro ? (
            <p className={styles.empty}>{erro}</p>
          ) : carregando ? (
            <p className={styles.empty}>Carregando indicadores de PA...</p>
          ) : resumos.length === 0 ? (
            <p className={styles.empty}>Nenhum dado de PA encontrado para este mês.</p>
          ) : (
            <>
              <div className={styles.kpis}>
                <div>
                  <span>PA médio geral</span>
                  <strong>{formatarPa(dados.paGeral)}</strong>
                  <small>
                    {dados.diferenca === null
                      ? "Sem base no mês anterior"
                      : `${dados.diferenca >= 0 ? "↑" : "↓"} ${formatarPa(Math.abs(dados.diferenca))} em relação ao mês anterior`}
                  </small>
                </div>
                <div>
                  <span>Loja destaque</span>
                  <strong>{dados.lojaDestaque?.loja || "—"}</strong>
                  <small>{dados.lojaDestaque ? `PA ${formatarPa(dados.lojaDestaque.pa)}` : "Sem lançamentos"}</small>
                </div>
                <div>
                  <span>Vendedora destaque</span>
                  <strong>{dados.destaque ? nomeVendedora(dados.destaque) : "Aguardando 15 dias"}</strong>
                  <small>{dados.destaque ? `PA ${formatarPa(dados.destaque.pa)}` : "A prévia aparece no topo do card."}</small>
                </div>
              </div>

              <div className={styles.columns}>
                <section>
                  <h3>PA por loja</h3>
                  <div className={styles.list}>
                    {dados.lojas.map((loja) => (
                      <div className={styles.row} key={loja.loja_id}>
                        <span>{loja.loja}</span>
                        <strong>{formatarPa(loja.pa)}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3>Top 3 vendedoras</h3>
                  {dados.elegiveis.length ? (
                    <div className={styles.list}>
                      {dados.elegiveis.slice(0, 3).map((item, indice) => (
                        <div className={styles.row} key={item.usuario_id}>
                          <span>{indice + 1}º · {nomeVendedora(item)}</span>
                          <strong>{formatarPa(item.pa)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.note}>Nenhuma vendedora atingiu 15 dias válidos ainda.</p>
                  )}
                </section>
              </div>

              <div className={styles.statusGrid}>
                <div><span>Abaixo de 2,20</span><strong>{dados.abaixo}</strong></div>
                <div><span>De 2,20 a 2,59</span><strong>{dados.faixa100}</strong></div>
                <div><span>2,60 ou mais</span><strong>{dados.faixa150}</strong></div>
              </div>

              <div className={styles.insight}>
                {dados.lojaDestaque && (
                  <p><strong>{dados.lojaDestaque.loja}</strong> tem o maior PA entre as lojas neste mês: {formatarPa(dados.lojaDestaque.pa)}.</p>
                )}
                {dados.abaixo > 0 && (
                  <p>{dados.abaixo} vendedora{dados.abaixo === 1 ? "" : "s"} {dados.abaixo === 1 ? "está" : "estão"} abaixo do PA 2,20.</p>
                )}
                {dados.diferenca !== null && (
                  <p>O PA geral {dados.diferenca >= 0 ? "subiu" : "caiu"} {formatarPa(Math.abs(dados.diferenca))} ponto{Math.abs(dados.diferenca) === 1 ? "" : "s"} em relação ao mês anterior.</p>
                )}
              </div>
            </>
          )}
        </div>
      </details>
    </article>
  );
}
