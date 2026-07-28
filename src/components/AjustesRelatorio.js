"use client";

import { useEffect } from "react";

function localizarRelatorioFechamento() {
  const area = document.querySelector("#fechamento-impressao");
  if (!area) return null;

  return Array.from(area.querySelectorAll("div")).find((elemento) => {
    const texto = elemento.textContent || "";
    const secoesDiretas = Array.from(elemento.children).filter(
      (filho) => filho.tagName === "SECTION"
    );

    return (
      secoesDiretas.length >= 3 &&
      texto.includes("Resultado geral") &&
      texto.includes("Evolução do mês")
    );
  }) || null;
}

function removerBlocosAntigosDoPainel() {
  const titulos = Array.from(document.querySelectorAll("h2"));

  titulos.forEach((titulo) => {
    const texto = titulo.textContent?.trim();
    if (texto !== "Mesmo mês, até o mesmo dia" && texto !== "O que merece atenção") {
      return;
    }

    const cartao = titulo.closest("article");
    if (cartao && !cartao.closest("#fechamento-impressao")) {
      cartao.hidden = true;
    }
  });
}

function removerBlocosAntigosDaPrevia() {
  const area = document.querySelector("#fechamento-impressao");
  if (!area) return;

  Array.from(area.querySelectorAll("h3")).forEach((titulo) => {
    const texto = titulo.textContent?.trim();
    if (texto !== "Mesmo mês, até o mesmo dia" && texto !== "Insights do fechamento") {
      return;
    }

    const secao = titulo.closest("section");
    if (secao) secao.hidden = true;
  });
}

export default function AjustesRelatorio() {
  useEffect(() => {
    function aplicarAjustes() {
      removerBlocosAntigosDoPainel();
      removerBlocosAntigosDaPrevia();

      const relatorio = localizarRelatorioFechamento();
      if (relatorio && !relatorio.classList.contains("FechamentoMensal_report")) {
        relatorio.classList.add("FechamentoMensal_report");
      }
    }

    aplicarAjustes();

    const observador = new MutationObserver(aplicarAjustes);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });

    document.addEventListener("click", aplicarAjustes, true);
    return () => {
      observador.disconnect();
      document.removeEventListener("click", aplicarAjustes, true);
    };
  }, []);

  return null;
}
