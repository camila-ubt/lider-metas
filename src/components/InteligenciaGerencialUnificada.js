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
  return normalizar(details.querySelector("summary")?.textContent);
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
  return Array.from(document.querySelectorAll("section, article, div")).find((elemento) => {
    const conteudo = normalizar(elemento.textContent);
    return (
      conteudo.includes("leitura gerencial avançada") &&
      conteudo.includes("insights para as líderes") &&
      elemento.querySelector("h2")
    );
  });
}

function criarUnificado(originais) {
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

  originais.forEach((original, indice) => {
    const secao = document.createElement("section");
    secao.className = "inteligencia-gerencial-secao";

    const titulo = document.createElement("h3");
    titulo.textContent = [
      "Comparativo histórico",
      "Projeção e inferência estatística",
      "Tendência e consistência",
    ][indice];
    secao.appendChild(titulo);

    const corpoOriginal = Array.from(original.children).filter(
      (filho) => filho.tagName !== "SUMMARY",
    );
    corpoOriginal.forEach((filho) => secao.appendChild(filho.cloneNode(true)));
    conteudo.appendChild(secao);
  });

  details.appendChild(summary);
  details.appendChild(conteudo);
  return details;
}

function montar() {
  const originais = localizarOriginais();
  if (originais.some((item) => !item)) return false;

  originais.forEach((item) => {
    item.style.setProperty("display", "none", "important");
    item.dataset.inteligenciaOriginal = "true";
  });

  const cabecalho = localizarCabecalho();
  if (cabecalho) {
    cabecalho.style.setProperty("display", "none", "important");
    cabecalho.dataset.inteligenciaCabecalho = "true";
  }

  let unificado = document.querySelector("details.inteligencia-gerencial-unificada");
  if (!unificado) unificado = criarUnificado(originais);

  const ultimoOriginal = originais[originais.length - 1];
  const pai = ultimoOriginal.parentElement;
  if (pai && unificado.parentElement !== pai) {
    pai.insertBefore(unificado, ultimoOriginal.nextSibling);
  } else if (pai && ultimoOriginal.nextSibling !== unificado) {
    pai.insertBefore(unificado, ultimoOriginal.nextSibling);
  }

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
        if (!pronto && tentativas < 30) {
          tentativas += 1;
          executar();
        }
      }, 100);
    };

    executar();

    const observador = new MutationObserver(() => executar());
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizador);
      observador.disconnect();
    };
  }, []);

  return null;
}
