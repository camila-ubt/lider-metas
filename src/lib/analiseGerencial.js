export const PERIODOS = ["manha", "noite"];

export function somar(lista, campo = "valor_vendido") {
  return lista.reduce(
    (total, item) => total + Number(item?.[campo] || 0),
    0
  );
}

export function diaDaData(data) {
  return Number(String(data || "").slice(8, 10));
}

export function anoDaData(data) {
  return Number(String(data || "").slice(0, 4));
}

export function intervaloMes(ano, mes) {
  const mesTexto = String(mes).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${mesTexto}-01`,
    fim: `${ano}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
    ultimoDia,
  };
}

export function media(valores) {
  if (!valores.length) return 0;
  return valores.reduce((total, valor) => total + Number(valor || 0), 0) / valores.length;
}

export function desvioPadrao(valores) {
  if (valores.length < 2) return 0;
  const valorMedio = media(valores);
  const variancia =
    valores.reduce(
      (total, valor) => total + (Number(valor || 0) - valorMedio) ** 2,
      0
    ) /
    (valores.length - 1);
  return Math.sqrt(Math.max(variancia, 0));
}

export function coeficienteVariacao(valores) {
  const valorMedio = media(valores);
  if (!(valorMedio > 0) || valores.length < 2) return null;
  return (desvioPadrao(valores) / valorMedio) * 100;
}

export function regressaoLinear(valores) {
  const lista = valores.map(Number).filter(Number.isFinite);
  const n = lista.length;
  if (n < 2) return { inclinacao: 0, intercepto: lista[0] || 0, r2: 0 };

  const mediaX = (n + 1) / 2;
  const mediaY = media(lista);
  let numerador = 0;
  let denominador = 0;

  lista.forEach((valor, indice) => {
    const x = indice + 1;
    numerador += (x - mediaX) * (valor - mediaY);
    denominador += (x - mediaX) ** 2;
  });

  const inclinacao = denominador > 0 ? numerador / denominador : 0;
  const intercepto = mediaY - inclinacao * mediaX;
  const previstos = lista.map((_, indice) => intercepto + inclinacao * (indice + 1));
  const somaTotal = lista.reduce((total, valor) => total + (valor - mediaY) ** 2, 0);
  const somaErros = lista.reduce(
    (total, valor, indice) => total + (valor - previstos[indice]) ** 2,
    0
  );
  const r2 = somaTotal > 0 ? Math.max(0, Math.min(1 - somaErros / somaTotal, 1)) : 0;

  return { inclinacao, intercepto, r2 };
}

export function caminhoGrafico(valores, maximo, largura = 700, altura = 250, margem = 34) {
  const areaLargura = largura - margem * 2;
  const areaAltura = altura - margem * 2;
  let iniciou = false;

  return valores
    .map((valor, indice) => {
      if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
        return "";
      }
      const x = margem + (indice / Math.max(valores.length - 1, 1)) * areaLargura;
      const y = altura - margem - (Number(valor) / Math.max(maximo, 1)) * areaAltura;
      const comando = iniciou ? "L" : "M";
      iniciou = true;
      return `${comando} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}

export function acumuladoPorDia(vendas, totalDias, diaLimite = totalDias) {
  const diarios = Array.from({ length: totalDias }, () => 0);
  vendas.forEach((venda) => {
    const dia = diaDaData(venda.data);
    if (dia >= 1 && dia <= totalDias && dia <= diaLimite) {
      diarios[dia - 1] += Number(venda.valor_vendido || 0);
    }
  });

  let total = 0;
  return diarios.map((valor, indice) => {
    if (indice + 1 > diaLimite) return null;
    total += valor;
    return total;
  });
}

export function textoTendencia(inclinacao, mediaDiaria) {
  const referencia = Math.max(Math.abs(mediaDiaria), 1);
  const proporcao = Math.abs(inclinacao) / referencia;
  if (proporcao < 0.02) return "estável";
  return inclinacao > 0 ? "de alta" : "de queda";
}
