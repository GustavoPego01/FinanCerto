import { BookOpen } from 'lucide-react'
import { PageHeading } from '../../components/UI.jsx'
const lessons = [
  {
    id: 'organizar',
    title: 'Organização começa com clareza',
    tag: 'Organização',
    text: 'Registre entradas e gastos durante um mês. Separe o que é essencial, o que pode mudar e o que pode esperar. Revise uma vez por semana para evitar surpresas.',
  },
  {
    id: 'reserva',
    title: 'Uma reserva para respirar',
    tag: 'Reserva',
    text: 'Dimensione sua reserva pelos gastos essenciais e pela estabilidade da renda. Construa aos poucos e priorize liquidez e baixo risco. Ela existe para imprevistos, não para despesas previsíveis.',
  },
  {
    id: 'dividas',
    title: 'Um plano para sair das dívidas',
    tag: 'Dívidas',
    text: 'Anote saldos, taxas e vencimentos. Compare o custo efetivo total e negocie parcelas que caibam no orçamento. Em geral, reduzir as dívidas de maior custo diminui a pressão financeira.',
  },
  {
    id: 'orcamento',
    title: 'Seu orçamento precisa caber na sua vida',
    tag: 'Orçamento',
    text: 'Comece pelas despesas essenciais. Defina limites realistas para despesas variáveis e um valor possível para metas. Revise o plano quando sua renda ou suas necessidades mudarem.',
  },
  {
    id: 'juros',
    title: 'O tempo e os juros compostos',
    tag: 'Juros',
    text: 'Nos juros compostos, os juros passam a integrar a base de cálculo. Isso afeta tanto uma dívida quanto uma aplicação. Observe taxa, prazo, impostos, inflação e custos antes de comparar alternativas.',
  },
  {
    id: 'investir',
    title: 'Entenda antes de investir',
    tag: 'Investimentos',
    text: 'Cada aplicação tem riscos, prazo e regras de resgate. Conheça esses fatores antes de investir e alinhe as escolhas aos seus objetivos. Rentabilidade passada não garante retorno futuro.',
  },
  {
    id: 'diversificar',
    title: 'Diversificar é distribuir riscos',
    tag: 'Diversificação',
    text: 'Concentrar recursos em uma única exposição pode aumentar vulnerabilidades. Distribuir riscos pode ajudar, mas não elimina perdas. Considere também liquidez, custos e correlação entre exposições.',
  },
]
export default function EducationPage({ profile }) {
  const priority = profile.has_debts
    ? 'dividas'
    : !profile.has_reserve
      ? 'reserva'
      : 'investir'
  const ordered = [...lessons].sort(
    (a, b) => Number(b.id === priority) - Number(a.id === priority),
  )
  return (
    <>
      <PageHeading
        eyebrow="CONHECIMENTO QUE ACOMPANHA VOCÊ"
        title="Aprender para conquistar"
        description={`Conteúdos para seu momento · Perfil ${profile.risk_profile || 'não informado'} · Experiência ${profile.investment_experience || 'iniciante'}`}
      />
      <div className="education-grid">
        {ordered.map((l, i) => (
          <article className="card lesson" key={l.id}>
            <div className="lesson-icon">
              <BookOpen size={24} />
            </div>
            <span className="badge">
              {i === 0 ? 'Sugerido para você' : l.tag}
            </span>
            <h2>{l.title}</h2>
            <p>{l.text}</p>
            <small>Leitura rápida · Educação financeira</small>
          </article>
        ))}
      </div>
      <p className="muted section-space">
        Conteúdo educativo geral. O perfil é autodeclarado e não substitui uma
        avaliação individual de adequação.
      </p>
    </>
  )
}
