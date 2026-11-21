"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimarChancesHistoricas } from "@/lib/probabilidadesHistoricas.mjs";
import { avaliarCalibracaoProbabilidades } from "@/lib/calibracaoProbabilidades.mjs";
import { verificarQualidadeLancamentos } from "@/lib/qualidadeDados.mjs";

const METAS = [
  { chave: "meta", nome: "Meta" },
  { chave: "super", nome: "Supermeta" },
  { chave: "mega", nome: "Megameta" },
];
const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function intervalosHistoricos(ano) {
  const intervalos = [];
  for (const anoAnterior of [ano - 2, ano - 1]) {
    if (anoAnterior < 2024) continue;
    for (const mes of [1, 4, 7, 10]) {
      const inicio = `${anoAnterior}-${String(mes).padStart(2, "0")}-01`;
      const fim = `${anoAnterior}-${String(mes + 2).padStart(2, "0")}-${String(new Date(anoAnterior, mes + 2, 0).getDate()).padStart(2, "0")}`;
      if (fim < "2024-07-01") continue;
      intervalos.push({ inicio, fim });
    }
  }
  return intervalos;
}

function intervalosMesesEncerrados(ano, numeroMes) {
  const intervalos = [];
  for (let mes = 1; mes < numeroMes; mes += 3) {
    const ultimoMes = Math.min(mes + 2, numeroMes - 1);
    const fim = new Date(ano, ultimoMes, 0).getDate();
    intervalos.push({
      inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
      fim: `${ano}-${String(ultimoMes).padStart(2, "0")}-${String(fim).padStart(2, "0")}`,
    });
  }
  return intervalos;
}

export default function ProbabilidadesMetas({
  ano, numeroMes, diaLimite, tipo, lojas, vendas, metas,
  filtroLoja = "geral", filtroPeriodo = "todos", projecaoMensal = null,
}) {
  const supabase = useMemo(() => createClient(), []);
  const [historico, setHistorico] = useState(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroRegistro, setErroRegistro] = useState(false);
  const chave = `${ano}-${numeroMes}`;
  const ativo = tipo === "andamento" || tipo === "ultimo-dia";

  useEffect(() => {
    if (!ativo || !ano || !numeroMes) return undefined;
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(false);
      const intervalos = [
        ...intervalosHistoricos(ano),
        ...intervalosMesesEncerrados(ano, numeroMes),
      ];
      const anos = [...new Set(intervalos.map((item) => Number(item.inicio.slice(0, 4))))];
      const requisicoes = [
        ...intervalos.map(({ inicio, fim }) =>
          supabase.from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido")
            .gte("data", inicio).lte("data", fim)),
        ...anos.map((anoHistorico) =>
          supabase.from("metas_mensais")
            .select("mes,loja_id,periodo,valor_meta")
            .gte("mes", `${anoHistorico}-01-01`)
            .lte("mes", `${anoHistorico}-12-01`)),
      ];
      const respostas = await Promise.all(requisicoes);
      if (cancelado) return;
      if (respostas.some((resposta) => resposta.error)) {
        setErro(true);
        setHistorico(null);
      } else {
        setHistorico({
          chave,
          vendasHistoricas: respostas.slice(0, intervalos.length)
            .flatMap((resposta) => resposta.data || []),
          metasHistoricas: respostas.slice(intervalos.length)
            .flatMap((resposta) => resposta.data || []),
        });
      }
      setCarregando(false);
    }

    carregar();
    return () => { cancelado = true; };
  }, [ativo, ano, numeroMes, chave, supabase]);

  const pronto = historico?.chave === chave;
  const resultado = useMemo(() => !ativo || !pronto ? null :
    estimarChancesHistoricas({
      vendas, metas, lojas, ano, numeroMes, diaLimite,
      filtroLoja, filtroPeriodo,
      ...historico,
    }), [ativo, pronto, historico, vendas, metas, lojas,
      ano, numeroMes, diaLimite, filtroLoja, filtroPeriodo]);

  const calibracao = useMemo(() => resultado?.status !== "ok" ? null :
    avaliarCalibracaoProbabilidades({
      ...historico, lojas, ano, numeroMes, diaLimite,
      filtroLoja, filtroPeriodo, probabilidades: resultado.probabilidades,
    }), [resultado, historico, lojas, ano, numeroMes, diaLimite, filtroLoja, filtroPeriodo]);
  const qualidade = useMemo(() => verificarQualidadeLancamentos({
    vendas, metas, lojas, ano, numeroMes,
    diaConcluido: Math.max(0, diaLimite - 1), filtroLoja, filtroPeriodo,
  }), [vendas, metas, lojas, ano, numeroMes, diaLimite, filtroLoja, filtroPeriodo]);

  useEffect(() => {
    if (!pronto || resultado?.status !== "ok" || !calibracao ||
        qualidade.status !== "ok" || !Number.isFinite(projecaoMensal)) return;
    const hoje = new Date();
    if (ano !== hoje.getFullYear() || numeroMes !== hoje.getMonth() + 1 ||
        diaLimite !== hoje.getDate() || resultado.diaBase < Math.max(3, diaLimite - 1)) return;
    let cancelado = false;
    const data = `${ano}-${String(numeroMes).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const raw = resultado.probabilidades;
    const ajustada = calibracao.probabilidades;
    async function registrar() {
      const { error: falha } = await supabase.from("previsoes_diarias").upsert({
        data_previsao: data, mes: `${ano}-${String(numeroMes).padStart(2, "0")}-01`,
        filtro_loja: String(filtroLoja), filtro_periodo: filtroPeriodo,
        dia_base: resultado.diaBase, projecao_valor: projecaoMensal,
        chance_meta_original: raw.meta, chance_super_original: raw.super,
        chance_mega_original: raw.mega, chance_meta: ajustada.meta,
        chance_super: ajustada.super, chance_mega: ajustada.mega,
        meses_calibracao: calibracao.totalMeses,
      }, { onConflict: "data_previsao,mes,filtro_loja,filtro_periodo", ignoreDuplicates: true });
      if (!cancelado) setErroRegistro(Boolean(falha));
    }
    registrar();
    return () => { cancelado = true; };
  }, [pronto, resultado, calibracao, qualidade, projecaoMensal,
    ano, numeroMes, diaLimite, filtroLoja, filtroPeriodo, supabase]);

  if (!ativo || erro) return null;
  if (carregando || !pronto) {
    return <small style={{ display: "block", marginTop: 8 }}>Calculando chances...</small>;
  }
  if (resultado?.status !== "ok") {
    return <small style={{ display: "block", marginTop: 8 }}>
      Chances indisponíveis para este recorte.
    </small>;
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      <strong style={{ fontSize: 13 }}>Chance estimada de atingir</strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {METAS.map(({ chave: nivel, nome }) => (
          <div key={nivel} style={{
            border: "1px solid var(--border, #ded9e6)",
            borderRadius: 9, padding: "9px 5px", textAlign: "center",
            display: "grid", gap: 3,
          }}>
            <span style={{ fontSize: 11 }}>{nome}</span>
            <strong style={{ fontSize: 19 }}>{(calibracao?.probabilidades?.[nivel] ?? resultado.probabilidades[nivel])}%</strong>
          </div>
        ))}
      </div>
      <small style={{ opacity: 0.8 }}>
        {resultado.anosMesmoMes.length
          ? `Mesmo mês: ${NOMES_MESES[numeroMes - 1]} de ${resultado.anosMesmoMes.join(" e ")}`
          : "Sem referência do mesmo mês"}
        {" · "}{resultado.mesesApoio} outros meses de apoio
        {" · "}até o dia {resultado.diaBase}
      </small>
      {calibracao && (
        <small style={{ opacity: 0.8 }}>
          Calibração: {calibracao.totalMeses} meses retrospectivos.{" "}
          {METAS.map(({ chave: nivel, nome }) => {
            const item = calibracao.niveis[nivel];
            return `${nome}: ${item?.validado ? `${item.semelhantes} casos semelhantes, ${Math.round(item.frequencia)}% atingiram` : "amostra insuficiente para confirmar a chance"}`;
          }).join(" · ")}.
        </small>
      )}
      {qualidade.status === "inconsistente" && (
        <small role="status" style={{ color: "#b42318" }}>
          Conferência dos lançamentos até ontem: {qualidade.faltantes} ausentes,{" "}
          {qualidade.duplicados} duplicados, {qualidade.invalidos} incompatíveis;{" "}
          {qualidade.metasAusentes + qualidade.metasDuplicadas + qualidade.metasInvalidas} problemas nas metas.
          {" "}Verifique antes de confiar na previsão.
        </small>
      )}
      {erroRegistro && <small>Registro diário indisponível; confira a migração do banco.</small>}
    </div>
  );
}
