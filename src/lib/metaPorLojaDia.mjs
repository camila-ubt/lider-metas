// Meta fixa por loja e por dia restante; não confundir com o saldo mensal.
export function calcularMetaPorLojaDia({ meta, vendido, diasRestantes, quantidadeLojas }) {
  if (!(Number(meta) > 0) || !(Number(quantidadeLojas) > 0)) return null;

  const saldo = Math.max(Number(meta) - Number(vendido || 0), 0);
  if (!saldo) return 0;
  if (!(Number(diasRestantes) > 0)) return null;

  return saldo / (Number(diasRestantes) * Number(quantidadeLojas));
}
