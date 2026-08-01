"use client";

import { useEffect } from "react";

export default function RodapeAutoria() {
  useEffect(() => {
    let rodape = document.querySelector("footer.rodape-autoria");

    if (!rodape) {
      rodape = document.createElement("footer");
      rodape.className = "rodape-autoria";
      rodape.innerHTML = `
        Produzido por
        <a href="https://github.com/camila-ubt" target="_blank" rel="noopener noreferrer">
          @camila-ubt
        </a>
      `;
    }

    function posicionarNoFinal() {
      const main = document.querySelector("main.app-shell");
      if (!main) return;

      if (rodape.parentElement !== main || main.lastElementChild !== rodape) {
        main.appendChild(rodape);
      }
    }

    posicionarNoFinal();

    const observador = new MutationObserver(posicionarNoFinal);
    observador.observe(document.body, { childList: true, subtree: true });

    return () => {
      observador.disconnect();
      rodape.remove();
    };
  }, []);

  return null;
}
