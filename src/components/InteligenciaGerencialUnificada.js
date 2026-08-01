"use client";

import { useEffect } from "react";

const titulos = [
  "Comparativo histórico",
  "Projeção e inferência estatística",
  "Tendência e consistência",
];

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function encontrarBloco(titulo) {
  return Array.from(document.querySelectorAll("details")).find((item) => {
    if (item.closest(".inteligencia-gerencial-unificada")) return false;
    const resumo = item.querySelector(":scope > summary strong, :scope > summary h3, :scope > summary");
    return texto(resumo).startsWith(titulo);
  });
}

function ocultarCabecalhoAntigo() {
  const marcador = Array.from(document.querySelectorAll("p, span, strong")).find(
    (item) =>
      !item.closest(".inteligencia-gerencial-unificada") &&
      texto(item) === "LEITURA GERENCIAL AVANÇADA",
  );
  if (!marcador) return;

  let alvo = marcador.parentElement;
  while (alvo && alvo.parentElement && alvo.scrollHeight < 230) {
    if (alvo.querySelector("h1, h2") && texto(alvo).includes("Insights para as líderes")) break;
    alvo = alvo.parentElement;
  }

  if (alvo) {
    alvo.dataset.inteligenciaCabecalhoAntigo = "true";
    alvo.style.display = "none";
  }
}

function montar() {
  const existentes = titulos.map(encontrarBloco);
  if (existentes.some((item) => !item)) return;

  ocultarCabecalhoAntigo();
  existentes.forEach((bloco) => {
    bloco.style.display = "none";
    bloco.dataset.inteligenciaOriginal = "true";
  });

  if (document.querySelector(".inteligencia-gerencial-unificada")) return;

  const detalhes = document.createElement("details");
  detalhes.className = "inteligencia-gerencial-unificada";

  const resumo = document.createElement("summary");
  resumo.innerHTML = `
    <div>
      <strong>Inteligência gerencial</strong>
      <span>Histórico, projeções e tendências em uma única análise.</span>
    </div>
    <i>⌄</i>
  `;
  detalhes.appendChild(resumo);

  const conteudo = document.createElement("div");
  conteudo.className = "inteligencia-gerencial-conteudo";

  existentes.forEach((bloco, indice) => {
    const secao = document.createElement("section");
    secao.className = "inteligencia-gerencial-secao";

    const titulo = document.createElement("h3");
    titulo.textContent = titulos[indice];
    secao.appendChild(titulo);

    Array.from(bloco.children)
      .filter((filho) => filho.tagName !== "SUMMARY")
      .forEach((filho) => secao.appendChild(filho.cloneNode(true)));

    conteudo.appendChild(secao);
  });

  detalhes.appendChild(conteudo);
  existentes[0].parentElement.insertBefore(detalhes, existentes[0]);
}

export default function InteligenciaGerencialUnificada() {
  useEffect(() => {
    let agendado = null;

    const atualizar = () => {
      clearTimeout(agendado);
      agendado = setTimeout(montar, 120);
    };

    atualizar();

    const observador = new MutationObserver((mutacoes) => {
      const mudouForaDoBloco = mutacoes.some(
        (mutacao) => !mutacao.target.closest?.(".inteligencia-gerencial-unificada"),
      );
      if (mudouForaDoBloco) atualizar();
    });

    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(agendado);
      observador.disconnect();
      document.querySelector(".inteligencia-gerencial-unificada")?.remove();
      document.querySelectorAll('[data-inteligencia-original="true"]').forEach((item) => {
        item.style.display = "";
        delete item.dataset.inteligenciaOriginal;
      });
      document.querySelectorAll('[data-inteligencia-cabecalho-antigo="true"]').forEach((item) => {
        item.style.display = "";
        delete item.dataset.inteligenciaCabecalhoAntigo;
      });
    };
  }, []);

  return null;
}
