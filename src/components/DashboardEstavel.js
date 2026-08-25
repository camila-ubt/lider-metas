"use client";

import { useEffect, useMemo } from "react";
import DashboardEstavelV2 from "./DashboardEstavelV2";

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
      const detalhes = [...document.querySelectorAll("section article em")].slice(0, 3);
      if (detalhes.length < 3) return false;

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

        const porLojaDia = valorDia / resumo.quantidadeLojas;
        detalhe.innerHTML = `${match[0]}<br><strong style="display:block;margin-top:2px;color:inherit;font-size:9px;font-weight:900">${dinheiro.format(porLojaDia)}/loja/dia</strong>`;
      });

      return true;
    };

    const observador = new MutationObserver(() => {
      if (aplicar()) observador.disconnect();
    });
    observador.observe(document.body, { childList: true, subtree: true });

    const quadro = requestAnimationFrame(aplicar);
    const atraso = setTimeout(aplicar, 250);

    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(atraso);
      observador.disconnect();
    };
  }, [resumo.quantidadeLojas]);

  return <DashboardEstavelV2 {...props} />;
}
