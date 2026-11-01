export function contextoDoMes(valorMes, referencia = new Date()) {
  const [ano, numeroMes] = String(valorMes || "").split("-").map(Number);

  if (!ano || !numeroMes) {
    return {
      tipo: "invalido",
      ano: 0,
      numeroMes: 0,
      ultimoDia: 0,
      diaCorte: 0,
      diasRestantes: 0,
    };
  }

  const hoje = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
  );
  const inicio = new Date(ano, numeroMes - 1, 1);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  const fim = new Date(ano, numeroMes - 1, ultimoDia);

  let tipo = "andamento";
  if (hoje < inicio) tipo = "futuro";
  else if (hoje > fim) tipo = "encerrado";
  else if (hoje.getTime() === fim.getTime()) tipo = "ultimo-dia";

  const diaCorte =
    tipo === "futuro"
      ? 0
      : tipo === "encerrado"
        ? ultimoDia
        : Math.min(hoje.getDate(), ultimoDia);

  return {
    tipo,
    ano,
    numeroMes,
    ultimoDia,
    diaCorte,
    diasRestantes: Math.max(ultimoDia - diaCorte, 0),
  };
}

export function nivelDoResultado(vendido, meta) {
  if (!(meta > 0)) return "Sem meta cadastrada";
  if (vendido >= meta * 1.2) return "Megameta";
  if (vendido >= meta * 1.1) return "Supermeta";
  if (vendido >= meta) return "Meta";
  return "Abaixo da Meta";
}

export function percentualDoResultado(vendido, meta) {
  return meta > 0 ? (vendido / meta) * 100 : null;
}

export function proximoNivel(vendido, meta) {
  if (!(meta > 0)) return null;
  const niveis = [
    { nome: "Meta", valor: meta },
    { nome: "Supermeta", valor: meta * 1.1 },
    { nome: "Megameta", valor: meta * 1.2 },
  ];
  return niveis.find((nivel) => vendido < nivel.valor) || null;
}

// Progresso matemático: o valor vendido é proporcional à Megameta mensal.
// A largura para em 100%, mas o excedente real continua disponível.
export function calcularProgressoMegameta(vendido, meta) {
  const base = Number(meta);
  const realizado = Number(vendido);
  if (!(base > 0) || !Number.isFinite(base) || !Number.isFinite(realizado)) {
    return null;
  }

  const alvo = base * 1.2;
  const percentualReal = Math.max(0, (realizado / alvo) * 100);
  const percentualBarra = Math.min(100, percentualReal);
  return {
    alvo,
    percentual: percentualReal,
    percentualBarra: Math.min(100, Math.max(0, percentualBarra)),
    falta: Math.max(alvo - realizado, 0),
    excedente: Math.max(realizado - alvo, 0),
  };
}

// Valor necessário por loja e por dia para alcançar o próximo nível.
// Com turnos restantes, distribui o saldo pelo futuro; após o último
// turno, calcula quanto teria faltado por loja/dia ao longo do mês.
export function calcularValorPorLojaDia({ falta, quantidadeLojas, turnosRestantes, diasMes }) {
  const saldo = Number(falta);
  const lojas = Number(quantidadeLojas);
  const restantes = Number(turnosRestantes);
  const dias = Number(diasMes);
  if (!Number.isFinite(saldo) || !(saldo > 0) ||
      !Number.isInteger(lojas) || !(lojas > 0)) {
    return null;
  }

  const retrospectivo = !Number.isFinite(restantes) || restantes <= 0;
  const divisorDias = retrospectivo ? dias : restantes;
  if (!Number.isInteger(divisorDias) || !(divisorDias > 0)) return null;

  // Arredonda para cima no centavo: o valor exibido é suficiente para bater o alvo.
  const valor = Math.ceil((saldo / (lojas * divisorDias) - 1e-9) * 100) / 100;
  return { valor, retrospectivo };
}

export function fraseSemBase(contexto, temMeta, temVendas) {
  if (contexto === "futuro") {
    return temMeta
      ? "O mês ainda não começou. As metas já estão definidas e a análise será iniciada com os primeiros lançamentos."
      : "O mês ainda não começou e as metas ainda não foram cadastradas. Este é o momento de planejar os objetivos.";
  }

  if (!temMeta) {
    return contexto === "encerrado"
      ? "O mês foi encerrado sem metas cadastradas. O faturamento pode ser analisado, mas não é possível avaliar o atingimento."
      : "O mês está em andamento, mas as metas ainda não foram cadastradas. Cadastre-as para acompanhar o progresso.";
  }

  if (!temVendas) {
    return contexto === "encerrado"
      ? "O mês foi encerrado sem lançamentos de venda."
      : "O mês já começou e aguarda os primeiros lançamentos para formar a análise.";
  }

  return "A base estatística ainda está sendo formada. Os indicadores ficarão mais confiáveis conforme novos dias forem lançados.";
}
