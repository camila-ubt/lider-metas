"use client";

import { useEffect, useMemo, useState } from "react";
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
  return new Date(ano, mes, 0).toISOString().slice(0, 10);
}

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function dataLocal(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function valorParaEdicao(valor) {
  return Number(valor).toLocaleString("pt-BR", {
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
  const [modalAberto, setModalAberto] = useState(false);
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
    if (!modalAberto) return undefined;

    function fecharComEsc(evento) {
      if (evento.key === "Escape") setModalAberto(false);
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fecharComEsc);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEsc);
    };
  }, [modalAberto]);

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
        .order("data", { ascending: false }),
      supabase.from("metas_mensais").select("*").eq("mes", inicioMes(mes)),
    ]);

    const erro = lojasResp.error || vendasResp.error || metasResp.error;
    if (erro) setMensagem(erro.message);

    setLojas(lojasResp.data || []);
    setVendas(vendasResp.data || []);
    setMetas(metasResp.data || []);

    setLancamento((atual) => ({
      ...atual,
      loja_id: atual.loja_id || lojasResp.data?.[0]?.id || "",
    }));
    setMetaForm((atual) => ({
      ...atual,
      loja_id: atual.loja_id || lojasResp.data?.[0]?.id || "",
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
    return lojas.flatMap((loja) =>
      periodos.map((periodo) => ({ loja_id: loja.id, periodo }))
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

    preencherSlot(
      data,
      primeiroPendente.loja_id,
      primeiroPendente.periodo
    );
    setMensagem("");
    setModalAberto(true);
  }

  function mudarSlot(campo, valor) {
    const lojaId = campo === "loja_id" ? valor : lancamento.loja_id;
    const periodo = campo === "periodo" ? valor : lancamento.periodo;
    preencherSlot(lancamento.data, lojaId, periodo);
  }

  async function salvarVenda(evento, acao = "proximo") {
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
    ];

    setVendas(vendasAtualizadas);

    if (acao === "fechar") {
      setMensagem("Venda salva com sucesso.");
      setModalAberto(false);
      setSalvando(false);
      return;
    }

    const sequencia = sequenciaDoDia();
    const indiceAtual = sequencia.findIndex(
      (slot) =>
        Number(slot.loja_id) === Number(lancamento.loja_id) &&
        slot.periodo === lancamento.periodo
    );
    const proximos = [
      ...sequencia.slice(indiceAtual + 1),
      ...sequencia.slice(0, indiceAtual),
    ];
    const proximoPendente = proximos.find(
      (slot) =>
        !vendaDoSlot(
          lancamento.data,
          slot.loja_id,
          slot.periodo,
          vendasAtualizadas
        )
    );

    if (proximoPendente) {
      preencherSlot(
        lancamento.data,
        proximoPendente.loja_id,
        proximoPendente.periodo,
        vendasAtualizadas
      );
      setMensagem("Salvo. Continue no próximo período.");
    } else {
      setMensagem("Dia completo: todas as lojas e períodos foram preenchidos.");
      setModalAberto(false);
    }

    setSalvando(false);
  }

  async function salvarMeta(evento) {
    evento.preventDefault();
    const valor = interpretarValor(metaForm.valor);

    if (!Number.isFinite(valor) || valor < 0) {
      setMensagem("Informe um valor de meta válido.");
      return;
    }

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

    if (error) setMensagem(error.message);
    else {
      setMensagem("Meta salva com sucesso.");
      setMetaForm((atual) => ({ ...atual, valor: "" }));
      carregarDados();
    }
  }

  const resumo = useMemo(() => {
    const totalVendido = vendas.reduce(
      (soma, item) => soma + Number(item.valor_vendido),
      0
    );
    const meta = metas.reduce(
      (soma, item) => soma + Number(item.valor_meta),
      0
    );
    const supermeta = meta * 1.2;
    const megameta = meta * 1.3;
    const [ano, numeroMes] = mes.split("-").map(Number);
    const diasNoMes = new Date(ano, numeroMes, 0).getDate();
    const hoje = new Date();
    const diasPassados =
      ano === hoje.getFullYear() && numeroMes === hoje.getMonth() + 1
        ? hoje.getDate()
        : diasNoMes;
    const media = diasPassados ? totalVendido / diasPassados : 0;
    const projecao = media * diasNoMes;

    return { totalVendido, meta, supermeta, megameta, media, projecao };
  }, [vendas, metas, mes]);

  const diasCalendario = useMemo(() => {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const primeiroDiaSemana = new Date(ano, numeroMes - 1, 1).getDay();
    const totalDias = new Date(ano, numeroMes, 0).getDate();
    const itens = Array(primeiroDiaSemana).fill(null);

    for (let dia = 1; dia <= totalDias; dia += 1) {
      itens.push({
        numero: dia,
        data: dataLocal(ano, numeroMes, dia),
      });
    }

    while (itens.length % 7 !== 0) itens.push(null);
    return itens;
  }, [mes]);

  function vendidoDaLoja(lojaId, periodo) {
    return vendas
      .filter(
        (item) =>
          Number(item.loja_id) === Number(lojaId) &&
          (!periodo || item.periodo === periodo)
      )
      .reduce((soma, item) => soma + Number(item.valor_vendido), 0);
  }

  function metaDaLoja(lojaId, periodo) {
    return metas
      .filter(
        (item) =>
          Number(item.loja_id) === Number(lojaId) &&
          (!periodo || item.periodo === periodo)
      )
      .reduce((soma, item) => soma + Number(item.valor_meta), 0);
  }

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
    const total = vendasDoDia.reduce(
      (soma, item) => soma + Number(item.valor_vendido),
      0
    );

    return {
      preenchidos,
      totalEsperado,
      manha,
      noite,
      total,
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
          <p className="muted">
            Acompanhe as metas da CB, AA e AB por período.
          </p>

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
            Seu cadastro foi criado, mas ainda precisa ser liberado pela
            administradora.
          </p>
          <button className="primary-button" onClick={sair}>
            Sair
          </button>
        </section>
      </main>
    );
  }

  const dataModal = new Date(
    `${lancamento.data}T12:00:00`
  ).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const slotAtual = vendaDoSlot(
    lancamento.data,
    lancamento.loja_id,
    lancamento.periodo
  );

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
          <button className="secondary-button" onClick={sair}>
            Sair
          </button>
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

      {tela === "painel" && (
        <section>
          <div className="kpi-grid">
            <article className="kpi">
              <span>Total vendido</span>
              <strong>{dinheiro.format(resumo.totalVendido)}</strong>
            </article>
            <article className="kpi">
              <span>Meta</span>
              <strong>{dinheiro.format(resumo.meta)}</strong>
              <small>
                {resumo.meta
                  ? `${Math.round(
                      (resumo.totalVendido / resumo.meta) * 100
                    )}% atingido`
                  : "Meta não cadastrada"}
              </small>
            </article>
            <article className="kpi">
              <span>Média diária</span>
              <strong>{dinheiro.format(resumo.media)}</strong>
            </article>
            <article className="kpi">
              <span>Projeção</span>
              <strong>{dinheiro.format(resumo.projecao)}</strong>
              <small>
                {resumo.projecao >= resumo.meta && resumo.meta
                  ? "Ritmo suficiente para a meta"
                  : "Abaixo do ritmo da meta"}
              </small>
            </article>
          </div>

          <div className="levels-card">
            {[
              { nome: "Meta", valor: resumo.meta },
              { nome: "Supermeta", valor: resumo.supermeta },
              { nome: "Megameta", valor: resumo.megameta },
            ].map((nivel) => {
              const porcentagem = nivel.valor
                ? Math.min((resumo.totalVendido / nivel.valor) * 100, 100)
                : 0;

              return (
                <div className="level" key={nivel.nome}>
                  <div>
                    <strong>{nivel.nome}</strong>
                    <span>{dinheiro.format(nivel.valor)}</span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${porcentagem}%` }} />
                  </div>
                  <small>{Math.round(porcentagem)}%</small>
                </div>
              );
            })}
          </div>

          <div className="store-grid">
            {lojas.map((loja) => {
              const vendido = vendidoDaLoja(loja.id);
              const meta = metaDaLoja(loja.id);

              return (
                <article className="store-card" key={loja.id}>
                  <div className="store-title">
                    <div>
                      <span>{loja.codigo}</span>
                      <h2>{loja.nome}</h2>
                    </div>
                    <strong>
                      {meta ? Math.round((vendido / meta) * 100) : 0}%
                    </strong>
                  </div>
                  <p className="store-total">{dinheiro.format(vendido)}</p>
                  <p className="muted">Meta: {dinheiro.format(meta)}</p>
                  <div className="period-row">
                    <span>
                      Manhã
                      <b>{dinheiro.format(vendidoDaLoja(loja.id, "manha"))}</b>
                    </span>
                    <span>
                      Noite
                      <b>{dinheiro.format(vendidoDaLoja(loja.id, "noite"))}</b>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
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
                <span>
                  <i className="legend-dot complete" /> Completo
                </span>
                <span>
                  <i className="legend-dot partial" /> Parcial
                </span>
                <span>
                  <i className="legend-dot empty" /> Pendente
                </span>
              </div>
            </div>

            <div className="calendar-weekdays">
              {diasSemana.map((dia) => (
                <span key={dia}>{dia}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {diasCalendario.map((dia, indice) => {
                if (!dia) {
                  return (
                    <div
                      className="calendar-day calendar-day-empty"
                      key={`vazio-${indice}`}
                    />
                  );
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
                    className={`calendar-day ${classeStatus} ${
                      hoje ? "today" : ""
                    }`}
                    key={dia.data}
                    onClick={() => abrirDia(dia.data)}
                    aria-label={`Dia ${dia.numero}: ${status.preenchidos} de ${status.totalEsperado} lançamentos preenchidos`}
                  >
                    <span className="calendar-number">{dia.numero}</span>
                    <span className="calendar-periods">
                      <b
                        className={
                          status.manha === lojas.length
                            ? "full"
                            : status.manha > 0
                              ? "some"
                              : ""
                        }
                      >
                        M
                      </b>
                      <b
                        className={
                          status.noite === lojas.length
                            ? "full"
                            : status.noite > 0
                              ? "some"
                              : ""
                        }
                      >
                        N
                      </b>
                    </span>
                    {status.preenchidos > 0 && (
                      <small>{status.preenchidos}/{status.totalEsperado}</small>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="calendar-help">
              M e N ficam verdes quando todas as lojas daquele período foram
              preenchidas. Valores zerados também contam como preenchidos.
            </p>
          </div>
        </section>
      )}

      {tela === "metas" && perfil.papel === "admin" && (
        <section className="content-grid">
          <form className="panel form-stack" onSubmit={salvarMeta}>
            <div>
              <p className="eyebrow">Configuração mensal</p>
              <h2>Cadastrar meta</h2>
            </div>
            <label>
              Loja
              <select
                value={metaForm.loja_id}
                onChange={(evento) =>
                  setMetaForm({
                    ...metaForm,
                    loja_id: evento.target.value,
                  })
                }
              >
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.codigo} — {loja.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Período
              <select
                value={metaForm.periodo}
                onChange={(evento) =>
                  setMetaForm({
                    ...metaForm,
                    periodo: evento.target.value,
                  })
                }
              >
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
                onChange={(evento) =>
                  setMetaForm({ ...metaForm, valor: evento.target.value })
                }
                required
              />
            </label>
            <button className="primary-button">Salvar meta</button>
            <p className="muted">
              Supermeta e Megameta são calculadas automaticamente em 120% e
              130%.
            </p>
          </form>

          <div className="panel">
            <p className="eyebrow">Mês selecionado</p>
            <h2>Metas cadastradas</h2>
            <div className="history-list">
              {lojas
                .flatMap((loja) =>
                  periodos.map((periodo) => ({
                    loja,
                    periodo,
                    valor: metaDaLoja(loja.id, periodo),
                  }))
                )
                .map((item) => (
                  <div
                    className="history-item"
                    key={`${item.loja.id}-${item.periodo}`}
                  >
                    <div>
                      <strong>
                        {item.loja.codigo} ·{" "}
                        {item.periodo === "manha" ? "Manhã" : "Noite"}
                      </strong>
                      <span>{item.valor ? "Configurada" : "Pendente"}</span>
                    </div>
                    <b>{dinheiro.format(item.valor)}</b>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {modalAberto && (
        <div
          className="modal-backdrop"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setModalAberto(false);
          }}
        >
          <section
            className="sale-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-venda"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Lançamento diário</p>
                <h2 id="titulo-modal-venda">{dataModal}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalAberto(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form
              className="form-stack modal-form"
              onSubmit={(evento) => salvarVenda(evento, "proximo")}
            >
              <label>
                Loja
                <select
                  value={lancamento.loja_id}
                  onChange={(evento) =>
                    mudarSlot("loja_id", evento.target.value)
                  }
                >
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.codigo} — {loja.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Período
                <select
                  value={lancamento.periodo}
                  onChange={(evento) =>
                    mudarSlot("periodo", evento.target.value)
                  }
                >
                  <option value="manha">Manhã</option>
                  <option value="noite">Noite</option>
                </select>
              </label>

              <div className="slot-status">
                <span
                  className={`status-pill ${
                    slotAtual ? "filled" : "unfilled"
                  }`}
                >
                  {slotAtual ? "Já preenchido — pode editar" : "Pendente"}
                </span>
              </div>

              <label>
                Valor vendido
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={lancamento.valor}
                  onChange={(evento) =>
                    setLancamento({
                      ...lancamento,
                      valor: evento.target.value,
                    })
                  }
                  autoFocus
                  required
                />
              </label>

              <button
                type="button"
                className="zero-button"
                onClick={() =>
                  setLancamento({
                    ...lancamento,
                    valor: "0,00",
                    observacao: "Caixa não aberto",
                  })
                }
              >
                Marcar caixa não aberto
              </button>

              <label>
                Observação
                <textarea
                  rows="3"
                  value={lancamento.observacao}
                  onChange={(evento) =>
                    setLancamento({
                      ...lancamento,
                      observacao: evento.target.value,
                    })
                  }
                  placeholder="Opcional"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={salvando}
                  onClick={(evento) => salvarVenda(evento, "fechar")}
                >
                  Salvar e fechar
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Salvar e próximo"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
