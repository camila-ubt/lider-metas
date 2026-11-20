import {
  calcularMetricasPrevisao,
  validarProjecoesHistoricas,
} from "./validacaoProjecoes.mjs";

const TURNOS = ["manha", "noite"];
const CORTES = [5, 10, 15, 20, 25];
const METODOS = [
  { id: "atual", nome: "Ritmo do mês (atual)" },
  { id: "recente", nome: "Ritmo dos últimos 7 dias" },
  { id: "sazonal", nome: "Padrão do mesmo mês no ano anterior" },
];

function indiceMensal(vendas, ano, numeroMes, lojas, periodos) {
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  const prefixo = ano + "-" + String(numeroMes).padStart(2, "0") + "-";
  const series = [];
  let completos = true;

  for (const loja of lojas) {
    for (const periodo of periodos) {
      const dias = Array(ultimoDia).fill(null);
      const duplicados = new Set();
      for (const venda of vendas) {
        if (String(venda.loja_id) !== String(loja.id) ||
            venda.periodo !== periodo ||
            !String(venda.data || "").startsWith(prefixo)) continue;
        const dia = Number(String(venda.data).slice(8, 10));
        const valor = Number(venda.valor_vendido);
        if (!Number.isInteger(dia) || dia < 1 || dia > ultimoDia ||
            String(venda.data) !== prefixo + String(dia).padStart(2, "0") ||
            venda.valor_vendido == null || !Number.isFinite(valor) || valor < 0) {
          completos = false;
          continue;
        }
        if (dias[dia - 1] !== null) duplicados.add(dia);
        dias[dia - 1] = valor;
      }
      if (duplicados.size || dias.some((valor) => valor === null)) completos = false;
      series.push({ id: String(loja.id), periodo, dias });
    }
  }

  return { ultimoDia, series, completos };
}

function somar(valores) {
  return valores.reduce((total, valor) => total + valor, 0);
}

function preverRecente(indice, diaCorte) {
  return indice.series.reduce((total, { dias }) => {
    const observados = dias.slice(0, diaCorte);
    const janela = observados.slice(-7);
    return total + somar(observados) +
      (somar(janela) / janela.length) * (indice.ultimoDia - diaCorte);
  }, 0);
}

function preverSazonal(indice, referencia, diaCorte) {
  if (!referencia.completos) return null;
  // Fevereiro de anos bissextos pode ter 28/29 dias: compara progresso relativo.
  const corteHistorico = Math.max(1, Math.min(
    referencia.ultimoDia,
    Math.round(diaCorte * referencia.ultimoDia / indice.ultimoDia),
  ));
  let total = 0;

  for (let i = 0; i < indice.series.length; i += 1) {
    const atual = indice.series[i];
    const anterior = referencia.series[i];
    if (!anterior || atual.id !== anterior.id || atual.periodo !== anterior.periodo) return null;
    const totalAnterior = somar(anterior.dias);
    const acumuladoAnterior = somar(anterior.dias.slice(0, corteHistorico));
    if (!(totalAnterior > 0) || !(acumuladoAnterior > 0)) return null;

    const fracao = acumuladoAnterior / totalAnterior;
    // Frações pequenas no início do mês deixam a previsão instável.
    if (!(fracao >= 0.03)) return null;
    total += somar(atual.dias.slice(0, diaCorte)) / fracao;
  }
  return Number.isFinite(total) ? total : null;
}

function linhaAvaliacao(diaCorte, previsto, realizado) {
  return {
    diaCorte,
    previsto,
    realizado,
    erro: previsto === null ? null : previsto - realizado,
    erroPercentual: previsto === null || realizado === 0
      ? null : ((previsto - realizado) / realizado) * 100,
  };
}

// Todos os modelos recebem exatamente os mesmos cortes e somente vendas
// observadas até cada corte. O ano anterior é permitido apenas como treino.
export function compararMetodosProjecao({
  vendas = [], vendasReferencia = [], lojas = [],
  ano, numeroMes, periodo = "todos", diasCorte = CORTES,
}) {
  const base = validarProjecoesHistoricas({
    vendas, lojas, ano, numeroMes, periodo, diasCorte,
  });
  if (base.status !== "ok") {
    return { ...base, modelos: [], melhor: null };
  }

  const periodos = periodo === "todos" ? TURNOS : [periodo];
  const atual = indiceMensal(vendas, ano, numeroMes, lojas, periodos);
  const anterior = indiceMensal(vendasReferencia, ano - 1, numeroMes, lojas, periodos);

  const modelos = METODOS.map(({ id, nome }) => {
    const avaliacoes = base.previsoes.map((linha) => {
      let previsto = null;
      if (id === "atual") previsto = linha.previsto;
      if (id === "recente") previsto = preverRecente(atual, linha.diaCorte);
      if (id === "sazonal") previsto = preverSazonal(atual, anterior, linha.diaCorte);
      return linhaAvaliacao(linha.diaCorte, previsto, base.totalRealizado);
    });
    const disponivel = avaliacoes.length > 0 &&
      avaliacoes.every((linha) => linha.previsto !== null &&
        Number.isFinite(linha.previsto));
    return {
      id, nome, disponivel,
      motivo: !disponivel && id === "sazonal"
        ? "Exige vendas completas do mesmo mês no ano anterior."
        : null,
      avaliacoes,
      metricas: disponivel ? calcularMetricasPrevisao(avaliacoes) : null,
    };
  });

  // Só compara métodos calculados nos mesmos cinco cortes.
  const ordenados = modelos.filter((modelo) => modelo.disponivel &&
    modelo.metricas.mape !== null).sort((a, b) =>
    a.metricas.mape - b.metricas.mape ||
    a.metricas.mae - b.metricas.mae);
  const melhor = ordenados.length
    ? { id: ordenados[0].id, nome: ordenados[0].nome,
        mape: ordenados[0].metricas.mape }
    : null;

  return { ...base, modelos, melhor, anoReferencia: ano - 1 };
}

// Exibe a análise por loja/turno em vez de concluir que um resultado geral
// representa o comportamento de todos os setores.
export function compararMetodosPorLojaTurno({
  vendas = [], vendasReferencia = [], lojas = [], ano, numeroMes, diasCorte = CORTES,
}) {
  return lojas.flatMap((loja) => TURNOS.map((periodo) => {
    const resultado = compararMetodosProjecao({
      vendas, vendasReferencia, lojas: [loja], ano, numeroMes, periodo, diasCorte,
    });
    return {
      lojaId: loja.id,
      lojaNome: loja.codigo || loja.nome || String(loja.id),
      periodo,
      status: resultado.status,
      melhor: resultado.melhor,
      modelos: resultado.modelos,
    };
  }));
}
