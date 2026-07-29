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
        const meta = metas
          .filter((item) => Number(item.loja_id) === Number(loja.id))
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);

        return {
          ...loja,
          total,
          manha,
          noite,
          meta,
          percentual: meta > 0 ? (total / meta) * 100 : 0,
          projecao:
            diaCorte > 0 ? (total / diaCorte) * intervalo.ultimoDia : 0,
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
        <span>Total, Meta, períodos e projeção em uma única visão.</span>
      </div>

      {carregando && <div className={styles.message}>Calculando resumo...</div>}
      {erro && <div className={styles.error}>{erro}</div>}

      {!carregando && !erro && (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Loja</th>
                <th>Total</th>
                <th>% Meta</th>
                <th>Manhã</th>
                <th>Noite</th>
                <th>Projeção</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((loja) => (
                <tr key={loja.id}>
                  <th>{loja.codigo}</th>
                  <td>{dinheiro.format(loja.total)}</td>
                  <td>{percentual.format(loja.percentual)}%</td>
                  <td>{dinheiro.format(loja.manha)}</td>
                  <td>{dinheiro.format(loja.noite)}</td>
                  <td>{dinheiro.format(loja.projecao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>,
    alvo
  );
}
