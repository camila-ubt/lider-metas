import {
  estimarChancesHistoricas,
  reconstruirMeses,
} from "./probabilidadesHistoricas.mjs";

export const DIAS_CALIBRACAO = [5, 10, 15, 20, 25];

export const NIVEIS_CALIBRACAO = [
  { id: "meta", nome: "Meta", fator: 1 },
  { id: "super", nome: "Supermeta", fator: 1.1 },
  { id: "mega", nome: "Megameta", fator: 1.2 },
];

const PERIODOS = ["manha", "noite"];
const PRIMEIRO_MES = "2024-07";
const FAIXAS = [
  { inicio: 0, fim: 19, rotulo: "0–19%" },
  { inicio: 20, fim: 39, rotulo: "20–39%" },
  { inicio: 40, fim: 59, rotulo: "40–59%" },
  { inicio: 60, fim: 79, rotulo: "60–79%" },
  { inicio: 80, fim: 100, rotulo: "80–100%" },
];

function chaveMes(ano, mes) {
  return String(ano) + "-" + String(mes).padStart(2, "0");
}

function chaveSlot(lojaId, periodo) {
  return String(lojaId) + "|" + periodo;
}

function estatisticas(amostras) {
  if (!amostras.length) {
    return {
      amostras: 0, meses: 0, chanceMedia: null,
      frequenciaReal: null, desvioPp: null, brier: null,
    };
  }

  const chanceMedia = amostras.reduce((soma, item) => soma + item.chance, 0) /
    amostras.length;
  const frequenciaReal = amostras.reduce((soma, item) => soma + item.atingiu, 0) *
    100 / amostras.length;
  const brier = amostras.reduce((soma, item) => {
    const erro = item.chance / 100 - item.atingiu;
    return soma + erro * erro;
  }, 0) / amostras.length;

  return {
    amostras: amostras.length,
    meses: new Set(amostras.map((item) => item.mes)).size,
    chanceMedia, frequenciaReal,
    desvioPp: chanceMedia - frequenciaReal,
    brier,
  };
}

// Compara chance informada com a frequência observada, no mesmo corte.
// Não mistura previsões do dia 5 com as do dia 25 como meses independentes.
export function resumirCalibracaoProbabilidades(observacoes = [], diaCorte = 20) {
  const selecionadas = observacoes.filter((item) => item.diaCorte === diaCorte);
  const niveis = Object.fromEntries(NIVEIS_CALIBRACAO.map(({ id }) => {
    const amostras = selecionadas.flatMap((item) => {
      const chance = item.probabilidades?.[id];
      const atingiu = item.atingiu?.[id];
      return Number.isFinite(chance) && chance >= 0 && chance <= 100 &&
        (atingiu === 0 || atingiu === 1)
        ? [{ mes: item.mes, chance, atingiu }]
        : [];
    });

    return [id, {
      ...estatisticas(amostras),
      faixas: FAIXAS.map((faixa) => ({
        ...faixa,
        ...estatisticas(amostras.filter((amostra) =>
          amostra.chance >= faixa.inicio && amostra.chance <= faixa.fim)),
      })),
    }];
  }));
  return {
    diaCorte,
    meses: new Set(selecionadas.map((item) => item.mes)).size,
    niveis,
  };
}

// Reexecuta a mesma função usada no painel para cada mês encerrado e corte.
// Apenas meses completos entram como alvo; o estimador consulta exclusivamente
// anos anteriores ao mês previsto, sem conhecer o fechamento que será avaliado.
export function validarCalibracaoProbabilidades({
  vendas = [], metas = [], lojas = [],
  anoLimite, filtroLoja = "geral", filtroPeriodo = "todos",
  diasCorte = DIAS_CALIBRACAO, minimoMeses = 6,
}) {
  const limiteValido = typeof anoLimite === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(anoLimite) &&
    anoLimite > PRIMEIRO_MES;
  const lojasSelecionadas = lojas.filter((loja) =>
    filtroLoja === "geral" || String(loja.id) === String(filtroLoja));
  const periodos = filtroPeriodo === "todos" ? PERIODOS : [filtroPeriodo];
  const cortes = [...new Set(diasCorte)].filter((dia) =>
    Number.isInteger(dia) && dia >= 3 && dia <= 28).sort((a, b) => a - b);

  if (!limiteValido || !lojasSelecionadas.length || !cortes.length ||
      !periodos.every((periodo) => PERIODOS.includes(periodo))) {
    return { status: "parametros_invalidos", observacoes: [] };
  }

  const slots = lojasSelecionadas.flatMap((loja) => periodos.map((periodo) =>
    chaveSlot(loja.id, periodo)));
  const chaves = new Set(slots);
  const mesesCompletos = reconstruirMeses({
    vendas, metas, slots, anoLimite,
  }).filter((item) => item.chave >= PRIMEIRO_MES);

  const candidatos = new Set();
  for (let ano = 2024; ano <= Number(anoLimite.slice(0, 4)); ano += 1) {
    for (let mes = 1; mes <= 12; mes += 1) {
      const chave = chaveMes(ano, mes);
      if (chave >= PRIMEIRO_MES && chave < anoLimite) candidatos.add(chave);
    }
  }

  const observacoes = [];
  const mesesComEstimativa = new Set();
  const mesesSemReferencia = new Set();

  for (const mes of mesesCompletos) {
    const vendasMes = vendas.filter((venda) =>
      String(venda.data || "").slice(0, 7) === mes.chave &&
      chaves.has(chaveSlot(venda.loja_id, venda.periodo)));
    const metasMes = metas.filter((meta) =>
      String(meta.mes || "").slice(0, 7) === mes.chave &&
      chaves.has(chaveSlot(meta.loja_id, meta.periodo)));
    const atingiu = Object.fromEntries(NIVEIS_CALIBRACAO.map(({ id, fator }) =>
      [id, Number(mes.realizado >= mes.meta * fator)]));

    for (const diaCorte of cortes) {
      if (diaCorte >= mes.dias.length) continue;

      const resultado = estimarChancesHistoricas({
        vendas: vendasMes,
        metas: metasMes,
        vendasHistoricas: vendas,
        metasHistoricas: metas,
        lojas: lojasSelecionadas,
        ano: mes.ano, numeroMes: mes.mes, diaLimite: diaCorte,
        filtroLoja: "geral", filtroPeriodo, minimoMeses,
      });

      if (resultado.status !== "ok") {
        mesesSemReferencia.add(mes.chave);
        continue;
      }

      mesesComEstimativa.add(mes.chave);
      observacoes.push({
        mes: mes.chave,
        diaCorte,
        probabilidades: resultado.probabilidades,
        atingiu,
        realizado: mes.realizado,
        meta: mes.meta,
        mesesReferencia: resultado.meses,
      });
    }
  }

  return {
    status: observacoes.length ? "ok" : "sem_amostra",
    observacoes,
    mesesCompletos: mesesCompletos.length,
    mesesInvalidos: Math.max(0, candidatos.size - mesesCompletos.length),
    mesesAvaliados: mesesComEstimativa.size,
    mesesSemReferencia: [...mesesSemReferencia].filter((mes) =>
      !mesesComEstimativa.has(mes)).length,
    dataLimite: anoLimite,
  };
}
