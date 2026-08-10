import {
  responderPerguntaMetas as responderBase,
  sugestoesPerguntas,
} from "@/lib/assistenteMetas";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mensagensUsuario(historico = []) {
  return historico
    .filter((item) => item.papel === "usuario")
    .map((item) => item.conteudo)
    .filter(Boolean);
}

function contextoUsuario(pergunta, historico = [], limite = 5) {
  return [...mensagensUsuario(historico).slice(-limite), pergunta]
    .map(normalizar)
    .filter(Boolean)
    .join(" ");
}

function ehPedidoDeAcao(pergunta) {
  const q = normalizar(pergunta);
  return /o que fazer|como melhorar|melhorar (esses|estes|os) numeros|que acao|quais acoes|plano de acao|estrategia|o que voce recomenda|o que recomenda|o que sugere|como reverter|como aumentar|como recuperar/.test(q);
}

function aliasesLoja(loja) {
  const codigo = normalizar(loja.codigo);
  const nome = normalizar(loja.nome);
  const ignorar = new Set(["loja", "acessorios", "acessorio", "bijoux", "biju", "bijuterias"]);
  return [...new Set([
    codigo,
    nome,
    ...nome.split(" ").filter((item) => item.length >= 3 && !ignorar.has(item)),
  ].filter(Boolean))];
}

function lojasNoTexto(lojas, texto) {
  const q = normalizar(texto);
  const tokens = new Set(q.split(" "));
  return lojas.filter((loja) =>
    aliasesLoja(loja).some((alias) =>
      alias.includes(" ") ? q.includes(alias) : tokens.has(alias)
    )
  );
}

function encontrarLojaNoContexto(lojas, historico) {
  const contexto = [...historico]
    .reverse()
    .map((item) => normalizar(item.conteudo))
    .filter(Boolean);

  for (const texto of contexto) {
    const encontradas = lojasNoTexto(lojas, texto);
    if (encontradas.length) return encontradas[0];
  }

  return null;
}

function encontrarPeriodo(pergunta, historico) {
  const contexto = [pergunta, ...[...historico].reverse().map((item) => item.conteudo)]
    .map(normalizar)
    .join(" ");
  if (/\bnoite\b|\bnoturno\b/.test(contexto)) return "noite";
  if (/\bmanha\b|\bmatutino\b/.test(contexto)) return "manha";
  return null;
}

function somar(lista, campo = "valor_vendido") {
  return lista.reduce((total, item) => total + Number(item?.[campo] || 0), 0);
}

function dataReferencia(mes, vendas) {
  const hoje = new Date();
  const [ano, numeroMes] = mes.split("-").map(Number);
  if (hoje.getFullYear() === ano && hoje.getMonth() + 1 === numeroMes) {
    return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  }

  const datas = vendas
    .map((item) => item.data)
    .filter((data) => String(data || "").startsWith(`${mes}-`))
    .sort();
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return datas.at(-1) || `${mes}-${String(ultimoDia).padStart(2, "0")}`;
}

function diaExplicito(pergunta) {
  const q = normalizar(pergunta);
  const padroes = [
    /ate (?:o )?dia\s+(\d{1,2})\b/,
    /do dia\s+\d{1,2}\s+(?:ao|ate)\s+(\d{1,2})\b/,
    /(?:primeiro|1)\s+(?:ao|ate)\s+(\d{1,2})\b/,
  ];

  for (const padrao of padroes) {
    const achou = q.match(padrao);
    if (achou) return Number(achou[1]);
  }
  return null;
}

function diaFinalComparacao({ pergunta, mes, vendas }) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  const explicito = diaExplicito(pergunta);
  if (Number.isFinite(explicito)) return Math.max(1, Math.min(explicito, ultimoDia));
  return Math.max(1, Math.min(Number(dataReferencia(mes, vendas).slice(8, 10)) || ultimoDia, ultimoDia));
}

function anosDoTexto(texto) {
  return [...new Set((normalizar(texto).match(/\b20\d{2}\b/g) || []).map(Number))];
}

function ehPerguntaTemporalAtual(pergunta) {
  const q = normalizar(pergunta);
  return /em relacao a|ano passado|mesmo periodo|compar|versus|\bvs\b|caiu|queda|cresceu|subiu|20\d{2}/.test(q);
}

function ehRefinamentoDePeriodo(pergunta) {
  const q = normalizar(pergunta);
  return /ate (?:o )?dia\s+\d{1,2}|mesmo periodo|esse periodo|este periodo|isso comparando|comparando ate|do dia\s+\d{1,2}/.test(q);
}

function formatarData(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function variacaoTexto(atual, anterior) {
  const diferenca = atual - anterior;
  if (anterior > 0) {
    const pct = (diferenca / anterior) * 100;
    return `${diferenca >= 0 ? "+" : "-"}${moeda.format(Math.abs(diferenca))} (${diferenca >= 0 ? "+" : ""}${percentual.format(pct)}%)`;
  }
  if (atual > 0) return `+${moeda.format(atual)} (sem base anterior)`;
  return moeda.format(0);
}

function respostaComparacaoTemporal({ pergunta, mes, vendas, lojas, historico }) {
  const contextoAnterior = mensagensUsuario(historico).slice(-5).join(" ");
  const temContextoTemporal = ehPerguntaTemporalAtual(contextoAnterior);
  if (!ehPerguntaTemporalAtual(pergunta) && !(ehRefinamentoDePeriodo(pergunta) && temContextoTemporal)) {
    return null;
  }

  const [anoAtual, numeroMes] = mes.split("-").map(Number);
  const contexto = contextoUsuario(pergunta, historico);
  const anos = anosDoTexto(contexto);
  let anoComparacao = [...anos].reverse().find((ano) => ano !== anoAtual);
  if (!anoComparacao && /ano passado|mesmo periodo/.test(contexto)) anoComparacao = anoAtual - 1;
  if (!anoComparacao) return null;

  const diaFinal = diaFinalComparacao({ pergunta, mes, vendas });
  const mm = String(numeroMes).padStart(2, "0");
  const dd = String(diaFinal).padStart(2, "0");
  const intervaloAtual = {
    inicio: `${anoAtual}-${mm}-01`,
    fim: `${anoAtual}-${mm}-${dd}`,
  };
  const intervaloAnterior = {
    inicio: `${anoComparacao}-${mm}-01`,
    fim: `${anoComparacao}-${mm}-${dd}`,
  };

  const periodo = encontrarPeriodo(pergunta, historico);
  const mencionadas = lojasNoTexto(lojas, contexto);
  const lojasAnalisadas = mencionadas.length ? mencionadas : lojas;

  const filtrar = (loja, intervalo) => vendas.filter((item) => {
    if (item.data < intervalo.inicio || item.data > intervalo.fim) return false;
    if (Number(item.loja_id) !== Number(loja.id)) return false;
    if (periodo && item.periodo !== periodo) return false;
    return true;
  });

  const resultados = lojasAnalisadas.map((loja) => {
    const atual = somar(filtrar(loja, intervaloAtual));
    const anterior = somar(filtrar(loja, intervaloAnterior));
    const diferenca = atual - anterior;
    const pct = anterior > 0 ? (diferenca / anterior) * 100 : null;
    return { loja, atual, anterior, diferenca, pct };
  });

  const cabecalho = `${ehRefinamentoDePeriodo(pergunta) ? "Sim — " : ""}comparando ${formatarData(intervaloAtual.inicio)} a ${formatarData(intervaloAtual.fim)} com ${formatarData(intervaloAnterior.inicio)} a ${formatarData(intervaloAnterior.fim)}`;
  const periodoTexto = periodo ? ` no turno da ${periodo === "manha" ? "manhã" : "noite"}` : "";

  if (/caiu mais|maior queda|pior queda|mais caiu/.test(contexto)) {
    const comBase = resultados.filter((item) => item.anterior > 0);
    if (!comBase.length) return `${cabecalho}${periodoTexto}, não encontrei dados suficientes de ${anoComparacao} para calcular a queda.`;
    const escolhido = [...comBase].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
    if ((escolhido.pct ?? 0) >= 0) {
      return `${cabecalho}${periodoTexto}, nenhuma loja caiu. A menor variação foi da ${escolhido.loja.codigo}: ${moeda.format(escolhido.anterior)} em ${anoComparacao} para ${moeda.format(escolhido.atual)} em ${anoAtual} (${percentual.format(escolhido.pct)}%).`;
    }
    return `${cabecalho}${periodoTexto}, a ${escolhido.loja.codigo} foi a que mais caiu: ${moeda.format(escolhido.anterior)} em ${anoComparacao} contra ${moeda.format(escolhido.atual)} em ${anoAtual}, queda de ${moeda.format(Math.abs(escolhido.diferenca))} (${percentual.format(Math.abs(escolhido.pct))}%).`;
  }

  if (/cresceu mais|subiu mais|maior crescimento|mais cresceu/.test(contexto)) {
    const comBase = resultados.filter((item) => item.anterior > 0);
    if (!comBase.length) return `${cabecalho}${periodoTexto}, não encontrei dados suficientes de ${anoComparacao} para calcular o crescimento.`;
    const escolhido = [...comBase].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
    return `${cabecalho}${periodoTexto}, a ${escolhido.loja.codigo} teve a maior variação: ${moeda.format(escolhido.anterior)} em ${anoComparacao} para ${moeda.format(escolhido.atual)} em ${anoAtual}, ${variacaoTexto(escolhido.atual, escolhido.anterior)}.`;
  }

  const linhas = resultados.map((item) =>
    `${item.loja.codigo}: ${moeda.format(item.atual)} em ${anoAtual} vs. ${moeda.format(item.anterior)} em ${anoComparacao} — ${variacaoTexto(item.atual, item.anterior)}`
  );
  return `${cabecalho}${periodoTexto}: ${linhas.join(" | ")}.`;
}

function dadosLoja({ loja, periodo, mes, vendas, metas }) {
  const referencia = dataReferencia(mes, vendas);
  const [ano, numeroMes] = mes.split("-").map(Number);
  const totalDias = new Date(ano, numeroMes, 0).getDate();
  const diaAtual = Math.max(1, Number(referencia.slice(8, 10)) || 1);
  const inicio = `${mes}-01`;

  const vendasMes = vendas.filter((item) => {
    if (item.data < inicio || item.data > referencia) return false;
    if (Number(item.loja_id) !== Number(loja.id)) return false;
    if (periodo && item.periodo !== periodo) return false;
    return true;
  });

  const meta = somar(
    metas.filter((item) => {
      if (String(item.mes || "").slice(0, 7) !== mes) return false;
      if (Number(item.loja_id) !== Number(loja.id)) return false;
      if (periodo && item.periodo !== periodo) return false;
      return true;
    }),
    "valor_meta"
  );

  const vendido = somar(vendasMes);
  const porDia = new Map();
  vendasMes.forEach((item) => {
    porDia.set(item.data, (porDia.get(item.data) || 0) + Number(item.valor_vendido || 0));
  });
  const valoresDiarios = [...porDia.values()].filter((valor) => valor > 0);
  const mediaAtual = valoresDiarios.length ? vendido / valoresDiarios.length : 0;
  const diasRestantes = Math.max(totalDias - diaAtual, 0);
  const falta = Math.max(meta - vendido, 0);
  const necessarioDia = diasRestantes > 0 ? falta / diasRestantes : falta;
  const projecao = vendido + mediaAtual * diasRestantes;
  const atingimento = meta > 0 ? (vendido / meta) * 100 : null;
  const projecaoPct = meta > 0 ? (projecao / meta) * 100 : null;

  return {
    vendido,
    meta,
    mediaAtual,
    diasRestantes,
    falta,
    necessarioDia,
    projecao,
    atingimento,
    projecaoPct,
  };
}

function escolherLojaCritica({ lojas, periodo, mes, vendas, metas }) {
  const candidatos = lojas
    .map((loja) => ({ loja, dados: dadosLoja({ loja, periodo, mes, vendas, metas }) }))
    .filter((item) => item.dados.meta > 0);

  if (!candidatos.length) return lojas[0] || null;
  candidatos.sort((a, b) => (a.dados.projecaoPct ?? 999) - (b.dados.projecaoPct ?? 999));
  return candidatos[0].loja;
}

function respostaDeAcao({ pergunta, mes, vendas, metas, lojas, historico }) {
  if (!ehPedidoDeAcao(pergunta)) return null;

  const periodo = encontrarPeriodo(pergunta, historico);
  const lojaContexto = encontrarLojaNoContexto(lojas, historico);
  const loja = lojaContexto || escolherLojaCritica({ lojas, periodo, mes, vendas, metas });
  if (!loja) return "Não encontrei uma loja no contexto para montar um plano de ação.";

  const dados = dadosLoja({ loja, periodo, mes, vendas, metas });
  const nomePeriodo = periodo ? ` no turno da ${periodo === "manha" ? "manhã" : "noite"}` : "";

  if (!(dados.meta > 0)) {
    return `Para melhorar a ${loja.codigo}${nomePeriodo}, eu começaria acompanhando uma meta diária do turno e a média dos últimos dias. Hoje não encontrei uma meta mensal cadastrada para esse recorte, então não consigo calcular com segurança quanto precisa vender por dia.`;
  }

  const acoes = [];
  if (dados.diasRestantes > 0 && dados.falta > 0) {
    acoes.push(`trabalhar com um piso de ${moeda.format(dados.necessarioDia)} por dia nos ${dados.diasRestantes} dias restantes para garantir a Meta`);
  }

  if (dados.mediaAtual > 0) {
    if (dados.necessarioDia > dados.mediaAtual) {
      const aumento = ((dados.necessarioDia / dados.mediaAtual) - 1) * 100;
      acoes.push(`elevar a média diária de ${moeda.format(dados.mediaAtual)} para pelo menos ${moeda.format(dados.necessarioDia)}, um ganho de cerca de ${percentual.format(aumento)}%`);
    } else {
      acoes.push(`não deixar a média diária cair abaixo de ${moeda.format(dados.necessarioDia)}; a média atual está em ${moeda.format(dados.mediaAtual)}`);
    }
  }

  acoes.push("acompanhar o resultado do turno a cada 2 ou 3 dias e agir antes que a média necessária aumente");
  acoes.push("nos dias fracos, reforçar abordagem, sondagem e venda adicional, e comparar o resultado do turno com os dias em que a loja performou melhor");

  let resposta = `Para melhorar os números da ${loja.codigo}${nomePeriodo}, eu faria o seguinte: ${acoes.map((item, indice) => `${indice + 1}) ${item}`).join("; ")}.`;
  resposta += ` Hoje ela está em ${moeda.format(dados.vendido)} de ${moeda.format(dados.meta)} (${percentual.format(dados.atingimento)}% da Meta).`;

  if (dados.projecaoPct !== null) {
    if (dados.projecaoPct >= 100) {
      resposta += ` A projeção atual é ${moeda.format(dados.projecao)} (${percentual.format(dados.projecaoPct)}% da Meta), então o objetivo principal é sustentar o ritmo e evitar queda.`;
    } else {
      resposta += ` A projeção atual é ${moeda.format(dados.projecao)} (${percentual.format(dados.projecaoPct)}% da Meta), então é preciso acelerar o ritmo.`;
    }
  }

  return resposta;
}

export function responderPerguntaMetas(parametros) {
  const respostaAcao = respostaDeAcao(parametros);
  if (respostaAcao) return respostaAcao;

  const respostaTemporal = respostaComparacaoTemporal(parametros);
  if (respostaTemporal) return respostaTemporal;

  return responderBase(parametros);
}

export { sugestoesPerguntas };
