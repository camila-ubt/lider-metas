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

  let atual = marcador;
  let melhor = marcador.closest("section, article, div");

  while (atual && atual !== document.body) {
    const estilo = getComputedStyle(atual);
    const raio = parseFloat(estilo.borderTopLeftRadius || "0");
    const conteudo = texto(atual);

    if (raio >= 12 && conteudo.length >= 40 && conteudo.length <= 6000) {
      melhor = atual;
    }

    if (atual.parentElement?.tagName === "MAIN") break;
    atual = atual.parentElement;
  }

  return melhor;
}

function acharCardPorTitulo(titulo) {
  return cardVisualDo(
    acharTextoExato("h1,h2,h3,h4,p,span,strong", titulo),
  );
}

export default function OrganizarRelatorio() {
  useEffect(() => {
    let agendado = null;

    function organizar() {
      const ranking = acharCardPorTitulo("RANKING INTERATIVO");
      const roteiro = acharTextoExato("p", "ROTEIRO DA REUNIÃO")?.closest("section");
      const grafico = acharCardPorTitulo("EVOLUÇÃO ACUMULADA");
      const inteligencia = document.querySelector("details.inteligencia-gerencial-unificada");

      if (ranking && roteiro && grafico && inteligencia) {
        const destino = grafico.parentElement;

        if (destino) {
          destino.insertBefore(ranking, grafico);
          destino.insertBefore(roteiro, grafico);
          destino.insertBefore(inteligencia, grafico.nextSibling);
        }
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
      agendado = setTimeout(organizar, 180);
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
