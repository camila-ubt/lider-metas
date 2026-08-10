import {
  responderPerguntaMetas as responderChat,
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

function ehPerguntaDeResponsabilidade(pergunta) {
  const q = normalizar(pergunta);
  return /(?:qual|que)\s+(?:periodo|turno).*(?:culpa|respons|pux|caus|pesou)|(?:culpa|respons|pux|caus|pesou).*(?:periodo|turno)|(?:manha|noite).*(?:culpa|respons|queda)/.test(q);
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

function lojaDoContexto(lojas, historico = []) {
  const mensagens = [...historico].reverse();
  for (const mensagem of mensagens) {
    const texto = normalizar(mensagem.conteudo);
    const tokens = new Set(texto.split(" "));
    const encontrada = lojas.find((loja) =>
      aliasesLoja(loja).some((alias) =>
        alias.includes(" ") ? texto.includes(alias) : tokens.has(alias)
      )
    );
    if (encontrada) return encontrada;
  }
  return null;
}

function anosDoContexto(historico = [], pergunta = "") {
  const texto = [
    ...historico.map((item) => item.conteudo),
    pergunta,
  ].join(" ");
  return [...new Set((normalizar(texto).match(/\b20\d{2}\b/g) || []).map(Number))];
}

function diaExplicito(texto) {
  const q = normalizar(texto);
  const padroes = [
    /ate (?:o )?dia\s+(\d{1,2})\b/,
    /comparando ate (?:o )?dia\s+(\d{1,2})\b/,
    /do dia\s+\d{1,2}\s+(?:ao|ate)\s+(\d{1,2})\b/,
  ];
  for (const padrao of padroes) {
    const achou = q.match(padrao);
    if (achou) return Number(achou[1]);
  }
  return null;
}

function diaFinalDoContexto({ historico = [], mes, vendas }) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();

  for (const mensagem of [...historico].reverse()) {
    if (mensagem.papel !== "usuario") continue;
    const dia = diaExplicito(mensagem.conteudo);
    if (Number.isFinite(dia)) return Math.max(1, Math.min(dia, ultimoDia));
  }

  const hoje = new Date();
  if (hoje.getFullYear() === ano && hoje.getMonth() + 1 === numeroMes) {
    return Math.min(hoje.getDate(), ultimoDia);
  }

  const datas = vendas
    .map((item) => item.data)
    .filter((data) => String(data || "").startsWith(`${mes}-`))
    .sort();
  const ultima = datas.at(-1);
  return ultima ? Number(ultima.slice(8, 10)) : ultimoDia;
}

function somar(lista) {
  return lista.reduce((total, item) => total + Number(item.valor_vendido || 0), 0);
}

function formatarData(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function responderResponsabilidade({ pergunta, mes, vendas = [], lojas = [], historico = [] }) {
  if (!ehPerguntaDeResponsabilidade(pergunta)) return null;

  const loja = lojaDoContexto(lojas, historico);
  if (!loja) return null;

  const [anoAtual, numeroMes] = mes.split("-").map(Number);
  const anos = anosDoContexto(historico, pergunta);
  const anoAnterior = [...anos].reverse().find((ano) => ano !== anoAtual) || anoAtual - 1;
  const diaFinal = diaFinalDoContexto({ historico, mes, vendas });
  const mm = String(numeroMes).padStart(2, "0");
  const dd = String(diaFinal).padStart(2, "0");

  const atual = {
    inicio: `${anoAtual}-${mm}-01`,
    fim: `${anoAtual}-${mm}-${dd}`,
  };
  const anterior = {
    inicio: `${anoAnterior}-${mm}-01`,
    fim: `${anoAnterior}-${mm}-${dd}`,
  };

  const resultados = ["manha", "noite"].map((periodo) => {
    const vendasAtual = vendas.filter((item) =>
      Number(item.loja_id) === Number(loja.id) &&
      item.periodo === periodo &&
      item.data >= atual.inicio &&
      item.data <= atual.fim
    );
    const vendasAnterior = vendas.filter((item) =>
      Number(item.loja_id) === Number(loja.id) &&
      item.periodo === periodo &&
      item.data >= anterior.inicio &&
      item.data <= anterior.fim
    );

    const valorAtual = somar(vendasAtual);
    const valorAnterior = somar(vendasAnterior);
    const diferenca = valorAtual - valorAnterior;
    const pct = valorAnterior > 0 ? (diferenca / valorAnterior) * 100 : null;
    return { periodo, valorAtual, valorAnterior, diferenca, pct };
  });

  const maiorResponsavel = [...resultados].sort((a, b) => a.diferenca - b.diferenca)[0];
  const outro = resultados.find((item) => item.periodo !== maiorResponsavel.periodo);
  const nome = maiorResponsavel.periodo === "manha" ? "manhã" : "noite";
  const nomeOutro = outro.periodo === "manha" ? "manhã" : "noite";

  const detalhe = (item, rotulo) => {
    if (item.diferenca < 0) {
      return `${rotulo}: ${moeda.format(item.valorAnterior)} em ${anoAnterior} para ${moeda.format(item.valorAtual)} em ${anoAtual}, queda de ${moeda.format(Math.abs(item.diferenca))}${item.pct !== null ? ` (${percentual.format(Math.abs(item.pct))}%)` : ""}`;
    }
    if (item.diferenca > 0) {
      return `${rotulo}: ${moeda.format(item.valorAnterior)} em ${anoAnterior} para ${moeda.format(item.valorAtual)} em ${anoAtual}, aumento de ${moeda.format(item.diferenca)}${item.pct !== null ? ` (${percentual.format(item.pct)}%)` : ""}`;
    }
    return `${rotulo}: sem variação, ${moeda.format(item.valorAtual)}`;
  };

  const cabecalho = `Na ${loja.codigo}, comparando ${formatarData(atual.inicio)} a ${formatarData(atual.fim)} com ${formatarData(anterior.inicio)} a ${formatarData(anterior.fim)}`;

  if (maiorResponsavel.diferenca < 0) {
    return `${cabecalho}, o turno que mais puxou a queda foi a ${nome}. ${detalhe(maiorResponsavel, nome)}. ${detalhe(outro, nomeOutro)}.`;
  }

  return `${cabecalho}, nenhum dos dois turnos caiu nesse recorte. ${detalhe(maiorResponsavel, nome)}. ${detalhe(outro, nomeOutro)}.`;
}

export function responderPerguntaMetas(parametros) {
  const resposta = responderResponsabilidade(parametros);
  if (resposta) return resposta;
  return responderChat(parametros);
}

export { sugestoesPerguntas };
