"use client";

import { useEffect } from "react";

const BLOCOS = [
  {
    origem: "comparativo histórico",
    titulo: "📊 Comparativo histórico",
  },
  {
    origem: "projeção e inferência estatística",
    titulo: "📈 Projeção estatística",
  },
  {
    origem: "tendência e consistência",
    titulo: "📉 Tendências",
  },
];

function normalizar(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function localizarAnaliseOriginal() {
  const marcador = Array.from(document.querySelectorAll("p")).find(
    (elemento) => normalizar(elemento.textContent) === "leitura gerencial avançada",
  );

  return marcador?.closest("section") || null;
}

function localizarBloco(secao, titulo) {
  return Array.from(secao.querySelectorAll("details")).find((details) => {
    if (details.classList.contains("inteligencia-gerencial-unificada")) return false;
    const summary = details.querySelector(":scope > summary");
    const strong = summary?.querySelector("strong");
    return normalizar(strong?.textContent || summary?.textContent).startsWith(titulo);
  });
}

function textoDoParagrafo(bloco, teste) {
  return Array.from(bloco.querySelectorAll("p"))
    .map((item) => item.textContent?.trim())
    .find((texto) => texto && teste(normalizar(texto)));
}

function gerarInsights(blocos) {
  const [historico, projecao, tendencia] = blocos;
  const insights = [];

  const comparacao = textoDoParagrafo(
    historico,
    (texto) => texto.includes("mesmo período") || texto.includes("mesmo periodo"),
  );
  if (comparacao) insights.push(comparacao);

  const supermeta = Array.from(projecao.querySelectorAll("strong")).find(
    (item) => normalizar(item.textContent) === "supermeta",
  );
  const chanceSuper = supermeta?.parentElement?.querySelector("span")?.textContent?.trim();
  if (chanceSuper) insights.push(`A probabilidade de Supermeta é de ${chanceSuper}.`);

  const artigos = Array.from(tendencia.querySelectorAll("article"));
  const artigoRitmo = artigos.find(
    (artigo) =>
      normalizar(artigo.querySelector("span")?.textContent) === "tendência recente",
  );
  const ritmo = artigoRitmo?.querySelector("strong")?.textContent?.trim();
  const detalheRitmo = artigoRitmo?.querySelector("p")?.textContent?.trim();
  if (ritmo) {
    insights.push(`O ritmo recente está ${ritmo}.${detalheRitmo ? ` ${detalheRitmo}` : ""}`);
  }

  const artigoRegularidade = artigos.find(
    (artigo) => normalizar(artigo.querySelector("span")?.textContent) === "regularidade",
  );
  const consistente = artigoRegularidade?.querySelector("strong")?.textContent?.trim();
  const detalheConsistencia = artigoRegularidade?.querySelector("p")?.textContent?.trim();
  if (consistente && normalizar(consistente) !== "sem amostra") {
    insights.push(
      `${consistente} apresenta a maior consistência.${
        detalheConsistencia ? ` ${detalheConsistencia}` : ""
      }`,
    );
  }

  return insights.slice(0, 4);
}

function criarControle() {
  const details = document.createElement("details");
  details.className = "inteligencia-gerencial-unificada";
  details.innerHTML = `
    <summary>
      <div>
        <strong>🧠 Inteligência Gerencial</strong>
        <span>Projeções, tendências e comparativos históricos.</span>
      </div>
      <i aria-hidden="true">⌄</i>
    </summary>
  `;
  return details;
}

function criarInsights(blocos) {
  const secao = document.createElement("section");
  secao.className = "inteligencia-gerencial-secao inteligencia-gerencial-secao-insights";

  const titulo = document.createElement("h3");
  titulo.textContent = "💡 Insights automáticos";

  const lista = document.createElement("div");
  lista.className = "inteligencia-gerencial-insights";

  const insights = gerarInsights(blocos);
  const textos = insights.length
    ? insights
    : ["Os insights serão gerados assim que houver dados suficientes no mês selecionado."];

  textos.forEach((texto) => {
    const artigo = document.createElement("article");
    const paragrafo = document.createElement("p");
    paragrafo.textContent = texto;
    artigo.appendChild(paragrafo);
    lista.appendChild(artigo);
  });

  secao.append(titulo, lista);
  return secao;
}

function prepararConteudo(container, blocos) {
  const conjunto = new Set(blocos);

  Array.from(container.children).forEach((filho) => {
    if (filho.classList?.contains("inteligencia-gerencial-secao-insights")) return;

    if (filho.tagName === "DETAILS") {
      if (!conjunto.has(filho)) {
        filho.style.setProperty("display", "none", "important");
        return;
      }

      const indice = blocos.indexOf(filho);
      filho.open = true;
      filho.classList.add("inteligencia-gerencial-item");
      filho.dataset.inteligenciaTitulo = BLOCOS[indice].titulo;
      filho.style.setProperty("display", "block", "important");

      const summary = filho.querySelector(":scope > summary");
      if (summary) summary.style.setProperty("display", "none", "important");
    }
  });

  container.classList.add("inteligencia-gerencial-blocos");
  container.querySelector(".inteligencia-gerencial-secao-insights")?.remove();
  container.appendChild(criarInsights(blocos));
}

function alternarConteudo(controle, container) {
  container.style.setProperty(
    "display",
    controle.open ? "grid" : "none",
    "important",
  );
}

function montar() {
  const original = localizarAnaliseOriginal();
  if (!original) {
    document.querySelector("details.inteligencia-gerencial-unificada")?.remove();
    return false;
  }

  const blocos = BLOCOS.map((item) => localizarBloco(original, item.origem));
  if (blocos.some((bloco) => !bloco)) return false;

  const container = blocos[0].parentElement;
  if (!container || !blocos.every((bloco) => bloco.parentElement === container)) {
    return false;
  }

  const cabecalho = original.querySelector(":scope > header");
  if (cabecalho) cabecalho.style.setProperty("display", "none", "important");

  let controle = original.querySelector(":scope > details.inteligencia-gerencial-unificada");
  if (!controle) {
    document
      .querySelectorAll("details.inteligencia-gerencial-unificada")
      .forEach((item) => item.remove());

    controle = criarControle();
    original.insertBefore(controle, container);
  }

  prepararConteudo(container, blocos);
  alternarConteudo(controle, container);

  if (controle.dataset.listenerAtivo !== "true") {
    controle.addEventListener("toggle", () => alternarConteudo(controle, container));
    controle.dataset.listenerAtivo = "true";
  }

  original.dataset.inteligenciaSubstituida = "true";
  return true;
}

function mutacaoSomenteDosInsights(mutacao) {
  const alterados = [...mutacao.addedNodes, ...mutacao.removedNodes].filter(
    (item) => item instanceof Element,
  );

  return (
    alterados.length > 0 &&
    alterados.every(
      (item) =>
        item.classList.contains("inteligencia-gerencial-secao-insights") ||
        Boolean(item.closest(".inteligencia-gerencial-secao-insights")),
    )
  );
}

export default function InteligenciaGerencialUnificada() {
  useEffect(() => {
    let temporizador;
    let executando = false;
    let tentativas = 0;

    const executar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (executando) return;
        executando = true;
        const pronto = montar();
        executando = false;

        if (!pronto && tentativas < 50) {
          tentativas += 1;
          executar();
        }
      }, 100);
    };

    executar();

    const observador = new MutationObserver((mutacoes) => {
      const alteracaoRelevante = mutacoes.some(
        (mutacao) => !mutacaoSomenteDosInsights(mutacao),
      );

      if (alteracaoRelevante) executar();
    });

    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizador);
      observador.disconnect();
    };
  }, []);

  return null;
}
