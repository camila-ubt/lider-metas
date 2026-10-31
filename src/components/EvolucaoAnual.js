"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  compararAnosEquivalentes, MESES_CURTOS, montarComparativo, resumirSerieAnual,
} from "@/lib/evolucaoAnual.mjs";
import styles from "./EvolucaoAnual.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const CORES = ["#7650a7", "#248676", "#c88d4f"];

function formatoEixo(valor, percentual) {
  if (percentual) return numero.format(valor) + "%";
  const abs = Math.abs(valor);
  if (abs >= 1000000) return numero.format(valor / 1000000) + " mi";
  if (abs >= 1000) return numero.format(valor / 1000) + " mil";
  return numero.format(valor);
}

function formatarMedida(valor, percentual) {
  return percentual ? numero.format(valor) + "%" : dinheiro.format(valor);
}

function MiniGrafico({ linhas, ano }) {
  const maximo = Math.max(1, ...linhas.map((item) => item.vendido ?? 0));
  const comDados = linhas.some((item) => item.temDados);

  if (!comDados) return <p className={styles.semDados}>Ainda não há lançamentos neste ano.</p>;

  return (
    <svg
      className={styles.miniSvg}
      viewBox="0 0 600 116"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={"Vendas mensais de " + ano + ", de janeiro a dezembro"}
    >
      <line x1="12" y1="88" x2="588" y2="88" stroke="#e9e3f0" />
      {linhas.map((item, i) => {
        const altura = item.temDados ? Math.max(3, (item.vendido / maximo) * 77) : 0;
        const x = 15 + i * 48;
        return (
          <g key={item.mes}>
            {item.temDados && (
              <rect x={x + 10} y={88 - altura} width="25" height={altura}
                rx="5" fill={item.parcial ? "#d0a744" : "#7650a7"}>
                <title>{item.nome + ": " + dinheiro.format(item.vendido) + (item.parcial ? " (parcial)" : "")}</title>
              </rect>
            )}
            <text x={x + 22} y="108" fontSize="11" textAnchor="middle" fill="#73697e">{item.nome}</text>
          </g>
        );
      })}
    </svg>
  );
}

async function consultarAno(supabase, ano) {
  const inicio = ano + "-01-01";
  const fim = ano + "-12-31";
  const metasResposta = await supabase.from("metas_mensais")
    .select("mes,loja_id,periodo,valor_meta")
    .gte("mes", inicio).lte("mes", fim);
  if (metasResposta.error) throw metasResposta.error;

  const vendas = [];
  for (let offset = 0; ; offset += 1000) {
    const resposta = await supabase.from("vendas_diarias")
      .select("id,data,loja_id,periodo,valor_vendido")
      .gte("data", inicio).lte("data", fim)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (resposta.error) throw resposta.error;
    const pagina = resposta.data || [];
    vendas.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return { vendas, metas: metasResposta.data || [] };
}

export default function EvolucaoAnual({ ano, lojas, vendas, metas }) {
  const supabase = useMemo(() => createClient(), []);
  const hoje = useMemo(() => new Date(), []);
  const [aberto, setAberto] = useState(false);
  const [lojaId, setLojaId] = useState("geral");
  const [periodo, setPeriodo] = useState("todos");
  const [modo, setModo] = useState("acumulado");
  const [historico, setHistorico] = useState({});
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const cache = useRef({});
  const botaoExpandirRef = useRef(null);
  const fecharRef = useRef(null);
  const janelaRef = useRef(null);

  const mini = useMemo(() => resumirSerieAnual({
    ano, lojasIds: lojas.map((loja) => loja.id), periodo: "todos", vendas, metas, hoje,
  }), [ano, lojas, vendas, metas, hoje]);

  const anosAnteriores = useMemo(
    () => [ano - 1, ano - 2].filter((y) => y >= 2024),
    [ano]
  );

  useEffect(() => {
    if (!aberto) return undefined;
    let ativo = true;
    const faltantes = anosAnteriores.filter((y) => !cache.current[y]);
    if (!faltantes.length) {
      setHistorico({ ...cache.current });
      setBuscando(false);
      return undefined;
    }
    setBuscando(true);
    setErro("");
    Promise.all(faltantes.map(async (y) => ({ ano: y, dados: await consultarAno(supabase, y) })))
      .then((resultados) => {
        if (!ativo) return;
        for (const item of resultados) cache.current[item.ano] = item.dados;
        setHistorico({ ...cache.current });
      })
      .catch((error) => {
        console.error("Consulta da evolução anual:", error);
        if (ativo) setErro("Não foi possível consultar todos os anos anteriores.");
      })
      .finally(() => { if (ativo) setBuscando(false); });
    return () => { ativo = false; };
  }, [aberto, ano, anosAnteriores, supabase]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fecharRef.current?.focus();
    function teclado(evento) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setAberto(false);
      } else if (evento.key === "Tab") {
        const controles = [...(janelaRef.current?.querySelectorAll(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]'
        ) || [])];
        if (!controles.length) return;
        if (evento.shiftKey && document.activeElement === controles[0]) {
          evento.preventDefault();
          controles[controles.length - 1].focus();
        } else if (!evento.shiftKey && document.activeElement === controles[controles.length - 1]) {
          evento.preventDefault();
          controles[0].focus();
        } else if (!janelaRef.current?.contains(document.activeElement)) {
          evento.preventDefault();
          controles[0].focus();
        }
      }
    }
    document.addEventListener("keydown", teclado);
    return () => {
      document.removeEventListener("keydown", teclado);
      document.body.style.overflow = scrollAnterior;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
      else botaoExpandirRef.current?.focus();
    };
  }, [aberto]);

  const ids = useMemo(() => lojaId === "geral"
    ? lojas.map((loja) => loja.id)
    : lojas.filter((loja) => String(loja.id) === lojaId).map((loja) => loja.id),
    [lojaId, lojas]);

  const series = useMemo(() => {
    const resultado = {
      [ano]: resumirSerieAnual({ ano, lojasIds: ids, periodo, vendas, metas, hoje }),
    };
    for (const anoAnterior of anosAnteriores) {
      const dados = historico[anoAnterior];
      if (dados) {
        resultado[anoAnterior] = resumirSerieAnual({
          ano: anoAnterior, lojasIds: ids, periodo,
          vendas: dados.vendas, metas: dados.metas, hoje,
        });
      }
    }
    return resultado;
  }, [ano, ids, periodo, vendas, metas, historico, anosAnteriores, hoje]);

  const anosComparados = useMemo(
    () => [ano, ...anosAnteriores.filter((y) => Boolean(series[y]))],
    [ano, anosAnteriores, series]
  );
  const dadosGrafico = useMemo(
    () => montarComparativo(series, anosComparados, modo),
    [series, anosComparados, modo]
  );
  const variacao = useMemo(
    () => compararAnosEquivalentes(series[ano], series[ano - 1]),
    [series, ano]
  );
  const valorAno = series[ano].reduce((total, item) => total + (item.vendido || 0), 0);
  const mesesObservados = series[ano].filter((item) => item.temDados).length;
  const parcial = ano === hoje.getFullYear() && mini.some((item) => item.parcial);
  const temGraficos = dadosGrafico.some((item) => anosComparados.some((y) => item[String(y)] !== null));

  return (
    <>
      <section className={styles.previa} aria-label="Gráfico de evolução anual">
        <div className={styles.previaTopo}>
          <div>
            <h3>Evolução do ano</h3>
            <p>{ano} · vendas mensais das três lojas</p>
          </div>
          <button type="button" ref={botaoExpandirRef} className={styles.botaoExpandir}
            onClick={() => setAberto(true)}>
            Ver análise completa <span aria-hidden="true">↗</span>
          </button>
        </div>
        <MiniGrafico linhas={mini} ano={ano} />
        {parcial && <p className={styles.nota}>O mês atual ainda está em andamento.</p>}
      </section>

      {aberto && createPortal(
        <div className={styles.fundo} onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) setAberto(false);
        }}>
          <section ref={janelaRef} role="dialog" aria-modal="true"
            aria-labelledby="evolucao-anual-modal-titulo" className={styles.janela}>
            <header className={styles.cabecalho}>
              <div>
                <span>Análise histórica</span>
                <h2 id="evolucao-anual-modal-titulo">Evolução anual · {ano}</h2>
              </div>
              <button ref={fecharRef} type="button" className={styles.fechar}
                onClick={() => setAberto(false)}>Fechar ×</button>
            </header>
            <div className={styles.conteudo}>
              <div className={styles.filtros}>
                <label>Loja
                  <select value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
                    <option value="geral">Geral das 3 lojas</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={String(loja.id)}>{loja.codigo} · {loja.nome}</option>
                    ))}
                  </select>
                </label>
                <label>Período
                  <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                    <option value="todos">Manhã + Noite</option>
                    <option value="manha">Manhã</option>
                    <option value="noite">Noite</option>
                  </select>
                </label>
                <label>Visualização
                  <select value={modo} onChange={(e) => setModo(e.target.value)}>
                    <option value="acumulado">Acumulado no ano</option>
                    <option value="mensal">Vendas mês a mês</option>
                    <option value="meta">% da meta mensal</option>
                  </select>
                </label>
              </div>

              <div className={styles.kpis}>
                <div><span>Vendido em {ano}</span><strong>{dinheiro.format(valorAno)}</strong>
                  <small>{mesesObservados} mês(es) com registros{parcial ? " · inclui o atual" : ""}</small></div>
                <div><span>Comparativo com {ano - 1}</span>
                  <strong>{variacao.percentual === null ? "—" :
                    (variacao.percentual > 0 ? "+" : "") + numero.format(variacao.percentual) + "%"}</strong>
                  <small>{variacao.meses ? variacao.meses + " mês(es) fechados equivalentes" : "Sem meses comparáveis"}</small>
                </div>
              </div>

              <div className={styles.tituloGrafico}>
                <h3>{modo === "acumulado" ? "Evolução acumulada" :
                  modo === "mensal" ? "Vendas por mês" : "Atingimento da meta"}</h3>
                <span>{[ano, ...anosAnteriores].join(" × ")}</span>
              </div>
              {erro && <p role="alert" className={styles.aviso}>{erro}</p>}
              {buscando && <p role="status" className={styles.aviso}>Carregando anos anteriores...</p>}
              {temGraficos ? (
                <div className={styles.grafico}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosGrafico} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#ebe5f1" strokeDasharray="4 4" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#73697e" }} tickLine={false} />
                      <YAxis width={70} tick={{ fontSize: 11, fill: "#73697e" }} tickLine={false}
                        tickFormatter={(n) => formatoEixo(n, modo === "meta")} />
                      <Tooltip
                        formatter={(valor, nome) => [formatarMedida(valor, modo === "meta"), nome]}
                        labelFormatter={(nome) => "Mês: " + nome}
                        contentStyle={{ borderRadius: 12, borderColor: "#e4ddec" }}
                      />
                      <Legend />
                      {modo === "meta" && (
                        <ReferenceLine y={100} stroke="#99909e" strokeDasharray="5 5" />
                      )}
                      {anosComparados.map((y, i) => (
                        <Line key={y} name={String(y)} dataKey={String(y)}
                          type="monotone" stroke={CORES[i]} strokeWidth={i === 0 ? 3 : 2}
                          dot={{ r: i === 0 ? 3 : 2 }} activeDot={{ r: 5 }}
                          connectNulls={false} isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className={styles.semDados}>Não há registros para este filtro.</p>}
              <p className={styles.nota}>
                Meses sem lançamentos aparecem como lacunas, sem valores estimados.
                {parcial ? " O mês atual é parcial; a comparação mensal com anos fechados exige cautela." : ""}
              </p>

              <details className={styles.tabelaDetalhada}>
                <summary>Ver valores mês a mês</summary>
                <div className={styles.rolagem}>
                  <table>
                    <thead><tr><th scope="col">Mês</th>
                      {anosComparados.map((y) => <th scope="col" key={y}>{y}</th>)}
                    </tr></thead>
                    <tbody>{dadosGrafico.map((linha) => <tr key={linha.mes}>
                      <th scope="row">{linha.mes}</th>
                      {anosComparados.map((y) => (
                        <td key={y}>{linha[String(y)] === null ? "—" :
                          formatarMedida(linha[String(y)], modo === "meta")}</td>
                      ))}
                    </tr>)}</tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
