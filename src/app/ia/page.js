"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { responderPerguntaMetas, sugestoesPerguntas } from "@/lib/assistenteMetasConversa";
import styles from "./ia.module.css";

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate()
  ).padStart(2, "0")}`;
}

function periodoCarga(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const inicio = `${ano - 2}-01-01`;
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  const fim = `${ano}-${String(numeroMes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

async function buscarPaginado(criarConsulta, tamanho = 1000) {
  const registros = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await criarConsulta().range(inicio, inicio + tamanho - 1);
    if (error) return { data: null, error };
    const lote = data || [];
    registros.push(...lote);
    if (lote.length < tamanho) break;
    inicio += tamanho;
  }

  return { data: registros, error: null };
}

function tituloDaPergunta(pergunta) {
  const texto = String(pergunta || "").trim();
  if (!texto) return "Nova conversa";
  return texto.length > 60 ? `${texto.slice(0, 57)}...` : texto;
}

export default function PaginaIA() {
  const supabase = useMemo(() => createClient(), []);
  const [mes, setMes] = useState(hojeLocal().slice(0, 7));
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [pergunta, setPergunta] = useState("");
  const [mensagens, setMensagens] = useState([]);
  const [conversaId, setConversaId] = useState(null);
  const [usuarioId, setUsuarioId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [respondendo, setRespondendo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");

      const { data: sessaoResp } = await supabase.auth.getSession();
      const sessao = sessaoResp.session;
      if (!sessao) {
        window.location.assign("/");
        return;
      }

      if (!ativo) return;
      setUsuarioId(sessao.user.id);

      const periodo = periodoCarga(mes);
      const [lojasResp, vendasResp, metasResp, conversaResp] = await Promise.all([
        supabase.from("lojas").select("id,codigo,nome,ativa,ordem").eq("ativa", true).order("ordem"),
        buscarPaginado(() =>
          supabase
            .from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido,observacao")
            .gte("data", periodo.inicio)
            .lte("data", periodo.fim)
            .order("data", { ascending: true })
        ),
        buscarPaginado(() =>
          supabase
            .from("metas_mensais")
            .select("mes,loja_id,periodo,valor_meta")
            .gte("mes", `${periodo.inicio.slice(0, 7)}-01`)
            .lte("mes", `${mes}-01`)
            .order("mes", { ascending: true })
        ),
        supabase
          .from("ia_conversas")
          .select("id,titulo,mes_contexto,atualizado_em")
          .eq("usuario_id", sessao.user.id)
          .order("atualizado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!ativo) return;
      const falha = lojasResp.error || vendasResp.error || metasResp.error || conversaResp.error;
      if (falha) {
        setErro(falha.message);
        setLojas([]);
        setVendas([]);
        setMetas([]);
        setCarregando(false);
        return;
      }

      setLojas(lojasResp.data || []);
      setVendas(vendasResp.data || []);
      setMetas(metasResp.data || []);

      const conversa = conversaResp.data;
      if (conversa?.id) {
        const mensagensResp = await supabase
          .from("ia_mensagens")
          .select("id,papel,conteudo,criado_em")
          .eq("conversa_id", conversa.id)
          .order("criado_em", { ascending: true });

        if (!ativo) return;
        if (mensagensResp.error) setErro(mensagensResp.error.message);
        else {
          setConversaId(conversa.id);
          setMensagens(mensagensResp.data || []);
        }
      }

      setCarregando(false);
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [mes, supabase]);

  const sugestoes = useMemo(() => sugestoesPerguntas(lojas), [lojas]);

  async function garantirConversa(perguntaInicial) {
    if (conversaId) return conversaId;
    if (!usuarioId) throw new Error("Usuário não identificado.");

    const { data, error } = await supabase
      .from("ia_conversas")
      .insert({
        usuario_id: usuarioId,
        titulo: tituloDaPergunta(perguntaInicial),
        mes_contexto: mes,
      })
      .select("id")
      .single();

    if (error) throw error;
    setConversaId(data.id);
    return data.id;
  }

  async function executarPergunta(texto) {
    const perguntaLimpa = String(texto || "").trim();
    if (!perguntaLimpa || carregando || respondendo || erro) return;

    setRespondendo(true);
    setErro("");

    try {
      const idConversa = await garantirConversa(perguntaLimpa);
      const mensagemUsuario = {
        papel: "usuario",
        conteudo: perguntaLimpa,
        criado_em: new Date().toISOString(),
      };

      const resposta = responderPerguntaMetas({
        pergunta: perguntaLimpa,
        mes,
        vendas,
        metas,
        lojas,
        historico: mensagens,
      });

      const mensagemIA = {
        papel: "assistente",
        conteudo: resposta,
        criado_em: new Date(Date.now() + 1).toISOString(),
      };

      const { error: erroMensagens } = await supabase.from("ia_mensagens").insert([
        {
          conversa_id: idConversa,
          usuario_id: usuarioId,
          papel: "usuario",
          conteudo: perguntaLimpa,
        },
        {
          conversa_id: idConversa,
          usuario_id: usuarioId,
          papel: "assistente",
          conteudo: resposta,
        },
      ]);

      if (erroMensagens) throw erroMensagens;

      await supabase
        .from("ia_conversas")
        .update({ atualizado_em: new Date().toISOString(), mes_contexto: mes })
        .eq("id", idConversa);

      setMensagens((atual) => [...atual, mensagemUsuario, mensagemIA]);
      setPergunta("");
    } catch (falha) {
      setErro(falha.message || "Não foi possível salvar a conversa.");
    } finally {
      setRespondendo(false);
    }
  }

  function enviar(evento) {
    evento.preventDefault();
    executarPergunta(pergunta);
  }

  function novaConversa() {
    setConversaId(null);
    setMensagens([]);
    setPergunta("");
    setErro("");
  }

  if (carregando && !lojas.length) {
    return <main className={styles.loading}>Conectando a IA aos dados do Líder Metas...</main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Líder Metas</p>
            <h1 className={styles.title}>Pergunte à IA</h1>
            <p className={styles.subtitle}>
              A conversa agora tem memória. Você pode continuar o mesmo assunto sem repetir toda a pergunta.
            </p>
          </div>

          <div className={styles.headerActions}>
            <input
              className={styles.month}
              type="month"
              value={mes}
              onChange={(evento) => setMes(evento.target.value)}
              aria-label="Mês analisado"
            />
            <button className={styles.newChat} type="button" onClick={novaConversa}>
              Nova conversa
            </button>
          </div>
        </header>

        <section className={styles.card}>
          <div className={styles.status}>
            <i className={styles.dot} />
            {erro
              ? "Houve um problema"
              : `${lojas.length} lojas conectadas · ${vendas.length} lançamentos históricos carregados`}
          </div>

          {mensagens.length > 0 && (
            <div className={styles.chat}>
              {mensagens.map((item, indice) => (
                <div
                  className={`${styles.messageRow} ${item.papel === "usuario" ? styles.userRow : styles.aiRow}`}
                  key={item.id || `${item.criado_em}-${indice}`}
                >
                  <div className={`${styles.bubble} ${item.papel === "usuario" ? styles.userBubble : styles.aiBubble}`}>
                    <strong>{item.papel === "usuario" ? "Você" : "IA"}</strong>
                    <span>{item.conteudo}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {erro && <div className={styles.errorBox}>{erro}</div>}

          <form className={styles.form} onSubmit={enviar}>
            <input
              className={styles.input}
              value={pergunta}
              onChange={(evento) => setPergunta(evento.target.value)}
              placeholder={mensagens.length ? "Continue a conversa... Ex.: E no turno da noite?" : "Faça uma pergunta sobre os dados"}
              autoComplete="off"
              autoFocus
            />
            <button className={styles.button} type="submit" disabled={!pergunta.trim() || respondendo}>
              {respondendo ? "Respondendo..." : "Perguntar"}
            </button>
          </form>

          {mensagens.length === 0 && (
            <div className={styles.suggestions}>
              {sugestoes.map((item) => (
                <button
                  type="button"
                  className={styles.suggestion}
                  key={item}
                  onClick={() => executarPergunta(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </section>

        <a className={styles.back} href="/">← Voltar ao Líder Metas</a>
      </div>
    </main>
  );
}