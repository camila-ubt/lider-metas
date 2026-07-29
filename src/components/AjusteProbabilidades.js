"use client";

import { useEffect } from "react";

function numeroPercentual(texto) {
  const correspondencia = String(texto || "").trim().match(/^([\d.,]+)%$/);
  if (!correspondencia) return null;

  const numero = Number(correspondencia[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function ajustarProbabilidades() {
  document.querySelectorAll('div[class*="probabilityRow"]').forEach((linha) => {
    const texto = linha.querySelector("span");
    if (!texto) return;

    const valor = numeroPercentual(texto.textContent);
    if (valor === null || valor >= 1) return;

    texto.textContent = "menos de 1% · chance muito baixa";

    const barra = linha.querySelector('div[class*="probabilityTrack"] i');
    if (barra) barra.style.width = "1%";
  });
}

export default function AjusteProbabilidades() {
  useEffect(() => {
    ajustarProbabilidades();

    const observador = new MutationObserver(ajustarProbabilidades);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
    });

    return () => observador.disconnect();
  }, []);

  return null;
}
