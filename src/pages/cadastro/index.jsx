import { useState } from "react";
import { supabase } from "../../supabase/client";

import "./index.css";

function Cadastro({ onCreateAccount, onBackToLogin }) {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [carregando, setCarregando] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();

        if (!nome || !email || !senha || !confirmarSenha) {
            alert("Preencha todos os campos.");
            return;
        }

        if (senha !== confirmarSenha) {
            alert("As senhas não são iguais.");
            return;
        }

        if (senha.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        try {
            setCarregando(true);

            // 1. Cria o usuário no Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: senha,
            });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error("Não foi possível criar o usuário.");
            }

            // 2. Cria o perfil na tabela profiles
            const { error: profileError } = await supabase
                .from("profiles")
                .upsert(
                    {
                        id: data.user.id,
                        nome: nome,
                        email: email,
                    },
                    {
                        onConflict: "id",
                    }
                );

            if (profileError) {
                throw profileError;
            }

            // 3. Mantém o callback que seu aplicativo já utilizava
            const usuario = {
                id: data.user.id,
                nome,
                email,
            };

            if (onCreateAccount) {
                onCreateAccount(usuario);
            }

            alert("Conta criada com sucesso!");

        } catch (error) {
            console.error("Erro ao criar conta:", error);

            alert(
                "Erro ao criar conta: " +
                (error.message || "Erro desconhecido.")
            );
        } finally {
            setCarregando(false);
        }
    }

    return (
        <main className="cadastro-page">
            <section className="cadastro-card">

                <div className="cadastro-brand">
                    <div className="cadastro-logo">F</div>

                    <h1>
                        Finan<span>Certo</span>
                    </h1>

                    <p>
                        Controle seu dinheiro. Controle sua vida.
                    </p>
                </div>

                <div className="cadastro-header">
                    <h2>Criar sua conta</h2>

                    <p>
                        Comece a organizar sua vida financeira.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="cadastro-form"
                >

                    <div className="form-group">
                        <label htmlFor="nome">
                            Nome
                        </label>

                        <input
                            id="nome"
                            type="text"
                            placeholder="Digite seu nome"
                            value={nome}
                            onChange={(event) =>
                                setNome(event.target.value)
                            }
                            autoComplete="name"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">
                            E-mail
                        </label>

                        <input
                            id="email"
                            type="email"
                            placeholder="seuemail@email.com"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="senha">
                            Senha
                        </label>

                        <input
                            id="senha"
                            type="password"
                            placeholder="Digite sua senha"
                            value={senha}
                            onChange={(event) =>
                                setSenha(event.target.value)
                            }
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmarSenha">
                            Confirmar senha
                        </label>

                        <input
                            id="confirmarSenha"
                            type="password"
                            placeholder="Digite a senha novamente"
                            value={confirmarSenha}
                            onChange={(event) =>
                                setConfirmarSenha(event.target.value)
                            }
                            autoComplete="new-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="cadastro-button"
                        disabled={carregando}
                    >
                        {carregando
                            ? "Criando conta..."
                            : "Criar minha conta"}
                    </button>

                </form>

                <div className="cadastro-footer">

                    <p>
                        Já possui uma conta?
                    </p>

                    <button
                        type="button"
                        className="voltar-login"
                        onClick={onBackToLogin}
                    >
                        Voltar para o login
                    </button>

                    <small>
                        Seus dados financeiros em um só lugar.
                    </small>

                </div>

            </section>
        </main>
    );
}

export default Cadastro;