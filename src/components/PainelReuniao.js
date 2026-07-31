"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./PainelReuniao.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function mesDaTela() {
  return document.querySelector('input[type="month"]')?.value || "";
}

function painelAtivo() {
  return Boolean(document.querySelector("nav.tabs button:first-child")?.classList.contains("active"));
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(new Date(ano, numeroMes, 0).getDate()).padStart(2, "0")}`;
}

function nivel(vendido, meta) {
  if (!meta) return "Sem meta";
  if (vendido >= meta * 1.3) return "Megameta";
  if (vendido >= meta * 1.2) return "Supermeta";
  if (vendido >= meta) return "Meta";
  return "Abaixo da meta";
}

function proximoAlvo(vendido, meta) {
  const alvos = [
    { nome: "Meta", valor: meta },
    { nome: "Supermeta", valor: meta * 1.2 },
    { nome: "Megameta", valor: meta * 1.3 },
  ];
  return alvos.find((item) => vendido < item.valor) || { nome: "Megameta", valor: meta * 1.3 };
}

export default function PainelReuniao() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [mes, setMes] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [metas, setMetas] = useState([]);

  useEffect(() => {
    function sincronizar() {
      setMes(mesDaTela());
      setVisivel(painelAtivo());
    }
    sincronizar();
    document.addEventListener("click", sincronizar, true);
    document.addEventListener("change", sincronizar, true);
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => {
      document.removeEventListener("click", sincronizar, true);
      document.removeEventListener("change", sincronizar, true);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visivel || !mes) return;
    let ativo = true;
    Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase.from("vendas_diarias").select("*").gte("data", `${mes}-01`).lte("data", fimMes(mes)),
      supabase.from("metas_mensais").select("*").eq("mes", `${mes}-01`),
    ]).then(([lojasResp, vendasResp, metasResp]) => {
      if (!ativo) return;
      setLojas(lojasResp.data || []);
      setVendas(vendasResp.data || []);
      setMetas(metasResp.data || []);
    });
    return () => { ativo = false; };
  }, [visivel, mes, supabase]);

  const resumo = useMemo(() => {
    const totalVendido = vendas.reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
    const totalMeta = metas.reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
    const alvo = proximoAlvo(totalVendido, totalMeta);
    const falta = Math.max(alvo.valor - totalVendido, 0);

    const ranking = lojas.map((loja) => {
      const vendido = vendas.filter((item) => Number(item.loja_id) === Number(loja.id)).reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
      const meta = metas.filter((item) => Number(item.loja_id) === Number(loja.id)).reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
      const proximo = proximoAlvo(vendido, meta);
      return {
        ...loja,
        vendido,
        meta,
        percentual: meta > 0 ? (vendido / meta) * 100 : 0,
        nivel: nivel(vendido, meta),
        proximo,
        falta: Math.max(proximo.valor - vendido, 0),
      };
    }).sort((a, b) => b.percentual - a.percentual);

    const porPeriodo = ["manha", "noite"].map((periodo) => {
      const vendido = vendas.filter((item) => item.periodo === periodo).reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
      const meta = metas.filter((item) => item.periodo === periodo).reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
      return { periodo, vendido, meta, percentual: meta > 0 ? (vendido / meta) * 100 : 0 };
    });

    const destaque = ranking[0];
    const atencao = ranking[ranking.length - 1];
    const melhorPeriodo = [...porPeriodo].sort((a, b) => b.percentual - a.percentual)[0];
    const piorPeriodo = [...porPeriodo].sort((a, b) => a.percentual - b.percentual)[0];
    const equilibrio = ranking.length ? Math.max(0, 100 - (ranking[0].percentual - ranking[ranking.length - 1].percentual)) : 0;
    const nota = Math.min(10, Math.max(0, ((totalMeta ? totalVendido / totalMeta : 0) * 5) + (equilibrio / 100) * 3 + ((porPeriodo.filter((p) => p.percentual >= 100).length / 2) * 2)));

    return { totalVendido, totalMeta, alvo, falta, ranking, porPeriodo, destaque, atencao, melhorPeriodo, piorPeriodo, nota };
  }, [lojas, vendas, metas]);

  if (!visivel || !mes || !resumo.totalMeta) return null;

  const acimaMeta = resumo.ranking.filter((item) => item.percentual >= 100).length;
  const acao1 = resumo.atencao?.percentual < 100
    ? `Priorizar ${resumo.atencao.codigo}: faltam ${dinheiro.format(Math.max(resumo.atencao.meta - resumo.atencao.vendido, 0))} para a Meta.`
    : `Buscar ${resumo.atencao?.proximo.nome} na ${resumo.atencao?.codigo}.`;
  const acao2 = `Reforçar o período da ${resumo.piorPeriodo?.periodo === "manha" ? "manhã" : "noite"}, hoje em ${percentual.format(resumo.piorPeriodo?.percentual || 0)}%.`;
  const acao3 = `Manter as práticas da ${resumo.destaque?.codigo}, líder com ${percentual.format(resumo.destaque?.percentual || 0)}%.`;

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p>RESUMO PARA REUNIÃO</p>
          <h2>Decisões do mês em uma visão</h2>
        </div>
        <div className={styles.score}><span>Nota da operação</span><strong>{resumo.nota.toFixed(1)}</strong></div>
      </header>

      <div className={styles.executivo}>
        <div><span>Vendido</span><strong>{dinheiro.format(resumo.totalVendido)}</strong></div>
        <div><span>Próximo objetivo</span><strong>{resumo.alvo.nome}</strong></div>
        <div><span>Falta</span><strong>{dinheiro.format(resumo.falta)}</strong></div>
        <div><span>Lojas acima da Meta</span><strong>{acimaMeta} de {resumo.ranking.length}</strong></div>
      </div>

      <div className={styles.grid}>
        <article>
          <h3>O que comemorar</h3>
          <p><b>{resumo.destaque?.codigo}</b> lidera com {percentual.format(resumo.destaque?.percentual || 0)}% da Meta.</p>
          <p>{acimaMeta === resumo.ranking.length ? "Todas as lojas estão acima da Meta." : `${acimaMeta} loja(s) já atingiram a Meta.`}</p>
          <p>Melhor período: <b>{resumo.melhorPeriodo?.periodo === "manha" ? "Manhã" : "Noite"}</b>, com {percentual.format(resumo.melhorPeriodo?.percentual || 0)}%.</p>
        </article>
        <article>
          <h3>Ponto de atenção</h3>
          <p><b>{resumo.atencao?.codigo}</b> está no menor percentual do ranking: {percentual.format(resumo.atencao?.percentual || 0)}%.</p>
          <p>Período em atenção: <b>{resumo.piorPeriodo?.periodo === "manha" ? "Manhã" : "Noite"}</b>.</p>
          <p>Diferença entre a primeira e a última loja: {percentual.format((resumo.destaque?.percentual || 0) - (resumo.atencao?.percentual || 0))} p.p.</p>
        </article>
      </div>

      <div className={styles.ranking}>
        <h3>Ranking com próximo passo</h3>
        {resumo.ranking.map((item, indice) => (
          <div className={styles.rankRow} key={item.id}>
            <i>{indice + 1}</i>
            <div><strong>{item.codigo} — {item.nome}</strong><span>{dinheiro.format(item.vendido)} · {item.nivel}</span></div>
            <div className={styles.rankEnd}><b>{percentual.format(item.percentual)}%</b><span>Faltam {dinheiro.format(item.falta)} para {item.proximo.nome}</span></div>
          </div>
        ))}
      </div>

      <div className={styles.turnos}>
        {resumo.porPeriodo.map((item) => (
          <div key={item.periodo}><span>{item.periodo === "manha" ? "Manhã" : "Noite"}</span><strong>{percentual.format(item.percentual)}%</strong><small>{dinheiro.format(item.vendido)} de {dinheiro.format(item.meta)}</small></div>
        ))}
      </div>

      <div className={styles.acoes}>
        <h3>Prioridades da próxima reunião</h3>
        {[acao1, acao2, acao3].map((acao, indice) => <label key={acao}><input type="checkbox" /> <b>{indice + 1}.</b> {acao}</label>)}
      </div>
    </section>
  );
}
