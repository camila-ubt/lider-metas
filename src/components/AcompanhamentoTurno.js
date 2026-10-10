"use client";

import { useEffect, useMemo, useState } from "react";
import { calcularAcompanhamentoTurno } from "@/lib/acompanhamentoTurno.mjs";
import styles from "./AcompanhamentoTurno.module.css";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const niveis = [{ valor: 100, rotulo: "Meta 100%" }, { valor: 110, rotulo: "Super 110%" }, { valor: 120, rotulo: "Mega 120%" }];

function hojeLocal() {
  const data = new Date();
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatarEntrada(digitos) {
  if (!digitos) return "";
  return numero.format(Number(digitos) / 100);
}

function carregarRascunho(chave) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) || "{}");
    if (!salvo || typeof salvo !== "object" || Array.isArray(salvo)) return {};
    return Object.fromEntries(
      Object.entries(salvo)
        .filter(([id, valor]) => /^\d+$/.test(id) && typeof valor === "string" && /^\d{0,12}$/.test(valor))
    );
  } catch {
    return {};
  }
}

export default function AcompanhamentoTurno({ mes, metas, lojas, usuarioId }) {
  const [data, setData] = useState(hojeLocal);
  const [periodo, setPeriodo] = useState("noite");
  const [nivel, setNivel] = useState(100);
  const [valores, setValores] = useState({});
  const [chaveCarregada, setChaveCarregada] = useState("");
  const [erroSalvar, setErroSalvar] = useState(false);

  const preferenciaChave = ["lider-metas", "acompanhamento", "preferencias", usuarioId].join(":");
  const chave = ["lider-metas", "acompanhamento", usuarioId, data, periodo].join(":");
  const pronto = chaveCarregada === chave;
  const vendasAtuais = pronto ? valores : {};

  useEffect(() => {
    try {
      const preferencia = JSON.parse(localStorage.getItem(preferenciaChave) || "{}");
      if (["manha", "noite"].includes(preferencia.periodo)) setPeriodo(preferencia.periodo);
      if ([100, 110, 120].includes(preferencia.nivel)) setNivel(preferencia.nivel);
    } catch {
      // Continua com a seleção inicial.
    }
  }, [preferenciaChave]);

  useEffect(() => {
    setValores(carregarRascunho(chave));
    setChaveCarregada(chave);
    setErroSalvar(false);
  }, [chave]);

  useEffect(() => {
    const atualizarDia = () => setData(hojeLocal());
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizarDia();
    };
    window.addEventListener("focus", atualizarDia);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.removeEventListener("focus", atualizarDia);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  const resultado = useMemo(
    () => calcularAcompanhamentoTurno({
      lojas,
      metas,
      mes,
      periodo,
      nivel,
      vendasEmCentavos: vendasAtuais,
    }),
    [lojas, metas, mes, periodo, nivel, vendasAtuais],
  );

  const mesAtual = data.slice(0, 7);
  const mesCorreto = mes === mesAtual;
  const dataFormatada = new Date(data + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  function salvarPreferencias(proximoPeriodo, proximoNivel) {
    try {
      localStorage.setItem(preferenciaChave, JSON.stringify({ periodo: proximoPeriodo, nivel: proximoNivel }));
    } catch {
      // Seleções continuam disponíveis nesta sessão.
    }
  }

  function alterarVenda(lojaId, digitado) {
    if (!pronto) return;
    const digitos = String(digitado).replace(/\D/g, "").slice(0, 12);
    const atualizados = { ...vendasAtuais, [String(lojaId)]: digitos };
    setValores(atualizados);
    try {
      localStorage.setItem(chave, JSON.stringify(atualizados));
      setErroSalvar(false);
    } catch {
      setErroSalvar(true);
    }
  }

  function limpar() {
    if (!window.confirm("Limpar os valores informados para este dia e turno?")) return;
    try {
      localStorage.removeItem(chave);
      setErroSalvar(false);
    } catch {
      setErroSalvar(true);
    }
    setValores({});
  }

  return (
    <section className={styles.container} aria-label="Acompanhamento do turno">
      <header className={styles.cabecalho}>
        <div>
          <p className="eyebrow">Acompanhamento de vendas</p>
          <h2>Acompanhar turno</h2>
          <p className="muted">{dataFormatada}</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={limpar}
          disabled={!pronto || !Object.values(vendasAtuais).some((valor) => Number(valor) > 0)}
        >
          Limpar valores
        </button>
      </header>

      <div className={styles.controles}>
        <div>
          <p className={styles.rotulo}>Turno</p>
          <div className={styles.opcoes} role="group" aria-label="Selecionar turno">
            {["manha", "noite"].map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={periodo === opcao ? styles.selecionado : ""}
                aria-pressed={periodo === opcao}
                onClick={() => {
                  setPeriodo(opcao);
                  salvarPreferencias(opcao, nivel);
                }}
              >
                {opcao === "manha" ? "Manhã" : "Noite"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={styles.rotulo}>Meta a acompanhar</p>
          <div className={styles.opcoes} role="group" aria-label="Selecionar meta">
            {niveis.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                className={nivel === opcao.valor ? styles.selecionado : ""}
                aria-pressed={nivel === opcao.valor}
                onClick={() => {
                  setNivel(opcao.valor);
                  salvarPreferencias(periodo, opcao.valor);
                }}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!mesCorreto && (
        <p className={styles.aviso} role="status">
          Para acompanhar hoje, selecione o mês {mesAtual} no topo da página.
        </p>
      )}

      {mesCorreto && !resultado.metasCompletas && (
        <p className={styles.aviso} role="status">
          {resultado.porLoja.length === 0
            ? "Nenhuma loja ativa encontrada."
            : "Faltam metas cadastradas para: " + resultado.porLoja
                .filter((item) => item.meta === null)
                .map((item) => item.loja.codigo || item.loja.nome)
                .join(", ") + "."
          }
        </p>
      )}

      {mesCorreto && resultado.metasCompletas && (
        <div className={styles.geral}>
          <div className={styles.geralTitulo}>
            <div>
              <p className="eyebrow">Geral · todas as lojas</p>
              <h3>Meta coletiva</h3>
            </div>
            <strong>{Math.round(resultado.percentual)}%</strong>
          </div>
          <div className={styles.metricas}>
            <div>
              <span>Falta no geral</span>
              <strong>{moeda.format(resultado.faltaGeral)}</strong>
            </div>
            <div>
              <span>Média por loja</span>
              <strong>{moeda.format(resultado.mediaPorLoja)}</strong>
            </div>
          </div>
          <div className={styles.progresso} role="progressbar" aria-label="Progresso da meta coletiva" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(resultado.percentual))}>
            <div style={{ width: Math.min(100, resultado.percentual) + "%" }} />
          </div>
          <p className={styles.totais}>
            Meta {moeda.format(resultado.metaTotal)} · Vendido {moeda.format(resultado.vendidoTotal)}
          </p>
          {resultado.faltaGeral === 0 && <p className={styles.concluido}>Meta coletiva atingida!</p>}
        </div>
      )}

      <div className={styles.secundario}>
        <h3>Real por loja</h3>
        <p className="muted">Informe o total vendido até agora em cada loja.</p>
      </div>
      <div className={styles.lojas}>
        {resultado.porLoja.map(({ loja, meta, falta, excedente }) => (
          <article className={styles.loja} key={loja.id}>
            <div className={styles.lojaTitulo}>
              <strong>{loja.codigo || loja.nome}</strong>
              <span>{mesCorreto && meta !== null ? "Meta " + moeda.format(meta) : "Meta indisponível"}</span>
            </div>
            <label htmlFor={"acompanhamento-loja-" + loja.id}>Vendido até agora (R$)</label>
            <input
              id={"acompanhamento-loja-" + loja.id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0,00"
              value={formatarEntrada(vendasAtuais[String(loja.id)] || "")}
              onChange={(evento) => alterarVenda(loja.id, evento.target.value)}
              disabled={!pronto}
            />
            {mesCorreto && meta !== null && (
              <div className={styles.situacao}>
                <span>{falta > 0 ? "Falta na loja" : "Meta atingida"}</span>
                <strong className={falta > 0 ? "" : styles.positivo}>
                  {falta > 0 ? moeda.format(falta) : excedente > 0 ? "+" + moeda.format(excedente) + " de excedente" : "Atingida"}
                </strong>
              </div>
            )}
          </article>
        ))}
      </div>
      {erroSalvar && <p className={styles.aviso} role="alert">Não foi possível salvar os valores neste navegador.</p>}
      <p className={styles.rodape}>Valores temporários salvos neste aparelho. Não alteram os lançamentos de vendas.</p>
    </section>
  );
}
