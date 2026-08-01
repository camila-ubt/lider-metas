"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { contextoDoMes } from "@/lib/contextoMes";
import DashboardEstavelV2 from "./DashboardEstavelV2";
import styles from "./FechamentoPainelNovo.module.css";

function intervaloMes(valorMes) {
  const [ano, numeroMes] = String(valorMes).split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return {
    inicio: `${valorMes}-01`,
    fim: `${valorMes}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function lerMesSelecionado() {
  return (
    document.querySelector('.top-actions input[type="month"]')?.value ||
    document.querySelector('input[type="month"]')?.value ||
    mesAtual()
  );
}

export default function FechamentoPainelNovo() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [tipoMes, setTipoMes] = useState("andamento");
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setVisivel(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => setVisivel(Boolean(sessao)),
    );

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function sincronizarMes() {
      setTipoMes(contextoDoMes(lerMesSelecionado()).tipo);
    }

    sincronizarMes();
    document.addEventListener("change", sincronizarMes, true);
    document.addEventListener("click", sincronizarMes, true);

    return () => {
      document.removeEventListener("change", sincronizarMes, true);
      document.removeEventListener("click", sincronizarMes, true);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "fechamento-print-active",
      aberto && Boolean(dados),
    );

    return () => document.body.classList.remove("fechamento-print-active");
  }, [aberto, dados]);

  async function abrirRelatorio() {
    const mes = lerMesSelecionado();
    const intervalo = intervaloMes(mes);

    setAberto(true);
    setCarregando(true);
    setErro("");
    setDados(null);

    const [lojasResp, vendasResp, metasResp] = await Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase
        .from("vendas_diarias")
        .select("*")
        .gte("data", intervalo.inicio)
        .lte("data", intervalo.fim)
        .order("data", { ascending: true }),
      supabase
        .from("metas_mensais")
        .select("*")
        .eq("mes", `${mes}-01`),
    ]);

    const falha = [lojasResp, vendasResp, metasResp].find(
      (resposta) => resposta.error,
    );

    if (falha?.error) {
      setErro(falha.error.message);
      setCarregando(false);
      return;
    }

    setDados({
      mes,
      lojas: lojasResp.data || [],
      vendas: vendasResp.data || [],
      metas: metasResp.data || [],
    });
    setCarregando(false);
  }

  function fechar() {
    setAberto(false);
    setErro("");
    setDados(null);
  }

  if (!visivel) return null;

  const textoBotao =
    tipoMes === "futuro"
      ? "Planejamento do mês"
      : tipoMes === "encerrado"
        ? "Fechamento do mês"
        : "Prévia do mês";

  return (
    <>
      <button type="button" className={styles.launcher} onClick={abrirRelatorio}>
        {textoBotao}
      </button>

      {aberto && (
        <div className={styles.backdrop} id="fechamento-impressao">
          <section className={styles.modal}>
            <div className={styles.modalHeader} data-print-hide="true">
              <div>
                <p>VISUALIZAÇÃO DO PAINEL</p>
                <h2>{textoBotao}</h2>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar">
                ×
              </button>
            </div>

            {carregando && (
              <div className={styles.loading}>Atualizando o painel...</div>
            )}

            {erro && <div className={styles.error}>{erro}</div>}

            {!carregando && !erro && dados && (
              <>
                <DashboardEstavelV2
                  mes={dados.mes}
                  vendas={dados.vendas}
                  metas={dados.metas}
                  lojas={dados.lojas}
                />

                <div className={styles.actionsNoPrint} data-print-hide="true">
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={fechar}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => window.print()}
                  >
                    Imprimir / salvar PDF
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
