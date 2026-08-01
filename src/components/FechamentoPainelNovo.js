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

function aguardarRenderizacao() {
  return new Promise((resolver) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolver);
    });
  });
}

function limparSnapshotImpressao() {
  document.getElementById("fechamento-painel-snapshot")?.remove();
}

async function criarSnapshotCompleto() {
  const area = document.getElementById("fechamento-impressao");
  const original = document.getElementById("fechamento-painel-original");
  if (!area || !original) return false;

  limparSnapshotImpressao();

  const botoesIniciais = Array.from(
    original.querySelectorAll('button[aria-expanded]'),
  );
  const indiceAbertoInicial = botoesIniciais.findIndex(
    (botao) => botao.getAttribute("aria-expanded") === "true",
  );
  const detalhesExpandidos = [];

  for (let indice = 0; indice < botoesIniciais.length; indice += 1) {
    let botoesAtuais = Array.from(
      original.querySelectorAll('button[aria-expanded]'),
    );
    let botao = botoesAtuais[indice];
    if (!botao) continue;

    if (botao.getAttribute("aria-expanded") !== "true") {
      botao.click();
      await aguardarRenderizacao();
      botoesAtuais = Array.from(
        original.querySelectorAll('button[aria-expanded]'),
      );
      botao = botoesAtuais[indice];
    }

    detalhesExpandidos[indice] = botao?.nextElementSibling?.cloneNode(true) || null;
  }

  const snapshot = original.cloneNode(true);
  snapshot.id = "fechamento-painel-snapshot";
  snapshot.setAttribute("aria-hidden", "true");

  const botoesSnapshot = Array.from(
    snapshot.querySelectorAll('button[aria-expanded]'),
  );

  botoesSnapshot.forEach((botao, indice) => {
    botao.setAttribute("aria-expanded", "true");
    while (botao.nextElementSibling) {
      botao.nextElementSibling.remove();
    }
    if (detalhesExpandidos[indice]) {
      botao.parentElement?.appendChild(detalhesExpandidos[indice]);
    }
  });

  original.parentElement?.insertBefore(snapshot, original.nextSibling);

  let botoesAtuais = Array.from(
    original.querySelectorAll('button[aria-expanded]'),
  );
  const indiceAbertoAtual = botoesAtuais.findIndex(
    (botao) => botao.getAttribute("aria-expanded") === "true",
  );

  if (indiceAbertoInicial >= 0 && indiceAbertoAtual !== indiceAbertoInicial) {
    botoesAtuais[indiceAbertoInicial]?.click();
    await aguardarRenderizacao();
  } else if (indiceAbertoInicial < 0 && indiceAbertoAtual >= 0) {
    botoesAtuais[indiceAbertoAtual]?.click();
    await aguardarRenderizacao();
  }

  return true;
}

export default function FechamentoPainelNovo() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [preparandoPdf, setPreparandoPdf] = useState(false);
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

  useEffect(() => {
    window.addEventListener("afterprint", limparSnapshotImpressao);
    return () => window.removeEventListener("afterprint", limparSnapshotImpressao);
  }, []);

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

  async function imprimirRelatorio() {
    if (preparandoPdf) return;
    setPreparandoPdf(true);

    try {
      await criarSnapshotCompleto();
      window.print();
    } finally {
      setPreparandoPdf(false);
      window.setTimeout(limparSnapshotImpressao, 500);
    }
  }

  function fechar() {
    limparSnapshotImpressao();
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
      <style>{`
        #fechamento-painel-snapshot { display: none; }
        @media print {
          #fechamento-painel-original { display: none !important; }
          #fechamento-painel-snapshot { display: block !important; }
        }
      `}</style>

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
                <div id="fechamento-painel-original">
                  <DashboardEstavelV2
                    mes={dados.mes}
                    vendas={dados.vendas}
                    metas={dados.metas}
                    lojas={dados.lojas}
                  />
                </div>

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
                    onClick={imprimirRelatorio}
                    disabled={preparandoPdf}
                  >
                    {preparandoPdf
                      ? "Preparando relatório completo..."
                      : "Imprimir / salvar PDF"}
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
