import { calcularProjecaoTurno } from "./projecaoTurnos.mjs";

const PERIODOS = ["manha", "noite"];
const CORTES_PADRAO = [5, 10, 15, 20, 25];

// Erro positivo: previsão acima do realizado; erro negativo: abaixo.
export function calcularMetricasPrevisao(observacoes = []) {
  const validas = observacoes.filter(({ previsto, realizado }) =>
    typeof previsto === "number" && Number.isFinite(previsto) &&
    typeof realizado === "number" && Number.isFinite(realizado) &&
    previsto >= 0 && realizado >= 0
  );

  if (!validas.length) {
    return {
      amostras: 0, amostrasMape: 0,
      mae: null, rmse: null, mape: null, wape: null, vies: null,
    };
  }

  const erros = validas.map(({ previsto, realizado }) => previsto - realizado);
  const totalAbsoluto = erros.reduce((soma, erro) => soma + Math.abs(erro), 0);
  const totalRealizado = validas.reduce((soma, item) => soma + item.realizado, 0);
  const comRealizadoPositivo = validas.filter((item) => item.realizado > 0);
  const n = validas.length;

  return {
    amostras: n,
    amostrasMape: comRealizadoPositivo.length,
    mae: totalAbsoluto / n,
    rmse: Math.sqrt(erros.reduce((soma, erro) => soma + erro ** 2, 0) / n),
    mape: comRealizadoPositivo.length
      ? comRealizadoPositivo.reduce(
          (soma, item) => soma + Math.abs(item.previsto - item.realizado) / item.realizado,
          0,
        ) * 100 / comRealizadoPositivo.length
      : null,
    wape: totalRealizado > 0 ? totalAbsoluto * 100 / totalRealizado : null,
    vies: erros.reduce((soma, erro) => soma + erro, 0) / n,
  };
}

// Backtest de um mês encerrado, usando apenas os lançamentos disponíveis em cada corte.
// Exige um registro por loja, período e dia: ausência não vira venda zero.
// Não grava nada no banco, nem altera a regra atual de projeção.
export function validarProjecoesHistoricas({
  vendas = [], lojas = [], ano, numeroMes, periodo = "todos",
  diasCorte = CORTES_PADRAO,
}) {
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  const periodos = periodo === "todos" ? PERIODOS : [periodo];
  const ids = [...new Set(lojas.map((loja) => String(loja.id)))];
  const mesValido = Number.isInteger(ano) && ano >= 2000 &&
    Number.isInteger(numeroMes) && numeroMes >= 1 && numeroMes <= 12 &&
    ids.length > 0 && periodos.every((item) => PERIODOS.includes(item));

  if (!mesValido) {
    return { status: "parametros_invalidos", previsoes: [], metricas: calcularMetricasPrevisao() };
  }

  const prefixo = String(ano) + "-" + String(numeroMes).padStart(2, "0") + "-";
  const mapa = new Map();
  let invalidos = 0;

  for (const venda of vendas) {
    const data = String(venda.data || "");
    if (!data.startsWith(prefixo) ||
        !ids.includes(String(venda.loja_id)) ||
        !periodos.includes(venda.periodo)) continue;
    const dia = Number(data.slice(8, 10));
    const valor = Number(venda.valor_vendido);
    if (!Number.isInteger(dia) || dia < 1 || dia > ultimoDia ||
        data !== prefixo + String(dia).padStart(2, "0") ||
        !Number.isFinite(valor) || valor < 0 || venda.valor_vendido == null) {
      invalidos += 1;
      continue;
    }
    const chave = data + "|" + String(venda.loja_id) + "|" + venda.periodo;
    mapa.set(chave, (mapa.get(chave) || 0) + 1);
  }

  const faltantes = [];
  const duplicados = [];
  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const data = prefixo + String(dia).padStart(2, "0");
    for (const id of ids) {
      for (const turno of periodos) {
        const chave = data + "|" + id + "|" + turno;
        const contagem = mapa.get(chave) || 0;
        if (contagem === 0) faltantes.push(chave);
        if (contagem > 1) duplicados.push(chave);
      }
    }
  }

  if (faltantes.length || duplicados.length || invalidos) {
    return {
      status: "base_incompleta",
      faltantes: faltantes.length,
      duplicados: duplicados.length,
      invalidos,
      previsoes: [],
      metricas: calcularMetricasPrevisao(),
    };
  }

  const registros = vendas.filter((venda) =>
    String(venda.data || "").startsWith(prefixo) &&
    ids.includes(String(venda.loja_id)) && periodos.includes(venda.periodo));
  const totalRealizado = registros.reduce((soma, item) => soma + Number(item.valor_vendido), 0);
  const cortes = [...new Set(diasCorte)]
    .filter((dia) => Number.isInteger(dia) && dia >= 1 && dia < ultimoDia)
    .sort((a, b) => a - b);
  const previsoes = cortes.map((diaCorte) => {
    const contexto = { tipo: "andamento", ano, numeroMes, diaCorte, ultimoDia };
    const previstos = periodos.map((turno) =>
      calcularProjecaoTurno({
        vendas: registros, lojas, periodo: turno,
        contexto, minutosAgora: 24 * 60, fimTurno: 0,
      }).valor);
    const previsto = previstos.some((valor) => valor === null)
      ? null : previstos.reduce((soma, valor) => soma + valor, 0);
    return {
      diaCorte, previsto, realizado: totalRealizado,
      erro: previsto === null ? null : previsto - totalRealizado,
      erroPercentual: previsto === null || totalRealizado === 0
        ? null : (previsto - totalRealizado) * 100 / totalRealizado,
    };
  });

  return {
    status: "ok", ano, numeroMes, periodo,
    totalRealizado, previsoes, metricas: calcularMetricasPrevisao(previsoes),
  };
}
