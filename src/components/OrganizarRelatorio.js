"use client";

import { useEffect } from "react";

function cardMaisProximo(elemento) {
  let atual = elemento;
  while (atual && atual !== document.body) {
    const texto = atual.textContent || "";
    const estilo = getComputedStyle(atual);
    if (
      atual.tagName === "SECTION" ||
      atual.tagName === "ARTICLE" ||
      (estilo.borderRadius !== "0px" && texto.length > 40)
    ) return atual;
    atual = atual.parentElement;
  }
  return elemento?.parentElement || null;
}

function achar(seletor, texto) {
  return Array.from(document.querySelectorAll(seletor)).find((el) =>
    (el.textContent || "").trim().toLowerCase().includes(texto.toLowerCase()),
  );
}

export default function OrganizarRelatorio() {
  useEffect(() => {
    function organizar() {
      const cabecalhoAntigo = achar("section,article,div", "LEITURA GERENCIAL AVANÇADA");
      const cardCabecalho = cabecalhoAntigo ? cardMaisProximo(cabecalhoAntigo) : null;
      if (cardCabecalho) cardCabecalho.style.display = "none";

      const tituloGrafico = achar("h1,h2,h3,h4,p,span", "EVOLUÇÃO ACUMULADA");
      const grafico = tituloGrafico ? cardMaisProximo(tituloGrafico) : null;
      const inteligencia = achar("summary,h2,h3,strong", "Inteligência gerencial");
      const cardInteligencia = inteligencia ? cardMaisProximo(inteligencia) : null;
      const previa = achar("button,a", "Prévia / fechamento");

      if (grafico && !grafico.dataset.movidoParaFinal) {
        const destino = cardInteligencia?.parentElement || previa?.parentElement;
        if (destino) {
          if (previa && previa.parentElement === destino) destino.insertBefore(grafico, previa);
          else if (cardInteligencia?.nextSibling) destino.insertBefore(grafico, cardInteligencia.nextSibling);
          else destino.appendChild(grafico);
          grafico.dataset.movidoParaFinal = "true";
        }
      }

      const tituloNota = achar("h2,h3,h4", "Por que essa nota?");
      const blocoNota = tituloNota ? cardMaisProximo(tituloNota) : null;
      const textoNota = achar("span,div", "Nota parcial") || achar("span,div", "Nota final do mês");
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
          if (!aberto) blocoNota.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

    organizar();
    const observador = new MutationObserver(() => requestAnimationFrame(organizar));
    observador.observe(document.body, { subtree: true, childList: true });
    return () => observador.disconnect();
  }, []);

  return null;
}
