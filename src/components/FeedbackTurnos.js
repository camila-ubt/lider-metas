"use client";

import { useEffect } from "react";

function tituloDoBloco(bloco) {
  return (
    bloco.querySelector("h3")?.textContent?.trim() ||
    bloco.querySelector("summary strong")?.textContent?.trim() ||
    ""
  );
}

function encontrarParagrafo(leitura, inicio) {
  return Array.from(leitura.querySelectorAll(":scope > p")).find((paragrafo) =>
    paragrafo.textContent?.trim().startsWith(inicio)
  );
}

function extrairLojaEPercentual(texto, titulo) {
  const padrao = new RegExp(
    `^${titulo}:\\s*([A-Z]{2})[,—-]?\\s*com\\s*([\\d.,]+)%`,
    "i"
  );
  const resultado = String(texto || "").trim().match(padrao);

  return resultado
    ? { codigo: resultado[1].toUpperCase(), percentual: resultado[2] }
    : null;
}

function extrairDesempenho(bloco) {
  const itens = Array.from(
    bloco.querySelectorAll('div[class*="periodHeading"] > div')
  );
  const item = itens.find(
    (elemento) => elemento.querySelector("span")?.textContent?.trim() === "Desempenho"
  );
  const texto = item?.querySelector("strong")?.textContent || "";
  const numero = Number(texto.replace("%", "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function mesEncerrado() {
  const campo = document.querySelector('input[type="month"]');
  if (!campo?.value) return false;

  const [ano, mes] = campo.value.split("-").map(Number);
  const hoje = new Date();
  return (
    ano < hoje.getFullYear() ||
    (ano === hoje.getFullYear() && mes < hoje.getMonth() + 1)
  );
}

function preencherParagrafo(paragrafo, rotulo, texto) {
  const novoTexto = `${rotulo} ${texto}`;
  if (paragrafo.textContent?.trim() === novoTexto.trim()) return;

  paragrafo.replaceChildren();
  const negrito = document.createElement("b");
  negrito.textContent = rotulo;
  paragrafo.append(negrito, document.createTextNode(` ${texto}`));
}

function orientacaoDoPeriodo({ periodo, desempenho, destaque, atencao, encerrado }) {
  if (encerrado) {
    if (desempenho < 100) {
      return `o mês encerrou sem atingir a Meta da ${periodo}. Comparar ${atencao.codigo} com ${destaque.codigo}, registrar diferenças observáveis e definir uma ação prática para o próximo mês.`;
    }
    if (desempenho < 120) {
      return `a Meta da ${periodo} foi atingida, mas a Supermeta não. Identificar com ${destaque.codigo} o que esteve presente nos melhores dias, registrar o que funcionou e transformar a análise em ação para o próximo mês.`;
    }
    if (desempenho < 130) {
      return `a Supermeta da ${periodo} foi atingida, mas a Megameta não. Documentar as práticas observáveis de ${destaque.codigo} e planejar como ampliar esse padrão no próximo mês.`;
    }
    return `a Megameta da ${periodo} foi atingida. Documentar com ${destaque.codigo} as práticas observáveis dos melhores dias e definir como preservar esse padrão no próximo mês.`;
  }

  if (desempenho < 100) {
    return `na reunião da ${periodo}, comparar ${atencao.codigo} com ${destaque.codigo}, identificar diferenças observáveis e definir um teste prático para recuperar a Meta nos dias restantes.`;
  }
  if (desempenho < 120) {
    return `na reunião da ${periodo}, identificar com ${destaque.codigo} quais abordagens, produtos, exposições ou condições de atendimento estiveram presentes nos melhores dias, mantendo o acompanhamento para avançar em direção à Supermeta.`;
  }
  if (desempenho < 130) {
    return `na reunião da ${periodo}, documentar com ${destaque.codigo} o que esteve presente nos melhores dias e avaliar o que pode ser replicado para avançar em direção à Megameta.`;
  }
  return `na reunião da ${periodo}, documentar com ${destaque.codigo} as práticas observáveis dos melhores dias e preservar o padrão que levou à Megameta.`;
}

function dadosDoBloco(bloco) {
  const titulo = tituloDoBloco(bloco);
  const correspondeManha = titulo === "Leitura da manhã";
  const correspondeNoite = titulo === "Leitura da noite";
  if (!correspondeManha && !correspondeNoite) return null;

  const leitura = bloco.querySelector('div[class*="periodReading"]');
  if (!leitura) return null;

  const destaqueParagrafo = encontrarParagrafo(leitura, "Destaque do período:");
  const atencaoParagrafo = encontrarParagrafo(leitura, "Ponto de atenção:");
  const acaoParagrafo = encontrarParagrafo(leitura, "Ação sugerida:");
  if (!destaqueParagrafo || !atencaoParagrafo || !acaoParagrafo) return null;

  const destaque = extrairLojaEPercentual(
    destaqueParagrafo.textContent,
    "Destaque do período"
  );
  const atencao = extrairLojaEPercentual(
    atencaoParagrafo.textContent,
    "Ponto de atenção"
  );
  const desempenho = extrairDesempenho(bloco);
  if (!destaque || !atencao || desempenho === null) return null;

  return {
    bloco,
    leitura,
    destaqueParagrafo,
    atencaoParagrafo,
    acaoParagrafo,
    periodo: correspondeManha ? "manhã" : "noite",
    desempenho,
    destaque,
    atencao,
  };
}

function aprimorarBloco(dados, encerrado) {
  const { periodo, desempenho, destaque, atencao } = dados;

  preencherParagrafo(
    dados.destaqueParagrafo,
    "Destaque do período:",
    `${destaque.codigo}, com ${destaque.percentual}% da própria Meta. O resultado indica o melhor desempenho proporcional do turno, mas os números não mostram sozinhos a causa.`
  );

  preencherParagrafo(
    dados.atencaoParagrafo,
    "Ponto de atenção:",
    `${atencao.codigo}, com ${atencao.percentual}% da própria Meta. Compare com ${destaque.codigo} no mesmo turno, observando fluxo, abordagem, exposição, mix de produtos e conversão.`
  );

  preencherParagrafo(
    dados.acaoParagrafo,
    "Ação sugerida:",
    orientacaoDoPeriodo({ periodo, desempenho, destaque, atencao, encerrado })
  );
}

function criarItemAcao(texto) {
  const artigo = document.createElement("article");
  artigo.dataset.acaoTurno = "true";

  const numero = document.createElement("span");
  const paragrafo = document.createElement("p");
  paragrafo.textContent = texto;

  artigo.append(numero, paragrafo);
  return artigo;
}

function ajustarAcoesConsolidadas(dadosPeriodos, encerrado) {
  const blocoAcoes = Array.from(
    document.querySelectorAll('article[class*="fullBlock"], details[class*="collapse"]')
  ).find((bloco) => tituloDoBloco(bloco) === "Ações sugeridas");

  const lista = blocoAcoes?.querySelector('div[class*="actionsList"]');
  if (!lista || dadosPeriodos.length < 2) return;

  const assinatura = JSON.stringify(
    dadosPeriodos.map((dados) => [
      dados.periodo,
      dados.desempenho,
      dados.destaque.codigo,
      dados.atencao.codigo,
      encerrado,
    ])
  );
  if (lista.dataset.feedbackTurnos === assinatura) return;

  Array.from(lista.querySelectorAll(":scope > article")).forEach((artigo) => {
    const texto = artigo.querySelector("p")?.textContent?.trim() || "";
    if (artigo.dataset.acaoTurno === "true" || /^Na (manhã|noite),/i.test(texto)) {
      artigo.remove();
    }
  });

  dadosPeriodos.forEach((dados) => {
    const texto = orientacaoDoPeriodo({
      periodo: dados.periodo,
      desempenho: dados.desempenho,
      destaque: dados.destaque,
      atencao: dados.atencao,
      encerrado,
    });
    lista.append(criarItemAcao(texto.charAt(0).toUpperCase() + texto.slice(1)));
  });

  Array.from(lista.querySelectorAll(":scope > article")).forEach((artigo, indice) => {
    const numero = artigo.querySelector(":scope > span");
    if (numero) numero.textContent = String(indice + 1);
  });

  lista.dataset.feedbackTurnos = assinatura;
}

function aprimorarFeedbacks() {
  const encerrado = mesEncerrado();
  const dadosPeriodos = Array.from(
    document.querySelectorAll('article[class*="fullBlock"], details[class*="collapse"]')
  )
    .map(dadosDoBloco)
    .filter(Boolean);

  dadosPeriodos.forEach((dados) => aprimorarBloco(dados, encerrado));
  ajustarAcoesConsolidadas(dadosPeriodos, encerrado);
}

export default function FeedbackTurnos() {
  useEffect(() => {
    let quadro = null;

    function agendar() {
      if (quadro !== null) return;
      quadro = window.requestAnimationFrame(() => {
        quadro = null;
        aprimorarFeedbacks();
      });
    }

    agendar();
    document.addEventListener("change", agendar, true);
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      document.removeEventListener("change", agendar, true);
      observador.disconnect();
      if (quadro !== null) window.cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
