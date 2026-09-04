"use client";

import { useEffect, useState } from "react";

const CHAVE_MES = "lider-metas:mes-selecionado";
const CHAVE_TELA = "lider-metas:tela-selecionada";
const CHAVE_SCROLL = "lider-metas:posicao-scroll";
const TELAS_VALIDAS = ["painel", "lancamentos", "metas", "manual", "pa"];

function mesAtual() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function campoMes() {
  return document.querySelector('.top-actions input[type="month"]');
}

function telaDoBotao(botao) {
  if (botao?.hasAttribute?.("data-manual-botao")) return "manual";
  if (botao?.hasAttribute?.("data-pa-botao")) return "pa";

  const texto = botao?.textContent?.trim().toLocaleLowerCase("pt-BR") || "";
  if (texto === "painel") return "painel";
  if (texto === "lançar vendas") return "lancamentos";
  if (texto === "metas") return "metas";
  if (texto === "manual do usuário") return "manual";
  return null;
}

function definirMesNoReact(campo, valor) {
  const descritor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  );

  if (descritor?.set) descritor.set.call(campo, valor);
  else campo.value = valor;

  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function PersistenciaNavegacao() {
  const [visivel, setVisivel] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState("");

  useEffect(() => {
    let restaurado = false;
    let podeSalvarScroll = false;
    let temporizadorScroll;
    const temporizadores = [];

    function salvarTela(botao) {
      const tela = telaDoBotao(botao);
      if (tela) localStorage.setItem(CHAVE_TELA, tela);
    }

    function restaurar() {
      const campo = campoMes();
      const botoes = Array.from(document.querySelectorAll("nav.tabs button"));
      setVisivel(Boolean(campo));

      if (!campo || !botoes.length) return;
      setMesSelecionado(campo.value);
      if (restaurado) return;

      const mesSalvo = localStorage.getItem(CHAVE_MES);
      const telaInicial = document.querySelector("nav.tabs")?.dataset.telaInicial;
      const telaSalva = telaInicial === "pa" ? "pa" : localStorage.getItem(CHAVE_TELA);
      const scrollSalvo = Number(localStorage.getItem(CHAVE_SCROLL) || 0);

      if (/^\d{4}-\d{2}$/.test(mesSalvo || "") && campo.value !== mesSalvo) {
        definirMesNoReact(campo, mesSalvo);
        setMesSelecionado(mesSalvo);
      }

      if (TELAS_VALIDAS.includes(telaSalva || "")) {
        const botao = botoes.find((item) => telaDoBotao(item) === telaSalva);

        // Abas restritas podem não existir para o perfil atual.
        if (botao && !botao.classList.contains("active")) botao.click();
      }

      restaurado = true;
      temporizadores.push(
        window.setTimeout(() => window.scrollTo(0, scrollSalvo), 350),
        window.setTimeout(() => window.scrollTo(0, scrollSalvo), 900),
        window.setTimeout(() => {
          podeSalvarScroll = true;
        }, 1100),
      );
    }

    function aoAlterar(evento) {
      const campo = evento.target?.closest?.('.top-actions input[type="month"]');
      if (!campo) return;
      localStorage.setItem(CHAVE_MES, campo.value);
      setMesSelecionado(campo.value);
    }

    function aoClicar(evento) {
      const botao = evento.target?.closest?.("nav.tabs button");
      if (botao) salvarTela(botao);
    }

    function aoRolar() {
      if (!podeSalvarScroll) return;
      clearTimeout(temporizadorScroll);
      temporizadorScroll = window.setTimeout(() => {
        localStorage.setItem(CHAVE_SCROLL, String(window.scrollY));
      }, 120);
    }

    function antesDeSair() {
      const campo = campoMes();
      if (campo?.value) localStorage.setItem(CHAVE_MES, campo.value);

      const ativo = document.querySelector("nav.tabs button.active");
      if (ativo) salvarTela(ativo);

      localStorage.setItem(CHAVE_SCROLL, String(window.scrollY));
    }

    restaurar();
    document.addEventListener("change", aoAlterar, true);
    document.addEventListener("click", aoClicar, true);
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("beforeunload", antesDeSair);

    const observador = new MutationObserver(restaurar);
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizadorScroll);
      temporizadores.forEach((id) => clearTimeout(id));
      observador.disconnect();
      document.removeEventListener("change", aoAlterar, true);
      document.removeEventListener("click", aoClicar, true);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("beforeunload", antesDeSair);
    };
  }, []);

  function irParaMesAtual() {
    const campo = campoMes();
    const atual = mesAtual();
    if (!campo) return;

    localStorage.setItem(CHAVE_MES, atual);
    definirMesNoReact(campo, atual);
    setMesSelecionado(atual);
  }

  if (!visivel || mesSelecionado === mesAtual()) return null;

  return (
    <button
      type="button"
      className="atalho-mes-atual"
      onClick={irParaMesAtual}
      title="Voltar rapidamente para o mês atual"
    >
      Mês atual
    </button>
  );
}
