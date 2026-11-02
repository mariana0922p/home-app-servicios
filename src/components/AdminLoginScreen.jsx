import React, { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { auth } from "../firebase";
import { Icon } from "./ui/Icons.jsx";

// Inicializamos la base de datos directamente usando la app activa
const db = getFirestore(auth.app);


export default function AdminLoginScreen({ onAuthenticated, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!email || !password)
      return setMsg({ type: "error", text: "Completa correo y contraseña para continuar." });
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        onAuthenticated({ user: cred.user, role: "admin" });
      } else {
        await signOut(auth);
        setMsg({ type: "error", text: "Esta cuenta no tiene permisos de administrador en Firebase." });
      }
    } catch (err) {
      const known = [
        "auth/invalid-credential",
        "auth/wrong-password",
        "auth/user-not-found",
        "auth/invalid-email",
      ];
      setMsg({
        type: "error",
        text: known.includes(err.code)
          ? "Correo o contraseña incorrectos."
          : "No pudimos conectar con el servidor. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hd-admin-login">
      <section
        className="hd-al-art"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(31,27,23,.92) 0%, rgba(31,27,23,.5) 100%), url(/img/real/banner-admin.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="hd-al-brand">
          <img src="/img/logo.svg" alt="Home" width="46" height="46" style={{ borderRadius: 13 }} />
          <div>
            <strong>Home</strong>
            <span>Portal de Administración</span>
          </div>
        </div>
        <div>
          <h2>Control integral del marketplace en tiempo real.</h2>
          <p>
            Monitorea el flujo de servicios, audita las certificaciones de los profesionales y supervisa los
            ingresos generados en el Valle de Aburrá.
          </p>
        </div>
      </section>

      <section className="hd-al-form">
        <div className="hd-al-card">
          <span className="hd-al-badge">
            <Icon name="lock" size={14} /> Acceso seguro y restringido
          </span>
          <h1>Panel de administración</h1>
          <p className="sub">Ingresa con tus credenciales administrativas para gestionar la plataforma.</p>

          {msg && (
            <div className={`hd-al-msg ${msg.type}`}>
              <Icon name={msg.type === "error" ? "x" : "help"} size={18} />
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="hd-field">
              <label htmlFor="adEmail">Correo electrónico administrativo</label>
              <div className="hd-al-input">
                <Icon name="mail" size={18} />
                <input
                  id="adEmail"
                  className="hd-input"
                  type="email"
                  placeholder="admin@home.com.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="hd-field">
              <label htmlFor="adPass">Contraseña</label>
              <div className="hd-al-input">
                <Icon name="lock" size={18} />
                <input
                  id="adPass"
                  className="hd-input"
                  type={show ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="hd-icon-btn"
                  style={{
                    position: "absolute",
                    right: 4,
                    border: "none",
                    background: "none",
                    width: 36,
                    height: 36,
                  }}
                  onClick={() => setShow((v) => !v)}
                  aria-label="Mostrar u ocultar contraseña"
                >
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </div>

            <button className="hd-btn" style={{ width: "100%", height: 48 }} disabled={loading}>
              {loading ? "Verificando acceso..." : "Ingresar al panel"}
            </button>
          </form>

          <button className="hd-al-back" onClick={onBack}>
            ← Volver a la página principal de Home
          </button>
        </div>
      </section>
    </div>
  );
}
