"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  HORARIOS_PADRAO,
  normalizarHorariosPeriodos,
  publicarHorariosPeriodos,
  validarHorariosPeriodos,
} from "@/lib/horariosPeriodos";
import styles from "./ConfiguracaoHorarios.module.css";

function abaMetasAtiva() {
  return Array.from(document.querySelectorAll("nav.tabs button")).some(
    (botao) =>
      botao.textContent?.trim() === "Metas" &&
      botao.classList.contains("active"),
  );
}

function horarioBancoParaTela(valor) {
  return typeof valor === "string" ? valor.slice(0, 5) : valor;
}

function mapearHorarioCompartilhado(linha) {
  if (!linha) return null;

  return normalizarHorariosPeriodos({
    manhaInicio: horarioBancoParaTela(linha.manha_inicio),
    manhaFim: horarioBancoParaTela(linha.manha_fim),
    noiteInicio: horarioBancoParaTela(linha.noite_inicio),
    noiteFim: horarioBancoParaTela(linha.noite_fim),
  });
}

export default function ConfiguracaoHorarios() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [horarios, setHorarios] = useState(HORARIOS_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let temporizador;

    function sincronizarVisibilidade() {
      clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        const ativa = abaMetasAtiva();
        setVisivel(ativa);
        if (!ativa) setAberto(false);
      }, 30);
    }

    sincronizarVisibilidade();
    document.addEventListener("click", sincronizarVisibilidade, true);
    const observador = new MutationObserver(sincronizarVisibilidade);
    observador.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("click", sincronizarVisibilidade, true);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarHorarios() {
      const { data, error } = await supabase
        .from("configuracao_horarios_periodos")
        .select("manha_inicio, manha_fim, noite_inicio, noite_fim")
        .eq("id", 1)
        .maybeSingle();

      if (!ativo) return;

      if (!error && data) {
        const compartilhados = mapearHorarioCompartilhado(data);
        setHorarios(compartilhados);
        publicarHorariosPeriodos(compartilhados);
        return;
      }

      const { data: sessaoData } = await supabase.auth.getSession();
      if (!ativo || !sessaoData.session) return;

      const salvos = normalizarHorariosPeriodos(
        sessaoData.session.user.user_metadata?.horarios_periodos,
      );
      setHorarios(salvos);
      publicarHorariosPeriodos(salvos);
    }

    carregarHorarios();

    return () => {
      ativo = false;
    };
  }, [supabase]);

  async function salvar(evento) {
    evento.preventDefault();
    setMensagem("");
    setErro("");

    const validacao = validarHorariosPeriodos(horarios);
    if (validacao) {
      setErro(validacao);
      return;
    }

    setSalvando(true);
    const normalizados = normalizarHorariosPeriodos(horarios);
    const { data: usuarioData } = await supabase.auth.getUser();

    const { error: erroBanco } = await supabase
      .from("configuracao_horarios_periodos")
      .update({
        manha_inicio: normalizados.manhaInicio,
        manha_fim: normalizados.manhaFim,
        noite_inicio: normalizados.noiteInicio,
        noite_fim: normalizados.noiteFim,
        atualizado_em: new Date().toISOString(),
        atualizado_por: usuarioData.user?.id ?? null,
      })
      .eq("id", 1);

    if (erroBanco) {
      setErro(erroBanco.message);
      setSalvando(false);
      return;
    }

    // Mantém o perfil sincronizado por compatibilidade com versões anteriores.
    await supabase.auth.updateUser({
      data: { horarios_periodos: normalizados },
    });

    setHorarios(normalizados);
    publicarHorariosPeriodos(normalizados);
    setMensagem(
      "Horários atualizados. O Líder Metas e a Calculadora de Metas já usam a mesma configuração.",
    );
    setSalvando(false);
  }

  if (!visivel) return null;

  return (
    <section className={styles.wrapper}>
      <div className={`${styles.panel} ${aberto ? styles.open : ""}`}>
        <button
          className={styles.toggle}
          type="button"
          aria-expanded={aberto}
          aria-controls="configuracao-horarios-conteudo"
          onClick={() => {
            setAberto((valor) => !valor);
            setMensagem("");
            setErro("");
          }}
        >
          <div className={styles.headingText}>
            <p>CONFIGURAÇÃO DOS PERÍODOS</p>
            <h2>Horários da manhã e da noite</h2>
            <span className={styles.summary}>
              Manhã {horarios.manhaInicio}–{horarios.manhaFim} · Noite {horarios.noiteInicio}–{horarios.noiteFim}
            </span>
          </div>

          <div className={styles.toggleSide}>
            <span className={styles.profileBadge}>Compartilhado entre os apps</span>
            <span className={styles.arrow} aria-hidden="true">⌄</span>
          </div>
        </button>

        <div
          id="configuracao-horarios-conteudo"
          className={styles.content}
          hidden={!aberto}
        >
          <p className={styles.help}>
            Esses horários definem os períodos usados nos cálculos do Líder Metas e da Calculadora de Metas.
          </p>

          <form className={styles.form} onSubmit={salvar}>
            <fieldset>
              <legend>Manhã</legend>
              <label>
                Início
                <input
                  type="time"
                  value={horarios.manhaInicio}
                  onChange={(evento) =>
                    setHorarios({ ...horarios, manhaInicio: evento.target.value })
                  }
                  required
                />
              </label>
              <label>
                Término
                <input
                  type="time"
                  value={horarios.manhaFim}
                  onChange={(evento) =>
                    setHorarios({ ...horarios, manhaFim: evento.target.value })
                  }
                  required
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Noite</legend>
              <label>
                Início
                <input
                  type="time"
                  value={horarios.noiteInicio}
                  onChange={(evento) =>
                    setHorarios({ ...horarios, noiteInicio: evento.target.value })
                  }
                  required
                />
              </label>
              <label>
                Término
                <input
                  type="time"
                  value={horarios.noiteFim}
                  onChange={(evento) =>
                    setHorarios({ ...horarios, noiteFim: evento.target.value })
                  }
                  required
                />
              </label>
            </fieldset>

            <button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar horários"}
            </button>
          </form>

          {erro && <p className={styles.error}>{erro}</p>}
          {mensagem && <p className={styles.success}>{mensagem}</p>}
        </div>
      </div>
    </section>
  );
}
