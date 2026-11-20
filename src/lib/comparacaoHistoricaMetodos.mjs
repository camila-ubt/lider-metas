import { compararMetodosProjecao } from "./comparacaoMetodosProjecao.mjs";

export const MINIMO_MESES_COMPARAVEIS = 3;
export const MAXIMO_MESES_ANALISE = 6;

// Retorna os seis meses encerrados até o mês selecionado, inclusive.
// O chamador só deve selecionar um mês já encerrado.
export function listarMesesAvaliacao(ano, numeroMes, quantidade = MAXIMO_MESES_ANALISE) {
  if (!Number.isInteger(ano) || !Number.isInteger(numeroMes) ||
      numeroMes < 1 || numeroMes > 12) return [];
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(ano, numeroMes - 1 - indice, 1);
    return { ano: data.getFullYear(), numeroMes: data.getMonth() + 1 };
  }).reverse();
}

const nomesMetodos = {
  atual: "Ritmo do mês (atual)",
  recente: "Ritmo dos últimos 7 dias",
  sazonal: "Padrão do ano anterior",
};

function media(valores) {
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

// Compara modelos em meses independentes, mantendo os mesmos meses e
// os mesmos cinco cortes para TODOS os modelos elegíveis.
export function avaliarMetodosEmVariosMeses({
  meses = [], lojas = [], periodo = "todos",
  minimoMeses = MINIMO_MESES_COMPARAVEIS,
}) {
  const avaliacoes = meses.map((mes) => ({
    chave: mes.ano + "-" + String(mes.numeroMes).padStart(2, "0"),
    resultado: compararMetodosProjecao({ ...mes, lojas, periodo }),
  })).filter(({ resultado }) => resultado.status === "ok" &&
    resultado.totalRealizado > 0);

  const ids = Object.keys(nomesMetodos);
  const elegiveis = ids.filter((id) =>
    avaliacoes.filter(({ resultado }) =>
      resultado.modelos.some((modelo) =>
        modelo.id === id && modelo.disponivel &&
        modelo.metricas.mape !== null)).length >= minimoMeses);

  const comuns = avaliacoes.filter(({ resultado }) => elegiveis.every((id) =>
    resultado.modelos.some((modelo) =>
      modelo.id === id && modelo.disponivel &&
      modelo.metricas.mape !== null)));

  const suficientes = comuns.length >= minimoMeses && elegiveis.length >= 2;
  const metodos = elegiveis.map((id) => {
    const serie = comuns.map(({ chave, resultado }) => {
      const modelo = resultado.modelos.find((item) => item.id === id);
      return { chave, mape: modelo.metricas.mape, mae: modelo.metricas.mae,
        vies: modelo.metricas.vies };
    });
    return {
      id, nome: nomesMetodos[id],
      meses: comuns.length,
      mape: suficientes ? media(serie.map((item) => item.mape)) : null,
      mae: suficientes ? media(serie.map((item) => item.mae)) : null,
      vies: suficientes ? media(serie.map((item) => item.vies)) : null,
      serie,
    };
  });
  const melhores = suficientes
    ? [...metodos].sort((a, b) => a.mape - b.mape || a.mae - b.mae)
    : [];

  return {
    mesesSolicitados: meses.length,
    mesesComBase: avaliacoes.length,
    mesesComparaveis: suficientes ? comuns.length : 0,
    mesesUsados: suficientes ? comuns.map((item) => item.chave) : [],
    metodos,
    melhor: melhores.length ? melhores[0] : null,
    status: suficientes ? "ok" : "insuficiente",
  };
}

export function avaliarSeisMesesPorLojaTurno({ meses = [], lojas = [] }) {
  return lojas.flatMap((loja) => ["manha", "noite"].map((periodo) => ({
    lojaId: loja.id,
    lojaNome: loja.codigo || loja.nome || String(loja.id),
    periodo,
    avaliacao: avaliarMetodosEmVariosMeses({ meses, lojas: [loja], periodo }),
  })));
}
