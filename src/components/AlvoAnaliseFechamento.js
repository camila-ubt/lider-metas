"use client";

import { useEffect } from "react";

function localizarRelatorio() {
  const area = document.querySelector("#fechamento-impressao");
  if (!area) return null;

  return (
    Array.from(area.querySelectorAll("div")).find((elemento) => {
      const texto = elemento.textContent || "";
      const secoesDiretas = Array.from(elemento.children).filter(
        (filho) => filho.tagName === "SECTION"
      );

      return (
        secoesDiretas.length >= 2 &&
        texto.includes("Resultado geral") &&
        texto.includes("Resultado por loja")
      );
    }) || null
  );
}

function localizarAcoes(relatorio) {
  return (
    Array.from(relatorio.querySelectorAll("div")).find((elemento) => {
      const botoes = Array.from(elemento.children).filter(
        (filho) => filho.tagName === "BUTTON"
      );
      return botoes.some((botao) =>
        /Salvar prévia em PDF|Imprimir \/ salvar PDF/.test(
          botao.textContent?.trim() || ""
        )
      );
    }) || null
  );
}

function ocultarSecoesRepetidas(relatorio) {
  const titulosOcultos = new Set([
    "Resultado por loja",
    "Mesmo mês, até o mesmo dia",
    "Insights do fechamento",
  ]);

  Array.from(relatorio.querySelectorAll("h3")).forEach((titulo) => {
    if (!titulosOcultos.has(titulo.textContent?.trim())) return;
    const secao = titulo.closest("section");
    if (secao) secao.hidden = true;
  });
}

function ocultarResumoDuplicado(alvo) {
  Array.from(alvo.querySelectorAll("h3")).forEach((titulo) => {
    if (titulo.textContent?.trim() !== "Resumo gerencial") return;
    const bloco = titulo.closest("article");
    if (bloco) bloco.hidden = true;
  });
}

function criarSlot(relatorio, id, classe, antesDe) {
  let alvo = relatorio.querySelector(`#${id}`);
  if (alvo) return alvo;

  alvo = document.createElement("div");
  alvo.id = id;
  alvo.className = classe;

  if (antesDe) relatorio.insertBefore(alvo, antesDe);
  else relatorio.appendChild(alvo);
  return alvo;
}

export default function AlvoAnaliseFechamento() {
  useEffect(() => {
    function organizarPrevia() {
      const relatorio = localizarRelatorio();
      if (!relatorio) return;

      ocultarSecoesRepetidas(relatorio);
      relatorio.classList.remove("FechamentoMensal_report");

      const acoes = localizarAcoes(relatorio);
      const alvoAnalise = criarSlot(
        relatorio,
        "analise-gerencial-fechamento",
        "FechamentoMensal_report analise-fechamento-slot",
        acoes
      );
      criarSlot(
        relatorio,
        "resumo-lojas-fechamento",
        "resumo-lojas-fechamento-slot",
        alvoAnalise
      );

      ocultarResumoDuplicado(alvoAnalise);
    }

    organizarPrevia();

    const observador = new MutationObserver(organizarPrevia);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
    });

    document.addEventListener("click", organizarPrevia, true);

    return () => {
      observador.disconnect();
      document.removeEventListener("click", organizarPrevia, true);
    };
  }, []);

  return null;
}
