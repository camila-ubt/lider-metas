export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PERIODOS = ["manha", "noite"];

function chave(lojaId, mes, periodo) {
  return String(lojaId) + ":" + String(mes) + ":" + periodo;
}

// Consolida vendas e metas usando exatamente as lojas e os períodos filtrados.
// Um mês sem lançamento é uma lacuna, não faturamento zero presumido.
export function resumirSerieAnual({ ano, lojasIds, periodo = "todos", vendas = [], metas = [], hoje = new Date() }) {
  const lojas = (lojasIds || []).map(String);
  const ids = new Set(lojas);
  const periodos = periodo === "todos" ? PERIODOS : PERIODOS.filter((p) => p === periodo);
  const vendasPorMes = new Map();
  const metasPorSlot = new Map();

  for (const venda of vendas) {
    const dataRegistro = String(venda.data ?? "").slice(0, 10);
    const mes = Number(dataRegistro.slice(5, 7));
    if (!ids.has(String(venda.loja_id)) || !periodos.includes(venda.periodo) || mes < 1 || mes > 12) continue;
    const atual = vendasPorMes.get(mes) || { vendido: 0, registros: 0, ultimaDataRegistro: null };
    atual.vendido += Number(venda.valor_vendido || 0);
    atual.registros += 1;
    // Data da venda, não o horário de inclusão no sistema.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataRegistro) &&
        dataRegistro.slice(0, 4) === String(ano) &&
        (!atual.ultimaDataRegistro || dataRegistro > atual.ultimaDataRegistro)) {
      atual.ultimaDataRegistro = dataRegistro;
    }
    vendasPorMes.set(mes, atual);
  }

  for (const registro of metas) {
    const mes = Number(String(registro.mes).slice(5, 7));
    const valor = Number(registro.valor_meta);
    if (!ids.has(String(registro.loja_id)) || !periodos.includes(registro.periodo) ||
        mes < 1 || mes > 12 || !Number.isFinite(valor) || valor <= 0) continue;
    metasPorSlot.set(chave(registro.loja_id, mes, registro.periodo), valor);
  }

  return MESES_CURTOS.map((nome, indice) => {
    const mes = indice + 1;
    const futuro = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth() + 1);
    const parcial = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
    const observacao = vendasPorMes.get(mes);
    const temDados = !futuro && Boolean(observacao?.registros);
    const chavesEsperadas = lojas.flatMap((id) => periodos.map((p) => chave(id, mes, p)));
    const temMeta = !futuro && chavesEsperadas.length > 0 && chavesEsperadas.every((id) => metasPorSlot.has(id));
    const meta = temMeta ? chavesEsperadas.reduce((acc, id) => acc + metasPorSlot.get(id), 0) : null;
    const vendido = temDados ? observacao.vendido : null;

    return {
      mes,
      nome,
      parcial,
      temDados,
      vendido,
      meta,
      ultimaDataRegistro: temDados ? observacao.ultimaDataRegistro : null,
      percentual: temDados && meta > 0 ? (vendido / meta) * 100 : null,
    };
  });
}

export function montarComparativo(seriesPorAno, anos, modo = "acumulado") {
  const series = {};
  for (const ano of anos) {
    const valores = seriesPorAno[ano] || [];
    let acumulado = 0;
    series[ano] = valores.map((item) => {
      if (!item?.temDados) return null;
      acumulado += item.vendido;
      if (modo === "meta") return item.percentual;
      if (modo === "mensal") return item.vendido;
      return acumulado;
    });
  }
  return MESES_CURTOS.map((nome, i) => {
    const linha = { mes: nome };
    for (const ano of anos) linha[String(ano)] = series[ano][i] ?? null;
    return linha;
  });
}

// Compara somente os mesmos meses fechados, registrados em ambos os anos.
export function compararAnosEquivalentes(anoAtual, anoAnterior) {
  const meses = (anoAtual || []).filter((registro, i) =>
    registro.temDados && !registro.parcial && anoAnterior?.[i]?.temDados
  );
  const anterior = meses.reduce((soma, item) => soma + (anoAnterior[item.mes - 1]?.vendido || 0), 0);
  const atual = meses.reduce((soma, item) => soma + (item.vendido || 0), 0);
  return {
    meses: meses.length,
    atual,
    anterior,
    percentual: anterior > 0 && meses.length ? ((atual / anterior) - 1) * 100 : null,
  };
}

// Resultado de um mês isolado: nunca compara mês parcial com um mês fechado.
export function detalharMesEvolucao(serieAtual, serieAnterior, mes) {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  const atual = serieAtual?.[mes - 1];
  if (!atual) return null;

  const temVendas = Boolean(atual.temDados && Number.isFinite(atual.vendido));
  const metaValida = Number.isFinite(atual.meta) && atual.meta > 0;
  const anterior = serieAnterior?.[mes - 1];
  const temAnterior = Boolean(anterior?.temDados && Number.isFinite(anterior.vendido));
  const comparavel = temVendas && !atual.parcial && temAnterior && anterior.vendido > 0;

  return {
    ...atual,
    diferencaMeta: temVendas && metaValida
      ? Math.round((atual.vendido - atual.meta) * 100) / 100
      : null,
    vendidoAnterior: temAnterior ? anterior.vendido : null,
    diferencaAnterior: comparavel
      ? Math.round((atual.vendido - anterior.vendido) * 100) / 100
      : null,
    variacaoAnterior: comparavel ? (atual.vendido / anterior.vendido - 1) * 100 : null,
  };
}

export function anosHistoricosDisponiveis(ano, primeiroAno = 2024) {
  return Array.from({ length: Math.max(0, ano - primeiroAno) }, (_, i) => ano - i - 1);
}

// Mantém no máximo dois anos anteriores, sempre em ordem decrescente.
// O ano principal é exibido separadamente e não pode ser desmarcado.
export function alternarAnoHistorico(anosAtuais, anoAlternado, anoPrincipal, limite = 2) {
  const disponiveis = anosHistoricosDisponiveis(anoPrincipal);
  const atuais = disponiveis.filter((ano) => anosAtuais.includes(ano));
  if (!disponiveis.includes(anoAlternado)) return atuais;
  if (atuais.includes(anoAlternado)) return atuais.filter((ano) => ano !== anoAlternado);
  if (atuais.length >= limite) return atuais;
  return disponiveis.filter((ano) => atuais.includes(ano) || ano === anoAlternado);
}


/**
 * Mensagem gerencial da meta do mês.
 * Enquanto o mês está em andamento, usa o presente; após o encerramento, passado.
 * Não presume vendas nem metas para períodos sem registros.
 */
export function situacaoMetaMensal(detalhe) {
  if (!detalhe?.temDados || !Number.isFinite(detalhe.vendido)) {
    return { titulo: "Sem vendas registradas", valor: null, complemento: "", tom: "neutro" };
  }
  if (!Number.isFinite(detalhe.meta) || detalhe.meta <= 0) {
    return { titulo: "Meta indisponível", valor: null, complemento: "", tom: "neutro" };
  }

  const diferenca = Math.round((detalhe.vendido - detalhe.meta) * 100) / 100;
  if (diferenca < 0) {
    return {
      titulo: detalhe.parcial ? "Ainda falta" : "Faltou",
      valor: -diferenca,
      complemento: "para atingir a meta",
      tom: "negativo",
    };
  }
  if (diferenca > 0) {
    return {
      titulo: detalhe.parcial ? "Meta já superada em" : "Meta superada em",
      valor: diferenca,
      complemento: "",
      tom: "positivo",
    };
  }
  return {
    titulo: detalhe.parcial ? "Meta já atingida" : "Meta atingida",
    valor: null,
    complemento: "",
    tom: "positivo",
  };
}
