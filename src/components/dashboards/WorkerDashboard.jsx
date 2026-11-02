import React, { useMemo, useState } from "react";
import Shell from "../ui/Shell.jsx";
import { Icon } from "../ui/Icons.jsx";
import { Avatar, AreaChart, Badge, Card, Empty, Modal, StatCard, Stars, useToast } from "../ui/Kit.jsx";
import { useStore } from "../../data/store.jsx";
import { ZONES } from "../../data/seed.js";
import { fmtCOP, fmtDate, lookFor, today } from "../../data/utils.js";
import { exportWorkerEarningsExcel } from "../../data/excelExport.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, firebaseConfigured } from "../../firebase.js";
import { saveUserProfile } from "../../services/db.js";

const normalizeCommissionRate = (value, fallback = 0.15) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number > 1 ? number / 100 : number;
};

const safeFixed = (value, decimals = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : (0).toFixed(decimals);
};

export default function WorkerDashboard({ session, onLogout }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [section, setSection] = useState("resumen");
  const [quote, setQuote] = useState(null);
  const userId = session?.user?.uid || "";

  const me = state.workers.find((w) => w.id === userId) || {
    id: userId,
    uid: userId,
    ...(session?.profile || {}),
    name: session?.profile?.name || session?.user?.displayName || session?.user?.email?.split("@")[0] || "Profesional",
    email: session?.user?.email || session?.profile?.email || "",
    cat: session?.profile?.cat || "",
    zone: session?.profile?.zone || "",
    rate: Number(session?.profile?.rate || 0),
    years: Number(session?.profile?.years || 0),
    jobs: Number(session?.profile?.jobs || 0),
    rating: Number(session?.profile?.rating || 0),
    approvalStatus: session?.profile?.approvalStatus || "pendiente_revision",
    status: session?.profile?.approvalStatus === "aprobado" && session?.profile?.status === "activo"
      ? "activo"
      : session?.profile?.status === "suspendido" ? "suspendido" : "pendiente",
  };
  const mine = useMemo(() => state.requests.filter((r) => r.workerId === userId), [state.requests, userId]);
  const client = (id) => state.clients.find((c) => c.id === id);
  const cat = state.categories.find((c) => c.id === me.cat);
  const pending = mine.filter((r) => r.status === "pendiente");
  const agenda = mine.filter((r) => ["aceptada", "en_progreso"].includes(r.status));
  const done = mine.filter((r) => r.status === "completada");
  const myReviews = state.reviews.filter((v) => v.workerId === userId);

  const commissionRate = Number(state.settings?.commission ?? 15);
  const requestCommission = (r) => r.homeCommission != null
    ? Number(r.homeCommission)
    : Math.round((Number(r.price) || 0) * normalizeCommissionRate(r.commissionRate, commissionRate / 100));
  const requestNet = (r) => r.workerEarnings != null
    ? Number(r.workerEarnings)
    : Math.max(0, (Number(r.price) || 0) - requestCommission(r));
  const totalBilled = done.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  const totalCommission = done.reduce((sum, r) => sum + requestCommission(r), 0);
  const totalNetEarnings = done.reduce((sum, r) => sum + requestNet(r), 0);
  const now = new Date();
  const income = Array.from({ length: 6 }, (_, index) => {
    const offset = index - 5;
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = done.reduce((sum, request) => {
      const rawDate = request.completedAt || request.updatedAt || request.date || request.created;
      const requestDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || "");
      if (Number.isNaN(requestDate.getTime())) return sum;
      if (requestDate.getFullYear() !== date.getFullYear() || requestDate.getMonth() !== date.getMonth()) return sum;
      return sum + requestNet(request);
    }, 0);
    return { m: date.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""), v: value };
  });
  const currentMonth = done.reduce((sum, request) => {
    const rawDate = request.completedAt || request.updatedAt || request.date || request.created;
    const requestDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || "");
    return !Number.isNaN(requestDate.getTime()) && requestDate.getFullYear() === now.getFullYear() && requestDate.getMonth() === now.getMonth()
      ? sum + requestNet(request) : sum;
  }, 0);

  const patch = (id, p) => dispatch({ type: "setRequest", id, patch: p });
  const complete = (r) => {
    patch(r.id, { status: "completada", completedAt: new Date().toISOString() });
    dispatch({ type: "updateWorker", id: userId, patch: { jobs: me.jobs + 1 } });
    toast("¡Trabajo completado! Se registró en tus ingresos.");
  };

  const nav = [
    { id: "resumen", label: "Resumen", icon: "grid" },
    { id: "solicitudes", label: "Solicitudes nuevas", icon: "bell", badge: pending.length },
    { id: "agenda", label: "Mi agenda", icon: "calendar", badge: agenda.length },
    { id: "ganancias", label: "Mis ganancias", icon: "dollar" },
    { id: "resenas", label: "Reseñas", icon: "star" },
    { id: "perfil", label: "Mi perfil", icon: "user" },
  ];

  const titles = {
    resumen: [`¡Hola, ${me.name.split(" ")[0]}! 👷`, "Así va tu negocio esta semana en Medellín"],
    solicitudes: ["Solicitudes de clientes", "Responde rápido para asegurar más contratos"],
    agenda: ["Mi agenda de servicios", "Tus trabajos programados y en curso"],
    ganancias: ["Mis ganancias e ingresos", "Liquidaciones, comisiones de HOME y exportación en Excel"],
    resenas: ["Reseñas y reputación", "Lo que dicen tus clientes verificados"],
    perfil: ["Mi perfil profesional", "Así ven tu perfil y portafolio los clientes"],
  };

  const notifications = state.settings?.notifyInApp === false ? [] : pending.map((r) => ({
    id: r.id,
    icon: "bell",
    text: `Nueva solicitud de ${client(r.clientId)?.name}: ${r.title}`,
    time: fmtDate(r.date),
  }));

  const handleDownloadExcel = () => {
    try {
      exportWorkerEarningsExcel(me, done);
      toast("Libro de Excel (.xlsx) generado y descargado exitosamente");
    } catch (e) {
      console.error("Error al exportar a Excel:", e);
      toast("Error al generar el archivo Excel");
    }
  };

  return (
    <Shell
      role="trabajador"
      nav={nav}
      active={section}
      onNav={setSection}
      onLogout={onLogout}
      user={{ name: me.name, look: me.look, photo: me.photo }}
      title={titles[section][0]}
      subtitle={titles[section][1]}
      notifications={notifications}
    >
      {/* Alerta de estado de revisión documental */}
      {me.approvalStatus === "pendiente_revision" && (
        <div className="hd-doc-alert info" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>⏳</span>
            <div>
              <strong style={{ fontSize: 15, display: "block" }}>Perfil en proceso de revisión documental</strong>
              <span style={{ fontSize: 13, color: "#5a4138" }}>
                El equipo administrativo de HOME está validando tu hoja de vida y certificados ({me.cvFile || "Documento adjunto"}).
                Tan pronto sea aprobado, aparecerás visible para clientes en el catálogo público.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* RECUADRO DE CORRECCIONES CON MOTIVO DINÁMICO DESDE FIRESTORE */}
      {me.approvalStatus === "requiere_correcciones" && (
        <div className="hd-doc-alert warning" style={{ marginBottom: 20, borderLeft: "5px solid #d97706", background: "#fff9e6", padding: "15px", borderRadius: "6px" }}>
          <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 15, display: "block", color: "#d97706" }}>Se requieren modificaciones en tu inscripción</strong>
              
              <p style={{ fontSize: 14, margin: "8px 0", color: "#b45309", fontWeight: "600", backgroundColor: "#fef3c7", padding: "10px", borderRadius: "4px" }}>
                Motivo del rechazo: "{me.approvalNotes || "Por favor, revisa tus documentos adjuntos e intenta subirlos nuevamente."}"
              </p>

              <span style={{ fontSize: 13, color: "#5a4138", display: "block", marginBottom: 15 }}>
                Por favor, corrige el documento solicitado abajo para volver a postular tu perfil al catálogo de HOME.
              </span>

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // CAPTURA CORRECTA DE ARCHIVOS EN REACT/VITE
                  const hvFile = document.getElementById("hoja-vida-file")?.files[0];
                  const certFile = document.getElementById("certificado-file")?.files[0];

                  if (!hvFile && !certFile) {
                    toast("Por favor, selecciona al menos un archivo para actualizar.");
                    return;
                  }

                  toast("Subiendo documentos actualizados...");
                  let updates = { approvalStatus: "pendiente_revision" };

                  // PARCHE DE CORS: Se le inyecta el tipo de contenido (metadata) explícito
                  if (hvFile) {
                    const hvRef = storageRef(storage, `professional-documents/${userId}/hoja_de_vida_${Date.now()}_${hvFile.name}`);
                    const metadata = { contentType: hvFile.type };
                    const snap = await uploadBytes(hvRef, hvFile, metadata);
                    updates.cvFile = await getDownloadURL(snap.ref);
                  }

                  if (certFile) {
                    const certRef = storageRef(storage, `professional-documents/${userId}/certificado_${Date.now()}_${certFile.name}`);
                    const metadata = { contentType: certFile.type };
                    const snap = await uploadBytes(certRef, certFile, metadata);
                    updates.certificateFile = await getDownloadURL(snap.ref);
                  }

                  await saveUserProfile(userId, updates);
                  toast("¡Documentos re-enviados con éxito! Tu perfil está en revisión otra vez.");
                  window.location.reload();

                } catch (error) {
                  console.error("Error al subir correcciones:", error);
                  toast(`Error al subir: ${error.message}`);
                }
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: "400px" }}>
                  <label style={{ fontSize: 12, fontWeight: "bold" }}>Nueva Hoja de Vida (Opcional):</label>
                  <input type="file" id="hoja-vida-file" accept=".pdf,.png,.jpg,.jpeg" />
                  
                  <label style={{ fontSize: 12, fontWeight: "bold", marginTop: 5 }}>Nuevo Certificado Técnico (Opcional):</label>
                  <input type="file" id="certificado-file" accept=".pdf,.png,.jpg,.jpeg" />
                  
                  <button type="submit" style={{ marginTop: 12, padding: "8px 15px", backgroundColor: "#d97706", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                    Enviar Correcciones para Revisión
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RENDERIZADO DE LAS SECCIONES DEL DASHBOARD */}
      {section === "resumen" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <StatCard title="Ingresos Netos" value={fmtCOP(totalNetEarnings)} icon="dollar" trend="+12%" color="green" />
            <StatCard title="Servicios Hechos" value={me.jobs} icon="check" color="blue" />
            <StatCard title="Calificación" value={`${safeFixed(me.rating)} / 5`} icon="star" color="yellow" />
            <StatCard title="Este Mes" value={fmtCOP(currentMonth)} icon="calendar" color="purple" />
          </div>
          <Card title="Evolución de Ganancias (Últimos 6 meses)">
            <AreaChart data={income} xKey="m" yKey="v" formatY={fmtCOP} />
          </Card>
        </div>
      )}

      {section === "solicitudes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {pending.length === 0 ? (
            <Empty title="No tienes solicitudes nuevas" subtitle="Te avisaremos por notificación cuando un cliente te contacte" icon="bell-off" />
          ) : (
            pending.map((r) => (
              <Card key={r.id} className="request-card">
                <div style={{ display: "flex", justifyContent: "between", alignItems: "start", width: "100%" }}>
                  <div>
                    <Badge text={cat?.name || "Servicio"} color="orange" />
                    <h4 style={{ marginTop: 8, fontSize: 16, fontWeight: "bold" }}>{r.title}</h4>
                    <p style={{ fontSize: 14, color: "#666" }}>{r.desc}</p>
                    <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "#888" }}>
                      <span>📍 {r.zone || me.zone}</span>
                      <span>📅 {fmtDate(r.date)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 18, fontWeight: "bold", color: "#10b981", display: "block" }}>{fmtCOP(r.price)}</span>
                    <button onClick={() => patch(r.id, { status: "aceptada", workerId: userId })} style={{ marginTop: 12, padding: "6px 12px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Aceptar</button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {section === "agenda" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {agenda.length === 0 ? (
            <Empty title="Tu agenda está libre" subtitle="Acepta solicitudes entrantes para llenar tu calendario" icon="calendar" />
          ) : (
            agenda.map((r) => (
              <Card key={r.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <Badge text={r.status === "en_progreso" ? "En Progreso" : "Programado"} color={r.status === "en_progreso" ? "blue" : "green"} />
                    <h4 style={{ marginTop: 4, fontWeight: "bold" }}>{r.title}</h4>
                    <p style={{ fontSize: 13, color: "#555" }}>Cliente: {client(r.clientId)?.name} | 📞 {client(r.clientId)?.phone}</p>
                    <span style={{ fontSize: 12, color: "#999" }}>Fecha pactada: {fmtDate(r.date)}</span>
                  </div>
                  <div>
                    {r.status === "aceptada" ? (
                      <button onClick={() => patch(r.id, { status: "en_progreso" })} style={{ padding: "6px 12px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Iniciar Trabajo</button>
                    ) : (
                      <button onClick={() => complete(r)} style={{ padding: "6px 12px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Terminar Trabajo</button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {section === "ganancias" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: "bold" }}>Historial de Liquidaciones</h3>
              <p style={{ fontSize: 13, color: "#666" }}>Resumen contable de tus trabajos realizados y comisiones aplicadas</p>
            </div>
            <button onClick={handleDownloadExcel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}>
              <Icon name="download" /> Exportar reporte (.xlsx)
            </button>
          </div>
          <Card>
            {done.length === 0 ? (
              <p style={{ textAlign: "center", padding: 20, color: "#888" }}>No registras contratos liquidados todavía.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee", textAlign: "left", color: "#666" }}>
                    <th style={{ padding: 10 }}>Fecha</th>
                    <th style={{ padding: 10 }}>Servicio realizado</th>
                    <th style={{ padding: 10 }}>Valor Bruto</th>
                    <th style={{ padding: 10 }}>Comisión HOME ({commissionRate}%)</th>
                    <th style={{ padding: 10 }}>Ganancia Neta</th>
                  </tr>
                </thead>
                <tbody>
                  {done.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: 10, color: "#777" }}>{fmtDate(r.completedAt || r.date)}</td>
                      <td style={{ padding: 10, fontWeight: "500" }}>{r.title}</td>
                      <td style={{ padding: 10, color: "#000" }}>{fmtCOP(r.price)}</td>
                      <td style={{ padding: 10, color: "#ef4444" }}>-{fmtCOP(requestCommission(r))}</td>
                      <td style={{ padding: 10, fontWeight: "bold", color: "#10b981" }}>{fmtCOP(requestNet(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {section === "resenas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 32, alignItems: "center", backgroundColor: "#f9fafb", padding: 20, borderRadius: 8 }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 44, fontWeight: "bold", color: "#111" }}>{safeFixed(me.rating)}</h2>
              <Stars count={5} value={me.rating} size={20} edit={false} />
              <span style={{ fontSize: 12, color: "#666", display: "block", marginTop: 4 }}>{myReviews.length} opiniones</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = myReviews.filter((v) => Math.round(v.stars) === stars).length;
                const pct = myReviews.length ? (count / myReviews.length) * 100 : 0;
                return (
                  <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 12 }}>{stars}</span>
                    <div style={{ flex: 1, height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#fbbf24" }} />
                    </div>
                    <span style={{ width: 20, color: "#666", textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {myReviews.length === 0 ? (
            <Empty title="Sin reseñas disponibles" subtitle="Las valoraciones de tus clientes completados aparecerán listadas aquí" icon="star" />
          ) : (
            myReviews.map((v) => (
              <Card key={v.id}>
                <div style={{ display: "flex", gap: 12 }}>
                  <Avatar name={v.clientName || "Cliente"} size="40" />
                  <div>
                    <h5 style={{ fontWeight: "bold", fontSize: 14 }}>{v.clientName || "Cliente Verificado"}</h5>
                    <Stars count={5} value={v.stars} size={14} edit={false} />
                    <p style={{ marginTop: 6, fontSize: 13, color: "#444" }}>{v.comment}</p>
                    <span style={{ fontSize: 11, color: "#aaa", display: "block", marginTop: 4 }}>{fmtDate(v.date)}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {section === "perfil" && (
        <Card title="Datos de Identidad Profesional">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32, padding: 10 }}>
            <div style={{ textAlign: "center" }}>
              <Avatar name={me.name} src={me.photo} size="120" />
              <h4 style={{ marginTop: 12, fontWeight: "bold", fontSize: 18 }}>{me.name}</h4>
              <p style={{ fontSize: 13, color: "#666" }}>{cat?.name || "Especialista"}</p>
              <div style={{ marginTop: 10 }}><Badge text={me.status === "activo" ? "Perfil Activo" : "Inactivo / En Revisión"} color={me.status === "activo" ? "green" : "gray"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 14 }}>
              <div><span style={{ color: "#888", display: "block" }}>Correo Electrónico</span><strong>{me.email}</strong></div>
              <div><span style={{ color: "#888", display: "block" }}>Teléfono Celular</span><strong>{me.phone || "No registrado"}</strong></div>
              <div><span style={{ color: "#888", display: "block" }}>Zona de Cobertura</span><strong>{me.zone || "Medellín"}</strong></div>
              <div><span style={{ color: "#888", display: "block" }}>Experiencia Laboral</span><strong>{me.years} años</strong></div>
              <div><span style={{ color: "#888", display: "block" }}>Tarifa de Referencia</span><strong>{fmtCOP(me.rate)} / hora</strong></div>
              <div><span style={{ color: "#888", display: "block" }}>Hoja de Vida Adjunta</span><span style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}>📄 {me.cvFile || "Ninguna"}</span></div>
            </div>
          </div>
        </Card>
      )}
    </Shell>
  );
}
