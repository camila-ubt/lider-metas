const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function somarMetaMensal(metas, lojaId, periodo) {
  return (metas || [])
    .filter(
      (item) =>
        Number(item.loja_id) === Number(lojaId) &&
        item.periodo === periodo,
    )
    .reduce((total, item) => total + Number(item.valor_meta || 0), 0);
}

function valorDiario(valorMensal, totalDias, fator = 1) {
  if (!(totalDias > 0)) return 0;
  return Math.floor((Number(valorMensal || 0) * fator) / totalDias);
}

function linha(sigla, valorMensal, totalDias) {
  return {
    sigla,
    meta: valorDiario(valorMensal, totalDias),
    super: valorDiario(valorMensal, totalDias, 1.1),
    mega: valorDiario(valorMensal, totalDias, 1.2),
  };
}

export function calcularMetasDiariasLoja({ metas, lojaId, totalDias }) {
  const manha = somarMetaMensal(metas, lojaId, "manha");
  const noite = somarMetaMensal(metas, lojaId, "noite");

  return [
    linha("M", manha, totalDias),
    linha("N", noite, totalDias),
    linha("T", manha + noite, totalDias),
  ];
}

export function formatarMesAno(valorMes) {
  const [ano, numeroMes] = String(valorMes || "").split("-").map(Number);
  if (!ano || !numeroMes || !NOMES_MESES[numeroMes - 1]) return String(valorMes || "");
  return `${NOMES_MESES[numeroMes - 1]}/${String(ano).slice(-2)}`;
}
