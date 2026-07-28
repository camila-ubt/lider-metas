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

export default function AlvoAnaliseFechamento() {
  useEffect(() => {
    function marcarRelatorio() {
      const relatorio = localizarRelatorio();
      if (relatorio) relatorio.classList.add("FechamentoMensal_report");
    }

    marcarRelatorio();

    const observador = new MutationObserver(marcarRelatorio);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
    });

    document.addEventListener("click", marcarRelatorio, true);

    return () => {
      observador.disconnect();
      document.removeEventListener("click", marcarRelatorio, true);
    };
  }, []);

  return null;
}
