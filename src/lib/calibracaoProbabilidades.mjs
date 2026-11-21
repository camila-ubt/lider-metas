import { estimarChancesHistoricas, reconstruirMeses } from "./probabilidadesHistoricas.mjs";

const NIVEIS = [["meta", 1], ["super", 1.1], ["mega", 1.2]];
const arredondar = (p) => Math.max(5, Math.min(95, Math.round(p / 5) * 5));
const mesChave = (ano, mes) => String(ano) + "-" + String(mes).padStart(2, "0");
const slot = (loja, periodo) => String(loja) + "|" + periodo;

// Cada mês encerrado fornece uma observação independente por nível.
// Usa o mesmo ponto percentual do calendário, sem olhar vendas após o corte.
export function avaliarCalibracaoProbabilidades({
  vendasHistoricas = [], metasHistoricas = [], lojas = [],
  ano, numeroMes, diaLimite, filtroLoja = "geral",
  filtroPeriodo = "todos", probabilidades = null, minimoVizinhos = 8,
}) {
  const indisponivel = {
    status: "sem_amostra", probabilidades, totalMeses: 0,
    niveis: {}, observacoes: [],
  };
  if (!probabilidades || !Number.isInteger(ano) ||
      !Number.isInteger(numeroMes) || !Number.isFinite(diaLimite)) {
    return indisponivel;
  }
  const escolhidas = lojas.filter((loja) => filtroLoja === "geral" ||
    String(loja.id) === String(filtroLoja));
  const periodos = filtroPeriodo === "todos" ? ["manha", "noite"] : [filtroPeriodo];
  const slots = escolhidas.flatMap((loja) =>
    periodos.map((periodo) => slot(loja.id, periodo)));
  if (!slots.length || periodos.some((periodo) =>
    !["manha", "noite"].includes(periodo))) return indisponivel;

  const mesAtual = mesChave(ano, numeroMes);
  const meses = reconstruirMeses({
    vendas: vendasHistoricas, metas: metasHistoricas,
    slots, anoLimite: mesAtual,
  }).filter((item) => item.chave >= mesChave(ano - 2, 1));
  const diasAtual = new Date(ano, numeroMes, 0).getDate();
  const proporcao = diaLimite / diasAtual;
  const observacoes = [];
  const mesesUsados = new Set();

  for (const mes of meses) {
    const corte = Math.max(3, Math.min(mes.dias.length - 1,
      Math.round(proporcao * mes.dias.length)));
    if (corte >= mes.dias.length) continue;

    const vendasNoCorte = vendasHistoricas.filter((venda) =>
      String(venda.data || "").startsWith(mes.chave + "-") &&
      Number(String(venda.data).slice(8, 10)) <= corte);
    const metasDoMes = metasHistoricas.filter((meta) =>
      String(meta.mes || "").slice(0, 7) === mes.chave);
    const previsto = estimarChancesHistoricas({
      vendas: vendasNoCorte, metas: metasDoMes,
      vendasHistoricas, metasHistoricas, lojas,
      ano: mes.ano, numeroMes: mes.mes, diaLimite: corte,
      filtroLoja, filtroPeriodo,
    });
    if (previsto.status !== "ok") continue;
    mesesUsados.add(mes.chave);
    for (const [nivel, fator] of NIVEIS) {
      const p = previsto.probabilidades[nivel];
      if (p === 100 || p === 0) continue;
      observacoes.push({
        mes: mes.chave, nivel, previsto: p,
        realizado: Number(mes.realizado >= mes.meta * fator),
      });
    }
  }

  const calib = { ...probabilidades };
  const niveis = {};
  for (const [nivel] of NIVEIS) {
    const p = probabilidades[nivel];
    const casos = observacoes.filter((item) => item.nivel === nivel);
    const semelhantes = casos.filter((item) => Math.abs(item.previsto - p) <= 15);
    const ocorrencias = semelhantes.reduce((s, item) => s + item.realizado, 0);
    const brier = casos.length
      ? casos.reduce((s, item) =>
        s + (item.previsto / 100 - item.realizado) ** 2, 0) / casos.length
      : null;
    const valido = p > 0 && p < 100 &&
      new Set(semelhantes.map((item) => item.mes)).size >= minimoVizinhos;
    const calibrado = valido
      ? arredondar((8 * p + 100 * ocorrencias) / (8 + semelhantes.length))
      : p;
    calib[nivel] = calibrado;
    niveis[nivel] = {
      casos: casos.length, semelhantes: semelhantes.length,
      ocorrencias, frequencia: semelhantes.length
        ? 100 * ocorrencias / semelhantes.length : null,
      mediaEstimada: semelhantes.length
        ? semelhantes.reduce((s, item) => s + item.previsto, 0) /
          semelhantes.length : null,
      brier, validado: valido, ajustado: calibrado !== p,
    };
  }

  // Meta >= Super >= Mega mesmo quando cada nível é calibrado separadamente.
  calib.super = Math.min(calib.super, calib.meta);
  calib.mega = Math.min(calib.mega, calib.super);

  return {
    status: Object.values(niveis).some((item) => item.validado)
      ? "calibracao_parcial" : "amostra_insuficiente",
    probabilidades: calib, niveis,
    totalMeses: mesesUsados.size, observacoes,
  };
}
