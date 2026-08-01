"use client";

import { useEffect } from "react";

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function marcadorExato(seletor, valor) {
  return Array.from(document.querySelectorAll(seletor)).find(
    (elemento) => texto(elemento).toLowerCase() === valor.toLowerCase(),
  );
}

export default function OrganizarRelatorio() {
  useEffect(() => {
    let agendado = null;

    function organizar() {
      const marcadorRanking = marcadorExato("p", "Ranking interativo");
      const marcadorGrafico = marcadorExato("p", "Evolução acumulada");
      const marcadorRoteiro = marcadorExato("p", "ROTEIRO DA REUNIÃO");

      const ranking = marcadorRanking?.closest("article");
      const grafico = marcadorGrafico?.closest("article");
      const roteiro = marcadorRoteiro?.closest("section");
      const inteligencia = document.querySelector(
        "details.inteligencia-gerencial-unificada",
      );
      const dashboard = ranking?.parentElement;

      if (
        dashboard &&
        grafico?.parentElement === dashboard &&
        ranking?.parentElement === dashboard
      ) {
        // Ordem fixa dentro do dashboard:
        // ranking -> roteiro -> gráfico -> inteligência gerencial.
        dashboard.insertBefore(ranking, grafico);

        if (roteiro) {
          dashboard.insertBefore(roteiro, grafico);
        }

        if (inteligencia) {
          dashboard.insertBefore(inteligencia, grafico.nextSibling);
        }
      }

      const tituloNota = marcadorExato("h2,h3,h4", "Por que essa nota?");
      const blocoNota = tituloNota?.closest("div,section,article");
      const textoNota =
        marcadorExato("span", "Nota parcial") ||
        marcadorExato("span", "Nota final do mês");
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
      agendado = setTimeout(organizar, 100);
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
