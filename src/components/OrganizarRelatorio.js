"use client";

import { useEffect } from "react";

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function acharTextoExato(seletor, valor) {
  return Array.from(document.querySelectorAll(seletor)).find(
    (elemento) => texto(elemento).toLowerCase() === valor.toLowerCase(),
  );
}

function cardVisualDo(marcador) {
  if (!marcador) return null;

  let atual = marcador.parentElement;
  let fallback = marcador.closest("section, article");

  while (atual && atual !== document.body) {
    const estilo = getComputedStyle(atual);
    const raio = parseFloat(estilo.borderTopLeftRadius || "0");
    const conteudo = texto(atual);

    if (
      raio >= 12 &&
      conteudo.length >= 40 &&
      conteudo.length <= 5000 &&
      atual.parentElement &&
      atual.parentElement !== document.body
    ) {
      return atual;
    }

    atual = atual.parentElement;
  }

  return fallback;
}

function acharCardPorTitulo(titulo) {
  const marcador = acharTextoExato("h1,h2,h3,h4,p,span,strong", titulo);
  return cardVisualDo(marcador);
}

function inserirDepois(elemento, referencia) {
  if (!elemento || !referencia || !referencia.parentElement) return false;
  referencia.parentElement.insertBefore(elemento, referencia.nextSibling);
  return true;
}

export default function OrganizarRelatorio() {
  useEffect(() => {
    let agendado = null;

    function organizar() {
      const ranking = acharCardPorTitulo("RANKING INTERATIVO");
      const marcadorRoteiro = acharTextoExato("p", "ROTEIRO DA REUNIÃO");
      const roteiro = marcadorRoteiro?.closest("section");
      const grafico = acharCardPorTitulo("EVOLUÇÃO ACUMULADA");
      const inteligencia = document.querySelector("details.inteligencia-gerencial-unificada");

      if (ranking && roteiro && ranking.nextElementSibling !== roteiro) {
        inserirDepois(roteiro, ranking);
      }

      if (roteiro && grafico && roteiro.nextElementSibling !== grafico) {
        inserirDepois(grafico, roteiro);
      }

      if (grafico && inteligencia && grafico.nextElementSibling !== inteligencia) {
        inserirDepois(inteligencia, grafico);
      }

      const tituloNota = acharTextoExato("h2,h3,h4", "Por que essa nota?");
      const blocoNota = tituloNota?.closest("div,section,article");
      const textoNota =
        acharTextoExato("span", "Nota parcial") ||
        acharTextoExato("span", "Nota final do mês");
      const botaoNota = textoNota?.parentElement;

      if (blocoNota && botaoNota && !botaoNota.dataset.notaInterativa) {
        blocoNota.style.display = "none";
        botaoNota.dataset.notaInterativa = "true";
        botaoNota.setAttribute("role", "button");
        botaoNota.setAttribute("tabindex", "0");
        botaoNota.setAttribute("aria-expanded", "false");
        botaoNota.style.cursor = "pointer";
        botaoNota.title = "Toque para ver o motivo da nota";

        const alternar = () => {
          const aberto = blocoNota.style.display !== "none";
          blocoNota.style.display = aberto ? "none" : "block";
          botaoNota.setAttribute("aria-expanded", String(!aberto));
        };

        botaoNota.addEventListener("click", alternar);
        botaoNota.addEventListener("keydown", (evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            alternar();
          }
        });
      }
    }

    function atualizar() {
      clearTimeout(agendado);
      agendado = setTimeout(organizar, 150);
    }

    atualizar();
    const observador = new MutationObserver(atualizar);
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(agendado);
      observador.disconnect();
    };
  }, []);

  return null;
}
