"use client";

import { useEffect } from "react";

const substituicoes = new Map([
  [
    "Supermeta corresponde a 120% da Meta.",
    "Supermeta corresponde a 110% da Meta.",
  ],
  [
    "Megameta corresponde a 130% da Meta.",
    "Megameta corresponde a 120% da Meta.",
  ],
  [
    "Supermeta e Megameta são calculadas automaticamente em 120% e 130%.",
    "Supermeta e Megameta são calculadas automaticamente em 110% e 120%.",
  ],
  [
    "Um período pode atingir 130% enquanto outro fica abaixo, fazendo o total combinado permanecer entre 120% e 129,9%.",
    "Um período pode atingir 120% enquanto outro fica abaixo, fazendo o total combinado permanecer entre 110% e 119,9%.",
  ],
]);

function atualizarTextos() {
  const caminhante = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
  );

  let no = caminhante.nextNode();
  while (no) {
    const elemento = no.parentElement;
    if (elemento && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(elemento.tagName)) {
      const atual = no.nodeValue?.trim();
      const novo = substituicoes.get(atual);
      if (novo) no.nodeValue = no.nodeValue.replace(atual, novo);
    }
    no = caminhante.nextNode();
  }
}

export default function AtualizarTextosNiveis() {
  useEffect(() => {
    let quadro = null;

    function agendar() {
      if (quadro !== null) return;
      quadro = requestAnimationFrame(() => {
        quadro = null;
        atualizarTextos();
      });
    }

    agendar();
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observador.disconnect();
      if (quadro !== null) cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
