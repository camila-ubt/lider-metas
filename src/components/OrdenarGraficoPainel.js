"use client";

import { useEffect } from "react";

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function marcadorExato(valor) {
  return Array.from(document.querySelectorAll("p")).find(
    (elemento) => texto(elemento).toLowerCase() === valor.toLowerCase(),
  );
}

export default function OrdenarGraficoPainel() {
  useEffect(() => {
    let quadro = null;

    function organizar() {
      quadro = null;

      const grafico = marcadorExato("EVOLUÇÃO ACUMULADA")?.closest("article");
      const ranking = marcadorExato("RANKING INTERATIVO")?.closest("article");
      const painel = grafico?.parentElement;

      if (!painel || !grafico || !ranking || ranking.parentElement !== painel) {
        return;
      }

      const filhos = Array.from(painel.children);
      const posicaoGrafico = filhos.indexOf(grafico);
      const posicaoRanking = filhos.indexOf(ranking);

      if (posicaoGrafico < 0 || posicaoRanking < 0) return;

      filhos.forEach((filho, indice) => {
        if (filho instanceof HTMLElement) filho.style.order = String(indice);
      });

      ranking.style.order = String(posicaoGrafico);
      grafico.style.order = String(posicaoRanking);
    }

    function agendar() {
      if (quadro !== null) return;
      quadro = requestAnimationFrame(organizar);
    }

    agendar();
    document.addEventListener("click", agendar, true);
    document.addEventListener("change", agendar, true);

    const observador = new MutationObserver(agendar);
    observador.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      document.removeEventListener("click", agendar, true);
      document.removeEventListener("change", agendar, true);
      observador.disconnect();
      if (quadro !== null) cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
