const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function descreverSituacaoNivel({
  alvo,
  vendido,
  encerrado = false,
  diasRestantes = 0,
  quantidadeLojas = 0,
}) {
  const meta = Number(alvo);
  const realizado = Number(vendido);

  if (!(meta > 0)) {
    return { atingida: false, texto: "Sem meta", porLojaDia: null };
  }
  if (realizado >= meta) {
    return { atingida: true, texto: encerrado ? "Conquistada" : "Batida", porLojaDia: null };
  }

  const falta = Math.max(meta - realizado, 0);
  if (encerrado) {
    return { atingida: false, texto: `Faltaram ${dinheiro.format(falta)}`, porLojaDia: null };
  }

  const mediaDia = diasRestantes > 0 ? falta / diasRestantes : null;
  const texto = `Faltam ${dinheiro.format(falta)}` +
    (mediaDia === null ? "" : ` · ${dinheiro.format(mediaDia)}/dia`);
  const porLojaDia = mediaDia !== null && quantidadeLojas > 0
    ? `${dinheiro.format(mediaDia / quantidadeLojas)}/loja/dia`
    : null;

  return { atingida: false, texto, porLojaDia };
}
