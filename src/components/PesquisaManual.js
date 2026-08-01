"use client";

import { useEffect } from "react";
import styles from "./PesquisaManual.module.css";

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function PesquisaManual() {
  useEffect(() => {
    let campo = null;
    let aviso = null;
    let manualAtual = null;

    function removerBusca() {
      campo?.closest(`.${styles.searchWrap}`)?.remove();
      aviso?.remove();
      campo = null;
      aviso = null;
      manualAtual = null;
    }

    function filtrar(manual, termoDigitado) {
      const termo = normalizar(termoDigitado);
      let encontrados = 0;

      manual.querySelectorAll("section").forEach((grupo) => {
        const titulo = grupo.querySelector("h3");
        const itens = Array.from(grupo.querySelectorAll("details"));
        if (!titulo || !itens.length) return;

        let grupoTemResultado = false;

        itens.forEach((item) => {
          const corresponde = !termo || normalizar(item.textContent).includes(termo);
          item.hidden = !corresponde;
          if (corresponde) {
            grupoTemResultado = true;
            encontrados += 1;
          }
        });

        grupo.hidden = !grupoTemResultado;
      });

      if (aviso) {
        aviso.hidden = encontrados > 0;
        aviso.textContent = termoDigitado.trim()
          ? `Nenhuma dúvida encontrada para “${termoDigitado.trim()}”.`
          : "Nenhuma dúvida encontrada.";
      }
    }

    function instalar() {
      const manual = document.querySelector("[data-manual-usuario]");
      if (!manual) {
        if (manualAtual) removerBusca();
        return;
      }

      if (manual === manualAtual && campo?.isConnected) return;
      removerBusca();
      manualAtual = manual;

      const hero = manual.firstElementChild;
      const intro = hero?.querySelector("p:nth-of-type(2)");
      const pontoInsercao = hero?.querySelector("div");
      if (!hero) return;

      const wrap = document.createElement("div");
      wrap.className = styles.searchWrap;

      const label = document.createElement("label");
      label.className = styles.searchLabel;
      label.textContent = "Buscar no manual";

      campo = document.createElement("input");
      campo.type = "search";
      campo.placeholder = "Digite uma palavra: pendência, meta, horário...";
      campo.autocomplete = "off";
      campo.className = styles.searchInput;
      campo.setAttribute("aria-label", "Buscar dúvida no manual do usuário");

      label.appendChild(campo);
      wrap.appendChild(label);

      if (pontoInsercao) hero.insertBefore(wrap, pontoInsercao);
      else if (intro) intro.insertAdjacentElement("afterend", wrap);
      else hero.appendChild(wrap);

      aviso = document.createElement("p");
      aviso.className = styles.empty;
      aviso.hidden = true;
      manual.querySelector(`.${styles.sections}`)?.appendChild(aviso);

      campo.addEventListener("input", () => filtrar(manual, campo.value));
    }

    instalar();
    const observador = new MutationObserver(instalar);
    observador.observe(document.body, { childList: true, subtree: true });

    return () => {
      observador.disconnect();
      removerBusca();
    };
  }, []);

  return null;
}
