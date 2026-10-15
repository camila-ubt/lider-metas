// Projeção compartilhada entre o Painel e o Roteiro da Reunião.
// Somente turnos encerrados, com lançamentos de todas as lojas, compõem a média.
export function calcularProjecaoTurno({
  vendas = [],
  lojas = [],
  periodo,
  lojaId = null,
  contexto,
  minutosAgora,
  fimTurno,
}) {
  const ids = new Set(
    lojas
      .filter((loja) => lojaId === null || Number(loja.id) === Number(lojaId))
      .map((loja) => String(loja.id)),
  );
  const prefixoMes = `${contexto.ano}-${String(contexto.numeroMes).padStart(2, "0")}-`;
  const atuais = vendas.filter(
    (venda) =>
      venda.periodo === periodo &&
      ids.has(String(venda.loja_id)) &&
      String(venda.data).startsWith(prefixoMes) &&
      Number(String(venda.data).slice(8, 10)) <= contexto.diaCorte,
  );
  const vendido = atuais.reduce(
    (total, venda) => total + Number(venda.valor_vendido || 0),
    0,
  );

  if (contexto.tipo === "encerrado") {
    return { valor: vendido, media: null, diasBase: 0 };
  }
  if (contexto.tipo === "futuro" || ids.size === 0) {
    return { valor: null, media: null, diasBase: 0 };
  }

  const abertoHoje = minutosAgora < fimTurno;
  const ultimoDiaCompleto = Math.max(contexto.diaCorte - (abertoHoje ? 1 : 0), 0);
  if (ultimoDiaCompleto < 3) {
    return { valor: null, media: null, diasBase: ultimoDiaCompleto };
  }

  const dias = new Map();
  for (const venda of atuais) {
    const numeroDia = Number(String(venda.data).slice(8, 10));
    if (numeroDia > ultimoDiaCompleto) continue;
    if (!dias.has(numeroDia)) dias.set(numeroDia, { lojas: new Set(), total: 0 });
    const dia = dias.get(numeroDia);
    dia.lojas.add(String(venda.loja_id));
    dia.total += Number(venda.valor_vendido || 0);
  }

  // Sem extrapolação de períodos ausentes ou parcialmente preenchidos.
  if (
    dias.size !== ultimoDiaCompleto ||
    [...dias.values()].some((dia) => dia.lojas.size !== ids.size)
  ) {
    return { valor: null, media: null, diasBase: 0 };
  }

  const media = [...dias.values()].reduce((total, dia) => total + dia.total, 0) / ultimoDiaCompleto;
  const parcialHoje = abertoHoje
    ? atuais
        .filter((venda) => Number(String(venda.data).slice(8, 10)) === contexto.diaCorte)
        .reduce((total, venda) => total + Number(venda.valor_vendido || 0), 0)
    : 0;
  const diasDepoisHoje = Math.max(contexto.ultimoDia - contexto.diaCorte, 0);
  return {
    valor: vendido + media * diasDepoisHoje + (abertoHoje ? Math.max(media - parcialHoje, 0) : 0),
    media,
    diasBase: ultimoDiaCompleto,
  };
}

export function somarProjecoes(...valores) {
  return valores.some((valor) => valor === null || !Number.isFinite(valor))
    ? null
    : valores.reduce((total, valor) => total + valor, 0);
}
