"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { minutosDoHorario, useHorariosPeriodos } from "@/lib/horariosPeriodos";
import styles from "./ClimaVendas.module.css";

const LATITUDE_UBATUBA = -23.4339;
const LONGITUDE_UBATUBA = -45.0839;

const TIPOS_CLIMA = [
  { tipo: "sol", rotulo: "Firme", icone: "☀️" },
  { tipo: "nublado", rotulo: "Nublado", icone: "☁️" },
  { tipo: "garoa", rotulo: "Sereno/garoa", icone: "💧" },
  { tipo: "chuva", rotulo: "Chuva", icone: "🌧️" },
  { tipo: "forte", rotulo: "Chuva forte", icone: "⛈️" },
];

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function dataIso(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function intervaloDoMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const inicio = new Date(ano, numeroMes - 1, 1, 12, 0, 0);
  const fimNatural = new Date(ano, numeroMes, 0, 12, 0, 0);
  const ontem = new Date();
  ontem.setHours(12, 0, 0, 0);
  ontem.setDate(ontem.getDate() - 1);

  if (inicio > ontem) return null;
  const fim = fimNatural < ontem ? fimNatural : ontem;
  return { inicio: dataIso(inicio), fim: dataIso(fim) };
}

function classificarPeriodo(registros) {
  if (!registros.length) return null;

  const chuva = registros.reduce((total, item) => total + item.chuva, 0);
  const nuvens = registros.reduce((total, item) => total + item.nuvens, 0) / registros.length;
  const temperaturas = registros.map((item) => item.temperatura);
  const codigos = registros.map((item) => item.codigo);

  const chuvaForte =
    chuva >= 5 ||
    codigos.some((codigo) => [65, 67, 82, 95, 96, 99].includes(codigo));
  const choveu = chuva >= 1;
  const garoa = chuva > 0 && chuva < 1;
  const fechado =
    nuvens >= 65 || codigos.some((codigo) => [3, 45, 48].includes(codigo));

  if (chuvaForte) {
    return { tipo: "forte", rotulo: "Chuva forte", icone: "⛈️", chuva, nuvens, temperaturas };
  }
  if (choveu) {
    return { tipo: "chuva", rotulo: "Chuva", icone: "🌧️", chuva, nuvens, temperaturas };
  }
  if (garoa) {
    return { tipo: "garoa", rotulo: "Sereno / garoa", icone: "💧", chuva, nuvens, temperaturas };
  }
  if (fechado) {
    return { tipo: "nublado", rotulo: "Nublado", icone: "☁️", chuva, nuvens, temperaturas };
  }
  return { tipo: "sol", rotulo: "Tempo firme", icone: "☀️", chuva, nuvens, temperaturas };
}

function montarPeriodos(hourly, periodos) {
  if (!hourly?.time?.length) return [];
  const porDia = new Map();

  hourly.time.forEach((dataHora, indice) => {
    const [data, horaTexto] = dataHora.split("T");
    const [hora, minuto = "00"] = horaTexto.split(":");
    const minutoDoDia = Number(hora) * 60 + Number(minuto);

    if (!porDia.has(data)) porDia.set(data, []);
    porDia.get(data).push({
      minutoDoDia,
      temperatura: Number(hourly.temperature_2m?.[indice] ?? 0),
      chuva: Number(hourly.precipitation?.[indice] ?? 0),
      codigo: Number(hourly.weather_code?.[indice] ?? 0),
      nuvens: Number(hourly.cloud_cover?.[indice] ?? 0),
    });
  });

  return [...porDia.entries()].flatMap(([data, registros]) =>
    periodos
      .map((periodo) => {
        const resumo = classificarPeriodo(
          registros.filter(
            (item) =>
              item.minutoDoDia >= periodo.inicioMin &&
              item.minutoDoDia < periodo.fimMin,
          ),
        );

        if (!resumo) return null;
        return {
          data,
          periodo: periodo.id,
          periodoNome: periodo.nome,
          ...resumo,
          tempMin: Math.min(...resumo.temperaturas),
          tempMax: Math.max(...resumo.temperaturas),
        };
      })
      .filter(Boolean),
  );
}

function media(valores) {
  const validos = valores.filter((valor) => Number.isFinite(valor) && valor > 0);
  if (!validos.length) return 0;
  return validos.reduce((total, valor) => total + valor, 0) / validos.length;
}

function dataBonita(data) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  });
}

export default function ClimaVendas({ mes, vendas = [], lojas = [], children }) {
  const horarios = useHorariosPeriodos();
  const [ativo, setAtivo] = useState(false);
  const [alvoTabs, setAlvoTabs] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [climaFiltro, setClimaFiltro] = useState("todos");

  const periodos = useMemo(
    () => [
      {
        id: "manha",
        nome: "Manhã",
        icone: "🌤️",
        inicioTexto: horarios.manhaInicio,
        fimTexto: horarios.manhaFim,
        inicioMin: minutosDoHorario(horarios.manhaInicio),
        fimMin: minutosDoHorario(horarios.manhaFim),
      },
      {
        id: "noite",
        nome: "Noite",
        icone: "🌙",
        inicioTexto: horarios.noiteInicio,
        fimTexto: horarios.noiteFim,
        inicioMin: minutosDoHorario(horarios.noiteInicio),
        fimMin: minutosDoHorario(horarios.noiteFim),
      },
    ],
    [horarios],
  );

  const clima = useMemo(() => montarPeriodos(hourly, periodos), [hourly, periodos]);

  useEffect(() => {
    setAlvoTabs(document.querySelector("nav.tabs"));
  }, []);

  useEffect(() => {
    if (!alvoTabs) return undefined;
    const botaoPainel = [...alvoTabs.querySelectorAll("button")].find(
      (botao) => botao.textContent?.trim() === "Painel",
    );
    const voltarPainel = () => setAtivo(false);
    botaoPainel?.addEventListener("click", voltarPainel);

    if (ativo) botaoPainel?.classList.remove("active");
    else botaoPainel?.classList.add("active");

    return () => botaoPainel?.removeEventListener("click", voltarPainel);
  }, [alvoTabs, ativo]);

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      setCarregando(true);
      setErro("");
      const intervalo = intervaloDoMes(mes);

      if (!intervalo) {
        setHourly(null);
        setCarregando(false);
        return;
      }

      try {
        const parametros = new URLSearchParams({
          latitude: String(LATITUDE_UBATUBA),
          longitude: String(LONGITUDE_UBATUBA),
          start_date: intervalo.inicio,
          end_date: intervalo.fim,
          hourly: "temperature_2m,precipitation,weather_code,cloud_cover",
          timezone: "America/Sao_Paulo",
        });

        const resposta = await fetch(
          `https://archive-api.open-meteo.com/v1/archive?${parametros.toString()}`,
          { signal: controller.signal },
        );
        if (!resposta.ok) throw new Error("Falha ao carregar histórico climático.");
        const dados = await resposta.json();
        setHourly(dados.hourly || null);
      } catch (error) {
        if (error.name !== "AbortError") {
          setErro("Não foi possível carregar o histórico climático agora.");
        }
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }

    carregar();
    return () => controller.abort();
  }, [mes]);

  const climaPorSlot = useMemo(() => {
    const mapa = new Map();
    clima.forEach((item) => mapa.set(`${item.data}-${item.periodo}`, item));
    return mapa;
  }, [clima]);

  const insightsPorPeriodo = useMemo(() => {
    const resultado = {};

    periodos.forEach((periodo) => {
      const climaDoPeriodo = clima.filter((item) => item.periodo === periodo.id);
      const tipos = {};

      TIPOS_CLIMA.forEach((tipo) => {
        const dias = climaDoPeriodo.filter((item) => item.tipo === tipo.tipo).length;
        const valores = vendas
          .filter((venda) => {
            if (venda.periodo !== periodo.id) return false;
            const climaVenda = climaPorSlot.get(`${venda.data}-${venda.periodo}`);
            return climaVenda?.tipo === tipo.tipo;
          })
          .map((venda) => Number(venda.valor_vendido || 0));

        tipos[tipo.tipo] = {
          ...tipo,
          dias,
          mediaVenda: media(valores),
        };
      });

      resultado[periodo.id] = {
        ...periodo,
        totalDias: climaDoPeriodo.length,
        tipos,
      };
    });

    return resultado;
  }, [clima, vendas, climaPorSlot, periodos]);

  const linhas = useMemo(() => {
    return clima
      .flatMap((itemClima) =>
        lojas.map((loja) => {
          const venda = vendas.find(
            (item) =>
              item.data === itemClima.data &&
              item.periodo === itemClima.periodo &&
              Number(item.loja_id) === Number(loja.id),
          );
          return { ...itemClima, loja, venda };
        }),
      )
      .filter(
        (item) =>
          (lojaFiltro === "todas" || String(item.loja.id) === lojaFiltro) &&
          (periodoFiltro === "todos" || item.periodo === periodoFiltro) &&
          (climaFiltro === "todos" || item.tipo === climaFiltro),
      )
      .sort((a, b) => {
        const data = b.data.localeCompare(a.data);
        if (data !== 0) return data;
        if (a.periodo !== b.periodo) return a.periodo === "manha" ? -1 : 1;
        return Number(a.loja.ordem || a.loja.id) - Number(b.loja.ordem || b.loja.id);
      });
  }, [clima, lojas, vendas, lojaFiltro, periodoFiltro, climaFiltro]);

  function blocoPeriodo(periodoId, compacto = false) {
    const insight = insightsPorPeriodo[periodoId];
    if (!insight) return null;

    return (
      <section
        className={`${styles.periodoInsight} ${compacto ? styles.periodoCompacto : ""}`}
        key={periodoId}
      >
        <div className={styles.periodoTitulo}>
          <div>
            <span>{insight.icone}</span>
            <div>
              <h3>{insight.nome}</h3>
              <small>
                {insight.inicioTexto}–{insight.fimTexto} · {insight.totalDias} dias analisados
              </small>
            </div>
          </div>
        </div>

        <div className={styles.climaPeriodoGrid}>
          {TIPOS_CLIMA.map((tipo) => {
            const item = insight.tipos[tipo.tipo];
            return (
              <article className={styles.climaPeriodoCard} key={`${periodoId}-${tipo.tipo}`}>
                <span className={styles.climaIcone}>{tipo.icone}</span>
                <div className={styles.climaPeriodoTexto}>
                  <strong>{item.dias} {item.dias === 1 ? "dia" : "dias"}</strong>
                  <small>{tipo.rotulo}</small>
                </div>
                <div className={styles.mediaClima}>
                  <small>média de venda</small>
                  <b>{item.mediaVenda > 0 ? dinheiro.format(item.mediaVenda) : "—"}</b>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const resumoCompacto = (
    <section className={styles.resumo} aria-label="Resumo de clima e vendas">
      <div className={styles.resumoCabecalho}>
        <div>
          <span className={styles.eyebrow}>Clima e vendas</span>
          <h2>Como o clima acompanhou as vendas</h2>
        </div>
        <button type="button" className={styles.verDetalhes} onClick={() => setAtivo(true)}>
          Ver análise completa
        </button>
      </div>

      {carregando ? (
        <p className={styles.estado}>Carregando histórico climático...</p>
      ) : erro ? (
        <p className={styles.estado}>{erro}</p>
      ) : clima.length === 0 ? (
        <p className={styles.estado}>Ainda não há períodos passados para analisar neste mês.</p>
      ) : (
        <div className={styles.periodosResumo}>
          {blocoPeriodo("manha", true)}
          {blocoPeriodo("noite", true)}
        </div>
      )}
    </section>
  );

  const detalhe = (
    <section className={styles.pagina}>
      <div className={styles.topoDetalhe}>
        <div>
          <span className={styles.eyebrow}>Histórico · Ubatuba</span>
          <h2>Clima e Vendas</h2>
          <p>
            Condições históricas estimadas, usando exatamente os horários configurados para manhã e noite.
          </p>
        </div>
        <button type="button" className={styles.voltar} onClick={() => setAtivo(false)}>
          ← Voltar ao painel
        </button>
      </div>

      {carregando ? (
        <p className={styles.estado}>Carregando histórico climático...</p>
      ) : erro ? (
        <p className={styles.estado}>{erro}</p>
      ) : clima.length === 0 ? (
        <p className={styles.estado}>Ainda não há períodos passados para analisar neste mês.</p>
      ) : (
        <div className={styles.insightsPeriodos}>
          {blocoPeriodo("manha")}
          {blocoPeriodo("noite")}
        </div>
      )}

      <div className={styles.detalheCabecalhoLista}>
        <div>
          <span className={styles.eyebrow}>Dia a dia</span>
          <h3>Histórico por loja e período</h3>
        </div>
      </div>

      <div className={styles.filtros}>
        <select value={lojaFiltro} onChange={(e) => setLojaFiltro(e.target.value)} aria-label="Filtrar loja">
          <option value="todas">Todas as lojas</option>
          {lojas.map((loja) => (
            <option key={loja.id} value={String(loja.id)}>{loja.codigo || loja.nome}</option>
          ))}
        </select>
        <select value={periodoFiltro} onChange={(e) => setPeriodoFiltro(e.target.value)} aria-label="Filtrar período">
          <option value="todos">Manhã e noite</option>
          <option value="manha">Manhã</option>
          <option value="noite">Noite</option>
        </select>
        <select value={climaFiltro} onChange={(e) => setClimaFiltro(e.target.value)} aria-label="Filtrar clima">
          <option value="todos">Todos os climas</option>
          {TIPOS_CLIMA.map((tipo) => (
            <option key={tipo.tipo} value={tipo.tipo}>{tipo.icone} {tipo.rotulo}</option>
          ))}
        </select>
      </div>

      {!carregando && !erro && (
        <div className={styles.lista}>
          {linhas.map((item) => (
            <article className={styles.linha} key={`${item.data}-${item.periodo}-${item.loja.id}`}>
              <div className={styles.data}>
                <strong>{dataBonita(item.data)}</strong>
                <small>{item.periodoNome}</small>
              </div>
              <div className={styles.loja}>
                <strong>{item.loja.codigo || item.loja.nome}</strong>
                <small>loja</small>
              </div>
              <div className={styles.clima}>
                <span>{item.icone}</span>
                <div>
                  <strong>{item.rotulo}</strong>
                  <small>{item.chuva.toFixed(1)} mm · {Math.round(item.tempMin)}–{Math.round(item.tempMax)}°C</small>
                </div>
              </div>
              <div className={styles.venda}>
                <small>Vendido</small>
                <strong>{item.venda ? dinheiro.format(Number(item.venda.valor_vendido || 0)) : "—"}</strong>
              </div>
            </article>
          ))}
          {!linhas.length && <p className={styles.estado}>Nenhum registro para estes filtros.</p>}
        </div>
      )}

      <p className={styles.fonte}>
        Fonte climática: Open-Meteo Historical Weather. A faixa horária acompanha a configuração salva no perfil; o horário final é usado como limite de troca do período. Dados modelados para Ubatuba.
      </p>
    </section>
  );

  return (
    <>
      {alvoTabs && createPortal(
        <button type="button" className={ativo ? "active" : ""} onClick={() => setAtivo(true)}>
          Clima e Vendas
        </button>,
        alvoTabs,
      )}
      {ativo ? detalhe : <>{children}{resumoCompacto}</>}
    </>
  );
}
