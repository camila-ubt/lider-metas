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
