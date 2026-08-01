"use client";

import { useEffect, useState } from "react";

export const CHAVE_HORARIOS_PERIODOS = "lider-metas:horarios-periodos";
export const EVENTO_HORARIOS_PERIODOS = "horarios-periodos-atualizados";

export const HORARIOS_PADRAO = Object.freeze({
  manhaInicio: "09:00",
  manhaFim: "16:00",
  noiteInicio: "16:00",
  noiteFim: "22:00",
});

function horarioValido(valor) {
  if (!/^\d{2}:\d{2}$/.test(String(valor || ""))) return false;
  const [hora, minuto] = valor.split(":").map(Number);
  return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59;
}

export function normalizarHorariosPeriodos(valor) {
  const origem = valor && typeof valor === "object" ? valor : {};

  return Object.fromEntries(
    Object.entries(HORARIOS_PADRAO).map(([chave, padrao]) => [
      chave,
      horarioValido(origem[chave]) ? origem[chave] : padrao,
    ]),
  );
}

export function minutosDoHorario(valor) {
  const normalizado = horarioValido(valor) ? valor : "00:00";
  const [hora, minuto] = normalizado.split(":").map(Number);
  return hora * 60 + minuto;
}

export function validarHorariosPeriodos(valor) {
  const horarios = normalizarHorariosPeriodos(valor);
  const manhaInicio = minutosDoHorario(horarios.manhaInicio);
  const manhaFim = minutosDoHorario(horarios.manhaFim);
  const noiteInicio = minutosDoHorario(horarios.noiteInicio);
  const noiteFim = minutosDoHorario(horarios.noiteFim);

  if (manhaInicio >= manhaFim) {
    return "O término da manhã precisa ser posterior ao início.";
  }
  if (noiteInicio >= noiteFim) {
    return "O término da noite precisa ser posterior ao início.";
  }
  if (manhaFim > noiteInicio) {
    return "Os períodos não podem se sobrepor.";
  }

  return "";
}

export function lerHorariosPeriodos() {
  if (typeof window === "undefined") return HORARIOS_PADRAO;

  try {
    const salvo = window.localStorage.getItem(CHAVE_HORARIOS_PERIODOS);
    return normalizarHorariosPeriodos(salvo ? JSON.parse(salvo) : null);
  } catch {
    return HORARIOS_PADRAO;
  }
}

export function publicarHorariosPeriodos(valor) {
  const horarios = normalizarHorariosPeriodos(valor);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      CHAVE_HORARIOS_PERIODOS,
      JSON.stringify(horarios),
    );
    window.dispatchEvent(
      new CustomEvent(EVENTO_HORARIOS_PERIODOS, { detail: horarios }),
    );
  }

  return horarios;
}

export function useHorariosPeriodos() {
  const [horarios, setHorarios] = useState(HORARIOS_PADRAO);

  useEffect(() => {
    setHorarios(lerHorariosPeriodos());

    function atualizar(evento) {
      setHorarios(
        evento?.detail
          ? normalizarHorariosPeriodos(evento.detail)
          : lerHorariosPeriodos(),
      );
    }

    window.addEventListener(EVENTO_HORARIOS_PERIODOS, atualizar);
    window.addEventListener("storage", atualizar);

    return () => {
      window.removeEventListener(EVENTO_HORARIOS_PERIODOS, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  return horarios;
}
