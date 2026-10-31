const NIVEIS_CONCLUIDOS = new Set(["abaixo", "meta", "super", "mega"]);
const NIVEIS_ATINGIDOS = new Set(["meta", "super", "mega"]);

// Exclui meses em andamento, futuros e sem meta do denominador.
export function resumirResultadosMensais(resultados) {
  const validos = resultados.filter((resultado) =>
    NIVEIS_CONCLUIDOS.has(resultado.nivel) && Number.isFinite(resultado.percentual)
  );
  const batidos = validos.filter((resultado) => NIVEIS_ATINGIDOS.has(resultado.nivel)).length;
  const ordenados = [...validos].sort((a, b) => a.percentual - b.percentual);

  return {
    meses: validos.length,
    batidos,
    taxa: validos.length ? batidos / validos.length : -1,
    melhor: ordenados.at(-1) || null,
    pior: ordenados[0] || null,
  };
}
