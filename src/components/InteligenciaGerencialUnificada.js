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

function tituloDoDetails(details) {
  return normalizar(details.querySelector(":scope > summary")?.textContent);
}

function localizarOriginais() {
  const todos = Array.from(document.querySelectorAll("details"));
  return TITULOS.map((titulo) =>
    todos.find(
      (details) =>
        !details.classList.contains("inteligencia-gerencial-unificada") &&
        tituloDoDetails(details).startsWith(titulo),
    ),
  );
}

function localizarCabecalho() {
  const marcador = Array.from(document.querySelectorAll("p, span, strong")).find(
    (elemento) => normalizar(elemento.textContent) === "leitura gerencial avançada",
  );
  if (!marcador) return null;

  let atual = marcador.parentElement;
  while (atual && atual !== document.body) {
    const conteudo = normalizar(atual.textContent);
    if (conteudo.includes("insights para as líderes") && atual.querySelector("h2")) {
      return atual;
    }
    atual = atual.parentElement;
  }
  return null;
}

function criarUnificado() {
  const details = document.createElement("details");
  details.className = "inteligencia-gerencial-unificada";
  details.dataset.criadoPelaUnificacao = "true";

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

  details.appendChild(summary);
  details.appendChild(conteudo);
  return details;
}

function prepararOriginal(original) {
  original.open = true;
  original.dataset.inteligenciaOriginal = "true";
  original.style.setProperty("display", "block", "important");

  const summary = original.querySelector(":scope > summary");
  if (summary) summary.style.setProperty("display", "none", "important");
}

function montar() {
  const originais = localizarOriginais();
  if (originais.some((item) => !item)) return false;

  const cabecalho = localizarCabecalho();
  if (cabecalho) {
    cabecalho.style.setProperty("display", "none", "important");
    cabecalho.dataset.inteligenciaCabecalho = "true";
  }

  let unificado = document.querySelector("details.inteligencia-gerencial-unificada");
  if (!unificado) unificado = criarUnificado();

  const conteudo = unificado.querySelector(".inteligencia-gerencial-conteudo");
  if (!conteudo) return false;

  const primeiroOriginal = originais[0];
  const paiOriginal = primeiroOriginal.parentElement;

  if (!unificado.isConnected && paiOriginal) {
    paiOriginal.insertBefore(unificado, primeiroOriginal);
  }

  originais.forEach((original) => {
    prepararOriginal(original);
    if (original.parentElement !== conteudo) conteudo.appendChild(original);
  });

  return true;
}

export default function InteligenciaGerencialUnificada() {
  useEffect(() => {
    let tentativas = 0;
    let temporizador;

    const executar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const pronto = montar();
        if (!pronto && tentativas < 40) {
          tentativas += 1;
          executar();
        }
      }, 120);
    };

    executar();

    const observador = new MutationObserver((mutacoes) => {
      const mudouFora = mutacoes.some(
        (mutacao) => !mutacao.target.closest?.(".inteligencia-gerencial-unificada"),
      );
      if (mudouFora) executar();
    });
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizador);
      observador.disconnect();
    };
  }, []);

  return null;
}
