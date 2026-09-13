import { PageHeading, ScoreCard, InsightCard } from '../../components/UI.jsx'
export default function IntelligencePage({ analysis }) {
  return (
    <>
      <PageHeading
        eyebrow="CLAREZA PARA DECIDIR"
        title="Inteligência financeira"
        description="Uma análise dos seus registros, do seu perfil e dos seus objetivos."
      />
      <div className="dashboard-columns">
        <div className="card">
          <h2>Seu momento, em detalhes</h2>
          {analysis.insights.map((i) => (
            <InsightCard insight={i} key={i.key} />
          ))}
        </div>
        <div className="stack">
          <ScoreCard score={analysis.score} />
          <article className="card">
            <span className="badge">Transparente por natureza</span>
            <h3>Como seus insights nascem</h3>
            <p>
              Analisamos seus registros com regras e comparações estatísticas.
              Nenhuma API de inteligência artificial é utilizada.
            </p>
            <p>
              As projeções dependem dos dados informados e não garantem
              resultados. Meses incompletos podem distorcer comparações.
            </p>
          </article>
        </div>
      </div>
    </>
  )
}
