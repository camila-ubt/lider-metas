"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { responderPerguntaMetas, sugestoesPerguntas } from "@/lib/assistenteMetas";
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

export default function PaginaIA() {
  const supabase = useMemo(() => createClient(), []);
  const [mes, setMes] = useState(hojeLocal().slice(0, 7));
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");

      const { data: sessaoResp } = await supabase.auth.getSession();
      if (!sessaoResp.session) {
        window.location.assign("/");
        return;
      }

      const periodo = periodoCarga(mes);
      const [lojasResp, vendasResp, metasResp] = await Promise.all([
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
      ]);

      if (!ativo) return;
      const falha = lojasResp.error || vendasResp.error || metasResp.error;
      if (falha) {
        setErro(falha.message);
        setLojas([]);
        setVendas([]);
        setMetas([]);
      } else {
        setLojas(lojasResp.data || []);
        setVendas(vendasResp.data || []);
        setMetas(metasResp.data || []);
        setResposta("");
        setHistorico([]);
      }
      setCarregando(false);
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [mes, supabase]);

  const sugestoes = useMemo(() => sugestoesPerguntas(lojas), [lojas]);

  function executarPergunta(texto) {
    const perguntaLimpa = String(texto || "").trim();
    if (!perguntaLimpa || carregando || erro) return;

    const novaResposta = responderPerguntaMetas({
      pergunta: perguntaLimpa,
      mes,
      vendas,
      metas,
      lojas,
    });

    setPergunta(perguntaLimpa);
    setResposta(novaResposta);
    setHistorico((atual) => [
      { pergunta: perguntaLimpa, resposta: novaResposta, id: Date.now() },
      ...atual,
    ].slice(0, 8));
  }

  function enviar(evento) {
    evento.preventDefault();
    executarPergunta(pergunta);
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
              Pergunte livremente sobre vendas, metas, lojas, turnos, anos, comparações e projeções. A IA consulta o histórico direto do Supabase.
            </p>
          </div>

          <input
            className={styles.month}
            type="month"
            value={mes}
            onChange={(evento) => setMes(evento.target.value)}
            aria-label="Mês analisado"
          />
        </header>

        <section className={styles.card}>
          <div className={styles.status}>
            <i className={styles.dot} />
            {erro
              ? "Não foi possível consultar o banco"
              : `${lojas.length} lojas conectadas · ${vendas.length} lançamentos históricos carregados`}
          </div>

          {erro ? (
            <div className={styles.answer}>
              <strong className={styles.answerLabel}>Erro do Supabase</strong>
              {erro}
            </div>
          ) : (
            <>
              <form className={styles.form} onSubmit={enviar}>
                <input
                  className={styles.input}
                  value={pergunta}
                  onChange={(evento) => setPergunta(evento.target.value)}
                  placeholder="Ex.: Compare Arte e Adoro deste mês até hoje com o ano passado"
                  autoComplete="off"
                  autoFocus
                />
                <button className={styles.button} type="submit" disabled={!pergunta.trim()}>
                  Perguntar
                </button>
              </form>

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

              {resposta && (
                <div className={styles.answer}>
                  <strong className={styles.answerLabel}>Resposta da IA</strong>
                  {resposta}
                </div>
              )}

              {historico.length > 1 && (
                <div className={styles.history}>
                  {historico.slice(1).map((item) => (
                    <div className={styles.historyItem} key={item.id}>
                      <p className={styles.question}>{item.pergunta}</p>
                      <p className={styles.historyAnswer}>{item.resposta}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <a className={styles.back} href="/">← Voltar ao Líder Metas</a>
      </div>
    </main>
  );
}
