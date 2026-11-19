// Converte o índice de interação do Recharts no dia do registro correspondente.
// O activeLabel pode não corresponder à bolinha tocada, por isso não é usado.
export function obterDiaPeloIndiceGrafico(estado, dados) {
  const indiceBruto = estado?.activeTooltipIndex ?? estado?.activeIndex;
  if (typeof indiceBruto !== "number" && typeof indiceBruto !== "string") return null;
  if (typeof indiceBruto === "string" && indiceBruto.trim() === "") return null;
  const indice = Number(indiceBruto);
  if (!Number.isInteger(indice) || indice < 0 || indice >= dados.length) return null;
  const dia = Number(dados[indice]?.dia);
  return Number.isInteger(dia) && dia > 0 ? dia : null;
}
