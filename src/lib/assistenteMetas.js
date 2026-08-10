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

function dataIso(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate()
  ).padStart(2, "0")}`;
}

function inicioFimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return {
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

function identificarLoja(perguntaNormalizada, lojas) {
  const tokens = new Set(perguntaNormalizada.split(" "));
  return lojas.find((loja) => {
    const codigo = normalizar(loja.codigo);
    const nome = normalizar(loja.nome);
    return (codigo && tokens.has(codigo)) || (nome && perguntaNormalizada.includes(nome));
  }) || null;
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

function intervaloPergunta(perguntaNormalizada, mesSelecionado, vendas) {
  const { inicio, fim } = inicioFimMes(mesSelecionado);
  const vendasMes = vendas.filter((venda) => venda.data >= inicio && venda.data <= fim);
  const ultimaDataMes = vendasMes.at(-1)?.data || fim;
  const referencia = new Date(`${ultimaDataMes}T12:00:00`);

  if (/\bhoje\b/.test(perguntaNormalizada)) {
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
    const quantidade = Math.max(1, Math.min(Number(ultimos[1]), 90));
    const inicioData = new Date(referencia);
    inicioData.setDate(inicioData.getDate() - quantidade + 1);
    return {
      inicio: dataIso(inicioData),
      fim: dataIso(referencia),
      rotulo: `nos últimos ${quantidade} dias`,
    };
  }

  if (/\bsemana\b/.test(perguntaNormalizada)) {
    const inicioData = new Date(referencia);
    inicioData.setDate(inicioData.getDate() - 6);
    return { inicio: dataIso(inicioData), fim: dataIso(referencia), rotulo: "nos últimos 7 dias" };
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

function metasDoFiltro(metas, loja, periodo) {
  return metas.filter((meta) => {
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

export function responderPerguntaMetas({ pergunta, mes, vendas = [], metas = [], lojas = [] }) {
  const q = normalizar(pergunta);
  if (!q) return "Digite uma pergunta sobre vendas, metas, lojas ou turnos.";

  const loja = identificarLoja(q, lojas);
  const periodo = identificarPeriodo(q);
  const nivel = identificarNivel(q);
  const intervalo = intervaloPergunta(q, mes, vendas);
  const vendasFiltradas = aplicarFiltros(vendas, intervalo, loja, periodo);
  const metasFiltradas = metasDoFiltro(metas, loja, periodo);
  const vendido = somar(vendasFiltradas);
  const metaBase = somar(metasFiltradas, "valor_meta");
  const alvo = metaBase * nivel.fator;
  const filtro = rotuloFiltro(loja, periodo);

  if (/qual loja|loja que|melhor loja|pior loja|mais vendeu|menos vendeu/.test(q)) {
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
    const porPeriodo = ["manha", "noite"].map((nome) => ({
      periodo: nome,
      total: somar(vendasFiltradas.filter((venda) => venda.periodo === nome)),
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

  if (/media|média/.test(pergunta.toLowerCase())) {
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

  if (/compar|versus| vs /.test(` ${q} `)) {
    const mencionadas = lojas.filter((item) => {
      const codigo = normalizar(item.codigo);
      const nome = normalizar(item.nome);
      return (codigo && new Set(q.split(" ")).has(codigo)) || (nome && q.includes(nome));
    });
    if (mencionadas.length >= 2) {
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
    "Qual turno está vendendo menos?",
    "Quanto vamos fechar o mês se continuar assim?",
    `Compare ${primeira} e ${segunda} nos últimos 7 dias.`,
  ];
}
