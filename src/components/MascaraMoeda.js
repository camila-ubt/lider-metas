"use client";

import { useEffect } from "react";

function formatarMoeda(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (!digitos) return "";

  const centavos = Number(digitos);
  if (!Number.isFinite(centavos)) return "";

  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MascaraMoeda() {
  useEffect(() => {
    function aplicarMascara(evento) {
      const campo = evento.target;
      if (!(campo instanceof HTMLInputElement)) return;
      if (campo.getAttribute("inputmode") !== "decimal") return;

      const formatado = formatarMoeda(campo.value);
      if (campo.value !== formatado) campo.value = formatado;
    }

    document.addEventListener("input", aplicarMascara, true);
    return () => document.removeEventListener("input", aplicarMascara, true);
  }, []);

  return null;
}
