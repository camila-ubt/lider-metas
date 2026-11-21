const PERIODOS = ["manha", "noite"];
const chaveSlot = (loja, periodo) => String(loja) + "|" + periodo;

// Dias ainda em andamento não são exigidos; zero explícito é válido.
// O resultado é somente diagnóstico: não altera nem preenche lançamentos.
export function verificarQualidadeLancamentos({
  vendas = [], metas = [], lojas = [], ano, numeroMes,
  diaConcluido, filtroLoja = "geral", filtroPeriodo = "todos",
}) {
  const vazio = { status: "parametros_invalidos", faltantes: 0,
    duplicados: 0, invalidos: 0, metasAusentes: 0,
    metasDuplicadas: 0, metasInvalidas: 0, exemplos: [] };
  if (!Number.isInteger(ano) || !Number.isInteger(numeroMes) ||
      numeroMes < 1 || numeroMes > 12 ||
      !Number.isInteger(diaConcluido) ||
      !(filtroPeriodo === "todos" || PERIODOS.includes(filtroPeriodo))) return vazio;
  const ultimo = new Date(ano, numeroMes, 0).getDate();
  const limite = Math.max(0, Math.min(ultimo, diaConcluido));
  const mes = String(ano) + "-" + String(numeroMes).padStart(2, "0");
  const escolhidas = lojas.filter((loja) => filtroLoja === "geral" ||
    String(loja.id) === String(filtroLoja));
  const turnos = filtroPeriodo === "todos" ? PERIODOS : [filtroPeriodo];
  const slots = escolhidas.flatMap((loja) =>
    turnos.map((turno) => chaveSlot(loja.id, turno)));
  if (!slots.length) return vazio;
  const esperados = new Set(slots);
  const contagemMetas = new Map();
  let metasInvalidas = 0;
  for (const meta of metas) {
    const chave = chaveSlot(meta.loja_id, meta.periodo);
    if (!esperados.has(chave)) continue;
    contagemMetas.set(chave, (contagemMetas.get(chave) || 0) + 1);
    if (meta.valor_meta == null || !Number.isFinite(Number(meta.valor_meta)) ||
        Number(meta.valor_meta) <= 0) metasInvalidas += 1;
  }
  const metasAusentes = slots.filter((item) => !contagemMetas.has(item)).length;
  const metasDuplicadas = [...contagemMetas.values()]
    .filter((quantidade) => quantidade > 1).length;

  const contagemVendas = new Map();
  let invalidos = 0;
  for (const venda of vendas) {
    const data = String(venda.data || "");
    const chave = chaveSlot(venda.loja_id, venda.periodo);
    if (!esperados.has(chave) || !data.startsWith(mes + "-")) continue;
    const dia = Number(data.slice(8, 10));
    if (!Number.isInteger(dia) || dia < 1 || dia > ultimo ||
        data !== mes + "-" + String(dia).padStart(2, "0") ||
        venda.valor_vendido == null ||
        !Number.isFinite(Number(venda.valor_vendido)) ||
        Number(venda.valor_vendido) < 0) {
      invalidos += 1;
      continue;
    }
    if (dia > limite) continue;
    const id = data + "|" + chave;
    contagemVendas.set(id, (contagemVendas.get(id) || 0) + 1);
  }

  let faltantes = 0;
  let duplicados = 0;
  const exemplos = [];
  for (let dia = 1; dia <= limite; dia += 1) {
    const data = mes + "-" + String(dia).padStart(2, "0");
    for (const chave of slots) {
      const id = data + "|" + chave;
      const quantidade = contagemVendas.get(id) || 0;
      if (quantidade === 0) {
        faltantes += 1;
        if (exemplos.length < 3) exemplos.push(data + " · " + chave.replace("|", " / "));
      } else if (quantidade > 1) {
        duplicados += 1;
        if (exemplos.length < 3) exemplos.push("Duplicado: " + data + " · " + chave.replace("|", " / "));
      }
    }
  }
  return {
    status: faltantes || duplicados || invalidos ||
      metasAusentes || metasDuplicadas || metasInvalidas ? "inconsistente" : "ok",
    faltantes, duplicados, invalidos,
    metasAusentes, metasDuplicadas, metasInvalidas,
    exemplos, diaConcluido: limite,
  };
}
