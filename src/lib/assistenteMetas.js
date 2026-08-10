const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const NIVEIS = {
  meta: { nome: "Meta", fator: 1 },
  supermeta: { nome: "Supermeta", fator: 1.1 },
  megameta: { nome: "Megameta", fator: 1.2 },
};

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contextualizarPergunta(pergunta, historico = []) {
  const atual = normalizar(pergunta);
  const usuarios = historico
    .filter((item) => item.papel === "usuario")
    .map((item) => item.conteudo)
    .filter(Boolean);

  if (!usuarios.length) return pergunta;

  const dependeDoContexto =
    atual.length < 75 ||
    /^(e |e no |e na |e de |e da |e do |nesse|nessa|neste|nesta|agora|e agora|e se|e quanto|e qual|e quem)/.test(atual) ||
    /\b(ele|ela|essa|esse|isso|aquilo|tambem|mesmo periodo|mesma loja|mesmo turno)\b/.test(atual);

  if (!dependeDoContexto) return pergunta;

  const anteriores = usuarios.slice(-3).join(". ");
  return `${anteriores}. Continuação: ${pergunta}`;
}

function dataIso(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate()
  ).padStart(2, "0")}`;
}

function parseIso(iso) {
  const [ano, mes, dia] = String(iso).split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

function inicioFimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return {
    ano,
    numeroMes,
    inicio: `${ano}-${String(numeroMes).padStart(2, "0")}-01`,
    fim: `${ano}-${String(numeroMes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`,
    totalDias: ultimoDia,
  };
}

function somar(lista, campo = "valor_vendido") {
  return lista.reduce((total, item) => total + Number(item?.[campo] || 0), 0);
}

function media(valores) {
  if (!valores.length) return 0;
  return valores.reduce((total, valor) => total + Number(valor || 0), 0) / valores.length;
}

function desvioPadrao(valores) {
  if (valores.length < 2) return 0;
  const m = media(valores);
  const variancia = valores.reduce((total, valor) => total + (valor - m) ** 2, 0) / (valores.length - 1);
  return Math.sqrt(Math.max(variancia, 0));
}

function agrupar(lista, chaveFn) {
  const mapa = new Map();
  lista.forEach((item) => {
    const chave = chaveFn(item);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(item);
  });
  return mapa;
}

function aliasesLoja(loja) {
  const codigo = normalizar(loja.codigo);
  const nome = normalizar(loja.nome);
  const ignorar = new Set(["loja", "acessorios", "acessorio", "bijoux", "biju", "bijuterias"]);
  const palavras = nome
    .split(" ")
    .filter((item) => item.length >= 3 && !ignorar.has(item));
  return [...new Set([codigo, nome, ...palavras].filter(Boolean))];
}

function identificarLojas(perguntaNormalizada, lojas) {
  const tokens = new Set(perguntaNormalizada.split(" "));
  return lojas.filter((loja) =>
    aliasesLoja(loja).some((alias) =>
      alias.includes(" ") ? perguntaNormalizada.includes(alias) : tokens.has(alias)
    )
  );
}

function identificarPeriodo(perguntaNormalizada) {
  if (/\b(manha|matutino)\b/.test(perguntaNormalizada)) return "manha";
  if (/\b(noite|noturno)\b/.test(perguntaNormalizada)) return "noite";
  return null;
}

function identificarNivel(perguntaNormalizada) {
  if (/mega\s*meta|megmeta|120%|120 por cento/.test(perguntaNormalizada)) return NIVEIS.megameta;
  if (/super\s*meta|110%|110 por cento/.test(perguntaNormalizada)) return NIVEIS.supermeta;
  return NIVEIS.meta;
}

function dataReferenciaMes(mes, vendas) {
  const { ano, numeroMes, fim } = inicioFimMes(mes);
  const hoje = new Date();
  const mesmoMesAtual = hoje.getFullYear() === ano && hoje.getMonth() + 1 === numeroMes;
  if (mesmoMesAtual) return dataIso(hoje);

  const datas = vendas
    .filter((venda) => String(venda.data || "").startsWith(`${mes}-`))
    .map((venda) => venda.data)
    .sort();
  return datas.at(-1) || fim;
}

function intervaloPergunta(perguntaNormalizada, mesSelecionado, vendas) {
  const { inicio, fim } = inicioFimMes(mesSelecionado);
  const referenciaIso = dataReferenciaMes(mesSelecionado, vendas);
  const referencia = parseIso(referenciaIso);

  if (/\bhoje\b/.test(perguntaNormalizada) && !/mes|comeco|inicio|desde/.test(perguntaNormalizada)) {
    const hoje = dataIso(new Date());
    return { inicio: hoje, fim: hoje, rotulo: "hoje" };
  }

  if (/\bontem\b/.test(perguntaNormalizada)) {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const iso = dataIso(ontem);
    return { inicio: iso, fim: iso, rotulo: "ontem" };
  }

  const ultimos = perguntaNormalizada.match(/(?:ultimos?|ultimas?)\s+(\d+)\s+dias?/);
  if (ultimos) {
    const quantidade = Math.max(1, Math.min(Number(ultimos[1]), 365));
    const inicioData = new Date(referencia);
    inicioData.setDate(inicioData.getDate() - quantidade + 1);
    return {
      inicio: dataIso(inicioData),
      fim: referenciaIso,
      rotulo: `nos últimos ${quantidade} dias`,
    };
  }

  if (/\bsemana\b/.test(perguntaNormalizada)) {
    const inicioData = new Date(referencia);
    inicioData.setDate(inicioData.getDate() - 6);
    return { inicio: dataIso(inicioData), fim: referenciaIso, rotulo: "nos últimos 7 dias" };
  }

  if (/ate hoje|ate o dia de hoje|comeco do mes|inicio do mes|desde o inicio|deste mes|desse mes|este mes/.test(perguntaNormalizada)) {
    return { inicio, fim: referenciaIso, rotulo: "do começo do mês até hoje" };
  }

  return { inicio, fim, rotulo: "no mês selecionado" };
}

function aplicarFiltros(vendas, intervalo, loja, periodo) {
  return vendas.filter((venda) => {
    if (venda.data < intervalo.inicio || venda.data > intervalo.fim) return false;
    if (loja && Number(venda.loja_id) !== Number(loja.id)) return false;
    if (periodo && venda.periodo !== periodo) return false;
    return true;
  });
}

function rotuloFiltro(loja, periodo) {
  const partes = [];
  if (loja) partes.push(loja.codigo || loja.nome);
  if (periodo) partes.push(periodo === "manha" ? "manhã" : "noite");
  return partes.length ? ` (${partes.join(" · ")})` : "";
}

function metasDoFiltro(metas, loja, periodo, mesSelecionado) {
  return metas.filter((meta) => {
    if (mesSelecionado && String(meta.mes || "").slice(0, 7) !== mesSelecionado) return false;
    if (loja && Number(meta.loja_id) !== Number(loja.id)) return false;
    if (periodo && meta.periodo !== periodo) return false;
    return true;
  });
}

function diarios(vendas) {
  return [...agrupar(vendas, (venda) => venda.data).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, itens]) => ({ data, valor: somar(itens) }));
}

function projetarFechamento(vendas, mesSelecionado) {
  const { inicio, fim, totalDias } = inicioFimMes(mesSelecionado);
  const lista = vendas.filter((venda) => venda.data >= inicio && venda.data <= fim);
  const porDia = diarios(lista);
  if (!porDia.length) return null;

  const ultimoDiaComDado = Number(porDia.at(-1).data.slice(8, 10));
  const totalAtual = porDia.reduce((total, item) => total + item.valor, 0);
  const valoresPositivos = porDia.filter((item) => item.valor > 0).map((item) => item.valor);
  const janela = valoresPositivos.slice(-Math.min(10, valoresPositivos.length));
  const mediaRecente = media(janela);
  const mediaGeral = media(valoresPositivos);
  const mediaProjetada = mediaRecente > 0 ? mediaRecente * 0.65 + mediaGeral * 0.35 : mediaGeral;
  const diasRestantes = Math.max(totalDias - ultimoDiaComDado, 0);
  const centro = totalAtual + mediaProjetada * diasRestantes;
  const dispersao = desvioPadrao(janela.length >= 2 ? janela : valoresPositivos);
  const margem = dispersao * Math.sqrt(Math.max(diasRestantes, 1));

  return {
    atual: totalAtual,
    centro,
    minimo: Math.max(totalAtual, centro - margem),
    maximo: Math.max(totalAtual, centro + margem),
    diasRestantes,
    mediaProjetada,
  };
}

function nomeLojaPorId(lojas, id) {
  return lojas.find((loja) => Number(loja.id) === Number(id))?.codigo || `Loja ${id}`;
}

function responderLojaAtencao({ q, mes, vendas, metas, lojas, periodo }) {
  if (!/(precisa|merece|necessita).*(atencao|cuidado)|mais atencao|mais cuidado|mais preocup|preocupante|pior desempenho/.test(q)) {
    return null;
  }

  const { inicio, totalDias } = inicioFimMes(mes);
  const referencia = dataReferenciaMes(mes, vendas);
  const diaAtual = Math.max(1, Number(referencia.slice(8, 10)) || 1);
  const intervaloAteAgora = { inicio, fim: referencia };

  const resultados = lojas.map((item) => {
    const vendasLoja = aplicarFiltros(vendas, intervaloAteAgora, item, periodo);
    const vendido = somar(vendasLoja);
    const meta = somar(metasDoFiltro(metas, item, periodo, mes), "valor_meta");
    const vendasParaProjetar = vendas.filter((venda) => {
      if (Number(venda.loja_id) !== Number(item.id)) return false;
      if (periodo && venda.periodo !== periodo) return false;
      return true;
    });
    const projecao = projetarFechamento(vendasParaProjetar, mes);
    const atingimento = meta > 0 ? (vendido / meta) * 100 : null;
    const esperadoAteAgora = meta > 0 ? meta * (diaAtual / totalDias) : 0;
    const ritmo = esperadoAteAgora > 0 ? (vendido / esperadoAteAgora) * 100 : null;
    const projecaoPercentual = meta > 0 && projecao ? (projecao.centro / meta) * 100 : null;

    return {
      loja: item,
      vendido,
      meta,
      atingimento,
      ritmo,
      projecao,
      projecaoPercentual,
    };
  });

  const comMeta = resultados.filter((item) => item.meta > 0);
  if (comMeta.length) {
    const escolhido = [...comMeta].sort((a, b) => {
      const projA = a.projecaoPercentual ?? a.atingimento ?? 999;
      const projB = b.projecaoPercentual ?? b.atingimento ?? 999;
      if (projA !== projB) return projA - projB;
      return (a.ritmo ?? 999) - (b.ritmo ?? 999);
    })[0];

    let resposta = `A ${escolhido.loja.codigo} é a loja que mais precisa de atenção neste mês`;
    if (periodo) resposta += ` no turno da ${periodo === "manha" ? "manhã" : "noite"}`;
    resposta += `. Até agora vendeu ${moeda.format(escolhido.vendido)} de uma meta de ${moeda.format(escolhido.meta)}, atingindo ${percentual.format(escolhido.atingimento)}%.`;

    if (escolhido.projecao) {
      resposta += ` Pelo ritmo atual, a projeção de fechamento é ${moeda.format(escolhido.projecao.centro)} (${percentual.format(escolhido.projecaoPercentual)}% da meta).`;
    }

    const falta = Math.max(escolhido.meta - escolhido.vendido, 0);
    if (falta > 0) resposta += ` Ainda faltam ${moeda.format(falta)} para a Meta.`;
    return resposta;
  }

  const escolhido = [...resultados].sort((a, b) => a.vendido - b.vendido)[0];
  if (!escolhido) return "Não encontrei dados suficientes para avaliar qual loja precisa de mais atenção.";
  return `Como não há metas cadastradas para esse recorte, usei o volume vendido como referência. A ${escolhido.loja.codigo} é a que merece mais atenção, com ${moeda.format(escolhido.vendido)} vendidos no período.`;
}

function anosMencionados(q) {
  return [...new Set((q.match(/\b20\d{2}\b/g) || []).map(Number))];
}

function temComparacaoTemporal(q) {
  return /ano passado|mesmo periodo|em relacao a|comparad[oa]|comparar|compare|versus| vs |20\d{2}/.test(` ${q} `);
}

function intervaloMesmoPeriodo(intervaloAtual, anoDestino) {
  return {
    inicio: `${anoDestino}-${intervaloAtual.inicio.slice(5)}`,
    fim: `${anoDestino}-${intervaloAtual.fim.slice(5)}`,
    rotulo: `${intervaloAtual.inicio.slice(8, 10)}/${intervaloAtual.inicio.slice(5, 7)} a ${intervaloAtual.fim.slice(8, 10)}/${intervaloAtual.fim.slice(5, 7)}/${anoDestino}`,
  };
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

function responderComparacaoTemporal({ q, mes, vendas, lojas, periodo, mencionadas }) {
  if (!temComparacaoTemporal(q)) return null;

  const { ano } = inicioFimMes(mes);
  const anos = anosMencionados(q);
  let anoAnterior = anos.find((item) => item !== ano);
  if (!anoAnterior && /ano passado|mesmo periodo/.test(q)) anoAnterior = ano - 1;
  if (!anoAnterior) return null;

  const intervaloAtual = intervaloPergunta(q, mes, vendas);
  const intervaloAnterior = intervaloMesmoPeriodo(intervaloAtual, anoAnterior);
  const lojasAnalisadas = mencionadas.length ? mencionadas : lojas;
  if (!lojasAnalisadas.length) return null;

  const resultados = lojasAnalisadas.map((loja) => {
    const atual = somar(aplicarFiltros(vendas, intervaloAtual, loja, periodo));
    const anterior = somar(aplicarFiltros(vendas, intervaloAnterior, loja, periodo));
    const diferenca = atual - anterior;
    const pct = anterior > 0 ? (diferenca / anterior) * 100 : null;
    return { loja, atual, anterior, diferenca, pct };
  });

  if (/caiu mais|maior queda|pior queda|mais caiu/.test(q)) {
    const comBase = resultados.filter((item) => item.anterior > 0);
    if (!comBase.length) return `Não encontrei dados de ${anoAnterior} suficientes para comparar as lojas.`;
    const escolhido = [...comBase].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
    if ((escolhido.pct ?? 0) >= 0) {
      return `Nenhuma loja caiu nesse período em relação a ${anoAnterior}. A menor variação foi da ${escolhido.loja.codigo}: ${moeda.format(escolhido.anterior)} em ${anoAnterior} para ${moeda.format(escolhido.atual)} agora (${percentual.format(escolhido.pct)}%).`;
    }
    return `A ${escolhido.loja.codigo} foi a que mais caiu: ${moeda.format(escolhido.anterior)} no mesmo período de ${anoAnterior} contra ${moeda.format(escolhido.atual)} agora, queda de ${moeda.format(Math.abs(escolhido.diferenca))} (${percentual.format(Math.abs(escolhido.pct))}%).`;
  }

  if (/cresceu mais|subiu mais|maior crescimento|mais cresceu/.test(q)) {
    const comBase = resultados.filter((item) => item.anterior > 0);
    if (!comBase.length) return `Não encontrei dados de ${anoAnterior} suficientes para comparar as lojas.`;
    const escolhido = [...comBase].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
    return `A ${escolhido.loja.codigo} teve a maior variação: ${moeda.format(escolhido.anterior)} no mesmo período de ${anoAnterior} para ${moeda.format(escolhido.atual)} agora, ${variacaoTexto(escolhido.atual, escolhido.anterior)}.`;
  }

  const linhas = resultados.map(
    (item) => `${item.loja.codigo}: ${moeda.format(item.atual)} agora vs. ${moeda.format(item.anterior)} em ${anoAnterior} — ${variacaoTexto(item.atual, item.anterior)}`
  );
  const maiorAtual = [...resultados].sort((a, b) => b.atual - a.atual)[0];

  let fechamento = `Comparando ${intervaloAtual.inicio.slice(8, 10)}/${intervaloAtual.inicio.slice(5, 7)} a ${intervaloAtual.fim.slice(8, 10)}/${intervaloAtual.fim.slice(5, 7)} de ${ano} com o mesmo período de ${anoAnterior}: ${linhas.join(" | ")}.`;
  if (/quem vendeu mais|qual vendeu mais|mais vendeu|vendeu mais|maior venda/.test(q) && maiorAtual) {
    fechamento += ` Neste período, ${maiorAtual.loja.codigo} vendeu mais, com ${moeda.format(maiorAtual.atual)}.`;
  }
  return fechamento;
}

function resumoPadrao({ vendasFiltradas, metasFiltradas, intervalo, loja, periodo, nivel }) {
  const vendido = somar(vendasFiltradas);
  const metaBase = somar(metasFiltradas, "valor_meta");
  const alvo = metaBase * nivel.fator;
  const falta = Math.max(alvo - vendido, 0);
  const atingimento = alvo > 0 ? (vendido / alvo) * 100 : null;
  const filtro = rotuloFiltro(loja, periodo);

  if (!vendasFiltradas.length && !metaBase) {
    return `Não encontrei vendas nem meta para esse recorte ${intervalo.rotulo}${filtro}.`;
  }

  const partes = [`Foram vendidos ${moeda.format(vendido)} ${intervalo.rotulo}${filtro}.`];
  if (alvo > 0) {
    partes.push(
      falta > 0
        ? `Faltam ${moeda.format(falta)} para a ${nivel.nome}.`
        : `A ${nivel.nome} já foi atingida.`
    );
    partes.push(`Atingimento: ${percentual.format(atingimento)}%.`);
  }
  return partes.join(" ");
}

export function responderPerguntaMetas({ pergunta, mes, vendas = [], metas = [], lojas = [], historico = [] }) {
  const perguntaComContexto = contextualizarPergunta(pergunta, historico);
  const q = normalizar(perguntaComContexto);
  if (!q) return "Digite uma pergunta sobre vendas, metas, lojas, turnos ou períodos.";

  const mencionadas = identificarLojas(q, lojas);
  const loja = mencionadas.length === 1 ? mencionadas[0] : null;
  const periodo = identificarPeriodo(q);
  const nivel = identificarNivel(q);

  const respostaTemporal = responderComparacaoTemporal({
    q,
    mes,
    vendas,
    lojas,
    periodo,
    mencionadas,
  });
  if (respostaTemporal) return respostaTemporal;

  const respostaAtencao = responderLojaAtencao({ q, mes, vendas, metas, lojas, periodo });
  if (respostaAtencao) return respostaAtencao;

  const intervalo = intervaloPergunta(q, mes, vendas);
  const vendasFiltradas = aplicarFiltros(vendas, intervalo, loja, periodo);
  const metasFiltradas = metasDoFiltro(metas, loja, periodo, mes);
  const vendido = somar(vendasFiltradas);
  const metaBase = somar(metasFiltradas, "valor_meta");
  const alvo = metaBase * nivel.fator;
  const filtro = rotuloFiltro(loja, periodo);

  if (/qual loja|loja que|melhor loja|pior loja|mais vendeu|menos vendeu/.test(q) && mencionadas.length < 2) {
    const totais = [...agrupar(vendasFiltradas, (venda) => venda.loja_id).entries()]
      .map(([lojaId, itens]) => ({ lojaId, total: somar(itens) }))
      .sort((a, b) => b.total - a.total);

    if (!totais.length) return `Não encontrei vendas ${intervalo.rotulo}${filtro}.`;
    const pior = /pior|menos/.test(q);
    const escolhido = pior ? totais.at(-1) : totais[0];
    return `${pior ? "A loja com menor venda" : "A loja com maior venda"} ${intervalo.rotulo} foi ${nomeLojaPorId(
      lojas,
      escolhido.lojaId
    )}, com ${moeda.format(escolhido.total)}.`;
  }

  if (/qual turno|melhor turno|pior turno|turno que|manha.*noite|noite.*manha/.test(q)) {
    const baseTurnos = loja ? aplicarFiltros(vendas, intervalo, loja, null) : aplicarFiltros(vendas, intervalo, null, null);
    const porPeriodo = ["manha", "noite"].map((nome) => ({
      periodo: nome,
      total: somar(baseTurnos.filter((venda) => venda.periodo === nome)),
    }));
    const pior = /pior|menos/.test(q);
    const escolhido = [...porPeriodo].sort((a, b) => (pior ? a.total - b.total : b.total - a.total))[0];
    return `${pior ? "O turno com menor venda" : "O turno com maior venda"} ${intervalo.rotulo}${
      loja ? ` na ${loja.codigo}` : ""
    } foi ${escolhido.periodo === "manha" ? "manhã" : "noite"}, com ${moeda.format(escolhido.total)}.`;
  }

  if (/quanto falta|falta quanto|faltam|para bater|atingir/.test(q)) {
    if (!(alvo > 0)) return `Não encontrei uma meta cadastrada para esse recorte${filtro}.`;
    const falta = Math.max(alvo - vendido, 0);
    return falta > 0
      ? `Faltam ${moeda.format(falta)} para atingir a ${nivel.nome}${filtro}. Até agora foram vendidos ${moeda.format(vendido)}.`
      : `A ${nivel.nome}${filtro} já foi atingida. O vendido está em ${moeda.format(vendido)}.`;
  }

  if (/percentual|porcentagem|atingimento|quantos por cento|%/.test(q)) {
    if (!(alvo > 0)) return `Não encontrei uma meta cadastrada para calcular o atingimento${filtro}.`;
    return `O atingimento da ${nivel.nome}${filtro} está em ${percentual.format((vendido / alvo) * 100)}%, com ${moeda.format(
      vendido
    )} vendidos de ${moeda.format(alvo)}.`;
  }

  if (/media/.test(q)) {
    const listaDiaria = diarios(vendasFiltradas).filter((item) => item.valor > 0);
    if (!listaDiaria.length) return `Não encontrei dias com vendas ${intervalo.rotulo}${filtro}.`;
    return `A média por dia com venda ${intervalo.rotulo}${filtro} é ${moeda.format(
      media(listaDiaria.map((item) => item.valor))
    )}, considerando ${listaDiaria.length} dias.`;
  }

  if (/projec|previs|fechar o mes|fechamento do mes|quanto vamos fechar|quanto vai fechar/.test(q)) {
    const vendasParaProjetar = loja || periodo
      ? vendas.filter((venda) => {
          if (loja && Number(venda.loja_id) !== Number(loja.id)) return false;
          if (periodo && venda.periodo !== periodo) return false;
          return true;
        })
      : vendas;
    const projecao = projetarFechamento(vendasParaProjetar, mes);
    if (!projecao) return `Ainda não há vendas suficientes no mês selecionado para fazer uma projeção${filtro}.`;

    let resposta = `Pelo ritmo atual, a projeção de fechamento${filtro} é de aproximadamente ${moeda.format(
      projecao.centro
    )}. Faixa estimada: ${moeda.format(projecao.minimo)} a ${moeda.format(projecao.maximo)}.`;
    if (alvo > 0) {
      resposta += projecao.centro >= alvo
        ? ` A projeção fica acima da ${nivel.nome} de ${moeda.format(alvo)}.`
        : ` A projeção fica ${moeda.format(alvo - projecao.centro)} abaixo da ${nivel.nome}.`;
    }
    return resposta;
  }

  if (/compar|versus| vs /.test(` ${q} `) && mencionadas.length >= 2) {
    const [a, b] = mencionadas;
    const totalA = somar(aplicarFiltros(vendas, intervalo, a, periodo));
    const totalB = somar(aplicarFiltros(vendas, intervalo, b, periodo));
    const diferenca = Math.abs(totalA - totalB);
    const maior = totalA === totalB ? null : totalA > totalB ? a : b;
    return maior
      ? `${a.codigo}: ${moeda.format(totalA)}. ${b.codigo}: ${moeda.format(totalB)}. ${maior.codigo} está na frente por ${moeda.format(
          diferenca
        )} ${intervalo.rotulo}.`
      : `${a.codigo} e ${b.codigo} estão empatadas em ${moeda.format(totalA)} ${intervalo.rotulo}.`;
  }

  if (/total|quanto vendeu|quanto vendemos|vendas/.test(q)) {
    return `O total vendido ${intervalo.rotulo}${filtro} foi ${moeda.format(vendido)}.`;
  }

  return resumoPadrao({ vendasFiltradas, metasFiltradas, intervalo, loja, periodo, nivel });
}

export function sugestoesPerguntas(lojas = []) {
  const primeira = lojas[0]?.codigo || "CB";
  const segunda = lojas[1]?.codigo || "AA";
  return [
    "Qual loja vendeu mais este mês?",
    `Quanto falta para a ${primeira} bater a supermeta?`,
    "Qual loja caiu mais em relação a 2025?",
    "Quanto vamos fechar o mês se continuar assim?",
    `Compare ${primeira} e ${segunda} deste mês até hoje com o mesmo período do ano passado.`,
  ];
}