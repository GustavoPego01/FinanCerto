import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Perfil from "../Perfil/index.jsx";
import { supabase } from "../../supabase/client";

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const categories = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Compras",
  "Bebidas",
  "Saúde",
  "Lazer",
  "Contas",
  "Vendas",
  "Salário",
  "Outros",
];

/* =========================================================
   FUNÇÕES DE DATA
========================================================= */

function getCurrentMonthKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthKeyFromDate(date) {
  const [day, month, year] = date.split("/");

  if (!day || !month || !year) {
    return getCurrentMonthKey();
  }

  return `${year}-${month.padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function formatMonthTitle(monthKey) {
  const label = formatMonthLabel(monthKey);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function changeMonth(monthKey, amount) {
  const [year, month] = monthKey.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1 + amount,
    1
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function isFutureMonth(monthKey) {
  return monthKey > getCurrentMonthKey();
}

function getToday() {
  const now = new Date();

  const brasilDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return brasilDate;
}

/* =========================================================
   MOEDA
========================================================= */

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatInputValue(value) {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (!numbers) return "";

  return (Number(numbers) / 100)
    .toFixed(2)
    .replace(".", ",");
}

function parseCurrency(value) {
  if (!value) return 0;

  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  return Number(normalized) || 0;
}

/* =========================================================
   TRANSAÇÕES INICIAIS
========================================================= */

const initialTransactions = [
  {
    id: 1,
    type: "income",
    title: "Venda",
    category: "Vendas",
    amount: 50000,
    date: "29/08/2026",
  },
  {
    id: 2,
    type: "expense",
    title: "Compra de bebidas",
    category: "Bebidas",
    amount: 1000,
    date: "29/08/2026",
  },
];

/* =========================================================
   APP
========================================================= */

function App() {
  const [page, setPage] = useState("inicio");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const testarSupabase = async () => {
      // 1. Verifica usuário logado
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      setUser(user);

      if (!user) {
        return;
      }

      // 2. Testa acesso à tabela transactions
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("ERRO TRANSAÇÕES:", error);
        return;
      }

      setTransactions(data || []);
    };

    testarSupabase();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  /*
    O mês selecionado começa sempre no mês REAL atual.
    Quando entrar setembro, por exemplo, automaticamente
    será 2026-09.
  */
  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMonthKey()
  );

  const [transactions, setTransactions] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);

  const [transactionType, setTransactionType] =
    useState("expense");

  const [amount, setAmount] = useState("");

  const [title, setTitle] = useState("");

  const [category, setCategory] = useState("Outros");

  const [message, setMessage] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);

  /* =======================================================
     NOME DO CLIENTE
  ======================================================= */

  const [clientName, setClientName] = useState("Cliente");

  useEffect(() => {
    const carregarNomeUsuario = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error) {
          console.error("ERRO AO PEGAR USUÁRIO:", error);
          return;
        }

        const user = data?.user;

        if (!user) {
          console.log("NENHUM USUÁRIO LOGADO");
          return;
        }

        const nome =
          user.user_metadata?.nome ||
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0];

        if (nome) {
          setClientName(nome);
        }
      } catch (error) {
        console.error("ERRO AO CARREGAR NOME:", error);
      }
    };

    carregarNomeUsuario();
  }, []);

  /* =======================================================
     SALVAR TRANSAÇÕES
  ======================================================= */


  /* =======================================================
     ACOMPANHAR O CALENDÁRIO REAL
  ======================================================= */

  useEffect(() => {
    function verificarNovoMes() {
      const realMonth = getCurrentMonthKey();

      setSelectedMonth((currentMonth) => {
        /*
          Se o usuário estava olhando o mês atual,
          acompanha automaticamente a virada do mês.
        */
        const previousRealMonth = changeMonth(
          realMonth,
          -1
        );

        if (
          currentMonth === previousRealMonth ||
          currentMonth === realMonth
        ) {
          return realMonth;
        }

        return currentMonth;
      });
    }

    verificarNovoMes();

    /*
      Verifica quando a aba volta a ficar ativa.
    */
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verificarNovoMes();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    /*
      Também verifica periodicamente.
      Assim, se o aplicativo ficar aberto durante
      a virada do mês, ele acompanha o calendário.
    */
    const interval = setInterval(
      verificarNovoMes,
      60 * 1000
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      clearInterval(interval);
    };
  }, []);

  /* =======================================================
     TRANSAÇÕES DO MÊS SELECIONADO
  ======================================================= */

  const monthTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      return (
        getMonthKeyFromDate(transaction.date) ===
        selectedMonth
      );
    });
  }, [transactions, selectedMonth]);

  /* =======================================================
     TOTAIS DO MÊS
  ======================================================= */

  const totals = useMemo(() => {
    const income = monthTransactions
      .filter((item) => item.type === "income")
      .reduce(
        (total, item) => total + Number(item.amount),
        0
      );

    const expenses = monthTransactions
      .filter((item) => item.type === "expense")
      .reduce(
        (total, item) => total + Number(item.amount),
        0
      );

    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }, [monthTransactions]);

  /* =======================================================
     HISTÓRICO DE MESES
  ======================================================= */

  const availableMonths = useMemo(() => {
    const months = new Set();

    transactions.forEach((transaction) => {
      months.add(
        getMonthKeyFromDate(transaction.date)
      );
    });

    /*
      O mês atual sempre aparece, mesmo sem lançamentos.
    */
    months.add(getCurrentMonthKey());

    return Array.from(months).sort(
      (a, b) => b.localeCompare(a)
    );
  }, [transactions]);

  /* =======================================================
     NAVEGAÇÃO ENTRE MESES
  ======================================================= */

  function previousMonth() {
    setSelectedMonth((currentMonth) =>
      changeMonth(currentMonth, -1)
    );
  }

  function nextMonth() {
    setSelectedMonth((currentMonth) => {
      const next = changeMonth(currentMonth, 1);

      if (isFutureMonth(next)) {
        return currentMonth;
      }

      return next;
    });
  }

  function goToCurrentMonth() {
    setSelectedMonth(getCurrentMonthKey());
  }

  /* =======================================================
     MODAL
  ======================================================= */

  function openTransactionModal(type) {
    setTransactionType(type);
    setAmount("");
    setTitle("");
    setCategory(
      type === "income" ? "Vendas" : "Outros"
    );
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setAmount("");
    setTitle("");
    setMessage("");
  }

  function handleAmountChange(event) {
    const value = event.target.value;

    setAmount(formatInputValue(value));
  }

  /* =======================================================
     SALVAR TRANSAÇÃO
  ======================================================= */

  async function handleSaveTransaction(event) {
    event.preventDefault();

    const numericAmount = parseCurrency(amount);

    if (!numericAmount || numericAmount <= 0) {
      setMessage("Digite um valor válido.");
      return;
    }

    if (!title.trim()) {
      setMessage("Digite uma descrição.");
      return;
    }

    try {
      // Pega o usuário atualmente logado no Supabase
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("ERRO AO PEGAR USUÁRIO:", authError);
        setMessage("Erro ao identificar usuário.");
        return;
      }

      if (!user) {
        setMessage("Usuário não está logado.");
        return;
      }

      // Cria a transação
      const newTransaction = {
        id: crypto.randomUUID(),
        user_id: user.id,
        type: transactionType,
        title: title.trim(),
        category,
        amount: numericAmount,
        date: getToday(),
      };

      console.log("ENVIANDO PARA SUPABASE:", newTransaction);

      // Salva no Supabase
      const { data, error } = await supabase
        .from("transactions")
        .insert([newTransaction])
        .select()
        .single();

      if (error) {
        console.error("ERRO AO SALVAR NO SUPABASE:", error);
        setMessage(`Erro ao salvar: ${error.message}`);
        return;
      }

      console.log("TRANSAÇÃO SALVA:", data);

      // Atualiza a tela
      setTransactions((current) => [
        data,
        ...current,
      ]);

      setSelectedMonth(getCurrentMonthKey());

      closeModal();

      setPage("lancamentos");

    } catch (error) {
      console.error("ERRO:", error);
      setMessage("Ocorreu um erro ao salvar a transação.");
    }
  }

  /* =======================================================
     EXCLUIR TRANSAÇÃO
  ======================================================= */

  async function deleteTransaction(id) {
    const confirmed = window.confirm(
      "Deseja realmente excluir este lançamento?"
    );

    if (!confirmed) return;

    try {
      // Pega o usuário logado
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("ERRO AO IDENTIFICAR USUÁRIO:", authError);
        return;
      }

      // Exclui do Supabase
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("ERRO AO EXCLUIR TRANSAÇÃO:", error);
        return;
      }

      // Remove da tela somente depois que o Supabase confirmou
      setTransactions((current) =>
        current.filter(
          (transaction) => transaction.id !== id
        )
      );

      console.log("TRANSAÇÃO EXCLUÍDA COM SUCESSO:", id);
    } catch (error) {
      console.error("ERRO AO EXCLUIR LANÇAMENTO:", error);
    }
  }

  /* =======================================================
     INÍCIO
  ======================================================= */

  function renderHome() {
    const recentTransactions =
      monthTransactions.slice(0, 5);

    return (
      <div className="page-content">
        <header className="top-header">
          <div>
            <span className="welcome-label">
              Bom dia,
            </span>

            <h1>{clientName}</h1>
          </div>

          <button
            className="notification-button"
            onClick={() =>
              alert(
                "Você não possui novas notificações."
              )
            }
          >
            🔔
          </button>
        </header>

        {/* =================================================
            CONTROLE DO PERÍODO
        ================================================= */}

        <section className="period-selector">
          <div className="period-info">
            <span>📅</span>

            <div>
              <small>Período</small>

              <strong>
                {formatMonthTitle(selectedMonth)}
              </strong>
            </div>
          </div>

          <div className="period-controls">
            <button
              type="button"
              onClick={previousMonth}
              aria-label="Mês anterior"
            >
              ‹
            </button>

            <button
              type="button"
              className="period-current"
              onClick={goToCurrentMonth}
            >
              {formatMonthTitle(selectedMonth)}
            </button>

            <button
              type="button"
              onClick={nextMonth}
              disabled={
                isFutureMonth(
                  changeMonth(selectedMonth, 1)
                )
              }
              aria-label="Próximo mês"
            >
              ›
            </button>
          </div>
        </section>

        {/* =================================================
            SALDO
        ================================================= */}

        <section className="balance-section">
          <span>
            Seu saldo em{" "}
            {formatMonthTitle(selectedMonth)}
          </span>

          <div className="balance-row">
            <h2>{formatCurrency(totals.balance)}</h2>

            <button
              className="main-add-button"
              onClick={() =>
                openTransactionModal("expense")
              }
            >
              +
            </button>
          </div>
        </section>

        {/* =================================================
            RESUMO
        ================================================= */}

        <section className="summary-grid">
          <button
            className="summary-card income-card"
            onClick={() =>
              openTransactionModal("income")
            }
          >
            <div className="summary-icon">↗</div>

            <div>
              <span>Entradas</span>

              <strong>
                {formatCurrency(totals.income)}
              </strong>
            </div>

            <small>Adicionar entrada</small>
          </button>

          <button
            className="summary-card expense-card"
            onClick={() =>
              openTransactionModal("expense")
            }
          >
            <div className="summary-icon">↘</div>

            <div>
              <span>Gastos</span>

              <strong>
                {formatCurrency(totals.expenses)}
              </strong>
            </div>

            <small>Adicionar gasto</small>
          </button>
        </section>

        {/* =================================================
            GRÁFICO
        ================================================= */}

        <section className="chart-card">
          <div className="section-heading">
            <div>
              <span className="section-label">
                Visão financeira
              </span>

              <h2>Movimentações</h2>
            </div>

            <button
              onClick={() =>
                setPage("relatorios")
              }
            >
              Ver relatório →
            </button>
          </div>

          <div className="fake-chart">
            <div className="chart-line">
              <span style={{ height: "35%" }} />
              <span style={{ height: "55%" }} />
              <span style={{ height: "42%" }} />
              <span style={{ height: "72%" }} />
              <span style={{ height: "60%" }} />
              <span style={{ height: "88%" }} />
              <span style={{ height: "70%" }} />
            </div>

            <div className="chart-days">
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>
          </div>
        </section>

        {/* =================================================
            ÚLTIMOS LANÇAMENTOS
        ================================================= */}

        <section className="transactions-card">
          <div className="section-heading">
            <div>
              <span className="section-label">
                Movimentações
              </span>

              <h2>Últimos lançamentos</h2>
            </div>

            <button
              onClick={() =>
                setPage("lancamentos")
              }
            >
              Ver todos →
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="empty-state">
              <div>📋</div>

              <p>
                Nenhum lançamento em{" "}
                {formatMonthTitle(selectedMonth)}.
              </p>

              <small>
                Adicione sua primeira entrada ou gasto.
              </small>
            </div>
          ) : (
            <div className="transaction-list">
              {recentTransactions.map(
                (transaction) => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                  />
                )
              )}
            </div>
          )}
        </section>

        {/* =================================================
            BOTÃO FLUTUANTE
        ================================================= */}

        <button
          className="floating-add"
          onClick={() =>
            openTransactionModal("expense")
          }
        >
          +
        </button>
      </div>
    );
  }

  /* =======================================================
     LANÇAMENTOS
  ======================================================= */

  function renderTransactions() {
    return (
      <div className="page-content">
        <PageHeader
          label="Financeiro"
          title="Lançamentos"
          onBack={() => setPage("inicio")}
        />

        {/* CONTROLE DO MÊS */}
        <section className="period-selector page-period">
          <div className="period-info">
            <span>📅</span>

            <div>
              <small>Histórico</small>

              <strong>
                {formatMonthTitle(selectedMonth)}
              </strong>
            </div>
          </div>

          <div className="period-controls">
            <button
              type="button"
              onClick={previousMonth}
            >
              ‹
            </button>

            <button
              type="button"
              className="period-current"
              onClick={goToCurrentMonth}
            >
              {formatMonthTitle(selectedMonth)}
            </button>

            <button
              type="button"
              onClick={nextMonth}
              disabled={
                isFutureMonth(
                  changeMonth(selectedMonth, 1)
                )
              }
            >
              ›
            </button>
          </div>
        </section>

        {/* HISTÓRICO */}
        {availableMonths.length > 1 && (
          <section className="month-history-card">
            <div className="section-heading">
              <div>
                <span className="section-label">
                  Histórico
                </span>

                <h2>Meses anteriores</h2>
              </div>
            </div>

            <div className="month-history-list">
              {availableMonths.map((month) => (
                <button
                  key={month}
                  className={
                    month === selectedMonth
                      ? "month-history-item active"
                      : "month-history-item"
                  }
                  onClick={() =>
                    setSelectedMonth(month)
                  }
                >
                  <span>
                    {formatMonthTitle(month)}
                  </span>

                  <strong>
                    {
                      transactions.filter(
                        (transaction) =>
                          getMonthKeyFromDate(
                            transaction.date
                          ) === month
                      ).length
                    }{" "}
                    lançamentos
                  </strong>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="page-description">
          <span>
            Lançamentos de{" "}
            {formatMonthTitle(selectedMonth)}
          </span>

          <div className="transaction-actions">
            <button
              className="secondary-button"
              onClick={() =>
                openTransactionModal("income")
              }
            >
              + Entrada
            </button>

            <button
              className="primary-button"
              onClick={() =>
                openTransactionModal("expense")
              }
            >
              + Gasto
            </button>
          </div>
        </div>

        {/* RESUMO DO MÊS */}
        <section className="report-grid">
          <div className="report-card">
            <span>Entradas</span>

            <strong className="green">
              {formatCurrency(totals.income)}
            </strong>
          </div>

          <div className="report-card">
            <span>Gastos</span>

            <strong className="red">
              {formatCurrency(totals.expenses)}
            </strong>
          </div>

          <div className="report-card">
            <span>Saldo</span>

            <strong>
              {formatCurrency(totals.balance)}
            </strong>
          </div>
        </section>

        <section className="all-transactions-card">
          {monthTransactions.length === 0 ? (
            <div className="empty-state large">
              <div>📋</div>

              <h3>Nenhum lançamento</h3>

              <p>
                Não existem lançamentos neste mês.
              </p>
            </div>
          ) : (
            <div className="transaction-list large-list">
              {monthTransactions.map(
                (transaction) => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    showDelete
                    onDelete={() =>
                      deleteTransaction(
                        transaction.id
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  /* =======================================================
     RELATÓRIOS
  ======================================================= */

  function renderReports() {
    const percentage =
      totals.income > 0
        ? Math.min(
          (totals.expenses /
            totals.income) *
          100,
          100
        )
        : 0;

    return (
      <div className="page-content">
        <PageHeader
          label="Financeiro"
          title="Relatórios"
          onBack={() => setPage("inicio")}
        />

        {/* PERÍODO DO RELATÓRIO */}
        <section className="period-selector page-period">
          <div className="period-info">
            <span>📅</span>

            <div>
              <small>Relatório de</small>

              <strong>
                {formatMonthTitle(selectedMonth)}
              </strong>
            </div>
          </div>

          <div className="period-controls">
            <button
              type="button"
              onClick={previousMonth}
            >
              ‹
            </button>

            <button
              type="button"
              className="period-current"
              onClick={goToCurrentMonth}
            >
              {formatMonthTitle(selectedMonth)}
            </button>

            <button
              type="button"
              onClick={nextMonth}
              disabled={
                isFutureMonth(
                  changeMonth(selectedMonth, 1)
                )
              }
            >
              ›
            </button>
          </div>
        </section>

        <section className="report-main-card">
          <span>
            Gastos em relação às entradas
          </span>

          <div className="report-percentage">
            {percentage.toFixed(0)}%
          </div>

          <div className="progress-bar">
            <div
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>

          <small>
            Você gastou{" "}
            {formatCurrency(totals.expenses)} em{" "}
            {formatMonthTitle(selectedMonth)}.
          </small>
        </section>

        <section className="report-grid">
          <div className="report-card">
            <span>Total recebido</span>

            <strong className="green">
              {formatCurrency(totals.income)}
            </strong>
          </div>

          <div className="report-card">
            <span>Total gasto</span>

            <strong className="red">
              {formatCurrency(totals.expenses)}
            </strong>
          </div>

          <div className="report-card">
            <span>Saldo</span>

            <strong>
              {formatCurrency(totals.balance)}
            </strong>
          </div>
        </section>
      </div>
    );
  }

  /* =======================================================
     PERFIL EXTERNO
  ======================================================= */

  function renderProfile() {
    /*
      IMPORTANTE:
      O Perfil NÃO fica mais dentro do App.jsx.

      Aqui simplesmente carregamos a página externa:
      ../Perfil/index.jsx
    */

    return <Perfil />;
  }

  /* =======================================================
     RENDERIZAÇÃO DAS PÁGINAS
  ======================================================= */

  function renderPage() {
    if (page === "lancamentos") {
      return renderTransactions();
    }

    if (page === "relatorios") {
      return renderReports();
    }

    if (page === "perfil") {
      return renderProfile();
    }

    return renderHome();
  }

  /* =======================================================
     INTERFACE PRINCIPAL
  ======================================================= */

  return (
    <div className="app">
      <main className="app-main">
        {renderPage()}
      </main>

      {/* ===================================================
          NAVEGAÇÃO INFERIOR
      =================================================== */}

      <nav className="bottom-navigation">
        <button
          className={
            page === "inicio" ? "active" : ""
          }
          onClick={() => setPage("inicio")}
        >
          <span>⌂</span>
          <small>Início</small>
        </button>

        <button
          className={
            page === "lancamentos"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("lancamentos")
          }
        >
          <span>▦</span>
          <small>Lançamentos</small>
        </button>

        <button
          className={
            page === "relatorios"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("relatorios")
          }
        >
          <span>◒</span>
          <small>Relatórios</small>
        </button>

        <button
          className={
            page === "perfil" ? "active" : ""
          }
          onClick={() => setPage("perfil")}
        >
          <span>◯</span>
          <small>Perfil</small>
        </button>
      </nav>

      {/* ===================================================
          MODAL DE LANÇAMENTO
      =================================================== */}

      {modalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={closeModal}
        >
          <div
            className="transaction-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="section-label">
                  Novo lançamento
                </span>

                <h2>
                  {transactionType === "income"
                    ? "Adicionar entrada"
                    : "Adicionar gasto"}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="type-selector">
              <button
                type="button"
                className={
                  transactionType === "expense"
                    ? "selected expense"
                    : ""
                }
                onClick={() =>
                  setTransactionType("expense")
                }
              >
                Gasto
              </button>

              <button
                type="button"
                className={
                  transactionType === "income"
                    ? "selected income"
                    : ""
                }
                onClick={() =>
                  setTransactionType("income")
                }
              >
                Entrada
              </button>
            </div>

            <form
              onSubmit={handleSaveTransaction}
            >
              <label>
                Valor

                <div className="amount-input">
                  <span>R$</span>

                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0,00"
                    value={amount}
                    onChange={
                      handleAmountChange
                    }
                    autoFocus
                  />
                </div>
              </label>

              <label>
                Descrição

                <input
                  type="text"
                  placeholder={
                    transactionType ===
                      "income"
                      ? "Ex: Salário"
                      : "Ex: Mercado"
                  }
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Categoria

                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                >
                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>

              {message && (
                <p className="form-message">
                  {message}
                </p>
              )}

              <button
                className={`save-button ${transactionType ===
                  "income"
                  ? "income"
                  : "expense"
                  }`}
                type="submit"
              >
                Salvar{" "}
                {transactionType === "income"
                  ? "entrada"
                  : "gasto"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================
          MENU MOBILE
      =================================================== */}

      {menuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() =>
            setMenuOpen(false)
          }
        >
          <div
            className="mobile-menu"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              onClick={() =>
                setPage("inicio")
              }
            >
              Início
            </button>

            <button
              onClick={() =>
                setPage("lancamentos")
              }
            >
              Lançamentos
            </button>

            <button
              onClick={() =>
                setPage("relatorios")
              }
            >
              Relatórios
            </button>

            <button
              onClick={() =>
                setPage("perfil")
              }
            >
              Perfil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPONENTE DE CABEÇALHO
========================================================= */

function PageHeader({
  label,
  title,
  onBack,
}) {
  return (
    <header className="page-header">
      <button
        className="back-button"
        onClick={onBack}
      >
        ←
      </button>

      <div>
        <span className="section-label">
          {label}
        </span>

        <h1>{title}</h1>
      </div>
    </header>
  );
}

/* =========================================================
   COMPONENTE DE TRANSAÇÃO
========================================================= */

function TransactionItem({
  transaction,
  showDelete,
  onDelete,
}) {
  const isIncome =
    transaction.type === "income";

  return (
    <div className="transaction-item">
      <div
        className={`transaction-icon ${isIncome
          ? "income"
          : "expense"
          }`}
      >
        {isIncome ? "↗" : "↘"}
      </div>

      <div className="transaction-info">
        <strong>
          {transaction.title}
        </strong>

        <span>
          {transaction.category} •{" "}
          {transaction.date}
        </span>
      </div>

      <div className="transaction-value">
        <strong
          className={
            isIncome ? "green" : "red"
          }
        >
          {isIncome ? "+" : "-"}{" "}
          {formatCurrency(
            transaction.amount
          )}
        </strong>

        {showDelete && (
          <button
            className="delete-button"
            onClick={onDelete}
            title="Excluir lançamento"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export default App;