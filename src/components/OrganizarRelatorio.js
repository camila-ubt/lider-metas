"use client";

import { useEffect } from "react";

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function acharExato(seletor, valor) {
  return Array.from(document.querySelectorAll(seletor)).find(
    (elemento) => texto(elemento).toLowerCase() === valor.toLowerCase(),
  );
}

function acharInicio(seletor, valor) {
  return Array.from(document.querySelectorAll(seletor)).find((elemento) =>
    texto(elemento).toLowerCase().startsWith(valor.toLowerCase()),
  );
}

function cardMaisProximo(elemento) {
  if (!elemento) return null;
  return elemento.closest("section, article, details") || elemento.parentElement;
}

function inserirDepois(elemento, referencia) {
  const pai = referencia?.parentElement;
  if (!elemento || !referencia || !pai || elemento === referencia) return false;
  if (referencia.nextSibling === elemento) return true;
  pai.insertBefore(elemento, referencia.nextSibling);
  return true;
}

export default function OrganizarRelatorio() {
  useEffect(() => {
    let agendado = null;

    function organizar() {
      const rankingTitulo = acharExato("p,span,strong,h1,h2,h3,h4", "RANKING INTERATIVO");
      const ranking = cardMaisProximo(rankingTitulo);

      const roteiroTitulo = acharExato("p,span,strong,h1,h2,h3,h4", "ROTEIRO DA REUNIÃO");
      const roteiro = cardMaisProximo(roteiroTitulo);

      const graficoTitulo = acharExato("p,span,strong,h1,h2,h3,h4", "EVOLUÇÃO ACUMULADA");
      const grafico = cardMaisProximo(graficoTitulo);

      const inteligenciaTitulo = acharInicio("summary strong, summary h2, summary h3", "Inteligência gerencial");
      const inteligencia = inteligenciaTitulo?.closest("details") || null;

      // Só reorganiza quando todos os blocos realmente existem.
      // Isso evita esconder ou deslocar o painel em meses ainda sem dados.
      if (ranking && roteiro && grafico && inteligencia) {
        inserirDepois(roteiro, ranking);
        inserirDepois(grafico, roteiro);
        inserirDepois(inteligencia, grafico);
      }

      const cabecalhoMarcador = acharExato(
        "p,span,strong",
        "LEITURA GERENCIAL AVANÇADA",
      );
      if (cabecalhoMarcador && inteligencia) {
        const cabecalho = cardMaisProximo(cabecalhoMarcador);
        if (cabecalho && !cabecalho.contains(inteligencia)) cabecalho.style.display = "none";
      }

      const tituloNota = acharExato("h2,h3,h4", "Por que essa nota?");
      const blocoNota = cardMaisProximo(tituloNota);
      const textoNota =
        acharInicio("span", "Nota parcial") || acharInicio("span", "Nota final do mês");
      const botaoNota = textoNota?.parentElement;

      if (blocoNota && botaoNota && !botaoNota.dataset.notaInterativa) {
        blocoNota.style.display = "none";
        botaoNota.dataset.notaInterativa = "true";
        botaoNota.setAttribute("role", "button");
        botaoNota.setAttribute("tabindex", "0");
        botaoNota.setAttribute("aria-expanded", "false");
        botaoNota.style.cursor = "pointer";

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

    const solicitar = () => {
      clearTimeout(agendado);
      agendado = setTimeout(organizar, 120);
    };

    solicitar();
    const observador = new MutationObserver(solicitar);
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(agendado);
      observador.disconnect();
    };
  }, []);

  return null;
}
