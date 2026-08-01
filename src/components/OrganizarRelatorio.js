"use client";

import { useEffect } from "react";

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function achar(seletor, trecho) {
  return Array.from(document.querySelectorAll(seletor)).find((elemento) =>
    texto(elemento).toLowerCase().includes(trecho.toLowerCase()),
  );
}

function cardMaisProximo(elemento) {
  let atual = elemento;
  while (atual && atual !== document.body) {
    const estilo = getComputedStyle(atual);
    if (
      atual.tagName === "SECTION" ||
      atual.tagName === "ARTICLE" ||
      (estilo.borderRadius !== "0px" && texto(atual).length > 40)
    ) {
      return atual;
    }
    atual = atual.parentElement;
  }
  return elemento?.parentElement || null;
}

function inserirDepois(elemento, referencia) {
  const pai = referencia?.parentElement;
  if (!elemento || !referencia || !pai) return false;
  if (referencia.nextSibling === elemento) return true;
  pai.insertBefore(elemento, referencia.nextSibling);
  return true;
}

export default function OrganizarRelatorio() {
  useEffect(() => {
    function organizar() {
      const cabecalhoAntigo = achar("section,article,div", "LEITURA GERENCIAL AVANÇADA");
      const cardCabecalho = cabecalhoAntigo ? cardMaisProximo(cabecalhoAntigo) : null;
      if (cardCabecalho) cardCabecalho.style.display = "none";

      const rankingTitulo = achar("h1,h2,h3,h4,p,span,strong", "RANKING INTERATIVO");
      const ranking = rankingTitulo ? cardMaisProximo(rankingTitulo) : null;

      const roteiro = document.querySelector("section[class*='wrap']");

      const tituloGrafico = achar("h1,h2,h3,h4,p,span,strong", "EVOLUÇÃO ACUMULADA");
      const grafico = tituloGrafico ? cardMaisProximo(tituloGrafico) : null;

      const inteligenciaResumo = achar("summary,strong,h2,h3", "Inteligência gerencial");
      const inteligencia = inteligenciaResumo?.closest("details") || cardMaisProximo(inteligenciaResumo);

      if (ranking && roteiro) inserirDepois(roteiro, ranking);
      if (roteiro && grafico) inserirDepois(grafico, roteiro);
      if (grafico && inteligencia) inserirDepois(inteligencia, grafico);

      const tituloNota = achar("h2,h3,h4", "Por que essa nota?");
      const blocoNota = tituloNota ? cardMaisProximo(tituloNota) : null;
      const textoNota =
        achar("span,div", "Nota parcial") || achar("span,div", "Nota final do mês");
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
