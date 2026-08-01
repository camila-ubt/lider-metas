"use client";

import { useEffect } from "react";

export default function CorrecaoAbaManual() {
  useEffect(() => {
    function manualAberto() {
      return Boolean(document.querySelector("[data-manual-usuario]"));
    }

    function manterSelecao() {
      const nav = document.querySelector("nav.tabs");
      const botaoManual = nav?.querySelector("[data-manual-botao]");
      if (!nav || !botaoManual || !manualAberto()) return;

      nav.querySelectorAll("button").forEach((botao) => {
        botao.classList.toggle("active", botao === botaoManual);
      });
    }

    function impedirFechamentoAoRepetir(evento) {
      const botao = evento.target.closest("[data-manual-botao]");
      if (!botao || !manualAberto()) return;

      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();
      manterSelecao();
    }

    document.addEventListener("click", impedirFechamentoAoRepetir, true);

    const observador = new MutationObserver(manterSelecao);
    observador.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    manterSelecao();

    return () => {
      document.removeEventListener("click", impedirFechamentoAoRepetir, true);
      observador.disconnect();
    };
  }, []);

  return null;
}
