"use client";

import { useEffect } from "react";

export default function CorrecaoAbaManual() {
  useEffect(() => {
    let abaDestino = null;

    function manualAberto() {
      return Boolean(document.querySelector("[data-manual-usuario]"));
    }

    function navAtual() {
      return document.querySelector("nav.tabs");
    }

    function selecionar(botao) {
      const nav = navAtual();
      if (!nav || !botao?.isConnected) return;

      nav.querySelectorAll("button").forEach((item) => {
        item.classList.toggle("active", item === botao);
      });
    }

    function manterSelecaoManual() {
      const nav = navAtual();
      const botaoManual = nav?.querySelector("[data-manual-botao]");
      if (!nav || !botaoManual || !manualAberto() || abaDestino) return;
      selecionar(botaoManual);
    }

    function tratarClique(evento) {
      const botao = evento.target.closest("nav.tabs button");
      if (!botao) return;

      const clicouManual = botao.hasAttribute("data-manual-botao");

      if (clicouManual && manualAberto()) {
        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();
        selecionar(botao);
        return;
      }

      if (!clicouManual && manualAberto()) {
        abaDestino = botao;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            selecionar(abaDestino);
            abaDestino = null;
          });
        });
      }
    }

    document.addEventListener("click", tratarClique, true);

    const observador = new MutationObserver(() => {
      if (abaDestino && !manualAberto()) {
        selecionar(abaDestino);
        abaDestino = null;
        return;
      }

      manterSelecaoManual();
    });

    observador.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    manterSelecaoManual();

    return () => {
      document.removeEventListener("click", tratarClique, true);
      observador.disconnect();
    };
  }, []);

  return null;
}
