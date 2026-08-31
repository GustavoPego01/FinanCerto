import { useState } from "react";
import { supabase } from "../../supabase/client";

import "./index.css";

function Login({ onLogin, onCreateAccount }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMensagem("");

    if (!email || !senha) {
      setMensagem("Preencha seu e-mail e sua senha.");
      return;
    }

    setCarregando(true);

    try {
      // 1. Faz login no Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Não foi possível encontrar o usuário.");
      }

      // 2. Busca o perfil do usuário
      const { data: perfil, error: perfilError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (perfilError) {
        throw perfilError;
      }

      // 3. Junta os dados do Auth com os dados do perfil
      const usuario = {
        id: data.user.id,
        email: data.user.email,
        nome: perfil.nome,
      };

      // 4. Envia o usuário para o App
      onLogin(usuario);

    } catch (error) {
      console.error("Erro no login:", error);

      if (
        error.message?.toLowerCase().includes("invalid login credentials")
      ) {
        setMensagem("E-mail ou senha incorretos.");
      } else if (
        error.message?.toLowerCase().includes("email not confirmed")
      ) {
        setMensagem(
          "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada."
        );
      } else {
        setMensagem(`Erro ao entrar: ${error.message}`);
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setMensagem("Digite seu e-mail primeiro.");
      return;
    }

    setMensagem("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: window.location.origin,
        }
      );

      if (error) {
        throw error;
      }

      setMensagem(
        "Se esse e-mail estiver cadastrado, enviaremos um link para redefinir sua senha."
      );
    } catch (error) {
      console.error("Erro ao recuperar senha:", error);
      setMensagem(`Erro: ${error.message}`);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">

        <div className="login-brand">
          <div className="login-logo">F</div>

          <h1>
            Finan<span>Certo</span>
          </h1>

          <p>Controle seu dinheiro. Controle sua vida.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">

          <label>
            E-mail

            <input
              type="email"
              placeholder="seuemail@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Senha

            <input
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {mensagem && (
            <p className="login-message">
              {mensagem}
            </p>
          )}

          <button
            type="button"
            className="forgot-button"
            onClick={handleForgotPassword}
          >
            Esqueci minha senha
          </button>

          <button
            type="submit"
            className="login-button"
            disabled={carregando}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>

        </form>

        <div className="login-divider">
          <span>ou</span>
        </div>

        <div className="login-create">

          <p>Ainda não possui uma conta?</p>

          <button
            type="button"
            className="create-account-button"
            onClick={onCreateAccount}
          >
            Criar minha conta
          </button>

          <small>
            Seus dados financeiros em um só lugar.
          </small>

        </div>

      </section>
    </main>
  );
}

export default Login;