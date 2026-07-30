"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import styles from "./ResumoLojasFechamento.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function intervaloMes(valorMes) {
  const [ano, mes] = valorMes.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const mesTexto = String(mes).padStart(2, "0");
  return {
    ano,
    mes,
    ultimoDia,
    inicio: `${ano}-${mesTexto}-01`,
    fim: `${ano}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function diaCorteDoMes(ano, mes, ultimoDia) {
  const hoje = new Date();
  const atual = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
  const passado =
    ano < hoje.getFullYear() ||
    (ano === hoje.getFullYear() && mes < hoje.getMonth() + 1);

  if (atual) return Math.min(hoje.getDate(), ultimoDia);
  if (passado) return ultimoDia;
  return 0;
}

function mesSelecionado() {
  const campo = document.querySelector('input[type="month"]');
  if (campo?.value) return campo.value;
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function niveisDoResultado(vendido, meta) {
  const niveis = [
    { nome: "Meta", valor: meta },
    { nome: "Super", valor: meta * 1.2 },
    { nome: "Mega", valor: meta * 1.3 },
  ];

  if (!(meta > 0)) {
    return niveis.map((nivel) => ({
      ...nivel,
      estado: "futuro",
      texto: "Sem meta",
    }));
  }

  const indiceAtual = niveis.findIndex((nivel) => vendido < nivel.valor);

  return niveis.map((nivel, indice) => {
    const batida = vendido >= nivel.valor;
    const atual = !batida && indice === indiceAtual;

    return {
      ...nivel,
      estado: batida ? "batida" : atual ? "atual" : "futuro",
      texto: batida
        ? "Batida"
        : atual
          ? `Faltam ${dinheiro.format(Math.max(nivel.valor - vendido, 0))}`
          : "Próxima",
    };
  });
}

function NiveisVisuais({ vendido, meta }) {
  return (
    <div className={styles.levelsVisual}>
      {niveisDoResultado(vendido, meta).map((nivel) => (
        <div
          className={`${styles.levelChip} ${
            nivel.estado === "batida"
              ? styles.levelDone
              : nivel.estado === "atual"
                ? styles.levelCurrent
                : styles.levelFuture
          }`}
          key={nivel.nome}
        >
          <strong>{nivel.nome}</strong>
          <span>{nivel.texto}</span>
        </div>
      ))}
    </div>
  );
}

function PeriodoResumo({ nome, vendido, meta, projecao }) {
  const atingimento = meta > 0 ? (vendido / meta) * 100 : 0;

  return (
    <div className={styles.periodCard}>
      <div className={styles.periodHeader}>
        <strong>{nome}</strong>
        <b>{percentual.format(atingimento)}%</b>
      </div>
      <span className={styles.periodValue}>{dinheiro.format(vendido)}</span>
      <small>Projeção: {dinheiro.format(projecao)}</small>
      <NiveisVisuais vendido={vendido} meta={meta} />
    </div>
  );
}

export default function ResumoLojasFechamento() {
  const supabase = useMemo(() => createClient(), []);
  const [alvo, setAlvo] = useState(null);
  const [mes, setMes] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    function localizar() {
      const elemento = document.querySelector("#resumo-lojas-fechamento");
      setAlvo(elemento || null);
      if (elemento) setMes(mesSelecionado());

      document.querySelectorAll("p").forEach((paragrafo) => {
        const texto = paragrafo.textContent || "";
        if (texto.includes("vendidos") && texto.includes("projeção de")) {
          paragrafo.style.display = "none";
        }
      });
    }

    localizar();
    const observador = new MutationObserver(localizar);
    observador.observe(document.body, { subtree: true, childList: true });
    document.addEventListener("click", localizar, true);

    return () => {
      observador.disconnect();
      document.removeEventListener("click", localizar, true);
    };
  }, []);

  useEffect(() => {
    if (!alvo || !mes) return;
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");

      const intervalo = intervaloMes(mes);
      const diaCorte = diaCorteDoMes(
        intervalo.ano,
        intervalo.mes,
        intervalo.ultimoDia
      );

      const [lojasResp, vendasResp, metasResp] = await Promise.all([
        supabase.from("lojas").select("id,codigo,nome,ordem").eq("ativa", true).order("ordem"),
        supabase
          .from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido")
          .gte("data", intervalo.inicio)
          .lte("data", intervalo.fim),
        supabase
          .from("metas_mensais")
          .select("loja_id,periodo,valor_meta")
          .eq("mes", `${mes}-01`),
      ]);

      if (cancelado) return;
      const falha = lojasResp.error || vendasResp.error || metasResp.error;
      if (falha) {
        setErro(falha.message);
        setCarregando(false);
        return;
      }

      const vendas = (vendasResp.data || []).filter(
        (item) => Number(String(item.data).slice(8, 10)) <= diaCorte
      );
      const metas = metasResp.data || [];

      const resumo = (lojasResp.data || []).map((loja) => {
        const vendasLoja = vendas.filter(
          (item) => Number(item.loja_id) === Number(loja.id)
        );
        const total = vendasLoja.reduce(
          (soma, item) => soma + Number(item.valor_vendido || 0),
          0
        );
        const manha = vendasLoja
          .filter((item) => item.periodo === "manha")
          .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
        const noite = vendasLoja
          .filter((item) => item.periodo === "noite")
          .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
        const metasLoja = metas.filter(
          (item) => Number(item.loja_id) === Number(loja.id)
        );
        const metaManha = metasLoja
          .filter((item) => item.periodo === "manha")
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        const metaNoite = metasLoja
          .filter((item) => item.periodo === "noite")
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        const meta = metaManha + metaNoite;
        const fatorProjecao = diaCorte > 0 ? intervalo.ultimoDia / diaCorte : 0;

        return {
          ...loja,
          total,
          manha,
          noite,
          meta,
          metaManha,
          metaNoite,
          percentual: meta > 0 ? (total / meta) * 100 : 0,
          projecao: total * fatorProjecao,
          projecaoManha: manha * fatorProjecao,
          projecaoNoite: noite * fatorProjecao,
        };
      });

      resumo.sort((a, b) => b.percentual - a.percentual);
      setLinhas(resumo);
      setCarregando(false);
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [alvo, mes, supabase]);

  if (!alvo) return null;

  return createPortal(
    <section className={styles.card}>
      <div className={styles.header}>
        <p>Resumo por loja</p>
        <h3>Resultado consolidado</h3>
        <span>Total, períodos, projeção e níveis alcançados em uma única visão.</span>
      </div>

      {carregando && <div className={styles.message}>Calculando resumo...</div>}
      {erro && <div className={styles.error}>{erro}</div>}

      {!carregando && !erro && (
        <div className={styles.storeList}>
          {linhas.map((loja) => (
            <article className={styles.storeCard} key={loja.id}>
              <h4>{loja.codigo}</h4>

              <div className={styles.storeOverview}>
                <div>
                  <span>Total</span>
                  <strong>{dinheiro.format(loja.total)}</strong>
                </div>
                <div>
                  <span>% da Meta</span>
                  <strong>{percentual.format(loja.percentual)}%</strong>
                </div>
                <div className={styles.projectionBox}>
                  <span>Projeção</span>
                  <strong>{dinheiro.format(loja.projecao)}</strong>
                </div>
              </div>

              <div className={styles.storeLevels}>
                <span>Níveis da loja</span>
                <NiveisVisuais vendido={loja.total} meta={loja.meta} />
              </div>

              <div className={styles.periodGrid}>
                <PeriodoResumo
                  nome="Manhã"
                  vendido={loja.manha}
                  meta={loja.metaManha}
                  projecao={loja.projecaoManha}
                />
                <PeriodoResumo
                  nome="Noite"
                  vendido={loja.noite}
                  meta={loja.metaNoite}
                  projecao={loja.projecaoNoite}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>,
    alvo
  );
}
