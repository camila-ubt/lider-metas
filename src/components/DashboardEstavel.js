"use client";

import { useEffect, useMemo } from "react";
import DashboardEstavelV2 from "./DashboardEstavelV2";
import ClimaTurnosPreview from "./ClimaTurnosPreview";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function DashboardEstavel(props) {
  const resumo = useMemo(() => {
    const vendido = (props.vendas || []).reduce(
      (total, item) => total + Number(item.valor_vendido || 0),
      0
    );
    const meta = (props.metas || []).reduce(
      (total, item) => total + Number(item.valor_meta || 0),
      0
    );

    const etapas = [
      { nome: "Meta", valor: meta },
      { nome: "Supermeta", valor: meta * 1.1 },
      { nome: "Megameta", valor: meta * 1.2 },
    ];
    const proxima = etapas.find((etapa) => vendido < etapa.valor);

    return {
      nome: proxima?.nome || "Megameta",
      falta: proxima ? Math.max(proxima.valor - vendido, 0) : 0,
      quantidadeLojas: Math.max((props.lojas || []).length, 1),
    };
  }, [props.vendas, props.metas, props.lojas]);

  useEffect(() => {
    const corrigirCard = () => {
      const rotulos = [...document.querySelectorAll("article span")];
      const rotulo = rotulos.find((item) =>
        item.textContent?.trim().startsWith("Necessário por dia")
      );
      const card = rotulo?.closest("article");
      if (!card) return;

      const valor = card.querySelector("strong");
      const detalhe = card.querySelector("small");

      rotulo.textContent = `Necessário para ${resumo.nome}`;
      if (valor) valor.textContent = dinheiro.format(resumo.falta);
      if (detalhe) detalhe.textContent = "Valor total que ainda falta vender";
    };

    const quadro = requestAnimationFrame(corrigirCard);
    return () => cancelAnimationFrame(quadro);
  }, [resumo]);

  useEffect(() => {
    const aplicar = () => {
      const hero = document.querySelector("section article");
      if (!hero) return;

      const detalhes = [...hero.querySelectorAll("em")].slice(0, 3);
      if (detalhes.length < 3) return;

      detalhes.forEach((detalhe) => {
        const texto = detalhe.textContent?.trim() || "";
        const match = texto.match(/R\$\s*[\d.]+,\d{2}\/dia/);
        if (!match) return;

        const valorDia = Number(
          match[0]
            .replace("R$", "")
            .replace("/dia", "")
            .trim()
            .replace(/\./g, "")
            .replace(",", ".")
        );
        if (!Number.isFinite(valorDia)) return;

        const cardNivel = detalhe.closest("div");
        if (!cardNivel) return;

        let extra = cardNivel.querySelector('[data-loja-dia="true"]');
        if (!extra) {
          extra = document.createElement("div");
          extra.setAttribute("data-loja-dia", "true");
          extra.style.gridColumn = "1 / -1";
          extra.style.marginTop = "2px";
          extra.style.fontSize = "9px";
          extra.style.fontWeight = "900";
          extra.style.lineHeight = "1.2";
          extra.style.color = "#5b5164";
          extra.style.textAlign = "center";
          cardNivel.appendChild(extra);
        }

        extra.textContent = `${dinheiro.format(valorDia / resumo.quantidadeLojas)}/loja/dia`;
      });
    };

    const timers = [0, 100, 300, 700, 1200, 2000].map((atraso) =>
      setTimeout(aplicar, atraso)
    );
    const intervalo = setInterval(aplicar, 1500);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(intervalo);
    };
  }, [resumo.quantidadeLojas, props.vendas]);

  return (
    <>
      <DashboardEstavelV2 {...props} />
      <ClimaTurnosPreview />
    </>
  );
}
