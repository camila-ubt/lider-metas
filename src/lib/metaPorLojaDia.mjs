// Saldo por loja/dia para o próximo nível da jornada (Meta, Supermeta ou Megameta).
export function calcularMetaPorLojaDia({ jornada, vendido, diasRestantes, quantidadeLojas }) {
  if (!jornada || jornada.semMeta || jornada.completa) return null;

  const alvo = Number(jornada.alvo?.valor);
  if (!(alvo > 0) || !(Number(quantidadeLojas) > 0)) return null;

  const saldo = Math.max(alvo - Number(vendido || 0), 0);
  if (!saldo) return 0;
  if (!(Number(diasRestantes) > 0)) return null;

  return saldo / (Number(diasRestantes) * Number(quantidadeLojas));
}

// Variação da meta diária ajustada versus a meta fixa do MESMO nível.
// Sem alvo ou sem saldo válido, não exibe indicador.
export function calcularVariacaoMetaPorLojaDia({ metaAtual, jornada, totalDias, quantidadeLojas }) {
  const alvo = Number(jornada?.alvo?.valor);
  const dias = Number(totalDias);
  const lojas = Number(quantidadeLojas);
  if (metaAtual === null || metaAtual === undefined || !Number.isFinite(metaAtual) ||
      !jornada || jornada.semMeta || jornada.completa ||
      !(alvo > 0) || !(dias > 0) || !(lojas > 0)) return null;

  const metaFixaPorLojaDia = alvo / (dias * lojas);
  return Number((((metaAtual / metaFixaPorLojaDia) - 1) * 100).toFixed(1));
}
