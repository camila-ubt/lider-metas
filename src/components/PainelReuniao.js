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

function proximoAlvo(vendido, meta) {
  const alvos = [
    { nome: "Meta", valor: meta },
    { nome: "Supermeta", valor: meta * 1.2 },
    { nome: "Megameta", valor: meta * 1.3 },
  ];
  return (
    alvos.find((item) => vendido < item.valor) || {
      nome: "Megameta",
      valor: meta * 1.3,
    }
  );
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

    return () => {
      observador.disconnect();
      document
        .querySelectorAll('[data-substituido-painel-reuniao="true"]')
        .forEach((bloco) => {
          bloco.style.display = "";
          delete bloco.dataset.substituidoPainelReuniao;
        });
    };
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
    const equilibrio = ranking.length
      ? Math.max(0, 100 - (destaque.percentual - atencao.percentual))
      : 0;
    const desempenho = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;
    const nota = Math.min(
      10,
      Math.max(0, desempenho / 20 + (equilibrio / 100) * 3 + 2),
    );

    return {
      totalVendido,
      totalMeta,
      alvo,
      ranking,
      destaque,
      atencao,
      melhorPeriodo,
      piorPeriodo,
      nota,
    };
  }, [lojas, vendas, metas]);

  if (!visivel || !mes || !resumo.totalMeta) return null;

  const todasAcima = resumo.ranking.every((item) => item.percentual >= 100);
  const faltaAtencao = Math.max(
    resumo.atencao?.proximo.valor - resumo.atencao?.vendido,
    0,
  );
  const acoes = [
    resumo.atencao?.percentual < 100
      ? `Recuperar a ${resumo.atencao.codigo}: faltam ${dinheiro.format(
          Math.max(resumo.atencao.meta - resumo.atencao.vendido, 0),
        )} para a Meta.`
      : `Direcionar esforço para a ${resumo.atencao?.codigo} alcançar ${
          resumo.atencao?.proximo.nome
        }; faltam ${dinheiro.format(faltaAtencao)}.`,
    `Reforçar o período da ${
      resumo.piorPeriodo?.periodo === "manha" ? "manhã" : "noite"
    }, que apresenta o menor desempenho proporcional.`,
    `Replicar com a equipe as práticas da ${resumo.destaque?.codigo}, líder do mês.`,
  ];

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p>ROTEIRO DA REUNIÃO</p>
          <h2>O que reconhecer, corrigir e combinar</h2>
        </div>
        <div className={styles.score}>
          <span>Nota da operação</span>
          <strong>{resumo.nota.toFixed(1)}</strong>
        </div>
      </header>

      <p className={styles.sintese}>
        A operação está rumo à <b>{resumo.alvo.nome}</b>. O foco da reunião deve ser
        manter o padrão da loja líder e reduzir a diferença para a loja de menor
        desempenho.
      </p>

      <div className={styles.grid}>
        <article className={styles.positivo}>
          <h3>Reconhecer</h3>
          <p>
            <b>{resumo.destaque?.codigo}</b> lidera o mês com {" "}
            {percentual.format(resumo.destaque?.percentual || 0)}% da Meta.
          </p>
          <p>
            {todasAcima
              ? "Todas as lojas já superaram a Meta."
              : `O melhor período é a ${
                  resumo.melhorPeriodo?.periodo === "manha" ? "manhã" : "noite"
                }.`}
          </p>
        </article>

        <article className={styles.atencao}>
          <h3>Corrigir</h3>
          <p>
            <b>{resumo.atencao?.codigo}</b> tem o menor desempenho proporcional do
            ranking.
          </p>
          <p>
            O período da {resumo.piorPeriodo?.periodo === "manha" ? "manhã" : "noite"}
            precisa de acompanhamento mais próximo.
          </p>
        </article>
      </div>

      <div className={styles.acoes}>
        <h3>Combinar com a equipe</h3>
        {acoes.map((acao, indice) => (
          <label key={acao}>
            <input type="checkbox" />
            <span>
              <b>{indice + 1}.</b> {acao}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
