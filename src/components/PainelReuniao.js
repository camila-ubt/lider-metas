"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./PainelReuniao.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const blocosSubstituidos = [
  "Loja destaque e ponto de atenção",
  "Leitura da manhã",
  "Leitura da noite",
  "Ações sugeridas",
];

function mesDaTela() {
  return document.querySelector('input[type="month"]')?.value || "";
}

function painelAtivo() {
  return Boolean(
    document.querySelector("nav.tabs button:first-child")?.classList.contains("active"),
  );
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(
    new Date(ano, numeroMes, 0).getDate(),
  ).padStart(2, "0")}`;
}

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;
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

function statusMes(mes) {
  const hoje = hojeLocal();
  const fim = fimMes(mes);
  if (hoje > fim) return "encerrado";
  if (hoje === fim) return "ultimo-dia";
  return "andamento";
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
    observador.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

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
        if (blocosSubstituidos.includes(titulo)) {
          bloco.style.display = "none";
          bloco.dataset.substituidoPainelReuniao = "true";
        }
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
      supabase
        .from("vendas_diarias")
        .select("*")
        .gte("data", `${mes}-01`)
        .lte("data", fimMes(mes)),
      supabase.from("metas_mensais").select("*").eq("mes", `${mes}-01`),
    ]).then(([lojasResp, vendasResp, metasResp]) => {
      if (!ativo) return;
      setLojas(lojasResp.data || []);
      setVendas(vendasResp.data || []);
      setMetas(metasResp.data || []);
    });

    return () => {
      ativo = false;
    };
  }, [visivel, mes, supabase]);

  const resumo = useMemo(() => {
    const totalVendido = vendas.reduce(
      (soma, item) => soma + Number(item.valor_vendido || 0),
      0,
    );
    const totalMeta = metas.reduce(
      (soma, item) => soma + Number(item.valor_meta || 0),
      0,
    );
    const alvo = proximoAlvo(totalVendido, totalMeta);
    const atingido = nivelAtingido(totalVendido, totalMeta);

    const ranking = lojas
      .map((loja) => {
        const vendido = vendas
          .filter((item) => Number(item.loja_id) === Number(loja.id))
          .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
        const meta = metas
          .filter((item) => Number(item.loja_id) === Number(loja.id))
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        return {
          ...loja,
          vendido,
          meta,
          percentual: meta > 0 ? (vendido / meta) * 100 : 0,
          proximo: proximoAlvo(vendido, meta),
        };
      })
      .sort((a, b) => b.percentual - a.percentual);

    const periodos = ["manha", "noite"]
      .map((periodo) => {
        const vendido = vendas
          .filter((item) => item.periodo === periodo)
          .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
        const meta = metas
          .filter((item) => item.periodo === periodo)
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        return {
          periodo,
          percentual: meta > 0 ? (vendido / meta) * 100 : 0,
        };
      })
      .sort((a, b) => b.percentual - a.percentual);

    const destaque = ranking[0];
    const atencao = ranking[ranking.length - 1];
    const melhorPeriodo = periodos[0];
    const piorPeriodo = periodos[periodos.length - 1];
    const desempenho = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;
    const diferencaLojas = destaque && atencao
      ? Math.max(0, destaque.percentual - atencao.percentual)
      : 0;
    const diferencaPeriodos = melhorPeriodo && piorPeriodo
      ? Math.max(0, melhorPeriodo.percentual - piorPeriodo.percentual)
      : 0;

    let nota = 0;
    nota += Math.min(6, Math.max(0, desempenho / 20));
    nota += Math.max(0, 2 - diferencaLojas / 15);
    nota += Math.max(0, 1.5 - diferencaPeriodos / 20);
    if (ranking.length && ranking.every((item) => item.percentual >= 100)) nota += 0.5;
    if (atingido === "Supermeta") nota += 0.5;
    if (atingido === "Megameta") nota += 1;
    nota = Math.min(10, Math.max(0, nota));

    return {
      totalVendido,
      totalMeta,
      alvo,
      atingido,
      ranking,
      destaque,
      atencao,
      melhorPeriodo,
      piorPeriodo,
      nota,
      diferencaLojas,
      diferencaPeriodos,
    };
  }, [lojas, vendas, metas]);

  if (!visivel || !mes || !resumo.totalMeta) return null;

  const contexto = statusMes(mes);
  const todasAcima = resumo.ranking.every((item) => item.percentual >= 100);
  const faltaProximo = Math.max(resumo.alvo.valor - resumo.totalVendido, 0);
  const faltaAtencao = Math.max(
    resumo.atencao?.proximo.valor - resumo.atencao?.vendido,
    0,
  );
  const periodoMelhor = resumo.melhorPeriodo?.periodo === "manha" ? "manhã" : "noite";
  const periodoPior = resumo.piorPeriodo?.periodo === "manha" ? "manhã" : "noite";

  const titulo = contexto === "encerrado"
    ? "Avaliação do mês encerrado"
    : contexto === "ultimo-dia"
      ? "Último dia para fechar o mês"
      : "Onde concentrar os esforços até o fechamento";

  const sintese = contexto === "encerrado"
    ? `A operação encerrou o mês com ${percentual.format((resumo.totalVendido / resumo.totalMeta) * 100)}% da Meta, atingindo ${resumo.atingido}. ${faltaProximo > 0 ? `Ficou ${dinheiro.format(faltaProximo)} abaixo da ${resumo.alvo.nome}.` : "O maior nível previsto foi alcançado."} O foco agora é reconhecer os resultados e definir as prioridades do próximo mês.`
    : contexto === "ultimo-dia"
      ? `Hoje é o último dia do mês. A operação está em ${percentual.format((resumo.totalVendido / resumo.totalMeta) * 100)}% da Meta e precisa de ${dinheiro.format(faltaProximo)} para alcançar a ${resumo.alvo.nome}.`
      : `A operação está em ${percentual.format((resumo.totalVendido / resumo.totalMeta) * 100)}% da Meta e segue rumo à ${resumo.alvo.nome}. Faltam ${dinheiro.format(faltaProximo)}. O foco é manter o ritmo da loja líder e elevar o resultado das demais.`;

  const reconhecer1 = contexto === "encerrado"
    ? `${resumo.destaque?.codigo} foi a loja destaque do mês, encerrando com ${percentual.format(resumo.destaque?.percentual || 0)}% da Meta.`
    : `${resumo.destaque?.codigo} lidera o mês com ${percentual.format(resumo.destaque?.percentual || 0)}% da Meta.`;

  const reconhecer2 = contexto === "encerrado"
    ? `O período da ${periodoMelhor} foi o destaque do mês, com ${percentual.format(resumo.melhorPeriodo?.percentual || 0)}% da Meta.`
    : todasAcima
      ? "Todas as lojas já superaram a Meta."
      : `O melhor período é a ${periodoMelhor}.`;

  const corrigir1 = contexto === "encerrado"
    ? `${resumo.atencao?.codigo} encerrou com o menor desempenho proporcional: ${percentual.format(resumo.atencao?.percentual || 0)}% da Meta.`
    : `${resumo.atencao?.codigo} tem o menor desempenho proporcional do ranking.`;

  const corrigir2 = contexto === "encerrado"
    ? `O período da ${periodoPior} terminou abaixo do outro período e será prioridade no próximo ciclo.`
    : `O período da ${periodoPior} precisa de acompanhamento mais próximo.`;

  const acoes = contexto === "encerrado"
    ? [
        `Definir um plano para a ${resumo.atencao?.codigo} reduzir a diferença para as demais lojas no próximo mês.`,
        `Levar para o próximo ciclo as práticas da ${resumo.destaque?.codigo}, destaque do mês.`,
        `Criar uma ação específica para fortalecer o período da ${periodoPior}.`,
      ]
    : [
        resumo.atencao?.percentual < 100
          ? `Recuperar a ${resumo.atencao.codigo}: faltam ${dinheiro.format(Math.max(resumo.atencao.meta - resumo.atencao.vendido, 0))} para a Meta.`
          : `Direcionar esforço para a ${resumo.atencao?.codigo} alcançar ${resumo.atencao?.proximo.nome}; faltam ${dinheiro.format(faltaAtencao)}.`,
        `Reforçar o período da ${periodoPior}, que apresenta o menor desempenho proporcional.`,
        `Replicar com a equipe as práticas da ${resumo.destaque?.codigo}, líder do mês.`,
      ];

  const justificativas = [
    resumo.atingido === "Megameta"
      ? "Megameta atingida."
      : resumo.atingido === "Supermeta"
        ? "Supermeta atingida."
        : resumo.atingido === "Meta"
          ? "Meta atingida, mas a Supermeta ainda não foi alcançada."
          : "Meta ainda não atingida.",
    todasAcima
      ? "Todas as lojas atingiram a Meta."
      : "Nem todas as lojas atingiram a Meta.",
    resumo.diferencaLojas <= 8
      ? "As lojas estão equilibradas."
      : `Há ${percentual.format(resumo.diferencaLojas)} p.p. de diferença entre a primeira e a última loja.`,
    resumo.diferencaPeriodos <= 6
      ? "Manhã e noite estão equilibradas."
      : `Há ${percentual.format(resumo.diferencaPeriodos)} p.p. de diferença entre manhã e noite.`,
  ];

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p>ROTEIRO DA REUNIÃO</p>
          <h2>{titulo}</h2>
        </div>
        <div className={styles.score}>
          <span>{contexto === "encerrado" ? "Nota final do mês" : "Nota parcial"}</span>
          <strong>{resumo.nota.toFixed(1)}</strong>
        </div>
      </header>

      <p className={styles.sintese}>{sintese}</p>

      <div className={styles.grid}>
        <article className={styles.positivo}>
          <h3>Reconhecer</h3>
          <p>{reconhecer1}</p>
          <p>{reconhecer2}</p>
        </article>

        <article className={styles.atencao}>
          <h3>Corrigir</h3>
          <p>{corrigir1}</p>
          <p>{corrigir2}</p>
        </article>
      </div>

      <div className={styles.acoes}>
        <h3>{contexto === "encerrado" ? "Decisões para o próximo mês" : "Combinar com a equipe"}</h3>
        {acoes.map((acao, indice) => (
          <label key={acao}>
            <input type="checkbox" />
            <span>
              <b>{indice + 1}.</b> {acao}
            </span>
          </label>
        ))}
      </div>

      <div className={styles.acoes}>
        <h3>Por que essa nota?</h3>
        {justificativas.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
