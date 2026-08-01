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
    if (item.classList.contains("inteligencia-gerencial-unificada")) return false;
    const resumo = item.querySelector(":scope > summary");
    return texto(resumo).startsWith(titulo);
  });
}

function encontrarCabecalho() {
  const marcador = Array.from(document.querySelectorAll("p, span, strong")).find(
    (item) =>
      !item.closest(".inteligencia-gerencial-unificada") &&
      texto(item) === "LEITURA GERENCIAL AVANÇADA",
  );

  if (!marcador) return null;
  return marcador.closest("section, article") || marcador.parentElement;
}

function criarBloco(existentes) {
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

  detalhes.appendChild(resumo);
  detalhes.appendChild(conteudo);
  return detalhes;
}

function montar() {
  const existentes = titulos.map(encontrarBloco);
  const cabecalho = encontrarCabecalho();

  if (!cabecalho || existentes.some((item) => !item)) return;

  existentes.forEach((bloco) => {
    bloco.style.display = "none";
    bloco.dataset.inteligenciaOriginal = "true";
  });

  cabecalho.style.display = "none";
  cabecalho.dataset.inteligenciaCabecalhoAntigo = "true";

  let unificado = document.querySelector(".inteligencia-gerencial-unificada");
  if (!unificado) unificado = criarBloco(existentes);

  cabecalho.parentElement?.insertBefore(unificado, cabecalho);
}

export default function InteligenciaGerencialUnificada() {
  useEffect(() => {
    let agendado = null;

    const atualizar = () => {
      clearTimeout(agendado);
      agendado = setTimeout(montar, 150);
    };

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
