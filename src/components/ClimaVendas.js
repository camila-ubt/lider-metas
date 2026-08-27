"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ClimaVendas.module.css";

const LATITUDE_UBATUBA = -23.4339;
const LONGITUDE_UBATUBA = -45.0839;
const PERIODOS = [
  { id: "manha", nome: "Manhã", inicio: 9, fim: 15 },
  { id: "noite", nome: "Noite", inicio: 16, fim: 21 },
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

  // Acumulados muito pequenos (ex.: 0,2–0,8 mm) podem representar
  // sereno/garoa leve no dado histórico modelado e não devem inflar
  // a contagem de períodos efetivamente chuvosos.
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

function montarPeriodos(hourly) {
  if (!hourly?.time?.length) return [];
  const porDia = new Map();

  hourly.time.forEach((dataHora, indice) => {
    const [data, horaTexto] = dataHora.split("T");
    const hora = Number(horaTexto.slice(0, 2));
    if (!porDia.has(data)) porDia.set(data, []);
    porDia.get(data).push({
      hora,
      temperatura: Number(hourly.temperature_2m?.[indice] ?? 0),
      chuva: Number(hourly.precipitation?.[indice] ?? 0),
      codigo: Number(hourly.weather_code?.[indice] ?? 0),
      nuvens: Number(hourly.cloud_cover?.[indice] ?? 0),
    });
  });

  return [...porDia.entries()].flatMap(([data, registros]) =>
    PERIODOS.map((periodo) => {
      const resumo = classificarPeriodo(
        registros.filter(
          (item) => item.hora >= periodo.inicio && item.hora <= periodo.fim
        )
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
    }).filter(Boolean)
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
  const [ativo, setAtivo] = useState(false);
  const [alvoTabs, setAlvoTabs] = useState(null);
  const [clima, setClima] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [climaFiltro, setClimaFiltro] = useState("todos");

  useEffect(() => {
    setAlvoTabs(document.querySelector("nav.tabs"));
  }, []);

  useEffect(() => {
    if (!alvoTabs) return undefined;
    const botaoPainel = [...alvoTabs.querySelectorAll("button")].find(
      (botao) => botao.textContent?.trim() === "Painel"
    );
    const voltarPainel = () => setAtivo(false);
    botaoPainel?.addEventListener("click", voltarPainel);

    if (ativo) botaoPainel?.classList.remove("active");
    else botaoPainel?.classList.add("active");

    return () => {
      botaoPainel?.removeEventListener("click", voltarPainel);
    };
  }, [alvoTabs, ativo]);

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      setCarregando(true);
      setErro("");
      const intervalo = intervaloDoMes(mes);

      if (!intervalo) {
        setClima([]);
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
          { signal: controller.signal }
        );
        if (!resposta.ok) throw new Error("Falha ao carregar histórico climático.");
        const dados = await resposta.json();
        setClima(montarPeriodos(dados.hourly));
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

  const resumo = useMemo(() => {
    const contagem = { sol: 0, nublado: 0, garoa: 0, chuva: 0, forte: 0 };
    let chuvaManha = 0;
    let chuvaNoite = 0;

    clima.forEach((item) => {
      contagem[item.tipo] += 1;
      if (item.tipo === "chuva" || item.tipo === "forte") {
        if (item.periodo === "manha") chuvaManha += 1;
        if (item.periodo === "noite") chuvaNoite += 1;
      }
    });

    const vendasComClima = vendas
      .map((venda) => ({
        valor: Number(venda.valor_vendido || 0),
        clima: climaPorSlot.get(`${venda.data}-${venda.periodo}`),
      }))
      .filter((item) => item.clima && item.valor > 0);

    const semChuva = media(
      vendasComClima
        .filter((item) => ["sol", "nublado", "garoa"].includes(item.clima.tipo))
        .map((item) => item.valor)
    );
    const comChuva = media(
      vendasComClima
        .filter((item) => item.clima.tipo === "chuva" || item.clima.tipo === "forte")
        .map((item) => item.valor)
    );
    const diferenca = semChuva > 0 && comChuva > 0
      ? ((comChuva - semChuva) / semChuva) * 100
      : null;

    return { contagem, chuvaManha, chuvaNoite, semChuva, comChuva, diferenca };
  }, [clima, vendas, climaPorSlot]);

  const linhas = useMemo(() => {
    return clima
      .flatMap((itemClima) =>
        lojas.map((loja) => {
          const venda = vendas.find(
            (item) =>
              item.data === itemClima.data &&
              item.periodo === itemClima.periodo &&
              Number(item.loja_id) === Number(loja.id)
          );
          return { ...itemClima, loja, venda };
        })
      )
      .filter((item) =>
        (lojaFiltro === "todas" || String(item.loja.id) === lojaFiltro) &&
        (periodoFiltro === "todos" || item.periodo === periodoFiltro) &&
        (climaFiltro === "todos" || item.tipo === climaFiltro)
      )
      .sort((a, b) => {
        const data = b.data.localeCompare(a.data);
        if (data !== 0) return data;
        if (a.periodo !== b.periodo) return a.periodo === "manha" ? -1 : 1;
        return Number(a.loja.ordem || a.loja.id) - Number(b.loja.ordem || b.loja.id);
      });
  }, [clima, lojas, vendas, lojaFiltro, periodoFiltro, climaFiltro]);

  const resumoCompacto = (
    <section className={styles.resumo} aria-label="Resumo de clima e vendas">
      <div className={styles.resumoCabecalho}>
        <div>
          <span className={styles.eyebrow}>Clima e vendas</span>
          <h2>Contexto dos dias já vendidos</h2>
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
        <>
          <div className={styles.iconesResumo}>
            <div><span>☀️</span><strong>{resumo.contagem.sol}</strong><small>firme</small></div>
            <div><span>☁️</span><strong>{resumo.contagem.nublado}</strong><small>nublado</small></div>
            <div><span>💧</span><strong>{resumo.contagem.garoa}</strong><small>sereno/garoa</small></div>
            <div><span>🌧️</span><strong>{resumo.contagem.chuva}</strong><small>chuva</small></div>
            <div><span>⛈️</span><strong>{resumo.contagem.forte}</strong><small>forte</small></div>
          </div>
          <div className={styles.faixaImpacto}>
            <span>🌧️ Manhã: <b>{resumo.chuvaManha}</b> períodos com chuva</span>
            <span>🌙 Noite: <b>{resumo.chuvaNoite}</b> períodos com chuva</span>
            {resumo.diferenca !== null && (
              <span className={resumo.diferenca < 0 ? styles.negativo : styles.positivo}>
                Venda média com chuva: <b>{resumo.diferenca > 0 ? "+" : ""}{resumo.diferenca.toFixed(1)}%</b>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );

  const detalhe = (
    <section className={styles.pagina}>
      <div className={styles.topoDetalhe}>
        <div>
          <span className={styles.eyebrow}>Histórico · Ubatuba</span>
          <h2>Clima e Vendas</h2>
          <p>Condições históricas estimadas por período, cruzadas com as vendas de cada loja.</p>
        </div>
        <button type="button" className={styles.voltar} onClick={() => setAtivo(false)}>← Voltar ao painel</button>
      </div>

      <div className={styles.cardsDetalhe}>
        <article><span>☀️</span><strong>{resumo.contagem.sol}</strong><small>períodos firmes</small></article>
        <article><span>☁️</span><strong>{resumo.contagem.nublado}</strong><small>períodos nublados</small></article>
        <article><span>💧</span><strong>{resumo.contagem.garoa}</strong><small>sereno/garoa</small></article>
        <article><span>🌧️</span><strong>{resumo.contagem.chuva}</strong><small>períodos de chuva</small></article>
        <article><span>⛈️</span><strong>{resumo.contagem.forte}</strong><small>chuva forte</small></article>
      </div>

      {(resumo.semChuva > 0 || resumo.comChuva > 0) && (
        <div className={styles.comparacao}>
          <div><small>Venda média sem chuva relevante</small><strong>{dinheiro.format(resumo.semChuva)}</strong></div>
          <div><small>Venda média com chuva</small><strong>{dinheiro.format(resumo.comChuva)}</strong></div>
          <div><small>Diferença observada</small><strong>{resumo.diferenca === null ? "—" : `${resumo.diferenca > 0 ? "+" : ""}${resumo.diferenca.toFixed(1)}%`}</strong></div>
        </div>
      )}

      <div className={styles.filtros}>
        <select value={lojaFiltro} onChange={(e) => setLojaFiltro(e.target.value)} aria-label="Filtrar loja">
          <option value="todas">Todas as lojas</option>
          {lojas.map((loja) => <option key={loja.id} value={String(loja.id)}>{loja.codigo || loja.nome}</option>)}
        </select>
        <select value={periodoFiltro} onChange={(e) => setPeriodoFiltro(e.target.value)} aria-label="Filtrar período">
          <option value="todos">Manhã e noite</option>
          <option value="manha">Manhã</option>
          <option value="noite">Noite</option>
        </select>
        <select value={climaFiltro} onChange={(e) => setClimaFiltro(e.target.value)} aria-label="Filtrar clima">
          <option value="todos">Todos os climas</option>
          <option value="sol">☀️ Firme</option>
          <option value="nublado">☁️ Nublado</option>
          <option value="garoa">💧 Sereno / garoa</option>
          <option value="chuva">🌧️ Chuva</option>
          <option value="forte">⛈️ Chuva forte</option>
        </select>
      </div>

      {carregando ? (
        <p className={styles.estado}>Carregando histórico climático...</p>
      ) : erro ? (
        <p className={styles.estado}>{erro}</p>
      ) : (
        <div className={styles.lista}>
          {linhas.map((item) => (
            <article className={styles.linha} key={`${item.data}-${item.periodo}-${item.loja.id}`}>
              <div className={styles.data}><strong>{dataBonita(item.data)}</strong><small>{item.periodoNome}</small></div>
              <div className={styles.loja}><strong>{item.loja.codigo || item.loja.nome}</strong><small>loja</small></div>
              <div className={styles.clima}><span>{item.icone}</span><div><strong>{item.rotulo}</strong><small>{item.chuva.toFixed(1)} mm · {Math.round(item.tempMin)}–{Math.round(item.tempMax)}°C</small></div></div>
              <div className={styles.venda}><small>Vendido</small><strong>{item.venda ? dinheiro.format(Number(item.venda.valor_vendido || 0)) : "—"}</strong></div>
            </article>
          ))}
          {!linhas.length && <p className={styles.estado}>Nenhum registro para estes filtros.</p>}
        </div>
      )}

      <p className={styles.fonte}>Fonte climática: Open-Meteo Historical Weather, dados horários modelados para Ubatuba. Acumulados abaixo de 1 mm são tratados como sereno/garoa e não entram na contagem de chuva. A comparação mostra associação observada e não prova causalidade.</p>
    </section>
  );

  return (
    <>
      {alvoTabs && createPortal(
        <button type="button" className={ativo ? "active" : ""} onClick={() => setAtivo(true)}>
          Clima e Vendas
        </button>,
        alvoTabs
      )}
      {ativo ? detalhe : <>{children}{resumoCompacto}</>}
    </>
  );
}
