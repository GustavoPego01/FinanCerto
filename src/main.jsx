import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import App from "./pages/home/App.jsx";
import Login from "./pages/login/index.jsx";
import Cadastro from "./pages/cadastro/index.jsx";

import "./global.css";

function Main() {
  const [tela, setTela] = useState("login");
  const [usuario, setUsuario] = useState(null);

  function handleLogin(user) {
    setUsuario(user);
    setTela("app");
  }

  function handleCadastro(user) {
    setUsuario(user);
    setTela("app");
  }

  function handleLogout() {
    setUsuario(null);
    setTela("login");
  }

  if (tela === "login") {
    return (
      <Login
        onLogin={handleLogin}
        onCreateAccount={() => setTela("cadastro")}
      />
    );
  }

  if (tela === "cadastro") {
    return (
      <Cadastro
        onCreateAccount={handleCadastro}
        onBackToLogin={() => setTela("login")}
      />
    );
  }

  return <App usuario={usuario} onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Main />
  </StrictMode>
);

//460816GuguPego.