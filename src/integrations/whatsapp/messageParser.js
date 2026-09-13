export const normalize = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
const rules = [
  [
    /mercado|almoco|jantar|alimentacao|comida|restaurante|lanche/,
    'Alimentação',
  ],
  [/gasolina|etanol|combustivel|uber|onibus|transporte/, 'Transporte'],
  [/salario|pagamento/, 'Salário'],
  [/aluguel|condominio|moradia/, 'Moradia'],
  [/farmacia|medico|consulta|saude/, 'Saúde'],
  [/luz|energia|internet|telefone|agua|contas/, 'Contas'],
  [/venda|cliente/, 'Vendas'],
  [/lazer|cinema|passeio/, 'Lazer'],
]
export const categoryFor = (text) =>
  rules.find(([pattern]) => pattern.test(normalize(text)))?.[1] || 'Outros'
const clarify = (message) => ({ intent: 'clarify', message })
export function parseMessage(message, context = null) {
  if (typeof message !== 'string' || message.length > 1000)
    return { intent: 'unknown' }
  const text = normalize(message)
  if (/^vincular\s+[a-z2-7]{12}$/i.test(text))
    return { intent: 'link', code: text.split(/\s+/)[1].toUpperCase() }
  if (/^(cancelar|cancela|pare)$/.test(text)) return { intent: 'cancel' }
  if (
    /\b(apague|exclua|delete|remova|ignore|usuario|user_id|sql|instrucoes)\b/.test(
      text,
    )
  )
    return { intent: 'unknown' }
  if (/\b(passado|anterior|semana|ontem|amanha)\b/.test(text))
    return clarify(
      'Por aqui, consulte o mês atual e registre lançamentos de hoje. Para outros períodos, use os relatórios do app.',
    )
  if (/vida financeira|resumo financeiro/.test(text))
    return { intent: 'financial_summary' }
  if (/quanto falta para (minha|meu|a|o)/.test(text))
    return {
      intent: 'goal_status',
      query: text
        .replace(/^.*quanto falta para\s+(minha|meu|a|o)\s+/, '')
        .replace(/[?!]/g, '')
        .trim(),
    }
  if (/maior gasto/.test(text)) return { intent: 'largest_expense' }
  if (/saldo|quanto.*tenho/.test(text)) return { intent: 'balance' }
  if (/finanscore|finans?core|pontuacao|score/.test(text))
    return { intent: 'score' }
  if (/ultim[oa]s?.*(transac|gasto|lancamento)/.test(text))
    return { intent: 'last_transactions', expensesOnly: /gasto/.test(text) }
  if (/meta/.test(text))
    return {
      intent: 'goal_status',
      query: text
        .replace(/^.*metas?\s*(da|do|de)?\s*/, '')
        .replace(/[?!]/g, '')
        .trim(),
    }
  if (/quanto.*(recebi|entrou|entrada)|entradas.*mes/.test(text))
    return { intent: 'monthly_income' }
  if (/quanto.*gast|gastos.*mes/.test(text)) {
    const category = categoryFor(text)
    return category === 'Outros'
      ? { intent: 'monthly_expenses' }
      : { intent: 'category_expenses', category }
  }
  const income = /^(recebi|ganhei|entrou)\b/.test(text)
  const expense = /^(gastei|paguei|comprei|adiciona|adicione)\b/.test(text)
  const inherited =
    !income && !expense && context?.intent?.startsWith('create_')
  if (!income && !expense && !inherited) return { intent: 'unknown' }
  if (/\b(ontem|amanha|dia|parcelas|vezes)\b/.test(text))
    return clarify(
      'Informe uma única transação, com valor e descrição, para hoje.',
    )
  const numbers = text.match(/-?\d[\d.,]*/g) || []
  if (numbers.length > 1)
    return clarify('Envie uma única transação por mensagem.')
  let amount = inherited ? context.amount : undefined
  if (numbers.length) {
    const raw = numbers[0].replace(/[.,]$/, '')
    if (
      !/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw) &&
      !/^-?\d+\.\d{1,2}$/.test(raw)
    )
      return clarify('Informe um valor como 50,50 ou 1.500,00.')
    amount = Number(
      raw.includes(',') || /^-?\d{1,3}(?:\.\d{3})+$/.test(raw)
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw,
    )
    if (!(amount > 0) || amount > 999999999)
      return clarify('Informe um valor positivo em reais.')
  }
  let title = message
    .replace(
      /^(gastei|paguei|comprei|adiciona|adicione|recebi|ganhei|entrou)\s*/i,
      '',
    )
    .replace(/R\$\s*/gi, '')
  if (numbers[0]) title = title.replace(numbers[0], '')
  title = title
    .replace(/^\s*(reais)?\s*(no|na|de|em|do|da)?\s*/i, '')
    .replace(/[.!?]+$/, '')
    .trim()
  if (!title && inherited) title = context.title || ''
  title = title ? title[0].toUpperCase() + title.slice(1) : ''
  const intent = inherited
    ? context.intent
    : income
      ? 'create_income'
      : 'create_expense'
  const category = categoryFor(title)
  if (!amount || !title)
    return {
      intent: 'clarify',
      message: !amount
        ? 'Qual foi o valor em reais?'
        : 'Qual é a descrição desse lançamento?',
      context: { intent, amount, title, category },
    }
  return { intent, amount, category, title }
}
