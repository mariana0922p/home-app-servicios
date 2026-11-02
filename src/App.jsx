import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./services/db.js";
import HomeLoginScreen from "./components/HomeLoginScreen.jsx";
import ClientDashboard from "./components/dashboards/ClientDashboard.jsx";
import WorkerDashboard from "./components/dashboards/WorkerDashboard.jsx";
import AdminDashboard from "./components/dashboards/AdminDashboard.jsx";
import { DataProvider } from "./data/store.jsx";
import { ToastProvider } from "./components/ui/Kit.jsx";

const SESSION_KEY = "home_ppi_session_v3";

const readStoredSession = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};

export default function App() {
  const [session, setSession] = useState(null); // { user, role, profile, status }
  const [booting, setBooting] = useState(true);
  const [suspended, setSuspended] = useState(false);

  // Escucha del estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          // El rol solo existe si hay un perfil real en Firestore; jamás se deduce del correo.
          if (!profile || !["cliente", "trabajador", "admin"].includes(profile.role)) {
            setSession(null);
            setSuspended(false);
            window.sessionStorage.removeItem(SESSION_KEY);
            setBooting(false);
            return;
          }
          const role = profile.role;
          const status = profile.status || "activo";
          if (status === "suspendido") {
            setSuspended(true);
            setSession({ user: firebaseUser, role, profile, status });
          } else {
            setSuspended(false);
            const newSession = { user: firebaseUser, role, profile, status };
            setSession(newSession);
            try {
              window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                role,
                profile,
                status,
                user: { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName },
              }));
            } catch {
              /* Storage no disponible */
            }
          }
        } catch (e) {
          console.error("No fue posible validar el perfil en Firestore:", e);
          setSession(null);
          window.sessionStorage.removeItem(SESSION_KEY);
        }
      } else {
        setSession(null);
        setSuspended(false);
        window.sessionStorage.removeItem(SESSION_KEY);
      }
      setBooting(false);
    });

    return unsubscribe;
  }, []);

  const handleAuthenticated = ({ user, role, profile }) => {
    if (profile?.status === "suspendido") {
      setSuspended(true);
      setSession({ user, role, profile, status: "suspendido" });
      return;
    }

    setSuspended(false);
    const newSession = { user, role, profile, status: profile?.status || "activo" };
    try {
      window.sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          role,
          profile,
          status: newSession.status,
          user: user ? { uid: user.uid, email: user.email, displayName: user.displayName } : undefined,
        })
      );
    } catch {
      /* sin almacenamiento */
    }
    setSession(newSession);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      /* ya cerrada */
    }
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setSuspended(false);
  };

  if (booting) {
    return (
      <div className="hd-loading">
        <div>
          <span className="hd-spinner" />
          <span>Cargando HOME...</span>
        </div>
      </div>
    );
  }

  // Pantalla de bloqueo si la cuenta ha sido suspendida
  if (suspended) {
    return (
      <div className="hd-suspended-screen">
        <div className="hd-suspended-card">
          <div className="hd-suspended-icon">⚠️</div>
          <h2>Cuenta Suspendida</h2>
          <p>
            Tu cuenta ha sido suspendida por el equipo de administración de HOME debido a una revisión de seguridad o
            incumplimiento de términos.
          </p>
          <div className="hd-suspended-actions">
            <button className="hd-btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <HomeLoginScreen onAuthenticated={handleAuthenticated} />;
  }

  // Redirección estricta según el rol verificado
  const Dashboard =
    session.role === "admin"
      ? AdminDashboard
      : session.role === "trabajador"
      ? WorkerDashboard
      : ClientDashboard;

  return (
    <ToastProvider>
      <DataProvider session={session}>
        <Dashboard session={session} onLogout={handleLogout} />
      </DataProvider>
    </ToastProvider>
  );
}
