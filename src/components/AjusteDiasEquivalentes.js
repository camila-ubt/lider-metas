"use client";

import { useEffect } from "react";

function numeroMoeda(texto) {
  const encontrado = String(texto || "").match(/R\$\s*([\d.]+,\d{2})/);
  if (!encontrado) return 0;
  return Number(encontrado[1].replace(/\./g, "").replace(",", "."));
}

function formatarDias(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: valor % 1 ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function diasEquivalentesRestantes(mesSelecionado) {
  if (!mesSelecionado) return 0;

  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  const totalDias = new Date(ano, mes, 0).getDate();

  if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) return 0;
  if (ano > anoAtual || (ano === anoAtual && mes > mesAtual)) return totalDias;

  const diasCompletosDepoisDeHoje = Math.max(totalDias - agora.getDate(), 0);
  const hora = agora.getHours() + agora.getMinutes() / 60;
  const restanteHoje = hora < 16 ? 1 : hora < 22 ? 0.5 : 0;

  return diasCompletosDepoisDeHoje + restanteHoje;
}

export default function AjusteDiasEquivalentes() {
  useEffect(() => {
    let agendamento;

    function atualizar() {
      clearTimeout(agendamento);
      agendamento = setTimeout(() => {
        const cards = Array.from(document.querySelectorAll("article"));
        const cardNecessario = cards.find((card) =>
          card.querySelector("span")?.textContent?.trim().startsWith("Necessário por")
        );

        if (!cardNecessario) return;

        const textoFalta = Array.from(document.querySelectorAll("b, strong")).find((item) =>
          item.textContent?.trim().startsWith("Faltam R$")
        );
        const falta = numeroMoeda(textoFalta?.textContent);
        const mesSelecionado = document.querySelector('input[type="month"]')?.value;
        const dias = diasEquivalentesRestantes(mesSelecionado);

        const titulo = cardNecessario.querySelector("span");
        const valor = cardNecessario.querySelector("strong");
        const detalhe = cardNecessario.querySelector("small");

        if (titulo) titulo.textContent = "Necessário por dia equivalente";
        if (valor) {
          valor.textContent = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(dias > 0 ? falta / dias : 0);
        }
        if (detalhe) {
          detalhe.textContent = `${formatarDias(dias)} ${dias === 1 ? "dia equivalente" : "dias equivalentes"}`;
        }
      }, 40);
    }

    atualizar();
    document.addEventListener("click", atualizar, true);
    document.addEventListener("change", atualizar, true);

    const observador = new MutationObserver(atualizar);
    observador.observe(document.body, { subtree: true, childList: true });

    const relogio = window.setInterval(atualizar, 60000);

    return () => {
      clearTimeout(agendamento);
      clearInterval(relogio);
      document.removeEventListener("click", atualizar, true);
      document.removeEventListener("change", atualizar, true);
      observador.disconnect();
    };
  }, []);

  return null;
}
