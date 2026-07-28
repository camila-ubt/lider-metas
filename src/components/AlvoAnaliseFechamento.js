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

function ocultarSecoesAntigas(relatorio) {
  Array.from(relatorio.querySelectorAll("h3")).forEach((titulo) => {
    const texto = titulo.textContent?.trim();
    if (texto !== "Mesmo mês, até o mesmo dia" && texto !== "Insights do fechamento") {
      return;
    }

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

export default function AlvoAnaliseFechamento() {
  useEffect(() => {
    function organizarPrevia() {
      const relatorio = localizarRelatorio();
      if (!relatorio) return;

      ocultarSecoesAntigas(relatorio);
      relatorio.classList.remove("FechamentoMensal_report");

      let alvo = relatorio.querySelector("#analise-gerencial-fechamento");
      if (!alvo) {
        alvo = document.createElement("div");
        alvo.id = "analise-gerencial-fechamento";
        alvo.className = "FechamentoMensal_report analise-fechamento-slot";

        const acoes = localizarAcoes(relatorio);
        if (acoes) relatorio.insertBefore(alvo, acoes);
        else relatorio.appendChild(alvo);
      }

      ocultarResumoDuplicado(alvo);
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
