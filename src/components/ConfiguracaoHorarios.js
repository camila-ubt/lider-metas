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

    function aplicarSessao(sessao) {
      if (!ativo || !sessao) return;
      const salvos = normalizarHorariosPeriodos(
        sessao.user.user_metadata?.horarios_periodos,
      );
      setHorarios(salvos);
      publicarHorariosPeriodos(salvos);
    }

    supabase.auth.getSession().then(({ data }) => aplicarSessao(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => aplicarSessao(sessao),
    );

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
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
    const { error } = await supabase.auth.updateUser({
      data: { horarios_periodos: normalizados },
    });

    if (error) {
      setErro(error.message);
    } else {
      setHorarios(normalizados);
      publicarHorariosPeriodos(normalizados);
      setMensagem("Horários atualizados. O painel já está usando a nova configuração.");
    }

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
            <span className={styles.profileBadge}>Salvo no seu perfil</span>
            <span className={styles.arrow} aria-hidden="true">⌄</span>
          </div>
        </button>

        <div
          id="configuracao-horarios-conteudo"
          className={styles.content}
          hidden={!aberto}
        >
          <p className={styles.help}>
            Esses horários definem quando cada período deixa de entrar no cálculo do valor necessário por dia.
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
