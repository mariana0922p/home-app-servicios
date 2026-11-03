import React, { useEffect, useRef, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, firebaseConfigured } from "../firebase";
import { prepareDocument } from "../data/files.js";
import { saveWorkerDoc } from "../services/docs.js";
import { getUserProfile, saveUserProfile, subscribePublicCatalog } from "../services/db.js";
import { CATEGORIES, ZONES } from "../data/seed.js";
import { fmtCOP } from "../data/utils.js";

/* ---------------------------------------------------------------- */
/* Iconos SVG inline de alta calidad                                */
/* ---------------------------------------------------------------- */
function Icon({ path, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {path}
    </svg>
  );
}

const IconMail = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    }
  />
);
const IconLock = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    }
  />
);
const IconEye = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    }
  />
);
const IconEyeOff = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7c1.5 0 2.8-.3 4-.8" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      </>
    }
  />
);
const IconPerson = (p) => (
  <Icon
    {...p}
    path={
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    }
  />
);
const IconPhone = (p) => (
  <Icon
    {...p}
    path={
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1v3.6c0 .6-.4 1-1 1C10.8 21.1 2.9 13.2 2.9 3.7c0-.6.4-1 1-1H7.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
    }
  />
);
const IconBadge = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <path d="M9 6V4h6v2" />
        <circle cx="12" cy="13" r="2.4" />
      </>
    }
  />
);
const IconShield = (p) => (
  <Icon
    {...p}
    path={<path d="M12 3 4.5 6v6c0 4.6 3.2 7.6 7.5 9 4.3-1.4 7.5-4.4 7.5-9V6L12 3Z" />}
  />
);
const IconCheck = (p) => (
  <Icon
    {...p}
    path={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.3 2.4 2.4 4.6-5.2" />
      </>
    }
  />
);
const IconAlert = (p) => (
  <Icon
    {...p}
    path={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
      </>
    }
  />
);
const IconSearch = (p) => (
  <Icon
    {...p}
    path={
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </>
    }
  />
);
const IconStar = (p) => (
  <Icon
    {...p}
    path={
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    }
  />
);
const IconMenu = (p) => (
  <Icon
    {...p}
    path={
      <>
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </>
    }
  />
);
const IconX = (p) => (
  <Icon
    {...p}
    path={
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    }
  />
);
const IconCalculator = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="16" y1="14" x2="16" y2="18" />
        <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
      </>
    }
  />
);
const IconFileText = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </>
    }
  />
);

const ESTIMATE_OPTIONS = [
  { id: "plomeria_fuga", name: "Reparación de fuga o grifería", cat: "Plomería", min: 45000, max: 95000 },
  { id: "plomeria_calentador", name: "Instalación de calentador a gas", cat: "Plomería", min: 180000, max: 280000 },
  { id: "elec_puntos", name: "Instalación de tomas o iluminación LED", cat: "Electricidad", min: 65000, max: 160000 },
  { id: "elec_tablero", name: "Revisión y cambio de breakers/tablero", cat: "Electricidad", min: 120000, max: 260000 },
  { id: "pintura_alcoba", name: "Pintura de alcoba completa (2 manos)", cat: "Pintura", min: 220000, max: 380000 },
  { id: "clima_mantenimiento", name: "Mantenimiento preventivo aire minisplit", cat: "Climatización", min: 120000, max: 180000 },
  { id: "reforma_bano", name: "Enchape y remodelación de baño", cat: "Reformas", min: 1200000, max: 2900000 },
  { id: "carp_closet", name: "Reparación o ajuste de closet/cocina", cat: "Carpintería", min: 80000, max: 190000 },
];

export default function HomeLoginScreen({ onAuthenticated }) {
  // Modal de autenticación
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [registerRole, setRegisterRole] = useState("cliente"); // "cliente" | "trabajador"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Campos de formulario Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  // Campos de formulario Registro (Comunes)
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Campos de formulario Registro (Profesional)
  const [workerCat, setWorkerCat] = useState("plomeria");
  const [workerZone, setWorkerZone] = useState("Laureles");
  const [workerRate, setWorkerRate] = useState("48000");
  const [workerYears, setWorkerYears] = useState("5");
  const [workerBio, setWorkerBio] = useState("");
  const [workerCvFile, setWorkerCvFile] = useState(null);
  const [workerCertificateFile, setWorkerCertificateFile] = useState(null);
  const [publicWorkers, setPublicWorkers] = useState([]);
  const [publicReviews, setPublicReviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Estados del cotizador
  const [selectedEstimate, setSelectedEstimate] = useState(ESTIMATE_OPTIONS[0]);
  const [searchCat, setSearchCat] = useState("todas");
  const [searchZone, setSearchZone] = useState("Laureles");

  useEffect(() => {
    document.body.style.overflow = authModalOpen ? "hidden" : "";
    // Si el usuario inicia sesión y esta pantalla se desmonta, nunca dejar el body bloqueado.
    return () => { document.body.style.overflow = ""; };
  }, [authModalOpen]);

  useEffect(() => subscribePublicCatalog(({ workers, reviews }) => {
    setPublicWorkers(workers || []);
    setPublicReviews(reviews || []);
  }, (error) => console.error("No se pudo cargar el catálogo público:", error)), []);

  const openAuth = (newMode = "login", newRegisterRole = "cliente") => {
    setMode(newMode);
    setRegisterRole(newRegisterRole);
    setFeedback(null);
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  /* ------------------------------------------------------------------ */
  /* LOGIN UNIVERSAL: Redirección automática por rol desde la base de datos */
  /* ------------------------------------------------------------------ */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = cred.user;

      const userDoc = await getUserProfile(user.uid);

      if (!userDoc) {
        setFeedback({
          type: "error",
          text: "Esta cuenta no tiene un perfil registrado en HOME. Regístrate o contacta al administrador. El rol no se asigna a partir del correo.",
        });
        return;
      }

      if (userDoc.status === "suspendido") {
        setFeedback({
          type: "error",
          text: "Esta cuenta se encuentra suspendida por la administración de HOME. Comunícate con soporte.",
        });
        return;
      }

      if (!["cliente", "trabajador", "admin"].includes(userDoc.role)) {
        setFeedback({ type: "error", text: "El perfil no tiene un rol válido. Contacta al administrador." });
        return;
      }
      onAuthenticated({ user, role: userDoc.role, profile: userDoc });
    } catch (err) {
      console.error("Error en login:", err);
      let msg = "No pudimos iniciar sesión. Verifica tu conexión e intenta de nuevo.";
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        msg = "Correo o contraseña incorrectos. Revisa tus datos.";
      }
      setFeedback({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* REGISTRO REAL: Cliente o Profesional con documentación             */
  /* ------------------------------------------------------------------ */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!acceptTerms) {
      setFeedback({
        type: "error",
        text: "Debes aceptar los Términos del Servicio y la Garantía Home para continuar.",
      });
      return;
    }

    if (registerRole === "trabajador") {
      if (!workerCvFile || !workerCertificateFile) {
        setFeedback({ type: "error", text: "Adjunta tanto la hoja de vida como el certificado para enviar tu postulación." });
        return;
      }
    }

    // Se validan y comprimen los documentos ANTES de crear la cuenta (PDF o foto, máx. 700 KB c/u)
    let cvDoc = null;
    let certDoc = null;
    if (registerRole === "trabajador") {
      try {
        cvDoc = await prepareDocument(workerCvFile);
        certDoc = await prepareDocument(workerCertificateFile);
      } catch (docErr) {
        setFeedback({ type: "error", text: docErr.message });
        return;
      }
    }

    setFeedback(null);
    setLoading(true);

    try {
      if (!firebaseConfigured) throw new Error("Firebase no está configurado. Completa las variables VITE_FIREBASE_* del archivo .env.");
      const cred = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const user = cred.user;

      const profileData = {
        uid: user.uid,
        email: regEmail,
        name: regName,
        phone: regPhone,
        role: registerRole,
        status: registerRole === "trabajador" ? "pendiente" : "activo",
        createdAt: new Date().toISOString(),
      };

      if (registerRole === "trabajador") {
        profileData.approvalStatus = "pendiente_revision";
        profileData.approvalNotes = "";
        profileData.cat = workerCat;
        profileData.zone = workerZone;
        profileData.rate = Number(workerRate) || 48000;
        profileData.years = Number(workerYears) || 3;
        profileData.bio = workerBio || `Profesional independiente de ${workerCat} en Medellín.`;
        profileData.cvFile = workerCvFile.name;
        profileData.certificateFile = workerCertificateFile.name;
        profileData.certifications = [workerCertificateFile.name];
        profileData.rating = 0;
        profileData.jobs = 0;
        profileData.photo = "";
      } else {
        profileData.photo = "";
      }

      // El estado pendiente se guarda antes de subir documentos; nunca se aprueba desde el registro.
      await saveUserProfile(user.uid, profileData);

      if (registerRole === "trabajador") {
        // Hoja de vida y certificado se guardan en Firestore (colección workerDocs); el admin los abre desde Verificaciones.
        await saveWorkerDoc(user.uid, "cv", cvDoc);
        await saveWorkerDoc(user.uid, "cert", certDoc);
        profileData.hasCv = true;
        profileData.hasCert = true;
        profileData.cvFile = cvDoc.name;
        profileData.certificateFile = certDoc.name;
        await saveUserProfile(user.uid, profileData);
      }

      onAuthenticated({
        user,
        role: registerRole,
        profile: profileData,
      });
    } catch (err) {
      console.error("Error en registro:", err);
      let msg = "Error al crear la cuenta. Intenta de nuevo.";
      if (err.code === "auth/email-already-in-use") {
        msg = "Este correo electrónico ya está registrado. Por favor inicia sesión.";
      } else if (err.code === "auth/weak-password") {
        msg = "La contraseña debe tener al menos 6 caracteres.";
      } else if (err.code === "permission-denied") {
        msg = "No pudimos guardar los documentos. Publica las reglas de Firestore (firestore.rules) e intenta de nuevo.";
      } else if (err.message?.includes("Firebase no está configurado")) {
        msg = err.message;
      } else if (err.message) {
        msg = `No pudimos completar el registro: ${err.message}`;
      }
      setFeedback({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setFeedback(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      let userDoc = await getUserProfile(user.uid);
      if (!userDoc) {
        userDoc = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split("@")[0],
          role: "cliente",
          status: "activo",
          photo: user.photoURL || "",
          createdAt: new Date().toISOString(),
        };
        await saveUserProfile(user.uid, userDoc);
      }

      if (userDoc.status === "suspendido") {
        setFeedback({
          type: "error",
          text: "Esta cuenta se encuentra suspendida por la administración de HOME.",
        });
        return;
      }

      if (!["cliente", "trabajador", "admin"].includes(userDoc.role)) {
        setFeedback({ type: "error", text: "El perfil no tiene un rol válido. Contacta al administrador." });
        return;
      }
      onAuthenticated({ user, role: userDoc.role, profile: userDoc });
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setFeedback({ type: "error", text: "No fue posible autenticar con Google en este momento." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!loginEmail) {
      setFeedback({ type: "error", text: "Escribe tu correo arriba para enviarte el enlace de recuperación." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setFeedback({ type: "success", text: `Enlace de recuperación enviado a ${loginEmail}.` });
    } catch {
      setFeedback({ type: "error", text: "No pudimos enviar el correo de recuperación. Revisa el correo ingresado." });
    }
  };

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };
  const averageReviewRating = publicReviews.length
    ? publicReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / publicReviews.length
    : null;

  return (
    <div className="landing-root">
      {/* ---------- HEADER DE NAVEGACIÓN COMERCIAL ---------- */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src="/img/logo.svg" alt="Home" className="landing-logo-img" />
            <div className="landing-brand-text">
              <strong>HOME</strong>
              <span>Servicios para el Hogar</span>
            </div>
          </div>

          <nav className="landing-nav desktop-only">
            <button onClick={() => scrollTo("servicios")}>Servicios</button>
            <button onClick={() => scrollTo("como-funciona")}>¿Cómo funciona?</button>
            <button onClick={() => scrollTo("calculadora")}>Cotizador</button>
            <button onClick={() => scrollTo("profesionales")}>Profesionales</button>
            <button onClick={() => scrollTo("garantia")}>Garantía</button>
            <button onClick={() => scrollTo("testimonios")}>Opiniones</button>
          </nav>

          <div className="landing-actions desktop-only">
            <button className="landing-btn-pro" onClick={() => openAuth("register", "trabajador")}>
              <IconBadge size={16} />
              <span>Soy Profesional</span>
            </button>
            <button className="landing-btn-primary" onClick={() => openAuth("login")}>
              Iniciar sesión
            </button>
          </div>

          <button
            className="landing-burger mobile-only"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <IconX size={24} /> : <IconMenu size={24} />}
          </button>
        </div>

        {/* Menú móvil */}
        {mobileMenuOpen && (
          <div className="landing-mobile-drawer">
            <button onClick={() => scrollTo("servicios")}>Servicios disponibles</button>
            <button onClick={() => scrollTo("como-funciona")}>¿Cómo funciona?</button>
            <button onClick={() => scrollTo("calculadora")}>Calculadora de precios</button>
            <button onClick={() => scrollTo("profesionales")}>Profesionales verificados</button>
            <button onClick={() => scrollTo("garantia")}>Garantía Home de 30 días</button>
            <button onClick={() => scrollTo("testimonios")}>Opiniones de clientes</button>
            <hr className="landing-drawer-hr" />
            <button
              className="landing-btn-pro"
              style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
              onClick={() => openAuth("register", "trabajador")}
            >
              <IconBadge size={16} />
              <span>Trabaja como Profesional</span>
            </button>
            <button
              className="landing-btn-primary"
              style={{ width: "100%" }}
              onClick={() => openAuth("login")}
            >
              Iniciar sesión / Registrarme
            </button>
          </div>
        )}
      </header>

      {/* ---------- HERO SECTION CON FOTOGRAFÍA PROFESIONAL DE ALTA CALIDAD ---------- */}
      <section
        className="landing-hero"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(23, 19, 16, 0.88) 0%, rgba(23, 19, 16, 0.6) 50%, rgba(23, 19, 16, 0.85) 100%), url(/img/real/hero-home.jpg)",
        }}
      >
        <div className="landing-hero-content">
          <div className="landing-trust-badge">
            <IconShield size={16} />
            <span>Red Oficial de Servicios Certificados para el Hogar en Medellín</span>
          </div>

          <h1 className="landing-hero-title">
            Tu hogar en manos de profesionales <span className="highlight">reales y verificados</span>.
          </h1>

          <p className="landing-hero-subtitle">
            Encuentra plomeros, electricistas, pintores, carpinteros y expertos en remodelación. Precios justos sin
            sorpresas y <strong>Garantía de Satisfacción de 30 días</strong> en cada servicio.
          </p>

          {/* Buscador interactivo en Hero */}
          <div className="landing-search-card">
            <div className="landing-search-field">
              <label>¿Qué servicio necesitas?</label>
              <select value={searchCat} onChange={(e) => setSearchCat(e.target.value)}>
                <option value="todas">Todos los servicios</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="landing-search-field">
              <label>Zona o barrio</label>
              <select value={searchZone} onChange={(e) => setSearchZone(e.target.value)}>
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <button className="landing-search-btn" onClick={() => openAuth("login")}>
              <IconSearch size={18} />
              <span>Ver profesionales</span>
            </button>
          </div>

          {/* Métricas destacadas */}
          <div className="landing-hero-stats">
            <div className="hero-stat-item">
              <strong>{publicWorkers.length}</strong>
              <span>Profesionales aprobados</span>
            </div>
            <div className="hero-stat-sep" />
            <div className="hero-stat-item">
              <strong>{averageReviewRating === null ? "—" : `${averageReviewRating.toFixed(1)} / 5 ★`}</strong>
              <span>{publicReviews.length ? `${publicReviews.length} reseñas registradas` : "Sin reseñas publicadas"}</span>
            </div>
            <div className="hero-stat-sep" />
            <div className="hero-stat-item">
              <strong>30 días</strong>
              <span>Garantía de mano de obra</span>
            </div>
            <div className="hero-stat-sep" />
            <div className="hero-stat-item">
              <strong>Manual</strong>
              <span>Revisión de documentos</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- SECCIÓN DE SERVICIOS / MÓDULOS CON FOTOGRAFÍA PROFESIONAL ---------- */}
      <section id="servicios" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-pill-tag">Módulos Especializados</span>
            <h2>Servicios profesionales con fotos y precios reales</h2>
            <p>
              Técnicos especialistas evaluados con antecedentes, matrículas profesionales y garantía escrita.
            </p>
          </div>

          <div className="landing-categories-grid">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="landing-cat-card"
                onClick={() => openAuth("login")}
              >
                <div className="landing-cat-image-wrap">
                  <img src={cat.img} alt={cat.name} loading="lazy" />
                  <span className="landing-cat-tag">{cat.tag}</span>
                  <div className="landing-cat-overlay">
                    <span>{publicWorkers.filter((worker) => worker.cat === cat.id).length} profesionales aprobados</span>
                  </div>
                </div>
                <div className="landing-cat-content">
                  <div className="landing-cat-title-row">
                    <h3>
                      {cat.emoji} {cat.name}
                    </h3>
                    <span className="landing-cat-price">Desde {fmtCOP(cat.from)}/h</span>
                  </div>
                  <p>{cat.desc}</p>
                  <button className="landing-cat-link">
                    <span>Solicitar cotización</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CALCULADORA DE PRECIOS INTERACTIVA ---------- */}
      <section id="calculadora" className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-calculator-card">
            <div className="calc-left">
              <span className="landing-pill-tag">
                <IconCalculator size={14} /> Cotizador Estimado al Instante
              </span>
              <h2>¿Cuánto cuesta tu arreglo o remodelación?</h2>
              <p>
                Selecciona el tipo de trabajo para consultar el rango promedio de precios cobrado por nuestros
                técnicos en Medellín.
              </p>

              <div className="calc-select-wrap">
                <label>Selecciona el trabajo que necesitas:</label>
                <select
                  value={selectedEstimate.id}
                  onChange={(e) =>
                    setSelectedEstimate(ESTIMATE_OPTIONS.find((o) => o.id === e.target.value))
                  }
                  className="calc-select"
                >
                  {ESTIMATE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.cat}: {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="calc-guarantee-perk">
                <IconCheck size={18} />
                <span>Incluye 30 días de Garantía Home y visita con diagnóstico profesional.</span>
              </div>
            </div>

            <div className="calc-right">
              <div className="calc-result-box">
                <span className="calc-result-label">Rango Estimado de Mano de Obra:</span>
                <div className="calc-price-range">
                  {fmtCOP(selectedEstimate.min)} - {fmtCOP(selectedEstimate.max)}
                </div>
                <span className="calc-currency">Pesos Colombianos (COP)</span>
                <p className="calc-notes">
                  * Precio de referencia promedio en Medellín. La cotización final se confirma según el estado
                  específico de la instalación.
                </p>
                <button
                  className="landing-btn-primary calc-cta"
                  onClick={() => openAuth("login")}
                >
                  Reservar este servicio ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CÓMO FUNCIONA HOME ---------- */}
      <section id="como-funciona" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-pill-tag">Simple y Rápido</span>
            <h2>Cómo funciona la plataforma Home</h2>
            <p>En tan solo tres pasos tienes al profesional ideal trabajando en tu hogar con total seguridad.</p>
          </div>

          <div className="landing-steps-grid">
            <div className="landing-step-card">
              <div className="step-number">01</div>
              <h3>Pide tu servicio</h3>
              <p>
                Elige la especialidad, describe lo que necesitas reparar o instalar y adjunta fotos de referencia de
                tu espacio.
              </p>
            </div>
            <div className="landing-step-card">
              <div className="step-number">02</div>
              <h3>Elige al mejor técnico</h3>
              <p>
                Revisa perfiles aprobados con fotos reales de trabajos anteriores, calificaciones de vecinos y tarifas
                transparentes por hora.
              </p>
            </div>
            <div className="landing-step-card">
              <div className="step-number">03</div>
              <h3>Paga contra satisfacción</h3>
              <p>
                El profesional realiza el trabajo a tiempo. Validas que todo quedó perfecto y cuentas con 30 días de
                Garantía Home.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- PROFESIONALES DESTACADOS (FOTOS REALES Y PORTAFOLIOS) ---------- */}
      <section id="profesionales" className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-pill-tag">Equipo Certificado</span>
            <h2>Profesionales destacados del mes</h2>
            <p>Conoce algunos de los técnicos independientes mejor valorados por familias en Medellín.</p>
          </div>

          <div className="landing-workers-grid">
            {publicWorkers.length === 0 && (
              <div className="landing-catalog-empty">
                <strong>Aún no hay profesionales aprobados</strong>
                <span>Los perfiles aparecerán aquí después de que el administrador revise y apruebe sus documentos.</span>
              </div>
            )}
            {publicWorkers.slice(0, 4).map((w) => (
              <div key={w.id} className="landing-worker-card">
                <div className="landing-worker-header">
                  <img src={w.photo || "/img/logo.svg"} alt={w.name} className="landing-worker-avatar" loading="lazy" />
                  <div>
                    <h4>{w.name}</h4>
                    <span className="worker-spec">
                      {CATEGORIES.find((c) => c.id === w.cat)?.name} · {w.zone}
                    </span>
                    <div className="worker-verified-tag">
                      <IconShield size={13} />
                      <span>Verificado y Aprobado</span>
                    </div>
                  </div>
                </div>

                <div className="landing-worker-stats">
                  <div>
                    <strong>{Number(w.rating) > 0 ? `${Number(w.rating).toFixed(1)} ★` : "—"}</strong>
                    <span>{Number(w.jobs) || 0} trabajos completados</span>
                  </div>
                  <div>
                    <strong>{w.years} años</strong>
                    <span>experiencia</span>
                  </div>
                  <div>
                    <strong>{fmtCOP(w.rate)}</strong>
                    <span>tarifa/h</span>
                  </div>
                </div>

                <p className="landing-worker-bio">{w.bio}</p>

                {w.portfolio && (
                  <div className="landing-worker-portfolio">
                    {w.portfolio.slice(0, 3).map((img, i) => (
                      <img key={i} src={img} alt="Trabajo realizado" loading="lazy" />
                    ))}
                  </div>
                )}

                <button
                  className="landing-btn-secondary"
                  onClick={() => openAuth("login")}
                >
                  Solicitar a {w.name.split(" ")[0]}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- GARANTÍA HOME ---------- */}
      <section id="garantia" className="landing-section">
        <div className="landing-container">
          <div className="landing-guarantee-card">
            <div className="guarantee-icon-huge">
              <IconShield size={56} />
            </div>
            <div className="guarantee-content">
              <span className="landing-pill-tag" style={{ background: "#e6faf7", color: "#006a63" }}>
                Garantía Home 100% Protegida
              </span>
              <h2>¿Por qué Home es la opción más segura de Colombia?</h2>
              <p>
                Eliminamos la incertidumbre de contratar personas desconocidas sin respaldo. Con Home, tu inversión
                y tu familia están 100% protegidas:
              </p>
              <div className="guarantee-points">
                <div className="guarantee-item">
                  <IconCheck size={20} />
                  <div>
                    <strong>Validación rigurosa de identidad</strong>
                    <p>Revisión exhaustiva de cédula, antecedentes policiales y antecedentes judiciales.</p>
                  </div>
                </div>
                <div className="guarantee-item">
                  <IconCheck size={20} />
                  <div>
                    <strong>30 días de cobertura total</strong>
                    <p>Si la reparación presenta cualquier falla, se corrige de inmediato sin costo.</p>
                  </div>
                </div>
                <div className="guarantee-item">
                  <IconCheck size={20} />
                  <div>
                    <strong>Precios pactados y transparentes</strong>
                    <p>Cotizaciones claras sin cobros ocultos ni aumentos imprevistos.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- TESTIMONIOS REALES CON FOTOS ---------- */}
      <section id="testimonios" className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-pill-tag">Experiencias Reales</span>
            <h2>Lo que dicen nuestros clientes en Medellín</h2>
            <p>Consulta las reseñas que los clientes publiquen después de completar sus servicios con HOME.</p>
          </div>

          <div className="landing-reviews-grid">
            {publicReviews.map((rev) => (
              <div key={rev.id} className="landing-review-card">
                <div className="review-stars">
                  {[...Array(rev.rating)].map((_, i) => (
                    <IconStar key={i} size={16} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <p className="review-quote">«{rev.text}»</p>
                <div className="review-author">
                  <img src={rev.photo || "/img/logo.svg"} alt={rev.client || "Cliente HOME"} className="review-avatar" loading="lazy" />
                  <div>
                    <strong>{rev.client}</strong>
                    <span>Cliente verificado en Antioquia</span>
                  </div>
                </div>
              </div>
            ))}
            {publicReviews.length === 0 && (
              <div className="landing-catalog-empty">
                <strong>Aún no hay reseñas publicadas</strong>
                <span>Las opiniones aparecerán cuando existan servicios completados y calificados.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- CTA PARA PROFESIONALES ---------- */}
      <section className="landing-pro-cta">
        <div className="landing-container">
          <div className="pro-cta-card">
            <div className="pro-cta-left">
              <h2>¿Eres técnico o contratista profesional?</h2>
              <p>
                Únete a la red más confiable de servicios para el hogar de Colombia. Accede a cientos de clientes
                nuevos, gestiona tu agenda y descarga tus reportes de ganancias en Excel.
              </p>
              <button
                className="landing-btn-primary pro-cta-btn"
                onClick={() => openAuth("register", "trabajador")}
              >
                Comenzar a trabajar con Home
              </button>
            </div>
            <div className="pro-cta-perks">
              <div className="pro-perk">
                <strong>Comisión justa (15%)</strong>
                <span>El 85% de cada labor va directo a tus ganancias</span>
              </div>
              <div className="pro-perk">
                <strong>Reportes en Excel</strong>
                <span>Descarga tus ingresos detallados en .xlsx con 1 clic</span>
              </div>
              <div className="pro-perk">
                <strong>Agenda flexible</strong>
                <span>Trabaja en los horarios y zonas que elijas en Medellín</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER COMPLETO Y PROFESIONAL ---------- */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top-grid">
            <div className="footer-brand-col">
              <div className="landing-brand">
                <img src="/img/logo.svg" alt="Home" className="landing-logo-img" />
                <div className="landing-brand-text">
                  <strong>HOME</strong>
                  <span>Servicios para el Hogar</span>
                </div>
              </div>
              <p className="footer-desc">
                La plataforma líder que conecta hogares y empresas con profesionales verificados en plomería,
                electricidad, pintura, climatización, carpintería y remodelaciones.
              </p>
              <div className="footer-location">
                <IconShield size={16} />
                <span>Medellín, Antioquia, Colombia</span>
              </div>
            </div>

            <div className="footer-col">
              <h4>Servicios</h4>
              <ul>
                {CATEGORIES.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <a
                      href="#servicios"
                      onClick={(e) => {
                        e.preventDefault();
                        scrollTo("servicios");
                      }}
                    >
                      {c.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-col">
              <h4>Zonas de Cobertura</h4>
              <ul>
                {ZONES.slice(0, 5).map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            </div>

            <div className="footer-col">
              <h4>Garantía y Seguridad</h4>
              <ul>
                <li>
                  <a href="#garantia" onClick={() => scrollTo("garantia")}>
                    Garantía Home de 30 días
                  </a>
                </li>
                <li>
                  <a href="#como-funciona" onClick={() => scrollTo("como-funciona")}>
                    Verificación de antecedentes
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openAuth("register", "trabajador");
                    }}
                  >
                    Vincularte como profesional
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <span>© 2026 Home Marketplace S.A.S. Todos los derechos reservados. NIT 901.845.291-3</span>
            <div className="footer-links">
              <a href="#">Términos del Servicio</a>
              <a href="#">Política de Privacidad</a>
              <a href="#">Tratamiento de Datos</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ---------- MODAL DE AUTENTICACIÓN CON SLIDER DESLIZANTE CORREGIDO ---------- */}
      {authModalOpen && (
        <div className="auth-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="auth-close-btn"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Cerrar modal"
            >
              <IconX size={20} />
            </button>

            {/* SLIDER DE PESTAÑAS (INICIAR SESIÓN / REGISTRARSE) - CORREGIDO ESTRUCTURALMENTE */}
            <div className="auth-slider-track" role="tablist">
              <div
                className="auth-slider-indicator"
                style={{
                  transform: mode === "login" ? "translateX(0%)" : "translateX(100%)",
                }}
              />
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`auth-slider-button ${mode === "login" ? "active" : ""}`}
                onClick={() => {
                  setMode("login");
                  setFeedback(null);
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={`auth-slider-button ${mode === "register" ? "active" : ""}`}
                onClick={() => {
                  setMode("register");
                  setFeedback(null);
                }}
              >
                Crear cuenta
              </button>
            </div>

            {feedback && (
              <div className={`auth-feedback ${feedback.type}`}>
                {feedback.type === "error" ? <IconAlert size={18} /> : <IconCheck size={18} />}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* VISTA: INICIAR SESIÓN (UNIVERSAL) */}
            {mode === "login" ? (
              <div>
                <h3 className="auth-title">Bienvenido a Home</h3>
                <p className="auth-subtitle">
                  Ingresa tu correo y contraseña. El sistema te dirigirá automáticamente a tu panel correspondiente.
                </p>

                <form onSubmit={handleLoginSubmit}>
                  <div className="auth-field">
                    <label>Correo electrónico</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">
                        <IconMail size={18} />
                      </span>
                      <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field">
                    <div className="auth-label-row">
                      <label>Contraseña</label>
                      <a href="#" onClick={handleForgotPassword}>
                        ¿Olvidaste tu contraseña?
                      </a>
                    </div>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">
                        <IconLock size={18} />
                      </span>
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="auth-trail-btn"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        aria-label="Ver u ocultar contraseña"
                      >
                        {showLoginPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                    />
                    <span>Recordar sesión en este dispositivo</span>
                  </label>

                  <button className="auth-submit-btn" type="submit" disabled={loading}>
                    <span>{loading ? "Verificando credenciales..." : "Ingresar a mi cuenta"}</span>
                  </button>
                </form>

                <div className="auth-divider">
                  <span>o continúa con</span>
                </div>

                <button
                  className="auth-google-btn"
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.4 34.7 26.9 35.5 24 35.5c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.1 5.4-5.8 6.9l6.5 5.4C39.9 37 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"
                    />
                  </svg>
                  <span>Continuar con Google</span>
                </button>
              </div>
            ) : (
              /* VISTA: REGISTRO PÚBLICO (CLIENTE O PROFESIONAL) */
              <div>
                <h3 className="auth-title">Crea tu cuenta en Home</h3>
                <p className="auth-subtitle">Regístrate para solicitar servicios o comenzar a trabajar.</p>

                <div className="auth-role-selector">
                  <label className={`auth-role-card ${registerRole === "cliente" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="registerRole"
                      value="cliente"
                      checked={registerRole === "cliente"}
                      onChange={() => setRegisterRole("cliente")}
                    />
                    <div>
                      <strong>Quiero contratar</strong>
                      <span>Busco servicios para mi hogar</span>
                    </div>
                  </label>
                  <label className={`auth-role-card ${registerRole === "trabajador" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="registerRole"
                      value="trabajador"
                      checked={registerRole === "trabajador"}
                      onChange={() => setRegisterRole("trabajador")}
                    />
                    <div>
                      <strong>Quiero trabajar</strong>
                      <span>Ofrezco mis servicios técnicos</span>
                    </div>
                  </label>
                </div>

                <form onSubmit={handleRegisterSubmit}>
                  <div className="auth-field">
                    <label>Nombre y apellido completo</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">
                        <IconPerson size={18} />
                      </span>
                      <input
                        type="text"
                        placeholder="Ej. Laura García Méndez"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-form-row">
                    <div className="auth-field">
                      <label>Correo electrónico</label>
                      <div className="auth-input-wrap">
                        <span className="auth-input-icon">
                          <IconMail size={18} />
                        </span>
                        <input
                          type="email"
                          placeholder="correo@ejemplo.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label>Teléfono celular (WhatsApp)</label>
                      <div className="auth-input-wrap">
                        <span className="auth-input-icon">
                          <IconPhone size={18} />
                        </span>
                        <input
                          type="tel"
                          placeholder="+57 300 123 4567"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Campos adicionales para profesional */}
                  {registerRole === "trabajador" && (
                    <div className="auth-worker-extra-fields">
                      <div className="auth-form-row">
                        <div className="auth-field">
                          <label>Especialidad principal</label>
                          <select
                            className="auth-select"
                            value={workerCat}
                            onChange={(e) => setWorkerCat(e.target.value)}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="auth-field">
                          <label>Zona de cobertura principal</label>
                          <select
                            className="auth-select"
                            value={workerZone}
                            onChange={(e) => setWorkerZone(e.target.value)}
                          >
                            {ZONES.map((z) => (
                              <option key={z} value={z}>
                                {z}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="auth-form-row">
                        <div className="auth-field">
                          <label>Tarifa base por hora (COP)</label>
                          <input
                            type="number"
                            className="auth-input"
                            value={workerRate}
                            onChange={(e) => setWorkerRate(e.target.value)}
                            min="20000"
                            step="5000"
                            required
                          />
                        </div>
                        <div className="auth-field">
                          <label>Años de experiencia</label>
                          <input
                            type="number"
                            className="auth-input"
                            value={workerYears}
                            onChange={(e) => setWorkerYears(e.target.value)}
                            min="1"
                            max="40"
                            required
                          />
                        </div>
                      </div>

                      <div className="auth-field">
                        <label>Hoja de vida (obligatoria)</label>
                        <div className="auth-file-box">
                          <IconFileText size={20} />
                          <span className="auth-file-name">{workerCvFile?.name || "Adjunta tu hoja de vida"}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="auth-file-input"
                            id="cv-upload"
                            onChange={(e) => setWorkerCvFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="cv-upload" className="auth-file-upload-btn">Examinar...</label>
                        </div>
                      </div>

                      <div className="auth-field">
                        <label>Certificado técnico (obligatorio)</label>
                        <div className="auth-file-box">
                          <IconFileText size={20} />
                          <span className="auth-file-name">{workerCertificateFile?.name || "Adjunta tu certificado"}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="auth-file-input"
                            id="certificate-upload"
                            onChange={(e) => setWorkerCertificateFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="certificate-upload" className="auth-file-upload-btn">Examinar...</label>
                        </div>
                        <span className="auth-hint">PDF o foto (JPG/PNG), máximo 700 KB cada uno; las fotos se comprimen solas. Los documentos son privados: solo tú y el administrador pueden verlos. Tu perfil quedará pendiente hasta que el administrador decida.</span>
                      </div>
                    </div>
                  )}

                  <div className="auth-field">
                    <label>Contraseña</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">
                        <IconLock size={18} />
                      </span>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-trail-btn"
                        onClick={() => setShowRegPassword((v) => !v)}
                        aria-label="Ver u ocultar contraseña"
                      >
                        {showRegPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      required
                    />
                    <span>
                      Acepto los <a href="#">Términos del Servicio</a> y la{" "}
                      <a href="#">Garantía Home de 30 días</a>.
                    </span>
                  </label>

                  <button className="auth-submit-btn" type="submit" disabled={loading}>
                    <span>
                      {loading
                        ? "Registrando..."
                        : registerRole === "trabajador"
                        ? "Enviar postulación como profesional"
                        : "Crear mi cuenta"}
                    </span>
                  </button>
                </form>
              </div>
            )}

            <div className="auth-modal-footer">
              <IconShield size={14} />
              <span>Conexión cifrada SSL · Protección de datos personales (Ley 1581)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
