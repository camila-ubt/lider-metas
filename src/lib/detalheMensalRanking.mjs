// Diferença financeira em relação à meta configurada, sem arredondar valores intermediários.
export function compararVendidoComMeta(vendido, meta, configurada = true) {
  const realizado = Number(vendido);
  const previsto = Number(meta);

  if (!configurada || !Number.isFinite(realizado) || !Number.isFinite(previsto) || previsto <= 0) {
    return { situacao: "semMeta", diferenca: null, percentual: null };
  }

  const diferenca = Math.round((realizado - previsto) * 100) / 100;
  const situacao = diferenca > 0 ? "acima" : diferenca < 0 ? "abaixo" : "atingida";

  return { situacao, diferenca, percentual: realizado / previsto * 100 };
}
