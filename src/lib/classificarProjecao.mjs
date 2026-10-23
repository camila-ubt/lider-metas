// Classifica o fechamento previsto pelos mesmos limites do Painel:
// Meta = 100%, Supermeta = 110%, Megameta = 120%.
export function classificarProjecao(valor, meta) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
    return { rotulo: "Sem projeção", tom: "neutro" };
  }
  if (!(Number(meta) > 0)) {
    return { rotulo: "Sem meta", tom: "neutro" };
  }

  const previsto = Number(valor);
  const alvo = Number(meta);

  if (previsto >= alvo * 1.2) return { rotulo: "Megameta", tom: "mega" };
  if (previsto >= alvo * 1.1) return { rotulo: "Supermeta", tom: "super" };
  if (previsto >= alvo) return { rotulo: "Meta", tom: "meta" };
  return { rotulo: "Abaixo da Meta", tom: "abaixo" };
}
