"use client";

import { useEffect } from "react";

const TITULOS = [
  "comparativo histórico",
  "projeção e inferência estatística",
  "tendência e consistência",
];

function normalizar(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function encontrarAnalise() {
  return Array.from(document.querySelectorAll("section")).find((secao) => {
    const texto = normalizar(secao.textContent);
    return (
      texto.includes("insights para as líderes") &&
      texto.includes("comparativo histórico") &&
      texto.includes("projeção e inferência estatística") &&
      texto.includes("tendência e consistência")
    );
  });
}

function encontrarBloco(wrapper, titulo) {
  return Array.from(wrapper.querySelectorAll("details")).find((details) => {
    const summary = details.querySelector(":scope > summary");
    return normalizar(summary?.textContent).startsWith(titulo);
  });
}

function criarUnificado() {
  const details = document.createElement("details");
  details.className = "inteligencia-gerencial-unificada";

  const summary = document.createElement("summary");
  summary.innerHTML = `
    <div>
      <strong>Inteligência gerencial</strong>
      <span>Comparativo histórico, projeções e tendências.</span>
    </div>
    <i aria-hidden="true">⌄</i>
  `;

  const conteudo = document.createElement("div");
  conteudo.className = "inteligencia-gerencial-conteudo";

  details.append(summary, conteudo);
  return details;
}

function prepararBloco(bloco) {
  bloco.open = true;
  bloco.style.display = "block";
  bloco.style.margin = "0";
  bloco.style.border = "0";
  bloco.style.boxShadow = "none";
  bloco.style.background = "transparent";

  const summary = bloco.querySelector(":scope > summary");
  if (summary) summary.style.display = "none";
}

function montar() {
  const wrapper = encontrarAnalise();
  if (!wrapper) return false;

  const blocos = TITULOS.map((titulo) => encontrarBloco(wrapper, titulo));
  if (blocos.some((bloco) => !bloco)) return false;

  let unificado = document.querySelector("details.inteligencia-gerencial-unificada");
  if (!unificado) unificado = criarUnificado();

  const conteudo = unificado.querySelector(".inteligencia-gerencial-conteudo");
  if (!conteudo) return false;

  if (!unificado.isConnected) {
    wrapper.parentElement?.insertBefore(unificado, wrapper);
  }

  blocos.forEach((bloco) => {
    prepararBloco(bloco);
    if (bloco.parentElement !== conteudo) conteudo.appendChild(bloco);
  });

  wrapper.style.setProperty("display", "none", "important");
  wrapper.dataset.inteligenciaOculta = "true";
  return true;
}

export default function InteligenciaGerencialUnificada() {
  useEffect(() => {
    let tentativas = 0;
    let temporizador;

    const executar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (!montar() && tentativas < 50) {
          tentativas += 1;
          executar();
        }
      }, 120);
    };

    executar();

    const observador = new MutationObserver((mutacoes) => {
      const alteracaoExterna = mutacoes.some(
        (mutacao) => !mutacao.target.closest?.(".inteligencia-gerencial-unificada"),
      );
      if (alteracaoExterna) executar();
    });

    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizador);
      observador.disconnect();
    };
  }, []);

  return null;
}
