// Compara as médias apenas quando há amostras suficientes de dias distintos.
export function extremosDiasSemana(diasCompletos, nomesSemana) {
  const valoresPorDia = new Map();

  for (const [data, registro] of diasCompletos) {
    const dataLocal = new Date(`${data}T12:00:00`);
    if (Number.isNaN(dataLocal.getTime())) continue;
    const indice = dataLocal.getDay();
    if (!valoresPorDia.has(indice)) valoresPorDia.set(indice, []);
    valoresPorDia.get(indice).push(Number(registro.total || 0));
  }

  const medias = Array.from(valoresPorDia, ([indice, valores]) => ({
    nome: nomesSemana[indice],
    media: valores.reduce((soma, valor) => soma + valor, 0) / valores.length,
    quantidade: valores.length,
  }))
    .filter((dia) => dia.quantidade >= 2)
    .sort((a, b) => b.media - a.media);

  if (medias.length < 2) {
    return { diaForte: null, diaFraco: null, situacao: "amostra" };
  }

  const diaForte = medias[0];
  const diaFraco = medias.at(-1);
  if (Math.round(diaForte.media * 100) === Math.round(diaFraco.media * 100)) {
    return { diaForte: null, diaFraco: null, situacao: "empate" };
  }

  return { diaForte, diaFraco, situacao: null };
}
