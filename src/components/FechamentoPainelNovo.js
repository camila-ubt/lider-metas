"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { contextoDoMes } from "@/lib/contextoMes";
import DashboardEstavelV2 from "./DashboardEstavelV2";
import styles from "./FechamentoPainelNovo.module.css";

const PERIODOS = ["manha", "noite"];

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

function dataDoDia(valorMes, dia) {
  return `${valorMes}-${String(dia).padStart(2, "0")}`;
}

function esperar(tempo) {
  return new Promise((resolver) => window.setTimeout(resolver, tempo));
}

function aguardarRenderizacao() {
  return new Promise((resolver) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolver);
    });
  });
}

async function aguardarPainelPronto(elemento) {
  if (document.fonts?.ready) await document.fonts.ready;

  const inicio = Date.now();
  while (
    elemento?.textContent?.includes("Carregando comparação histórica") &&
    Date.now() - inicio < 5000
  ) {
    await esperar(120);
  }

  await aguardarRenderizacao();
  await esperar(180);
}

async function criarSnapshotCompleto(original) {
  const detalhes = [];
  const quantidade = original.querySelectorAll('button[aria-expanded]').length;

  for (let indice = 0; indice < quantidade; indice += 1) {
    const botoes = Array.from(original.querySelectorAll('button[aria-expanded]'));
    const botao = botoes[indice];
    if (!botao) continue;

    if (botao.getAttribute("aria-expanded") !== "true") {
      botao.click();
      await aguardarRenderizacao();
      await esperar(70);
    }

    const botaoAtual = Array.from(
      original.querySelectorAll('button[aria-expanded]'),
    )[indice];
    detalhes[indice] = botaoAtual?.nextElementSibling?.cloneNode(true) || null;
  }

  const snapshot = original.cloneNode(true);
  snapshot.removeAttribute("id");
  snapshot.setAttribute("data-painel-imagem", "true");

  const botoesSnapshot = Array.from(
    snapshot.querySelectorAll('button[aria-expanded]'),
  );

  botoesSnapshot.forEach((botao, indice) => {
    botao.setAttribute("aria-expanded", "true");
    botao.style.cursor = "default";

    while (botao.nextElementSibling) {
      botao.nextElementSibling.remove();
    }

    if (detalhes[indice]) {
      botao.parentElement?.appendChild(detalhes[indice]);
    }
  });

  snapshot.style.display = "block";
  snapshot.style.width = "1180px";
  snapshot.style.maxWidth = "none";
  snapshot.style.margin = "0";
  snapshot.style.padding = "24px";
  snapshot.style.background = "#f7f3fa";
  snapshot.style.boxSizing = "border-box";

  snapshot.querySelectorAll("*").forEach((elemento) => {
    elemento.style.animation = "none";
    elemento.style.transition = "none";
  });

  return snapshot;
}

function calcularPendencias(valorMes, lojas, vendas) {
  const contexto = contextoDoMes(valorMes);
  if (contexto.tipo === "futuro" || contexto.diaCorte <= 0) {
    return { quantidade: 0, dias: 0 };
  }

  const preenchidos = new Set(
    vendas.map(
      (venda) =>
        `${venda.data}|${Number(venda.loja_id)}|${venda.periodo}`,
    ),
  );
  const diasPendentes = new Set();
  let quantidade = 0;

  for (let dia = 1; dia <= contexto.diaCorte; dia += 1) {
    const data = dataDoDia(valorMes, dia);
    lojas.forEach((loja) => {
      PERIODOS.forEach((periodo) => {
        const chave = `${data}|${Number(loja.id)}|${periodo}`;
        if (!preenchidos.has(chave)) {
          quantidade += 1;
          diasPendentes.add(data);
        }
      });
    });
  }

  return { quantidade, dias: diasPendentes.size };
}

export default function FechamentoPainelNovo() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [tipoMes, setTipoMes] = useState("andamento");
  const [dados, setDados] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [imagem, setImagem] = useState(null);
  const [blobImagem, setBlobImagem] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState("painel-metas.png");
  const [erro, setErro] = useState("");

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
    return () => {
      if (imagem) URL.revokeObjectURL(imagem);
    };
  }, [imagem]);

  async function carregarDados() {
    const mes = lerMesSelecionado();
    const intervalo = intervaloMes(mes);

    setGerando(true);
    setErro("");
    setAviso(null);
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
      setGerando(false);
      return;
    }

    const novosDados = {
      mes,
      lojas: lojasResp.data || [],
      vendas: vendasResp.data || [],
      metas: metasResp.data || [],
    };
    const pendencias = calcularPendencias(
      mes,
      novosDados.lojas,
      novosDados.vendas,
    );

    setDados(novosDados);
    setNomeArquivo(`painel-metas-${mes}.png`);

    if (pendencias.quantidade > 0) {
      setAviso(pendencias);
      setGerando(false);
      return;
    }

    await gerarImagem(novosDados);
  }

  async function gerarImagem(dadosParaImagem = dados) {
    if (!dadosParaImagem) return;

    setAviso(null);
    setGerando(true);
    setErro("");

    try {
      await aguardarRenderizacao();
      const original = document.getElementById("painel-captura-imagem");
      if (!original) throw new Error("Não foi possível preparar o painel.");

      await aguardarPainelPronto(original);
      const snapshot = await criarSnapshotCompleto(original);
      const palco = document.createElement("div");
      palco.style.position = "fixed";
      palco.style.left = "-20000px";
      palco.style.top = "0";
      palco.style.width = "1180px";
      palco.style.background = "#f7f3fa";
      palco.style.zIndex = "-1";
      palco.appendChild(snapshot);
      document.body.appendChild(palco);

      await aguardarRenderizacao();
      await esperar(120);

      const { toBlob } = await import("html-to-image");
      const altura = snapshot.scrollHeight;
      const proporcao = altura > 8500 ? 1 : altura > 6000 ? 1.25 : 1.5;
      const blob = await toBlob(snapshot, {
        backgroundColor: "#f7f3fa",
        cacheBust: true,
        pixelRatio: proporcao,
        width: snapshot.scrollWidth,
        height: snapshot.scrollHeight,
      });

      palco.remove();
      if (!blob) throw new Error("Não foi possível gerar a imagem.");

      if (imagem) URL.revokeObjectURL(imagem);
      const url = URL.createObjectURL(blob);
      setBlobImagem(blob);
      setImagem(url);
      setDados(null);
    } catch (falha) {
      setErro(falha?.message || "Não foi possível gerar a imagem do painel.");
      setDados(null);
    } finally {
      setGerando(false);
    }
  }

  function baixarImagem() {
    if (!imagem) return;
    const link = document.createElement("a");
    link.href = imagem;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function compartilharImagem() {
    if (!blobImagem) return;

    const arquivo = new File([blobImagem], nomeArquivo, { type: "image/png" });
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({
          files: [arquivo],
          title: "Painel de metas",
          text: `Painel de metas — ${lerMesSelecionado()}`,
        });
        return;
      } catch (falha) {
        if (falha?.name === "AbortError") return;
      }
    }

    baixarImagem();
  }

  function fecharImagem() {
    if (imagem) URL.revokeObjectURL(imagem);
    setImagem(null);
    setBlobImagem(null);
    setErro("");
  }

  function cancelarAviso() {
    setAviso(null);
    setDados(null);
    setGerando(false);
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
        .painel-imagem-captura {
          position: fixed;
          left: -20000px;
          top: 0;
          width: 1180px;
          padding: 24px;
          background: #f7f3fa;
          pointer-events: none;
          z-index: -1;
        }
        .painel-imagem-overlay {
          position: fixed;
          inset: 0;
          z-index: 3000;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(35, 24, 48, .72);
          backdrop-filter: blur(5px);
        }
        .painel-imagem-dialogo {
          width: min(560px, 100%);
          max-height: calc(100dvh - 32px);
          overflow: auto;
          border-radius: 24px;
          padding: 20px;
          background: #fff;
          color: #241a32;
          box-shadow: 0 28px 80px rgba(24, 15, 35, .35);
        }
        .painel-imagem-dialogo h2 { margin: 0 0 8px; }
        .painel-imagem-dialogo p { margin: 0; color: #6f6578; line-height: 1.5; }
        .painel-imagem-acoes {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }
        .painel-imagem-acoes button {
          min-height: 46px;
          border: 0;
          border-radius: 14px;
          padding: 11px 14px;
          font: inherit;
          font-weight: 850;
          cursor: pointer;
        }
        .painel-imagem-secundario { background: #eee8f4; color: #5f3c91; }
        .painel-imagem-principal { background: #684199; color: #fff; }
        .painel-imagem-preview {
          width: min(820px, 100%);
        }
        .painel-imagem-preview img {
          display: block;
          width: 100%;
          max-height: calc(100dvh - 190px);
          object-fit: contain;
          border: 1px solid #e6deec;
          border-radius: 15px;
          background: #f7f3fa;
        }
        .painel-imagem-carregando {
          display: grid;
          place-items: center;
          gap: 12px;
          min-height: 180px;
          text-align: center;
        }
        .painel-imagem-carregando i {
          width: 38px;
          height: 38px;
          border: 4px solid #e8dff0;
          border-top-color: #684199;
          border-radius: 50%;
          animation: painelImagemGirar .8s linear infinite;
        }
        @keyframes painelImagemGirar { to { transform: rotate(360deg); } }
        @media (max-width: 540px) {
          .painel-imagem-dialogo { border-radius: 20px; padding: 16px; }
          .painel-imagem-acoes { grid-template-columns: 1fr; }
        }
      `}</style>

      <button
        type="button"
        className={styles.launcher}
        onClick={carregarDados}
        disabled={gerando}
      >
        {gerando ? "Preparando imagem..." : textoBotao}
      </button>

      {dados && (
        <div className="painel-imagem-captura" aria-hidden="true">
          <div id="painel-captura-imagem">
            <DashboardEstavelV2
              mes={dados.mes}
              vendas={dados.vendas}
              metas={dados.metas}
              lojas={dados.lojas}
            />
          </div>
        </div>
      )}

      {gerando && (
        <div className="painel-imagem-overlay" role="status">
          <section className="painel-imagem-dialogo painel-imagem-carregando">
            <i />
            <div>
              <h2>Preparando a imagem</h2>
              <p>Abrindo todos os detalhes e montando o painel completo.</p>
            </div>
          </section>
        </div>
      )}

      {aviso && !gerando && (
        <div className="painel-imagem-overlay">
          <section className="painel-imagem-dialogo" role="dialog" aria-modal="true">
            <h2>Lançamentos pendentes</h2>
            <p>
              Existem {aviso.quantidade} lançamentos pendentes em {aviso.dias}{" "}
              {aviso.dias === 1 ? "dia" : "dias"}. A imagem pode apresentar um
              resultado incompleto.
            </p>
            <div className="painel-imagem-acoes">
              <button
                type="button"
                className="painel-imagem-secundario"
                onClick={cancelarAviso}
              >
                Voltar e corrigir
              </button>
              <button
                type="button"
                className="painel-imagem-principal"
                onClick={() => gerarImagem()}
              >
                Gerar mesmo assim
              </button>
            </div>
          </section>
        </div>
      )}

      {imagem && !gerando && (
        <div className="painel-imagem-overlay">
          <section
            className="painel-imagem-dialogo painel-imagem-preview"
            role="dialog"
            aria-modal="true"
          >
            <img src={imagem} alt="Painel completo de metas" />
            <div className="painel-imagem-acoes">
              <button
                type="button"
                className="painel-imagem-secundario"
                onClick={fecharImagem}
              >
                Fechar
              </button>
              <button
                type="button"
                className="painel-imagem-secundario"
                onClick={baixarImagem}
              >
                Salvar imagem
              </button>
              <button
                type="button"
                className="painel-imagem-principal"
                onClick={compartilharImagem}
              >
                Compartilhar
              </button>
            </div>
          </section>
        </div>
      )}

      {erro && !gerando && !imagem && !aviso && (
        <div className="painel-imagem-overlay">
          <section className="painel-imagem-dialogo" role="alertdialog">
            <h2>Não foi possível gerar a imagem</h2>
            <p>{erro}</p>
            <div className="painel-imagem-acoes">
              <button
                type="button"
                className="painel-imagem-principal"
                onClick={() => setErro("")}
              >
                Fechar
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
