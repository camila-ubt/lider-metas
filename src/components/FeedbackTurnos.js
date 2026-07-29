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

function preencherParagrafo(paragrafo, rotulo, texto) {
  paragrafo.replaceChildren();
  const negrito = document.createElement("b");
  negrito.textContent = rotulo;
  paragrafo.append(negrito, document.createTextNode(` ${texto}`));
}

function aprimorarBloco(bloco) {
  const titulo = tituloDoBloco(bloco);
  const correspondeManha = titulo === "Leitura da manhã";
  const correspondeNoite = titulo === "Leitura da noite";
  if (!correspondeManha && !correspondeNoite) return;

  const leitura = bloco.querySelector('div[class*="periodReading"]');
  if (!leitura) return;

  const destaqueParagrafo = encontrarParagrafo(leitura, "Destaque do período:");
  const atencaoParagrafo = encontrarParagrafo(leitura, "Ponto de atenção:");
  const acaoParagrafo = encontrarParagrafo(leitura, "Ação sugerida:");
  if (!destaqueParagrafo || !atencaoParagrafo || !acaoParagrafo) return;

  if (
    destaqueParagrafo.textContent?.includes(
      "melhor desempenho proporcional do turno"
    )
  ) {
    return;
  }

  const destaque = extrairLojaEPercentual(
    destaqueParagrafo.textContent,
    "Destaque do período"
  );
  const atencao = extrairLojaEPercentual(
    atencaoParagrafo.textContent,
    "Ponto de atenção"
  );
  if (!destaque || !atencao) return;

  const periodo = correspondeManha ? "manhã" : "noite";
  const desempenho = extrairDesempenho(bloco);

  preencherParagrafo(
    destaqueParagrafo,
    "Destaque do período:",
    `${destaque.codigo}, com ${destaque.percentual}% da própria Meta. O resultado indica o melhor desempenho proporcional do turno, mas os números não mostram sozinhos a causa.`
  );

  preencherParagrafo(
    atencaoParagrafo,
    "Ponto de atenção:",
    `${atencao.codigo}, com ${atencao.percentual}% da própria Meta. Compare com ${destaque.codigo} no mesmo turno, observando fluxo, abordagem, exposição, mix de produtos e conversão.`
  );

  let orientacao;
  if (desempenho !== null && desempenho < 100) {
    orientacao = `na reunião da ${periodo}, comparar ${atencao.codigo} com ${destaque.codigo}. Identificar diferenças observáveis e definir um teste prático para o próximo acompanhamento.`;
  } else if (desempenho !== null && desempenho >= 120) {
    orientacao = `na reunião da ${periodo}, mapear com a equipe de ${destaque.codigo} o que esteve presente nos melhores dias, documentar práticas observáveis e testar o que pode ser replicado nas demais lojas.`;
  } else {
    orientacao = `na reunião da ${periodo}, identificar com a equipe de ${destaque.codigo} quais abordagens, produtos, exposições ou condições de atendimento estiveram presentes nos melhores dias e avaliar o que pode ser adaptado às demais lojas.`;
  }

  preencherParagrafo(acaoParagrafo, "Ação sugerida:", orientacao);
}

function aprimorarFeedbacks() {
  document
    .querySelectorAll('article[class*="fullBlock"], details[class*="collapse"]')
    .forEach(aprimorarBloco);
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
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      observador.disconnect();
      if (quadro !== null) window.cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
