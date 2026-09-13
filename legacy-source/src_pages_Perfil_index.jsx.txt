import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase/client";
import "./index.css";

function Perfil() {
  const [notificacoes, setNotificacoes] = useState(true);
  const [tema, setTema] = useState("Claro");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [novaSenha, setNovaSenha] = useState("");

  // ========================================
  // CARREGAR PERFIL
  // ========================================

  useEffect(() => {
    carregarPerfil();
  }, []);

  async function carregarPerfil() {
    try {
      setCarregando(true);

      // Pega o usuário atualmente logado
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        console.log("Nenhum usuário está logado.");
        return;
      }

      console.log("Usuário autenticado:", user);

      // Busca o perfil na tabela profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      }

      console.log("Perfil encontrado:", data);

      setNome(data.nome || "");
      setEmail(data.email || user.email || "");

      // Essas configurações continuam locais por enquanto
      const notificacoesSalvas = localStorage.getItem(
        "financerto_notificacoes"
      );

      const temaSalvo = localStorage.getItem("financerto_tema");

      setNotificacoes(
        notificacoesSalvas !== null
          ? JSON.parse(notificacoesSalvas)
          : true
      );

      setTema(temaSalvo || "Claro");
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      alert("Não foi possível carregar seu perfil.");
    } finally {
      setCarregando(false);
    }
  }

  // ========================================
  // SALVAR PERFIL
  // ========================================

  async function salvarPerfil() {
    try {
      setSalvando(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        alert("Nenhum usuário está logado.");
        return;
      }

      const nomeLimpo = nome.trim();
      const emailLimpo = email.trim().toLowerCase();

      if (!nomeLimpo || !emailLimpo) {
        alert("Preencha seu nome e seu e-mail.");
        return;
      }

      // Atualiza o perfil na tabela profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: nomeLimpo,
          email: emailLimpo,
        })
        .eq("id", user.id);

      if (profileError) {
        throw profileError;
      }

      // Se o e-mail foi alterado, atualiza também o Supabase Auth
      if (emailLimpo !== user.email?.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: emailLimpo,
        });

        if (emailError) {
          throw emailError;
        }

        alert(
          "Perfil atualizado! Se você alterou o e-mail, verifique sua caixa de entrada para confirmar o novo endereço."
        );
      } else {
        alert("Perfil atualizado com sucesso!");
      }

      setNome(nomeLimpo);
      setEmail(emailLimpo);
      setEditando(false);
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Não foi possível salvar as alterações: " + error.message);
    } finally {
      setSalvando(false);
    }
  }

  // ========================================
  // ALTERAR NOTIFICAÇÕES
  // ========================================

  function alterarNotificacoes() {
    try {
      const novoValor = !notificacoes;

      setNotificacoes(novoValor);

      localStorage.setItem(
        "financerto_notificacoes",
        JSON.stringify(novoValor)
      );
    } catch (error) {
      console.error(
        "Erro ao atualizar notificações:",
        error
      );
    }
  }

  // ========================================
  // ALTERAR TEMA
  // ========================================

  function alterarTema() {
    try {
      const novoTema =
        tema === "Claro" ? "Escuro" : "Claro";

      setTema(novoTema);

      localStorage.setItem(
        "financerto_tema",
        novoTema
      );
    } catch (error) {
      console.error("Erro ao atualizar tema:", error);
    }
  }

  // ========================================
  // ALTERAR SENHA
  // ========================================

  async function atualizarSenha() {
    if (novaSenha.length < 6) {
      alert(
        "A nova senha precisa ter pelo menos 6 caracteres."
      );
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) {
        throw error;
      }

      setNovaSenha("");
      setMostrarSenha(false);

      alert("Senha atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      alert(
        "Não foi possível atualizar a senha: " +
          error.message
      );
    }
  }

  // ========================================
  // CARREGAMENTO
  // ========================================

  if (carregando) {
    return (
      <div className="perfil-page">
        <div className="perfil-container">
          <div className="perfil-loading">
            Carregando seu perfil...
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // PERFIL
  // ========================================

  return (
    <div
      className={`perfil-page ${
        tema === "Escuro" ? "tema-escuro" : ""
      }`}
    >
      <div className="perfil-container">

        {/* CABEÇALHO */}

        <header className="perfil-header">

          <button
            className="perfil-voltar"
            onClick={() => window.history.back()}
            aria-label="Voltar"
            type="button"
          >
            ←
          </button>

          <div>
            <span className="perfil-label">
              Minha conta
            </span>

            <h1>Perfil</h1>
          </div>

        </header>

        {/* CARTÃO DO PERFIL */}

        <section className="perfil-card-principal">

          <div className="perfil-avatar">
            {(nome || "U")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="perfil-info">

            <h2>
              {nome || "Usuário"}
            </h2>

            <p>
              {email || "Usuário do FinanCerto"}
            </p>

          </div>

          <button
            className="perfil-editar-btn"
            onClick={() =>
              setEditando(!editando)
            }
            type="button"
          >
            {editando
              ? "Cancelar"
              : "Editar perfil"}
          </button>

        </section>

        {/* EDITAR PERFIL */}

        {editando && (
          <section className="perfil-section perfil-edicao">

            <div className="section-title">

              <span>👤</span>

              <div>
                <h2>Editar perfil</h2>

                <p>
                  Atualize suas informações pessoais
                </p>
              </div>

            </div>

            <div className="perfil-form">

              <label>
                Nome

                <input
                  type="text"
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  placeholder="Digite seu nome"
                />
              </label>

              <label>
                E-mail

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Digite seu e-mail"
                />
              </label>

              <button
                className="botao-salvar"
                onClick={salvarPerfil}
                disabled={salvando}
                type="button"
              >
                {salvando
                  ? "Salvando..."
                  : "Salvar alterações"}
              </button>

            </div>

          </section>
        )}

        {/* CONFIGURAÇÕES */}

        <section className="perfil-section">

          <div className="section-title">

            <span>⚙️</span>

            <div>
              <h2>Configurações</h2>

              <p>
                Personalize sua experiência
              </p>
            </div>

          </div>

          <div className="config-list">

            {/* NOTIFICAÇÕES */}

            <div className="config-item">

              <div className="config-icon">
                🔔
              </div>

              <div className="config-text">

                <strong>
                  Notificações
                </strong>

                <span>
                  Receba avisos sobre suas movimentações
                </span>

              </div>

              <button
                className={`switch ${
                  notificacoes ? "ativo" : ""
                }`}
                onClick={alterarNotificacoes}
                aria-label="Ativar notificações"
                type="button"
              >
                <span></span>
              </button>

            </div>

            {/* TEMA */}

            <button
              className="config-item config-click"
              onClick={alterarTema}
              type="button"
            >

              <div className="config-icon">
                {tema === "Claro" ? "☀️" : "🌙"}
              </div>

              <div className="config-text">

                <strong>
                  Tema
                </strong>

                <span>
                  {tema}
                </span>

              </div>

              <span className="config-arrow">
                ›
              </span>

            </button>

            {/* SEGURANÇA */}

            <button
              className="config-item config-click"
              onClick={() =>
                setMostrarSenha(!mostrarSenha)
              }
              type="button"
            >

              <div className="config-icon">
                🔐
              </div>

              <div className="config-text">

                <strong>
                  Segurança
                </strong>

                <span>
                  Alterar senha e segurança da conta
                </span>

              </div>

              <span className="config-arrow">
                ›
              </span>

            </button>

          </div>

        </section>

        {/* ALTERAR SENHA */}

        {mostrarSenha && (
          <section className="perfil-section senha-box">

            <div className="section-title">

              <span>🔑</span>

              <div>
                <h2>Segurança</h2>

                <p>
                  Gerencie sua senha
                </p>
              </div>

            </div>

            <div className="senha-form">

              <label>
                Nova senha

                <input
                  type="password"
                  value={novaSenha}
                  onChange={(event) =>
                    setNovaSenha(event.target.value)
                  }
                  placeholder="Digite a nova senha"
                />
              </label>

              <button
                className="botao-salvar"
                onClick={atualizarSenha}
                type="button"
              >
                Atualizar senha
              </button>

            </div>

          </section>
        )}

        {/* SOBRE */}

        <section className="perfil-section">

          <div className="section-title">

            <span>ℹ️</span>

            <div>
              <h2>
                Sobre o aplicativo
              </h2>

              <p>
                Informações sobre o FinanCerto
              </p>
            </div>

          </div>

          <div className="sobre-info">

            <div>
              <span>
                Aplicativo
              </span>

              <strong>
                FinanCerto
              </strong>
            </div>

            <div>
              <span>
                Versão
              </span>

              <strong>
                1.0.0
              </strong>
            </div>

          </div>

        </section>

        {/* RODAPÉ */}

        <footer className="perfil-footer">

          <p>
            FinanCerto
          </p>

          <span>
            Controle suas finanças de forma simples.
          </span>

        </footer>

      </div>
    </div>
  );
}

export default Perfil;