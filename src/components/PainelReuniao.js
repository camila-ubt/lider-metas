"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./PainelReuniao.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const blocosSubstituidos = ["Loja destaque e ponto de atenção", "Leitura da manhã", "Leitura da noite", "Ações sugeridas"];

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

function inicioHistorico(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 4, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

function fimHistorico(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 1, 0);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function statusMes(mes) {
  if (hojeLocal() > fimMes(mes)) return "encerrado";
  if (hojeLocal() === fimMes(mes)) return "ultimo-dia";
  return "andamento";
}

function proximoAlvo(vendido, meta) {
  const alvos = [
    { nome: "Meta", valor: meta },
    { nome: "Supermeta", valor: meta * 1.2 },
    { nome: "Megameta", valor: meta * 1.3 },
  ];
  return alvos.find((item) => vendido < item.valor) || alvos[2];
}

function nivelAtingido(vendido, meta) {
  if (!(meta > 0)) return "Sem meta";
  if (vendido >= meta * 1.3) return "Megameta";
  if (vendido >= meta * 1.2) return "Supermeta";
  if (vendido >= meta) return "Meta";
  return "Abaixo da Meta";
}

function mediaDiaria(lista) {
  const dias = new Set(lista.map((item) => item.data)).size;
  const total = lista.reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
  return dias ? total / dias : 0;
}

function leituraHistorica(atual, historica) {
  if (!(historica > 0)) return { variacao: null, texto: "Sem histórico suficiente para comparação." };
  const variacao = ((atual - historica) / historica) * 100;
  if (variacao >= 5) return { variacao, texto: `${percentual.format(variacao)}% acima da própria média histórica.` };
  if (variacao <= -5) return { variacao, texto: `${percentual.format(Math.abs(variacao))}% abaixo da própria média histórica.` };
  return { variacao, texto: "Dentro do padrão histórico do próprio turno." };
}

export default function PainelReuniao() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [mes, setMes] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [historico, setHistorico] = useState([]);
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
    function ocultarRepetidos() {
      document.querySelectorAll("details").forEach((bloco) => {
        const titulo = bloco.querySelector("summary strong")?.textContent?.trim();
        if (blocosSubstituidos.includes(titulo)) bloco.style.display = "none";
      });
    }
    ocultarRepetidos();
    const observador = new MutationObserver(ocultarRepetidos);
    observador.observe(document.body, { subtree: true, childList: true });
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || !mes) return undefined;
    let ativo = true;
    Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase.from("vendas_diarias").select("*").gte("data", `${mes}-01`).lte("data", fimMes(mes)),
      supabase.from("vendas_diarias").select("data,loja_id,periodo,valor_vendido").gte("data", inicioHistorico(mes)).lte("data", fimHistorico(mes)),
      supabase.from("metas_mensais").select("*").eq("mes", `${mes}-01`),
    ]).then(([lojasResp, vendasResp, historicoResp, metasResp]) => {
      if (!ativo) return;
      setLojas(lojasResp.data || []);
      setVendas(vendasResp.data || []);
      setHistorico(historicoResp.data || []);
      setMetas(metasResp.data || []);
    });
    return () => { ativo = false; };
  }, [visivel, mes, supabase]);

  const resumo = useMemo(() => {
    const totalVendido = vendas.reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
    const totalMeta = metas.reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
    const alvo = proximoAlvo(totalVendido, totalMeta);
    const atingido = nivelAtingido(totalVendido, totalMeta);

    const ranking = lojas.map((loja) => {
      const vendido = vendas.filter((item) => Number(item.loja_id) === Number(loja.id)).reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
      const meta = metas.filter((item) => Number(item.loja_id) === Number(loja.id)).reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
      return { ...loja, vendido, meta, percentual: meta > 0 ? (vendido / meta) * 100 : 0, proximo: proximoAlvo(vendido, meta) };
    }).sort((a, b) => b.percentual - a.percentual);

    const turnos = ["manha", "noite"].map((periodo) => {
      const vendasTurno = vendas.filter((item) => item.periodo === periodo);
      const historicoTurno = historico.filter((item) => item.periodo === periodo);
      const atual = mediaDiaria(vendasTurno);
      const mediaHistorica = mediaDiaria(historicoTurno);
      const leitura = leituraHistorica(atual, mediaHistorica);

      const lojasTurno = lojas.map((loja) => {
        const vendido = vendasTurno.filter((item) => Number(item.loja_id) === Number(loja.id)).reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
        const meta = metas.filter((item) => Number(item.loja_id) === Number(loja.id) && item.periodo === periodo).reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        return { ...loja, vendido, meta, percentual: meta > 0 ? (vendido / meta) * 100 : 0 };
      }).sort((a, b) => b.percentual - a.percentual);

      return {
        periodo,
        atual,
        mediaHistorica,
        leitura,
        puxando: lojasTurno[0],
        atencao: lojasTurno[lojasTurno.length - 1],
      };
    });

    const destaque = ranking[0];
    const atencao = ranking[ranking.length - 1];
    const desempenho = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;
    const diferencaLojas = destaque && atencao ? Math.max(0, destaque.percentual - atencao.percentual) : 0;
    const aderenciaTurnos = turnos.reduce((soma, turno) => {
      if (turno.leitura.variacao === null) return soma + 0.75;
      return soma + Math.max(0, 1 - Math.max(0, -turno.leitura.variacao) / 25);
    }, 0);

    let nota = Math.min(6, Math.max(0, desempenho / 20));
    nota += Math.max(0, 2 - diferencaLojas / 15);
    nota += aderenciaTurnos;
    if (ranking.length && ranking.every((item) => item.percentual >= 100)) nota += 0.5;
    if (atingido === "Supermeta") nota += 0.5;
    if (atingido === "Megameta") nota += 1;

    return { totalVendido, totalMeta, alvo, atingido, ranking, destaque, atencao, turnos, nota: Math.min(10, Math.max(0, nota)), diferencaLojas };
  }, [lojas, vendas, historico, metas]);

  if (!visivel || !mes || !resumo.totalMeta) return null;

  const contexto = statusMes(mes);
  const todasAcima = resumo.ranking.every((item) => item.percentual >= 100);
  const faltaProximo = Math.max(resumo.alvo.valor - resumo.totalVendido, 0);
  const faltaAtencao = Math.max(resumo.atencao?.proximo.valor - resumo.atencao?.vendido, 0);
  const titulo = contexto === "encerrado" ? "Avaliação do mês encerrado" : contexto === "ultimo-dia" ? "Último dia para fechar o mês" : "Onde concentrar os esforços até o fechamento";
  const sintese = contexto === "encerrado"
    ? `A operação encerrou o mês com ${percentual.format((resumo.totalVendido / resumo.totalMeta) * 100)}% da Meta, atingindo ${resumo.atingido}. ${faltaProximo > 0 ? `Ficou ${dinheiro.format(faltaProximo)} abaixo da ${resumo.alvo.nome}.` : "O maior nível previsto foi alcançado."} O foco agora é reconhecer os resultados e definir as prioridades do próximo mês.`
    : contexto === "ultimo-dia"
      ? `Hoje é o último dia do mês. A operação está em ${percentual.format((resumo.totalVendido / resumo.totalMeta) * 100)}% da Meta e precisa de ${dinheiro.format(faltaProximo)} para alcançar a ${resumo.alvo.nome}.`
      : `A operação está em ${percentual.format((resumo.totalVendido / resumo.totalMeta) * 100)}% da Meta e segue rumo à ${resumo.alvo.nome}. Faltam ${dinheiro.format(faltaProximo)}.`;

  const acoes = contexto === "encerrado"
    ? [
        `Definir um plano para a ${resumo.atencao?.codigo} reduzir a diferença para as demais lojas no próximo mês.`,
        `Levar para o próximo ciclo as práticas da ${resumo.destaque?.codigo}, destaque do mês.`,
        ...resumo.turnos.filter((turno) => turno.leitura.variacao !== null && turno.leitura.variacao < -5).map((turno) => `Revisar o resultado da ${turno.periodo === "manha" ? "manhã" : "noite"}, que fechou abaixo da própria média histórica.`),
      ].slice(0, 3)
    : [
        resumo.atencao?.percentual < 100
          ? `Recuperar a ${resumo.atencao.codigo}: faltam ${dinheiro.format(Math.max(resumo.atencao.meta - resumo.atencao.vendido, 0))} para a Meta.`
          : `Direcionar esforço para a ${resumo.atencao?.codigo} alcançar ${resumo.atencao?.proximo.nome}; faltam ${dinheiro.format(faltaAtencao)}.`,
        `Replicar com a equipe as práticas da ${resumo.destaque?.codigo}, líder do mês.`,
        ...resumo.turnos.filter((turno) => turno.leitura.variacao !== null && turno.leitura.variacao < -5).map((turno) => `Acompanhar a ${turno.periodo === "manha" ? "manhã" : "noite"}: está abaixo da própria média histórica.`),
      ].slice(0, 3);

  const justificativas = [
    resumo.atingido === "Megameta" ? "Megameta atingida." : resumo.atingido === "Supermeta" ? "Supermeta atingida." : resumo.atingido === "Meta" ? "Meta atingida, mas a Supermeta ainda não foi alcançada." : "Meta ainda não atingida.",
    todasAcima ? "Todas as lojas atingiram a Meta." : "Nem todas as lojas atingiram a Meta.",
    resumo.diferencaLojas <= 8 ? "As lojas estão equilibradas." : `Há ${percentual.format(resumo.diferencaLojas)} p.p. de diferença entre a primeira e a última loja.`,
    ...resumo.turnos.map((turno) => `${turno.periodo === "manha" ? "Manhã" : "Noite"}: ${turno.leitura.texto}`),
  ];

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div><p>ROTEIRO DA REUNIÃO</p><h2>{titulo}</h2></div>
        <div className={styles.score}><span>{contexto === "encerrado" ? "Nota final do mês" : "Nota parcial"}</span><strong>{resumo.nota.toFixed(1)}</strong></div>
      </header>

      <p className={styles.sintese}>{sintese}</p>

      <div className={styles.grid}>
        <article className={styles.positivo}>
          <h3>Reconhecer</h3>
          <p>{contexto === "encerrado" ? `${resumo.destaque?.codigo} foi a loja destaque do mês` : `${resumo.destaque?.codigo} lidera o mês`} com {percentual.format(resumo.destaque?.percentual || 0)}% da Meta.</p>
          <p>{todasAcima ? "Todas as lojas atingiram a Meta." : "O resultado geral segue em evolução."}</p>
        </article>
        <article className={styles.atencao}>
          <h3>Corrigir</h3>
          <p><b>{resumo.atencao?.codigo}</b> tem o menor desempenho proporcional do ranking.</p>
          <p>Os turnos só entram como atenção quando ficam abaixo da própria média histórica.</p>
        </article>
      </div>

      <div className={styles.turnosHistoricos}>
        <h3>Leitura justa por turno</h3>
        <div className={styles.turnosGrid}>
          {resumo.turnos.map((turno) => (
            <article key={turno.periodo}>
              <header><strong>{turno.periodo === "manha" ? "Manhã" : "Noite"}</strong><span>{turno.leitura.texto}</span></header>
              <p>Média atual: <b>{dinheiro.format(turno.atual)}</b> por dia</p>
              <p>Média histórica: <b>{dinheiro.format(turno.mediaHistorica)}</b> por dia</p>
              <div className={styles.turnoLojas}>
                <p><span>Puxando o resultado</span><b>{turno.puxando?.codigo} · {percentual.format(turno.puxando?.percentual || 0)}%</b></p>
                <p><span>Precisa de atenção</span><b>{turno.atencao?.codigo} · {percentual.format(turno.atencao?.percentual || 0)}%</b></p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.acoes}>
        <h3>{contexto === "encerrado" ? "Decisões para o próximo mês" : "Combinar com a equipe"}</h3>
        {acoes.map((acao, indice) => <label key={acao}><input type="checkbox" /><span><b>{indice + 1}.</b> {acao}</span></label>)}
      </div>

      <div className={styles.acoes}>
        <h3>Por que essa nota?</h3>
        {justificativas.map((item) => <p key={item}>{item}</p>)}
      </div>
    </section>
  );
}
