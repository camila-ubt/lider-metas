"use client";

import { useEffect } from "react";

export default function RodapeAutoria() {
  useEffect(() => {
    let rodape = document.querySelector("footer.rodape-autoria");

    if (!rodape) {
      rodape = document.createElement("footer");
      rodape.className = "rodape-autoria";
      rodape.innerHTML = `
        <span>© 2026 Líder Metas</span>
        <span aria-hidden="true"> • </span>
        <a href="https://github.com/camila-ubt/lider-metas/releases" target="_blank" rel="noopener noreferrer" aria-label="Ver releases do Líder Metas">
          v1.0.0
        </a>
        <span aria-hidden="true"> • </span>
        <span>Desenvolvido por</span>
        <a href="https://github.com/camila-ubt" target="_blank" rel="noopener noreferrer">
          @camila-ubt
        </a>
      `;
    }

    let reposicionando = false;

    function posicionarNoFinal() {
      if (reposicionando || !document.body) return;
      if (rodape.parentElement === document.body && document.body.lastElementChild === rodape) return;

      reposicionando = true;
      document.body.appendChild(rodape);
      reposicionando = false;
    }

    posicionarNoFinal();

    const observador = new MutationObserver(() => {
      requestAnimationFrame(posicionarNoFinal);
    });

    observador.observe(document.body, {
      childList: true,
    });

    return () => {
      observador.disconnect();
      rodape.remove();
    };
  }, []);

  return null;
}
