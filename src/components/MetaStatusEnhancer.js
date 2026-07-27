"use client";

import { useEffect } from "react";

function definirValor(elemento, valor) {
  const prototipo = Object.getPrototypeOf(elemento);
  const descritor = Object.getOwnPropertyDescriptor(prototipo, "value");

  if (descritor?.set) descritor.set.call(elemento, valor);
  else elemento.value = valor;

  elemento.dispatchEvent(new Event("input", { bubbles: true }));
  elemento.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function MetaStatusEnhancer() {
  useEffect(() => {
    let formularioAberto = null;
    let fundoModal = null;
    let quadroAgendado = false;

    function fecharEditor() {
      formularioAberto?.classList.remove("meta-editor-open");
      document.body.classList.remove("meta-editor-active");
      fundoModal?.remove();
      fundoModal = null;
      formularioAberto = null;
    }

    function abrirEditor(formulario) {
      fecharEditor();
      formularioAberto = formulario;
      formulario.classList.add("meta-editor-open");
      document.body.classList.add("meta-editor-active");

      fundoModal = document.createElement("button");
      fundoModal.type = "button";
      fundoModal.className = "meta-editor-backdrop";
      fundoModal.setAttribute("aria-label", "Fechar cadastro de meta");
      fundoModal.addEventListener("click", fecharEditor);
      document.body.appendChild(fundoModal);

      window.setTimeout(() => {
        formulario.querySelector('input[inputmode="decimal"]')?.focus();
      }, 80);
    }

    function localizarTelaMetas() {
      const titulo = [...document.querySelectorAll(".panel h2")].find(
        (item) => item.textContent.trim() === "Metas cadastradas"
      );

      if (!titulo) return null;

      const painel = titulo.closest(".panel");
      const secao = painel?.parentElement;
      const formulario = secao?.querySelector("form");
      const lista = painel?.querySelector(".history-list");

      if (!painel || !secao || !formulario || !lista) return null;
      return { painel, secao, formulario, lista, titulo };
    }

    function selecionarCartao(cartao, formulario) {
      const titulo = cartao.querySelector("strong")?.textContent || "";
      const [codigoLoja, nomePeriodo] = titulo
        .split("·")
        .map((item) => item.trim());
      const configurada = cartao.classList.contains("is-filled");
      const valorExibido = cartao.querySelector("b")?.textContent || "";
      const valor = configurada
        ? valorExibido.replace(/^R\$\s?/, "").trim()
        : "";

      const selects = formulario.querySelectorAll("select");
      const selectLoja = selects[0];
      if (!selectLoja) return;

      const opcaoLoja = [...selectLoja.options].find((opcao) =>
        opcao.textContent.trim().startsWith(`${codigoLoja} `)
      );
      if (opcaoLoja) definirValor(selectLoja, opcaoLoja.value);

      window.setTimeout(() => {
        const formularioAtual = localizarTelaMetas()?.formulario || formulario;
        const selectPeriodo = formularioAtual.querySelectorAll("select")[1];

        if (selectPeriodo) {
          const opcaoPeriodo = [...selectPeriodo.options].find(
            (opcao) => opcao.textContent.trim() === nomePeriodo
          );
          if (opcaoPeriodo) definirValor(selectPeriodo, opcaoPeriodo.value);
        }

        window.setTimeout(() => {
          const formularioFinal =
            localizarTelaMetas()?.formulario || formularioAtual;
          const campoValor = formularioFinal.querySelector(
            'input[inputmode="decimal"]'
          );

          if (campoValor) definirValor(campoValor, valor);
          abrirEditor(formularioFinal);
        }, 20);
      }, 20);
    }

    function decorarTela() {
      quadroAgendado = false;
      const tela = localizarTelaMetas();
      if (!tela) return;

      const { painel, secao, formulario, lista, titulo } = tela;
      secao.classList.add("meta-manager");
      painel.classList.add("meta-overview-panel");
      formulario.classList.add("meta-form-panel");
      lista.classList.add("meta-status-grid");

      if (!formulario.querySelector(".meta-form-close")) {
        const fechar = document.createElement("button");
        fechar.type = "button";
        fechar.className = "meta-form-close";
        fechar.setAttribute("aria-label", "Fechar");
        fechar.textContent = "×";
        fechar.addEventListener("click", fecharEditor);
        formulario.prepend(fechar);
      }

      const cartoes = [...lista.querySelectorAll(".history-item")];
      let preenchidas = 0;

      cartoes.forEach((cartao) => {
        const configurada =
          cartao.querySelector("span")?.textContent.trim() === "Configurada";
        if (configurada) preenchidas += 1;

        cartao.classList.add("meta-status-card");
        cartao.classList.toggle("is-filled", configurada);
        cartao.classList.toggle("is-pending", !configurada);
        cartao.setAttribute("role", "button");
        cartao.setAttribute("tabindex", "0");

        let acao = cartao.querySelector(".meta-card-action");
        if (!acao) {
          acao = document.createElement("small");
          acao.className = "meta-card-action";
          cartao.appendChild(acao);
        }

        const textoAcao = configurada
          ? "Toque para editar"
          : "Toque para preencher";
        if (acao.textContent !== textoAcao) acao.textContent = textoAcao;

        if (cartao.dataset.metaInterativo !== "true") {
          const ativar = () => selecionarCartao(cartao, formulario);
          cartao.addEventListener("click", ativar);
          cartao.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter" || evento.key === " ") {
              evento.preventDefault();
              ativar();
            }
          });
          cartao.dataset.metaInterativo = "true";
        }
      });

      let resumo = painel.querySelector(".meta-progress-summary");
      if (!resumo) {
        resumo = document.createElement("div");
        resumo.className = "meta-progress-summary";
        titulo.insertAdjacentElement("afterend", resumo);
      }

      const pendentes = Math.max(cartoes.length - preenchidas, 0);
      resumo.classList.toggle(
        "all-filled",
        cartoes.length > 0 && preenchidas === cartoes.length
      );

      const textoResumo = pendentes
        ? `${preenchidas} de ${cartoes.length} preenchidas · ${pendentes} pendentes`
        : `Todas as ${cartoes.length} metas estão preenchidas`;
      if (resumo.textContent !== textoResumo) resumo.textContent = textoResumo;
    }

    function agendarDecoracao() {
      if (quadroAgendado) return;
      quadroAgendado = true;
      window.requestAnimationFrame(decorarTela);
    }

    function tratarEscape(evento) {
      if (evento.key === "Escape") fecharEditor();
    }

    const observador = new MutationObserver(agendarDecoracao);
    observador.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", tratarEscape);
    agendarDecoracao();

    return () => {
      observador.disconnect();
      document.removeEventListener("keydown", tratarEscape);
      fecharEditor();
    };
  }, []);

  return null;
}
