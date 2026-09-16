"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./OrdenacaoResumoPA.module.css";

function localizarResumo() {
  const titulo = [...document.querySelectorAll("p")].find(
    (item) => item.textContent?.trim().toLowerCase() === "resumo do mês",
  );
  const painel = titulo?.closest("section");
  if (!painel) return { lista: null, cabecalho: null };

  const lista = [...painel.querySelectorAll("div")].find((item) => {
    const filhos = [...item.children];
    return filhos.length > 0
      && filhos.every((filho) => filho.tagName === "BUTTON" && /PA\s*[\d,.]+/i.test(filho.textContent || ""));
  }) || null;

  return { lista, cabecalho: titulo.parentElement?.parentElement || null };
}

function paDoCard(card) {
  const match = (card.textContent || "").match(/PA\s*([\d]+[,.]\d+)/i);
  return match ? Number(match[1].replace(",", ".")) : 0;
}

function numeroDoCard(card) {
  const match = (card.textContent || "").trim().match(/^(?:✓\s*)?(\d+)\s*[—-]/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export default function OrdenacaoResumoPA() {
  const [ordem, setOrdem] = useState("numero");
  const [destino, setDestino] = useState(null);

  useEffect(() => {
    function ordenar() {
      const { lista, cabecalho } = localizarResumo();
      setDestino((atual) => (atual === cabecalho ? atual : cabecalho));
      if (!lista) return;

      const cards = [...lista.children].filter((item) => item.tagName === "BUTTON");
      cards.sort((a, b) => {
        if (ordem === "maior") return paDoCard(b) - paDoCard(a) || numeroDoCard(a) - numeroDoCard(b);
        if (ordem === "menor") return paDoCard(a) - paDoCard(b) || numeroDoCard(a) - numeroDoCard(b);
        return numeroDoCard(a) - numeroDoCard(b);
      });
      cards.forEach((card) => lista.appendChild(card));
    }

    ordenar();
    const observer = new MutationObserver(() => window.requestAnimationFrame(ordenar));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ordem]);

  if (!destino) return null;

  return createPortal(
    <div className={styles.control} aria-label="Ordenação do resumo de PA">
      <label htmlFor="ordenacao-resumo-pa">Ordenar</label>
      <select id="ordenacao-resumo-pa" value={ordem} onChange={(event) => setOrdem(event.target.value)}>
        <option value="numero">Nº da vendedora</option>
        <option value="maior">Maior PA → menor PA</option>
        <option value="menor">Menor PA → maior PA</option>
      </select>
    </div>,
    destino,
  );
}
