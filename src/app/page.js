"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
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
  const [lancamento, setLancamento] = useState({
    data: hojeLocal(),
    loja_id: "",
    periodo: "manha",
    valor: "",
    observacao: "",
  });
  const [metaForm, setMetaForm] = useState({ loja_id: "", periodo: "manha", valor: "" });

  useEffect(() => {
    async function iniciar() {
      const { data } = await supabase.auth.getSession();
      setSessao(data.session);
      if (data.session) await carregarPerfil(data.session.user.id);
      setCarregando(false);
    }

    iniciar();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evento, novaSessao) => {
      setSessao(novaSessao);
      if (novaSessao) await carregarPerfil(novaSessao.user.id);
      else setPerfil(null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (perfil?.ativo) carregarDados();
  }, [perfil, mes]);

  async function carregarPerfil(id) {
    const { data, error } = await supabase.from("perfis").select("*").eq("id", id).single();
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
    setLancamento((atual) => ({ ...atual, loja_id: atual.loja_id || lojasResp.data?.[0]?.id || "" }));
    setMetaForm((atual) => ({ ...atual, loja_id: atual.loja_id || lojasResp.data?.[0]?.id || "" }));
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
      setMensagem(error ? error.message : "Cadastro criado. Confirme o e-mail e aguarde a aprovação.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.senha });
    if (error) setMensagem("E-mail ou senha incorretos.");
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  async function salvarVenda(evento) {
    evento.preventDefault();
    setMensagem("");
    const valor = Number(lancamento.valor.replace(".", "").replace(",", "."));

    if (!valor || valor < 0) {
      setMensagem("Informe um valor de venda válido.");
      return;
    }

    const { error } = await supabase.from("vendas_diarias").upsert(
      {
        data: lancamento.data,
        loja_id: Number(lancamento.loja_id),
        periodo: lancamento.periodo,
        valor_vendido: valor,
        observacao: lancamento.observacao || null,
        atualizado_por: sessao.user.id,
      },
      { onConflict: "data,loja_id,periodo" }
    );

    if (error) setMensagem(error.message);
    else {
      setMensagem("Venda salva com sucesso.");
      setLancamento((atual) => ({ ...atual, valor: "", observacao: "" }));
      carregarDados();
    }
  }

  async function salvarMeta(evento) {
    evento.preventDefault();
    const valor = Number(metaForm.valor.replace(".", "").replace(",", "."));

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
    const totalVendido = vendas.reduce((soma, item) => soma + Number(item.valor_vendido), 0);
    const meta = metas.reduce((soma, item) => soma + Number(item.valor_meta), 0);
    const supermeta = meta * 1.2;
    const megameta = meta * 1.3;
    const [ano, numeroMes] = mes.split("-").map(Number);
    const diasNoMes = new Date(ano, numeroMes, 0).getDate();
    const hoje = new Date();
    const diasPassados = ano === hoje.getFullYear() && numeroMes === hoje.getMonth() + 1 ? hoje.getDate() : diasNoMes;
    const media = diasPassados ? totalVendido / diasPassados : 0;
    const projecao = media * diasNoMes;

    return { totalVendido, meta, supermeta, megameta, media, projecao };
  }, [vendas, metas, mes]);

  function vendidoDaLoja(lojaId, periodo) {
    return vendas
      .filter((item) => item.loja_id === lojaId && (!periodo || item.periodo === periodo))
      .reduce((soma, item) => soma + Number(item.valor_vendido), 0);
  }

  function metaDaLoja(lojaId, periodo) {
    return metas
      .filter((item) => item.loja_id === lojaId && (!periodo || item.periodo === periodo))
      .reduce((soma, item) => soma + Number(item.valor_meta), 0);
  }

  if (carregando && !sessao) return <div className="central">Carregando...</div>;

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
              <label>Nome<input value={login.nome} onChange={(e) => setLogin({ ...login, nome: e.target.value })} required /></label>
            )}
            <label>E-mail<input type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required /></label>
            <label>Senha<input type="password" minLength={6} value={login.senha} onChange={(e) => setLogin({ ...login, senha: e.target.value })} required /></label>
            <button className="primary-button">{modoCadastro ? "Criar acesso" : "Entrar"}</button>
          </form>

          {mensagem && <p className="message">{mensagem}</p>}
          <button className="text-button" onClick={() => setModoCadastro(!modoCadastro)}>
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
          <p className="muted">Seu cadastro foi criado, mas ainda precisa ser liberado pela administradora.</p>
          <button className="primary-button" onClick={sair}>Sair</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Gestão de desempenho</p><h1>Líder Metas</h1></div>
        <div className="top-actions">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <button className="secondary-button" onClick={sair}>Sair</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tela === "painel" ? "active" : ""} onClick={() => setTela("painel")}>Painel</button>
        <button className={tela === "lancamentos" ? "active" : ""} onClick={() => setTela("lancamentos")}>Lançar vendas</button>
        {perfil.papel === "admin" && <button className={tela === "metas" ? "active" : ""} onClick={() => setTela("metas")}>Metas</button>}
      </nav>

      {mensagem && <p className="message app-message">{mensagem}</p>}

      {tela === "painel" && (
        <section>
          <div className="kpi-grid">
            <article className="kpi"><span>Total vendido</span><strong>{dinheiro.format(resumo.totalVendido)}</strong></article>
            <article className="kpi"><span>Meta</span><strong>{dinheiro.format(resumo.meta)}</strong><small>{resumo.meta ? `${Math.round((resumo.totalVendido / resumo.meta) * 100)}% atingido` : "Meta não cadastrada"}</small></article>
            <article className="kpi"><span>Média diária</span><strong>{dinheiro.format(resumo.media)}</strong></article>
            <article className="kpi"><span>Projeção</span><strong>{dinheiro.format(resumo.projecao)}</strong><small>{resumo.projecao >= resumo.meta && resumo.meta ? "Ritmo suficiente para a meta" : "Abaixo do ritmo da meta"}</small></article>
          </div>

          <div className="levels-card">
            {[{ nome: "Meta", valor: resumo.meta }, { nome: "Supermeta", valor: resumo.supermeta }, { nome: "Megameta", valor: resumo.megameta }].map((nivel) => {
              const porcentagem = nivel.valor ? Math.min((resumo.totalVendido / nivel.valor) * 100, 100) : 0;
              return <div className="level" key={nivel.nome}><div><strong>{nivel.nome}</strong><span>{dinheiro.format(nivel.valor)}</span></div><div className="progress"><div style={{ width: `${porcentagem}%` }} /></div><small>{Math.round(porcentagem)}%</small></div>;
            })}
          </div>

          <div className="store-grid">
            {lojas.map((loja) => {
              const vendido = vendidoDaLoja(loja.id);
              const meta = metaDaLoja(loja.id);
              return (
                <article className="store-card" key={loja.id}>
                  <div className="store-title"><div><span>{loja.codigo}</span><h2>{loja.nome}</h2></div><strong>{meta ? Math.round((vendido / meta) * 100) : 0}%</strong></div>
                  <p className="store-total">{dinheiro.format(vendido)}</p>
                  <p className="muted">Meta: {dinheiro.format(meta)}</p>
                  <div className="period-row"><span>Manhã <b>{dinheiro.format(vendidoDaLoja(loja.id, "manha"))}</b></span><span>Noite <b>{dinheiro.format(vendidoDaLoja(loja.id, "noite"))}</b></span></div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tela === "lancamentos" && (
        <section className="content-grid">
          <form className="panel form-stack" onSubmit={salvarVenda}>
            <div><p className="eyebrow">Novo lançamento</p><h2>Venda da loja</h2></div>
            <label>Data<input type="date" value={lancamento.data} onChange={(e) => setLancamento({ ...lancamento, data: e.target.value })} required /></label>
            <label>Loja<select value={lancamento.loja_id} onChange={(e) => setLancamento({ ...lancamento, loja_id: e.target.value })}>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.codigo} — {loja.nome}</option>)}</select></label>
            <label>Período<select value={lancamento.periodo} onChange={(e) => setLancamento({ ...lancamento, periodo: e.target.value })}><option value="manha">Manhã</option><option value="noite">Noite</option></select></label>
            <label>Valor vendido<input inputMode="decimal" placeholder="0,00" value={lancamento.valor} onChange={(e) => setLancamento({ ...lancamento, valor: e.target.value })} required /></label>
            <label>Observação<textarea rows="3" value={lancamento.observacao} onChange={(e) => setLancamento({ ...lancamento, observacao: e.target.value })} /></label>
            <button className="primary-button">Salvar venda</button>
          </form>

          <div className="panel">
            <p className="eyebrow">Histórico do mês</p><h2>Últimos lançamentos</h2>
            <div className="history-list">
              {vendas.slice(0, 20).map((item) => {
                const loja = lojas.find((lojaItem) => lojaItem.id === item.loja_id);
                return <div className="history-item" key={item.id}><div><strong>{loja?.codigo} · {item.periodo === "manha" ? "Manhã" : "Noite"}</strong><span>{new Date(`${item.data}T12:00:00`).toLocaleDateString("pt-BR")}</span></div><b>{dinheiro.format(item.valor_vendido)}</b></div>;
              })}
            </div>
          </div>
        </section>
      )}

      {tela === "metas" && perfil.papel === "admin" && (
        <section className="content-grid">
          <form className="panel form-stack" onSubmit={salvarMeta}>
            <div><p className="eyebrow">Configuração mensal</p><h2>Cadastrar meta</h2></div>
            <label>Loja<select value={metaForm.loja_id} onChange={(e) => setMetaForm({ ...metaForm, loja_id: e.target.value })}>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.codigo} — {loja.nome}</option>)}</select></label>
            <label>Período<select value={metaForm.periodo} onChange={(e) => setMetaForm({ ...metaForm, periodo: e.target.value })}><option value="manha">Manhã</option><option value="noite">Noite</option></select></label>
            <label>Valor da meta<input inputMode="decimal" placeholder="0,00" value={metaForm.valor} onChange={(e) => setMetaForm({ ...metaForm, valor: e.target.value })} required /></label>
            <button className="primary-button">Salvar meta</button>
            <p className="muted">Supermeta e Megameta são calculadas automaticamente em 120% e 130%.</p>
          </form>

          <div className="panel">
            <p className="eyebrow">Mês selecionado</p><h2>Metas cadastradas</h2>
            <div className="history-list">
              {lojas.flatMap((loja) => ["manha", "noite"].map((periodo) => ({ loja, periodo, valor: metaDaLoja(loja.id, periodo) }))).map((item) => <div className="history-item" key={`${item.loja.id}-${item.periodo}`}><div><strong>{item.loja.codigo} · {item.periodo === "manha" ? "Manhã" : "Noite"}</strong><span>{item.valor ? "Configurada" : "Pendente"}</span></div><b>{dinheiro.format(item.valor)}</b></div>)}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
