import { calcularTurnosRestantes } from "./projecaoTurnos.mjs";

const PERIODOS = ["manha", "noite"];

function idCombinacao(lojaId, periodo) {
  return String(lojaId) + "|" + periodo;
}

/**
 * Encontra um único ponto de atenção entre todas as lojas e períodos.
 * A meta esperada é proporcional aos dias encerrados com lançamentos completos,
 * sem confundir um registro ausente com uma venda de valor zero.
 */
export function encontrarPeriodoMaisAtrasado({
  lojas = [],
  metas = [],
  vendas = [],
  contexto,
  minutosAgora = 0,
  fimManha = 960,
  fimNoite = 1320,
}) {
  if (!contexto || ["futuro", "invalido"].includes(contexto.tipo)) {
    return { status: "sem-dados" };
  }

  const ultimoDia = Number(contexto.ultimoDia) || 0;
  if (!ultimoDia || !lojas.length) return { status: "sem-dados" };

  const combinacoes = lojas.flatMap((loja) =>
    PERIODOS.map((periodo) => ({ loja, periodo, chave: idCombinacao(loja.id, periodo) })),
  );
  const metasPorCombinacao = new Map();
  for (const meta of metas) {
    const valor = Number(meta.valor_meta);
    if (!Number.isFinite(valor)) continue;
    const chave = idCombinacao(meta.loja_id, meta.periodo);
    metasPorCombinacao.set(chave, (metasPorCombinacao.get(chave) || 0) + Math.round(valor * 100));
  }
  if (combinacoes.some((item) => !(metasPorCombinacao.get(item.chave) > 0))) {
    return { status: "sem-metas" };
  }

  const prefixo = String(contexto.ano) + "-" + String(contexto.numeroMes).padStart(2, "0") + "-";
  const vendasPorData = new Map();
  for (const venda of vendas) {
    const data = String(venda.data || "");
    const dia = Number(data.slice(8, 10));
    const valor = Number(venda.valor_vendido);
    if (data.length !== 10 || !data.startsWith(prefixo) ||
        !(dia >= 1 && dia <= ultimoDia) || !Number.isFinite(valor)) continue;
    const chave = idCombinacao(venda.loja_id, venda.periodo);
    if (!vendasPorData.has(dia)) vendasPorData.set(dia, new Map());
    const registros = vendasPorData.get(dia);
    registros.set(chave, (registros.get(chave) || 0) + Math.round(valor * 100));
  }

  const resultados = [];
  for (const periodo of PERIODOS) {
    const fimPeriodo = periodo === "manha" ? fimManha : fimNoite;
    const limite = contexto.tipo === "encerrado"
      ? ultimoDia
      : Math.max(0, (contexto.diaCorte || 0) - (minutosAgora < fimPeriodo ? 1 : 0));
    const periodosRestantes = calcularTurnosRestantes({
      contexto, minutosAgora, fimTurno: fimPeriodo,
    });
    const chaves = combinacoes.filter((item) => item.periodo === periodo);
    const diasCompletos = [];

    for (let dia = 1; dia <= limite; dia += 1) {
      const registros = vendasPorData.get(dia);
      if (registros && chaves.every((item) => registros.has(item.chave))) {
        diasCompletos.push({ dia, registros });
      }
    }

    if (!diasCompletos.length) continue;

    for (const item of chaves) {
      const metaCentavos = metasPorCombinacao.get(item.chave);
      const esperadoCentavos = Math.round(metaCentavos * diasCompletos.length / ultimoDia);
      const vendidoCentavos = diasCompletos.reduce(
        (total, dia) => total + dia.registros.get(item.chave), 0,
      );
      const atrasoCentavos = Math.max(0, esperadoCentavos - vendidoCentavos);
      const projecaoCentavos = Math.round(vendidoCentavos * ultimoDia / diasCompletos.length);
      const faltaProjetadaCentavos = Math.max(0, metaCentavos - projecaoCentavos);
      const adicionalPorPeriodoRestante = periodosRestantes > 0 && faltaProjetadaCentavos > 0
        ? Math.ceil(faltaProjetadaCentavos / periodosRestantes) / 100
        : null;
      resultados.push({
        loja: item.loja,
        periodo,
        dia: diasCompletos[diasCompletos.length - 1].dia,
        mes: contexto.numeroMes,
        diasAnalisados: diasCompletos.length,
        esperado: esperadoCentavos / 100,
        vendido: vendidoCentavos / 100,
        atraso: atrasoCentavos / 100,
        atrasoPercentual: esperadoCentavos > 0 ? (atrasoCentavos / esperadoCentavos) * 100 : 0,
        projecao: projecaoCentavos / 100,
        percentualProjetado: (projecaoCentavos / metaCentavos) * 100,
        faltaProjetada: faltaProjetadaCentavos / 100,
        periodosRestantes,
        adicionalPorPeriodoRestante,
      });
    }
  }

  if (!resultados.length) return { status: "sem-lancamentos" };

  const atrasados = resultados.filter((item) => item.atraso > 0).sort(
    (a, b) => b.atrasoPercentual - a.atrasoPercentual || b.atraso - a.atraso,
  );
  return atrasados.length
    ? { status: "atrasado", ...atrasados[0] }
    : { status: "em-dia" };
}
