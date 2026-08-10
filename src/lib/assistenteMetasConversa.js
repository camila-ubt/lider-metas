import {
  responderPerguntaMetas as responderAnterior,
  sugestoesPerguntas,
} from "@/lib/assistenteMetasChat";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ehPerguntaSobreTurnoResponsavel(pergunta) {
  const q = normalizar(pergunta);
  return (
    /qual (periodo|turno).*(culpa|respons|pesou|puxou|contribuiu|queda|caiu)/.test(q) ||
    /(manha|noite).*(culpa|respons|pesou|puxou|contribuiu|caiu mais)/.test(q) ||
    /(culpa|respons|pesou|puxou|contribuiu).*(periodo|turno|manha|noite)/.test(q) ||
    /onde.*(caiu mais|teve mais queda)/.test(q)
  );
}

function aliasesLoja(loja) {
  const codigo = normalizar(loja.codigo);
  const nome = normalizar(loja.nome);
  const ignorar = new Set(["loja", "acessorios", "acessorio", "bijoux", "biju", "bijuterias"]);
  return [...new Set([
    codigo,
    nome,
    ...nome.split(" ").filter((item) => item.length >= 3 && !ignorar.has(item)),
  ].filter(Boolean))];
}

function encontrarLoja(lojas, pergunta, historico = []) {
  const textos = [pergunta, ...[...historico].reverse().map((item) => item.conteudo)].filter(Boolean);
  for (const texto of textos) {
    const q = normalizar(texto);
    const tokens = new Set(q.split(" "));
    const encontrada = lojas.find((loja) =>
      aliasesLoja(loja).some((alias) =>
        alias.includes(" ") ? q.includes(alias) : tokens.has(alias)
      )
    );
    if (encontrada) return encontrada;
  }
  return null;
}

function brParaIso(dataBr) {
  const [dia, mes, ano] = String(dataBr).split("/");
  if (!dia || !mes || !ano) return null;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function extrairComparacaoDoHistorico(historico = []) {
  const mensagens = [...historico].reverse().map((item) => String(item.conteudo || ""));
  const padrao = /comparando\s+(\d{1,2}\/\d{1,2}\/20\d{2})\s+a\s+(\d{1,2}\/\d{1,2}\/20\d{2})\s+com\s+(\d{1,2}\/\d{1,2}\/20\d{2})\s+a\s+(\d{1,2}\/\d{1,2}\/20\d{2})/i;

  for (const texto of mensagens) {
    const achou = texto.match(padrao);
    if (!achou) continue;
    return {
      atual: { inicio: brParaIso(achou[1]), fim: brParaIso(achou[2]) },
      anterior: { inicio: brParaIso(achou[3]), fim: brParaIso(achou[4]) },
    };
  }
  return null;
}

function intervaloPadrao(mes, vendas, historico = []) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const mm = String(numeroMes).padStart(2, "0");
  const hoje = new Date();
  let diaFinal;

  if (hoje.getFullYear() === ano && hoje.getMonth() + 1 === numeroMes) {
    diaFinal = hoje.getDate();
  } else {
    const datas = vendas
      .map((item) => item.data)
      .filter((data) => String(data || "").startsWith(`${mes}-`))
      .sort();
    diaFinal = Number((datas.at(-1) || `${mes}-01`).slice(8, 10));
  }

  const contexto = historico.map((item) => String(item.conteudo || "")).join(" ");
  const anos = [...new Set((contexto.match(/\b20\d{2}\b/g) || []).map(Number))];
  const anoAnterior = [...anos].reverse().find((item) => item !== ano) || ano - 1;
  const dd = String(Math.max(1, diaFinal || 1)).padStart(2, "0");

  return {
    atual: { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${dd}` },
    anterior: { inicio: `${anoAnterior}-${mm}-01`, fim: `${anoAnterior}-${mm}-${dd}` },
  };
}

function formatarData(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function somar(lista) {
  return lista.reduce((total, item) => total + Number(item.valor_vendido || 0), 0);
}

function dadosTurno({ turno, loja, intervalo, vendas }) {
  const filtrar = (faixa) => vendas.filter((item) => {
    if (item.data < faixa.inicio || item.data > faixa.fim) return false;
    if (Number(item.loja_id) !== Number(loja.id)) return false;
    if (item.periodo !== turno) return false;
    return true;
  });

  const atual = somar(filtrar(intervalo.atual));
  const anterior = somar(filtrar(intervalo.anterior));
  const diferenca = atual - anterior;
  const variacao = anterior > 0 ? (diferenca / anterior) * 100 : null;
  const queda = Math.max(anterior - atual, 0);
  return { turno, atual, anterior, diferenca, variacao, queda };
}

function textoVariacao(item) {
  if (item.diferenca < 0) {
    const pct = item.variacao === null ? "" : ` (${percentual.format(Math.abs(item.variacao))}%)`;
    return `caiu ${moeda.format(Math.abs(item.diferenca))}${pct}`;
  }
  if (item.diferenca > 0) {
    const pct = item.variacao === null ? "" : ` (${percentual.format(item.variacao)}%)`;
    return `cresceu ${moeda.format(item.diferenca)}${pct}`;
  }
  return "ficou estável";
}

function respostaTurnoResponsavel({ pergunta, mes, vendas = [], lojas = [], historico = [] }) {
  if (!ehPerguntaSobreTurnoResponsavel(pergunta)) return null;

  const loja = encontrarLoja(lojas, pergunta, historico);
  if (!loja) return "Eu entendi que você quer saber qual turno puxou mais a queda, mas não consegui identificar a loja no contexto.";

  const intervalo = extrairComparacaoDoHistorico(historico) || intervaloPadrao(mes, vendas, historico);
  const resultados = ["manha", "noite"].map((turno) =>
    dadosTurno({ turno, loja, intervalo, vendas })
  );

  const ordenados = [...resultados].sort((a, b) => b.queda - a.queda);
  const principal = ordenados[0];
  const outro = ordenados[1];
  const totalQuedas = resultados.reduce((total, item) => total + item.queda, 0);

  const periodoTexto = `${formatarData(intervalo.atual.inicio)} a ${formatarData(intervalo.atual.fim)} vs. ${formatarData(intervalo.anterior.inicio)} a ${formatarData(intervalo.anterior.fim)}`;

  if (!(principal.queda > 0)) {
    return `Nesse recorte da ${loja.codigo} (${periodoTexto}), nenhum dos dois turnos caiu. Manhã ${textoVariacao(resultados[0])} e noite ${textoVariacao(resultados[1])}.`;
  }

  const nomePrincipal = principal.turno === "manha" ? "manhã" : "noite";
  const nomeOutro = outro.turno === "manha" ? "manhã" : "noite";
  let resposta = `O turno da ${nomePrincipal} teve mais peso na queda da ${loja.codigo}. Comparando ${periodoTexto}, a ${nomePrincipal} passou de ${moeda.format(principal.anterior)} para ${moeda.format(principal.atual)} e ${textoVariacao(principal)}.`;

  if (totalQuedas > 0 && outro.queda > 0) {
    const participacao = (principal.queda / totalQuedas) * 100;
    resposta += ` Entre as quedas dos dois turnos, isso representa cerca de ${percentual.format(participacao)}%.`;
  }

  resposta += ` Já a ${nomeOutro} passou de ${moeda.format(outro.anterior)} para ${moeda.format(outro.atual)} e ${textoVariacao(outro)}.`;
  return resposta;
}

export function responderPerguntaMetas(parametros) {
  const resposta = respostaTurnoResponsavel(parametros);
  if (resposta) return resposta;
  return responderAnterior(parametros);
}

export { sugestoesPerguntas };
