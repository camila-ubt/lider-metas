"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardEstavel from "@/components/DashboardEstavel";
import { createClient } from "@/lib/supabase/client";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const periodos = ["manha", "noite"];

function inicioMes(valor) {
  return `${valor}-01`;
}

function fimMes(valor) {
  const [ano, mes] = valor.split("-").map(Number);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(
    new Date(ano, mes, 0).getDate()
  ).padStart(2, "0")}`;
}

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(data.getDate()).padStart(2, "0")}`;
}

function dataLocal(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(
    2,
    "0"
  )}`;
}

function valorParaEdicao(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function interpretarValor(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return Number.NaN;
  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    return Number(texto.replace(/\./g, ""));
  }
  return Number(texto);
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [tela, setTela] = useState("painel");
  const [mensagem, setMensagem] = useState("");
  const [mes, setMes] = useState(hojeLocal().slice(0, 7));
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [login, setLogin] = useState({ nome: "", email: "", senha: "" });
  const [modoCadastro, setModoCadastro] = useState(false);
  const [modalVendaAberto, setModalVendaAberto] = useState(false);
  const [modalMetaAberto, setModalMetaAberto] = useState(false);
  const [lancamento, setLancamento] = useState({
    data: hojeLocal(),
    loja_id: "",
    periodo: "manha",
    valor: "",
    observacao: "",
  });
  const [metaForm, setMetaForm] = useState({
    loja_id: "",
    periodo: "manha",
    valor: "",
  });

  useEffect(() => {
    async function iniciar() {
      const { data } = await supabase.auth.getSession();
      setSessao(data.session);
      if (data.session) await carregarPerfil(data.session.user.id);
      setCarregando(false);
    }

    iniciar();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_evento, novaSessao) => {
        setSessao(novaSessao);
        if (novaSessao) await carregarPerfil(novaSessao.user.id);
        else setPerfil(null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (perfil?.ativo) carregarDados();
  }, [perfil, mes]);

  useEffect(() => {
    if (!modalVendaAberto && !modalMetaAberto) return undefined;

    function fecharComEsc(evento) {
      if (evento.key !== "Escape") return;
      setModalVendaAberto(false);
      setModalMetaAberto(false);
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fecharComEsc);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEsc);
    };
  }, [modalVendaAberto, modalMetaAberto]);

  async function carregarPerfil(id) {
    const { data, error } = await supabase
      .from("perfis")
      .select("*")
      .eq("id", id)
      .single();

    if (error) setMensagem(error.message);
    setPerfil(data);
  }

  async function carregarDados() {
    setCarregando(true);

    const [lojasResp, vendasResp, metasResp] = await Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase
        .from("vendas_diarias")
        .select("*")
        .gte("data", inicioMes(mes))
        .lte("data", fimMes(mes))
        .order("data", { ascending: true }),
      supabase.from("metas_mensais").select("*").eq("mes", inicioMes(mes)),
    ]);

    const erro = lojasResp.error || vendasResp.error || metasResp.error;
    if (erro) setMensagem(erro.message);

    const lojasCarregadas = lojasResp.data || [];
    setLojas(lojasCarregadas);
    setVendas(vendasResp.data || []);
    setMetas(metasResp.data || []);
    setLancamento((atual) => ({
      ...atual,
      loja_id: atual.loja_id || lojasCarregadas[0]?.id || "",
    }));
    setMetaForm((atual) => ({
      ...atual,
      loja_id: atual.loja_id || lojasCarregadas[0]?.id || "",
    }));
    setCarregando(false);
  }

  async function entrar(evento) {
    evento.preventDefault();
    setMensagem("");

    if (modoCadastro) {
      const { error } = await supabase.auth.signUp({
        email: login.email,
        password: login.senha,
        options: { data: { nome: login.nome } },
      });
      setMensagem(
        error
          ? error.message
          : "Cadastro criado. Confirme o e-mail e aguarde a aprovação."
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: login.email,
      password: login.senha,
    });
    if (error) setMensagem("E-mail ou senha incorretos.");
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  function vendaDoSlot(data, lojaId, periodo, lista = vendas) {
    return lista.find(
      (item) =>
        item.data === data &&
        Number(item.loja_id) === Number(lojaId) &&
        item.periodo === periodo
    );
  }

  function preencherSlot(data, lojaId, periodo, lista = vendas) {
    const existente = vendaDoSlot(data, lojaId, periodo, lista);
    setLancamento({
      data,
      loja_id: String(lojaId),
      periodo,
      valor: existente ? valorParaEdicao(existente.valor_vendido) : "",
      observacao: existente?.observacao || "",
    });
  }

  function sequenciaDoDia() {
    return periodos.flatMap((periodo) =>
      lojas.map((loja) => ({ loja_id: loja.id, periodo }))
    );
  }

  function abrirDia(data) {
    if (!lojas.length) {
      setMensagem("Nenhuma loja ativa foi encontrada.");
      return;
    }

    const sequencia = sequenciaDoDia();
    const primeiroPendente =
      sequencia.find(
        (slot) => !vendaDoSlot(data, slot.loja_id, slot.periodo)
      ) || sequencia[0];

    preencherSlot(data, primeiroPendente.loja_id, primeiroPendente.periodo);
    setMensagem("");
    setModalVendaAberto(true);
  }

  function mudarSlot(campo, valor) {
    const lojaId = campo === "loja_id" ? valor : lancamento.loja_id;
    const periodo = campo === "periodo" ? valor : lancamento.periodo;
    preencherSlot(lancamento.data, lojaId, periodo);
  }

  async function salvarVenda(evento, acao = "continuar") {
    evento.preventDefault();
    setMensagem("");

    const valor = interpretarValor(lancamento.valor);
    if (!Number.isFinite(valor) || valor < 0) {
      setMensagem("Informe um valor de venda válido.");
      return;
    }

    let observacao = lancamento.observacao.trim();
    if (valor === 0 && !observacao) observacao = "Caixa não aberto";
    if (valor > 0 && observacao === "Caixa não aberto") observacao = "";

    setSalvando(true);
    const { data: vendaSalva, error } = await supabase
      .from("vendas_diarias")
      .upsert(
        {
          data: lancamento.data,
          loja_id: Number(lancamento.loja_id),
          periodo: lancamento.periodo,
          valor_vendido: valor,
          observacao: observacao || null,
          atualizado_por: sessao.user.id,
        },
        { onConflict: "data,loja_id,periodo" }
      )
      .select()
      .single();

    if (error) {
      setMensagem(error.message);
      setSalvando(false);
      return;
    }

    const vendasAtualizadas = [
      ...vendas.filter(
        (item) =>
          !(
            item.data === lancamento.data &&
            Number(item.loja_id) === Number(lancamento.loja_id) &&
            item.periodo === lancamento.periodo
          )
      ),
      vendaSalva,
    ].sort((a, b) => a.data.localeCompare(b.data));

    setVendas(vendasAtualizadas);
    setLancamento((atual) => ({
      ...atual,
      valor: valorParaEdicao(vendaSalva.valor_vendido),
      observacao: vendaSalva.observacao || "",
    }));

    if (acao === "fechar") {
      setMensagem("Venda salva com sucesso.");
      setModalVendaAberto(false);
      setSalvando(false);
      return;
    }

    setMensagem("Venda salva. Escolha o próximo card para continuar.");
    setSalvando(false);
  }

  function metaDoSlot(lojaId, periodo) {
    return metas.find(
      (item) =>
        Number(item.loja_id) === Number(lojaId) && item.periodo === periodo
    );
  }

  function abrirMeta(lojaId, periodo) {
    const existente = metaDoSlot(lojaId, periodo);
    setMetaForm({
      loja_id: String(lojaId),
      periodo,
      valor: existente ? valorParaEdicao(existente.valor_meta) : "",
    });
    setMensagem("");
    setModalMetaAberto(true);
  }

  async function salvarMeta(evento) {
    evento.preventDefault();
    const valor = interpretarValor(metaForm.valor);

    if (!Number.isFinite(valor) || valor < 0) {
      setMensagem("Informe um valor de meta válido.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from("metas_mensais").upsert(
      {
        mes: inicioMes(mes),
        loja_id: Number(metaForm.loja_id),
        periodo: metaForm.periodo,
        valor_meta: valor,
        atualizado_por: sessao.user.id,
      },
      { onConflict: "mes,loja_id,periodo" }
    );

    if (error) {
      setMensagem(error.message);
    } else {
      setMensagem("Meta salva com sucesso.");
      setModalMetaAberto(false);
      await carregarDados();
    }
    setSalvando(false);
  }

  const diasCalendario = useMemo(() => {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const primeiroDiaSemana = new Date(ano, numeroMes - 1, 1).getDay();
    const totalDias = new Date(ano, numeroMes, 0).getDate();
    const itens = Array(primeiroDiaSemana).fill(null);

    for (let dia = 1; dia <= totalDias; dia += 1) {
      itens.push({ numero: dia, data: dataLocal(ano, numeroMes, dia) });
    }
    while (itens.length % 7 !== 0) itens.push(null);
    return itens;
  }, [mes]);

  function statusDoDia(data) {
    const vendasDoDia = vendas.filter((item) => item.data === data);
    const totalEsperado = lojas.length * periodos.length;
    const preenchidos = vendasDoDia.length;
    const manha = lojas.filter((loja) =>
      vendaDoSlot(data, loja.id, "manha")
    ).length;
    const noite = lojas.filter((loja) =>
      vendaDoSlot(data, loja.id, "noite")
    ).length;

    return {
      preenchidos,
      totalEsperado,
      manha,
      noite,
      completo: totalEsperado > 0 && preenchidos >= totalEsperado,
      parcial: preenchidos > 0 && preenchidos < totalEsperado,
    };
  }

  if (carregando && !sessao) {
    return <div className="central">Carregando...</div>;
  }

  if (!sessao) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">LM</div>
          <p className="eyebrow">Gestão das lojas</p>
          <h1>Líder Metas</h1>
          <p className="muted">Acompanhe as metas da CB, AA e AB por período.</p>

          <form onSubmit={entrar} className="form-stack">
            {modoCadastro && (
              <label>
                Nome
                <input
                  value={login.nome}
                  onChange={(evento) =>
                    setLogin({ ...login, nome: evento.target.value })
                  }
                  required
                />
              </label>
            )}
            <label>
              E-mail
              <input
                type="email"
                value={login.email}
                onChange={(evento) =>
                  setLogin({ ...login, email: evento.target.value })
                }
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                minLength={6}
                value={login.senha}
                onChange={(evento) =>
                  setLogin({ ...login, senha: evento.target.value })
                }
                required
              />
            </label>
            <button className="primary-button">
              {modoCadastro ? "Criar acesso" : "Entrar"}
            </button>
          </form>

          {mensagem && <p className="message">{mensagem}</p>}
          <button
            className="text-button"
            onClick={() => setModoCadastro(!modoCadastro)}
          >
            {modoCadastro ? "Já tenho acesso" : "Primeiro acesso"}
          </button>
        </section>
      </main>
    );
  }

  if (!perfil?.ativo) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">LM</div>
          <h1>Aguardando aprovação</h1>
          <p className="muted">
            Seu cadastro foi criado, mas ainda precisa ser liberado pela administradora.
          </p>
          <button className="primary-button" onClick={sair}>Sair</button>
        </section>
      </main>
    );
  }

  const dataModal = new Date(`${lancamento.data}T12:00:00`).toLocaleDateString(
    "pt-BR",
    { weekday: "long", day: "2-digit", month: "long" }
  );
  const slotAtual = vendaDoSlot(
    lancamento.data,
    lancamento.loja_id,
    lancamento.periodo
  );
  const lojaAtual = lojas.find(
    (loja) => Number(loja.id) === Number(lancamento.loja_id)
  );
  const slotsMetas = lojas.flatMap((loja) =>
    periodos.map((periodo) => ({
      loja,
      periodo,
      registro: metaDoSlot(loja.id, periodo),
    }))
  );
  const metasPreenchidas = slotsMetas.filter((item) => item.registro).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gestão de desempenho</p>
          <h1>Líder Metas</h1>
        </div>
        <div className="top-actions">
          <input
            type="month"
            value={mes}
            onChange={(evento) => setMes(evento.target.value)}
          />
          <button className="secondary-button" onClick={sair}>Sair</button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tela === "painel" ? "active" : ""}
          onClick={() => setTela("painel")}
        >
          Painel
        </button>
        <button
          className={tela === "lancamentos" ? "active" : ""}
          onClick={() => setTela("lancamentos")}
        >
          Lançar vendas
        </button>
        {perfil.papel === "admin" && (
          <button
            className={tela === "metas" ? "active" : ""}
            onClick={() => setTela("metas")}
          >
            Metas
          </button>
        )}
      </nav>

      {mensagem && <p className="message app-message">{mensagem}</p>}
      {carregando && <p className="muted">Atualizando dados...</p>}

      {tela === "painel" && (
        <DashboardEstavel mes={mes} vendas={vendas} metas={metas} lojas={lojas} />
      )}

      {tela === "lancamentos" && (
        <section className="calendar-section">
          <div className="panel calendar-panel">
            <div className="calendar-heading">
              <div>
                <p className="eyebrow">Lançamentos do mês</p>
                <h2>Selecione um dia</h2>
                <p className="muted">
                  Toque no dia para preencher ou editar os caixas das lojas.
                </p>
              </div>
              <div className="calendar-legend">
                <span><i className="legend-dot complete" /> Completo</span>
                <span><i className="legend-dot partial" /> Parcial</span>
                <span><i className="legend-dot empty" /> Pendente</span>
              </div>
            </div>

            <div className="calendar-weekdays">
              {diasSemana.map((dia) => <span key={dia}>{dia}</span>)}
            </div>

            <div className="calendar-grid">
              {diasCalendario.map((dia, indice) => {
                if (!dia) {
                  return <div className="calendar-day calendar-day-empty" key={`vazio-${indice}`} />;
                }

                const status = statusDoDia(dia.data);
                const hoje = dia.data === hojeLocal();
                const classeStatus = status.completo
                  ? "complete"
                  : status.parcial
                    ? "partial"
                    : "pending";

                return (
                  <button
                    type="button"
                    className={`calendar-day ${classeStatus} ${hoje ? "today" : ""}`}
                    key={dia.data}
                    onClick={() => abrirDia(dia.data)}
                    aria-label={`Dia ${dia.numero}: ${status.preenchidos} de ${status.totalEsperado} lançamentos preenchidos`}
                  >
                    <span className="calendar-number">{dia.numero}</span>
                    <span className="calendar-periods">
                      <b className={status.manha === lojas.length ? "full" : status.manha > 0 ? "some" : ""}>M</b>
                      <b className={status.noite === lojas.length ? "full" : status.noite > 0 ? "some" : ""}>N</b>
                    </span>
                    {status.preenchidos > 0 && <small>{status.preenchidos}/{status.totalEsperado}</small>}
                  </button>
                );
              })}
            </div>

            <p className="calendar-help">
              M e N ficam verdes quando todas as lojas daquele período foram preenchidas. Valores zerados também contam como preenchidos.
            </p>
          </div>
        </section>
      )}

      {tela === "metas" && perfil.papel === "admin" && (
        <section className="meta-manager">
          <div className="panel meta-overview-panel">
            <p className="eyebrow">Mês selecionado</p>
            <h2>Metas cadastradas</h2>
            <div className={`meta-progress-summary ${metasPreenchidas === slotsMetas.length && slotsMetas.length ? "all-filled" : ""}`}>
              {metasPreenchidas === slotsMetas.length && slotsMetas.length
                ? `Todas as ${slotsMetas.length} metas estão preenchidas`
                : `${metasPreenchidas} de ${slotsMetas.length} preenchidas · ${slotsMetas.length - metasPreenchidas} pendentes`}
            </div>

            <div className="history-list meta-status-grid">
              {slotsMetas.map((item) => {
                const configurada = Boolean(item.registro);
                return (
                  <button
                    type="button"
                    className={`history-item meta-status-card ${configurada ? "is-filled" : "is-pending"}`}
                    onClick={() => abrirMeta(item.loja.id, item.periodo)}
                    key={`${item.loja.id}-${item.periodo}`}
                  >
                    <div>
                      <strong>{item.loja.codigo} · {item.periodo === "manha" ? "Manhã" : "Noite"}</strong>
                      <span>{configurada ? "Configurada" : "Pendente"}</span>
                      <small className="meta-card-action">{configurada ? "Toque para editar" : "Toque para preencher"}</small>
                    </div>
                    <b>{dinheiro.format(Number(item.registro?.valor_meta || 0))}</b>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {modalVendaAberto && (
        <div
          className="modal-backdrop"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setModalVendaAberto(false);
          }}
        >
          <section className="sale-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-venda">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Lançamento diário</p>
                <h2 id="titulo-modal-venda">{dataModal}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalVendaAberto(false)} aria-label="Fechar">×</button>
            </div>

            <form className="form-stack modal-form" onSubmit={(evento) => salvarVenda(evento, "continuar")}>
              <div className="slot-selection">
                <div className="slot-selector-group">
                  <div className="slot-selector-title">
                    <strong>Período</strong>
                    <small>Verde = todas as lojas lançadas</small>
                  </div>
                  <div className="period-card-grid">
                    {periodos.map((periodo) => {
                      const preenchidas = lojas.filter((loja) =>
                        vendaDoSlot(lancamento.data, loja.id, periodo)
                      ).length;
                      const completo = lojas.length > 0 && preenchidas === lojas.length;
                      const parcial = preenchidas > 0 && !completo;
                      const selecionado = lancamento.periodo === periodo;

                      return (
                        <button
                          type="button"
                          className={`slot-period-card ${
                            completo ? "is-complete" : parcial ? "is-partial" : ""
                          } ${selecionado ? "is-selected" : ""}`}
                          onClick={() => mudarSlot("periodo", periodo)}
                          aria-pressed={selecionado}
                          key={periodo}
                        >
                          <strong>{periodo === "manha" ? "Manhã" : "Noite"}</strong>
                          <span>{preenchidas} de {lojas.length} lojas preenchidas</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="slot-selector-group">
                  <div className="slot-selector-title">
                    <strong>Loja</strong>
                    <small>Toque para lançar ou editar</small>
                  </div>
                  <div className="store-card-grid">
                    {lojas.map((loja) => {
                      const venda = vendaDoSlot(
                        lancamento.data,
                        loja.id,
                        lancamento.periodo
                      );
                      const selecionada =
                        Number(lancamento.loja_id) === Number(loja.id);

                      return (
                        <button
                          type="button"
                          className={`slot-store-card ${
                            venda ? "is-filled" : ""
                          } ${selecionada ? "is-selected" : ""}`}
                          onClick={() => mudarSlot("loja_id", String(loja.id))}
                          aria-pressed={selecionada}
                          key={loja.id}
                        >
                          <i>{venda ? "✓" : "+"}</i>
                          <strong>{loja.codigo}</strong>
                          <span>
                            {venda
                              ? dinheiro.format(Number(venda.valor_vendido || 0))
                              : "Pendente"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="slot-current-summary">
                <strong>
                  {lojaAtual?.codigo} · {lancamento.periodo === "manha" ? "Manhã" : "Noite"}
                </strong>
                <span>
                  {slotAtual
                    ? `Lançado: ${dinheiro.format(Number(slotAtual.valor_vendido || 0))}`
                    : "Pendente"}
                </span>
              </div>

              <label>
                Valor vendido
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={lancamento.valor}
                  onChange={(evento) => setLancamento({ ...lancamento, valor: evento.target.value })}
                  autoFocus
                  required
                />
              </label>

              <button
                type="button"
                className="zero-button"
                onClick={() => setLancamento({ ...lancamento, valor: "0,00", observacao: "Caixa não aberto" })}
              >
                Marcar caixa não aberto
              </button>

              <label>
                Observação
                <textarea
                  rows="3"
                  value={lancamento.observacao}
                  onChange={(evento) => setLancamento({ ...lancamento, observacao: evento.target.value })}
                  placeholder="Opcional"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" disabled={salvando} onClick={(evento) => salvarVenda(evento, "fechar")}>Salvar e fechar</button>
                <button type="submit" className="primary-button" disabled={salvando}>{salvando ? "Salvando..." : "Salvar lançamento"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modalMetaAberto && (
        <div
          className="modal-backdrop"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setModalMetaAberto(false);
          }}
        >
          <section className="sale-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-meta">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Configuração mensal</p>
                <h2 id="titulo-modal-meta">Cadastrar meta</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalMetaAberto(false)} aria-label="Fechar">×</button>
            </div>

            <form className="form-stack modal-form" onSubmit={salvarMeta}>
              <label>
                Loja
                <select value={metaForm.loja_id} onChange={(evento) => {
                  const lojaId = evento.target.value;
                  const existente = metaDoSlot(lojaId, metaForm.periodo);
                  setMetaForm({ ...metaForm, loja_id: lojaId, valor: existente ? valorParaEdicao(existente.valor_meta) : "" });
                }}>
                  {lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.codigo} — {loja.nome}</option>)}
                </select>
              </label>

              <label>
                Período
                <select value={metaForm.periodo} onChange={(evento) => {
                  const periodo = evento.target.value;
                  const existente = metaDoSlot(metaForm.loja_id, periodo);
                  setMetaForm({ ...metaForm, periodo, valor: existente ? valorParaEdicao(existente.valor_meta) : "" });
                }}>
                  <option value="manha">Manhã</option>
                  <option value="noite">Noite</option>
                </select>
              </label>

              <label>
                Valor da meta
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={metaForm.valor}
                  onChange={(evento) => setMetaForm({ ...metaForm, valor: evento.target.value })}
                  autoFocus
                  required
                />
              </label>

              <p className="muted">Supermeta e Megameta são calculadas automaticamente em 120% e 130%.</p>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setModalMetaAberto(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={salvando}>{salvando ? "Salvando..." : "Salvar meta"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
