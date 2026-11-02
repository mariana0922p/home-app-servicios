import React, { useState } from "react";
import Shell from "../ui/Shell.jsx";
import { Icon } from "../ui/Icons.jsx";
import { Avatar, AreaChart, Badge, BarChart, Card, Donut, Empty, Modal, StatCard, Stars, useToast } from "../ui/Kit.jsx";
import { useStore } from "../../data/store.jsx";
import { fmtCOP, fmtDate, lookFor } from "../../data/utils.js";
import { exportAdminFinancialExcel, exportAdminWorkersExcel } from "../../data/excelExport.js";
import { updateWorkerApproval } from "../../services/db.js";

const DONUT_COLORS = ["#ea580c", "#006a63", "#dd9a2b", "#8e7166", "#2bb3a8", "#c2410c"];

function requestCommissionRate(request, configuredRate = 15) {
  if (request?.commissionRate === undefined || request?.commissionRate === null || request?.commissionRate === "") {
    return Number(configuredRate ?? 15) / 100;
  }
  const raw = Number(request.commissionRate);
  if (!Number.isFinite(raw) || raw < 0) return Number(configuredRate ?? 15) / 100;
  return raw > 1 ? raw / 100 : raw;
}

function homeCommissionForRequest(request, configuredRate = 15) {
  if (request?.homeCommission !== undefined && request?.homeCommission !== null) return Number(request.homeCommission) || 0;
  return Math.round((Number(request?.price) || 0) * requestCommissionRate(request, configuredRate));
}

function workerEarningsForRequest(request, configuredRate = 15) {
  if (request?.workerEarnings !== undefined && request?.workerEarnings !== null) return Number(request.workerEarnings) || 0;
  return Math.max(0, (Number(request?.price) || 0) - homeCommissionForRequest(request, configuredRate));
}

function monthlySeries(requests, valueForRequest, dateForRequest) {
  const now = new Date();
  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      m: date.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
      v: 0,
    });
  }
  requests.forEach((request) => {
    const rawDate = dateForRequest(request);
    const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || "");
    if (Number.isNaN(date.getTime())) return;
    const bucket = months.find((item) => item.year === date.getFullYear() && item.month === date.getMonth());
    if (bucket) bucket.v += Number(valueForRequest(request) || 0);
  });
  return months;
}
export default function AdminDashboard({ session, onLogout }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [section, setSection] = useState("panel");

  const name = session.user?.displayName || session.user?.email?.split("@")[0] || "Administrador";
  const pendingWorkers = state.workers.filter(
    (w) => !["aprobado", "rechazado"].includes(w.approvalStatus)
  );
  const wName = (id) => state.workers.find((w) => w.id === id)?.name || "—";
  const cName = (id) => state.clients.find((c) => c.id === id)?.name || "—";
  const workerObj = (id) => state.workers.find((w) => w.id === id);
  const clientObj = (id) => state.clients.find((c) => c.id === id);
  const cat = (id) => state.categories.find((c) => c.id === id);

  const nav = [
    { id: "panel", label: "Panel general", icon: "grid" },
    { id: "usuarios", label: "Usuarios", icon: "users" },
    { id: "verificaciones", label: "Verificaciones", icon: "shieldCheck", badge: pendingWorkers.length },
    { id: "solicitudes", label: "Solicitudes", icon: "list" },
    { id: "categorias", label: "Categorías", icon: "tag" },
    { id: "reportes", label: "Finanzas y reportes", icon: "chart" },
    { id: "config", label: "Configuración", icon: "settings" },
  ];

  const titles = {
    panel: ["Panel de Control", "Métricas en tiempo real del marketplace Home"],
    usuarios: ["Directorio de Usuarios", "Gestión integral de clientes y profesionales verificados"],
    verificaciones: ["Validación de Profesionales", "Revisión documental antes de habilitar perfil público"],
    solicitudes: ["Transacciones y Solicitudes", "Supervisión de operaciones y garantía activa"],
    categorias: ["Catálogo de Servicios", "Control de tarifas base y estado de categorías"],
    reportes: ["Finanzas y Ganancias de HOME", "Volumen transado, comisiones y descarga oficial en Excel (.xlsx)"],
    config: ["Configuración Global", "Parámetros operativos y modelo de comisiones"],
  };

  const notifications = state.settings?.notifyInApp === false ? [] : pendingWorkers.map((w) => ({
    id: w.id,
    icon: "shieldCheck",
    text: `${w.name} espera verificación de documentos`,
    time: cat(w.cat)?.name || "Servicio",
  }));

  return (
    <Shell
      role="admin"
      nav={nav}
      active={section}
      onNav={setSection}
      onLogout={onLogout}
      user={{ name, look: 9 }}
      title={titles[section][0]}
      subtitle={titles[section][1]}
      notifications={notifications}
    >
      {section === "panel" && (
        <Panel
          {...{ state, pendingWorkers, wName, cName, workerObj, clientObj, cat, setSection }}
        />
      )}
      {section === "usuarios" && <Usuarios {...{ state, dispatch, toast }} />}
      {section === "verificaciones" && <Verificaciones {...{ pendingWorkers, cat, dispatch, toast }} />}
      {section === "solicitudes" && <Solicitudes {...{ state, wName, cName, cat }} />}
      {section === "categorias" && <Categorias {...{ state, dispatch, toast }} />}
      {section === "reportes" && <Reportes {...{ state, wName, cName, cat, toast }} />}
      {section === "config" && <Config {...{ state, dispatch, toast }} />}
    </Shell>
  );
}

function Panel({ state, pendingWorkers, wName, cName, workerObj, clientObj, cat, setSection }) {
  const activeWorkers = state.workers.filter((w) => w.status === "activo" && w.approvalStatus === "aprobado").length;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthReq = state.requests.filter((r) => String(r.created || r.date || r.createdAt || "").slice(0, 7) === currentMonth).length;
  const completedRequests = state.requests.filter((r) => r.status === "completada");
  const revenue = Math.round(completedRequests.reduce((sum, r) => sum + homeCommissionForRequest(r, state.settings?.commission), 0));
  const monthlyRequests = monthlySeries(state.requests, () => 1, (r) => r.created || r.date || r.createdAt);
  const byCat = state.categories
    .map((c, i) => ({
      label: c.name,
      value: state.requests.filter((r) => r.cat === c.id).length,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }))
    .filter((p) => p.value > 0);
  const top = [...state.workers]
    .filter((w) => w.status === "activo" && w.approvalStatus === "aprobado")
    .sort((a, b) => b.rating - a.rating || b.jobs - a.jobs)
    .slice(0, 5);
  const feed = state.requests.slice(0, 5);

  return (
    <>
      <section
        className="hd-hero hd-hero-admin"
        style={{
          backgroundImage:
            "linear-gradient(100deg, rgba(31,27,23,.85) 0%, rgba(31,27,23,.35) 100%), url(/img/real/banner-admin.jpg)",
        }}
      >
        <div className="hd-hero-badge" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
          <span>🚀 Marketplace Home · Operaciones Valle de Aburrá</span>
        </div>
        <h2>Control y escalabilidad de la plataforma.</h2>
        <p>
          {monthReq} solicitudes registradas este mes y {pendingWorkers.length} profesional
          {pendingWorkers.length === 1 ? "" : "es"} en espera de aprobación de documentos.
        </p>
        <div className="hd-hero-actions">
          <button className="hd-btn light" onClick={() => setSection("verificaciones")}>
            Revisar postulaciones ({pendingWorkers.length})
          </button>
          <button className="hd-btn ghost" onClick={() => setSection("solicitudes")}>
            Ver operaciones en vivo
          </button>
        </div>
      </section>

      <div className="hd-grid c4">
        <StatCard
          icon="users"
          tone="orange"
          label="Usuarios registrados"
          value={(state.clients.length + state.workers.length).toLocaleString("es-CO")}
          hint="según cuentas reales de la base de datos"
        />
        <StatCard
          icon="briefcase"
          tone="teal"
          label="Profesionales aprobados"
          value={activeWorkers}
          hint={`${pendingWorkers.length} en revisión`}
        />
        <StatCard
          icon="list"
          tone="amber"
          label="Solicitudes del mes"
          value={monthReq}
          hint="solicitudes reales creadas en el mes"
        />
        <StatCard
          icon="dollar"
          tone="green"
          label="Comisión de HOME"
          value={fmtCOP(revenue)}
          hint={`Tasa fija ${state.settings?.commission || 15}%`}
        />
      </div>

      <div className="hd-grid main">
        <Card title="Crecimiento de solicitudes mensuales">
          <AreaChart data={monthlyRequests} color="#ea580c" />
        </Card>
        <Card title="Distribución de demanda por categoría">
          <Donut parts={byCat} center={state.requests.length} />
        </Card>
      </div>

      <div className="hd-grid c2">
        <Card title="Profesionales líderes del ranking">
          <div className="hd-list">
            {top.map((w) => (
              <div className="hd-row" key={w.id}>
                <Avatar look={w.look} name={w.name} photo={w.photo} size={44} />
                <div className="hd-row-main">
                  <strong>{w.name}</strong>
                  <span>
                    {cat(w.cat)?.name} · {w.jobs} servicios exitosos
                  </span>
                </div>
                <div className="hd-row-end">
                  <Stars value={w.rating} />
                  <b style={{ fontSize: 13 }}>{w.rating}</b>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Última actividad en el marketplace">
          <div className="hd-list">
            {feed.map((r) => {
              const c = clientObj(r.clientId);
              const w = workerObj(r.workerId);
              return (
                <div className="hd-row" key={r.id}>
                  <div className="hd-cat-ico">{cat(r.cat)?.emoji || "🔧"}</div>
                  <div className="hd-row-main">
                    <strong>{r.title}</strong>
                    <span>
                      {c?.name} → {w?.name}
                    </span>
                  </div>
                  <Badge status={r.status} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function Usuarios({ state, dispatch, toast }) {
  const [tab, setTab] = useState("clientes");
  const [q, setQ] = useState("");
  const match = (u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase());

  const toggle = (type, u) => {
    const next = u.status === "suspendido" ? "activo" : "suspendido";
    dispatch({ type, id: u.id, patch: { status: next } });
    toast(next === "activo" ? `${u.name} fue reactivado con éxito` : `${u.name} fue suspendido`);
  };

  const clients = state.clients.filter(match);
  const workers = state.workers.filter(match);

  return (
    <Card>
      <div className="hd-toolbar" style={{ marginBottom: 16 }}>
        <div className="hd-tabs">
          <button className={tab === "clientes" ? "active" : ""} onClick={() => setTab("clientes")}>
            Clientes ({state.clients.length})
          </button>
          <button
            className={tab === "profesionales" ? "active" : ""}
            onClick={() => setTab("profesionales")}
          >
            Profesionales ({state.workers.length})
          </button>
        </div>
        <div className="hd-search">
          <Icon name="search" size={18} />
          <input
            placeholder="Buscar por nombre o correo electrónico..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="hd-table-wrap">
        <table className="hd-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>{tab === "clientes" ? "Zona" : "Especialidad"}</th>
              <th>{tab === "clientes" ? "Fecha registro" : "Aprobación / Estado"}</th>
              <th>Estado cuenta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tab === "clientes"
              ? clients.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="hd-cell-user">
                        <Avatar look={lookFor(u.id)} name={u.name} photo={u.photo} size={40} />
                        <div>
                          <strong>{u.name}</strong>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.zone || "Medellín"}</td>
                    <td>{(u.joined || u.createdAt) ? fmtDate(u.joined || u.createdAt) : "—"}</td>
                    <td>
                      <Badge status={u.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`hd-btn sm ${u.status === "suspendido" ? "teal" : "danger"}`}
                        onClick={() => toggle("updateClient", u)}
                      >
                        {u.status === "suspendido" ? "Reactivar" : "Suspender"}
                      </button>
                    </td>
                  </tr>
                ))
              : workers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="hd-cell-user">
                        <Avatar look={u.look} name={u.name} photo={u.photo} size={40} />
                        <div>
                          <strong>{u.name}</strong>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{state.categories.find((c) => c.id === u.cat)?.name || "General"}</td>
                    <td>
                      <span
                        className={`hd-tag ${
                          u.approvalStatus === "aprobado"
                            ? "success"
                            : u.approvalStatus === "rechazado"
                            ? "danger"
                            : "warning"
                        }`}
                        style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}
                      >
                        {u.approvalStatus === "aprobado"
                          ? "✓ Aprobado"
                          : u.approvalStatus === "rechazado"
                          ? "✕ Rechazado"
                          : "⏳ Pendiente"}
                      </span>
                    </td>
                    <td>
                      <Badge status={u.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`hd-btn sm ${u.status === "suspendido" ? "teal" : "danger"}`}
                        onClick={() => toggle("updateWorker", u)}
                      >
                        {u.status === "suspendido" ? "Reactivar" : "Suspender"}
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {(tab === "clientes" ? clients : workers).length === 0 && (
        <Empty icon="search" title="No se encontraron usuarios" />
      )}
    </Card>
  );
}

function Verificaciones({ pendingWorkers, cat, dispatch, toast }) {
  const [modalWorker, setModalWorker] = useState(null);
  const [notes, setNotes] = useState("");

  if (pendingWorkers.length === 0)
    return (
      <Card>
        <Empty
          icon="shieldCheck"
          title="No hay verificaciones pendientes"
          text="Todos los profesionales registrados han sido evaluados y se encuentran al día."
        />
      </Card>
    );

  const persistApproval = async (w, approvalStatus, approvalNotes = "") => {
    await updateWorkerApproval(w.id, { approvalStatus, approvalNotes });
    dispatch({ type: "setWorkerApproval", id: w.id, approvalStatus, approvalNotes, persisted: true });
  };

  const handleApprove = async (w) => {
    if (!w.cvUrl || !w.certificateUrl) {
      toast("No se puede aprobar: primero debes revisar la hoja de vida y el certificado cargados.", "error");
      return;
    }
    try {
      await persistApproval(w, "aprobado", "");
      toast(`¡${w.name} fue aprobado manualmente y publicado en el catálogo de clientes!`);
    } catch (error) {
      console.error("Error aprobando profesional:", error);
      toast("No se pudo guardar la aprobación en Firestore. Revisa los permisos de administrador.", "error");
    }
  };

  const handleRequestCorrections = async (w) => {
    if (!notes.trim()) {
      toast("Escribe una indicación de lo que debe corregir el profesional.", "error");
      return;
    }
    try {
      await persistApproval(w, "requiere_correcciones", notes.trim());
      setModalWorker(null);
      setNotes("");
      toast(`Se solicitaron correcciones a ${w.name}`);
    } catch (error) {
      console.error("Error solicitando correcciones:", error);
      toast("No se pudo guardar la solicitud de corrección.", "error");
    }
  };

  const handleReject = async (w) => {
    try {
      await persistApproval(w, "rechazado", "No cumple con los requisitos técnicos o documentos requeridos.");
      toast(`${w.name} fue rechazado.`, "error");
    } catch (error) {
      console.error("Error rechazando profesional:", error);
      toast("No se pudo guardar el rechazo.", "error");
    }
  };

  return (
    <>
      <div className="hd-grid c2">
        {pendingWorkers.map((w) => (
          <article key={w.id} className="hd-worker hd-worker-verification">
            <div className="hd-worker-head">
              <Avatar look={w.look} name={w.name} photo={w.photo} size={64} ring="#dd9a2b" />
              <div>
                <strong style={{ fontSize: 16 }}>{w.name}</strong>
                <span>
                  {cat(w.cat)?.emoji} {cat(w.cat)?.name} · Zona: {w.zone}
                </span>
                <div style={{ marginTop: 4 }}>
                  <Badge status="pendiente" />
                </div>
              </div>
            </div>

            <p style={{ WebkitLineClamp: 3 }}>{w.bio}</p>

            <div className="hd-verification-documents">
              <strong>Documentos enviados por el profesional</strong>
              {w.cvUrl ? (
                <a href={w.cvUrl} target="_blank" rel="noreferrer" className="hd-document-link">
                  <Icon name="fileText" size={17} />
                  <span><b>Hoja de vida</b><small>{w.cvFile || "Abrir hoja de vida"}</small></span>
                  <Icon name="externalLink" size={15} />
                </a>
              ) : (
                <div className="hd-document-missing">Falta cargar una hoja de vida verificable.</div>
              )}
              {w.certificateUrl ? (
                <a href={w.certificateUrl} target="_blank" rel="noreferrer" className="hd-document-link">
                  <Icon name="fileText" size={17} />
                  <span><b>Certificado técnico</b><small>{w.certificateFile || w.certifications?.[0] || "Abrir certificado"}</small></span>
                  <Icon name="externalLink" size={15} />
                </a>
              ) : (
                <div className="hd-document-missing">Falta cargar un certificado técnico verificable.</div>
              )}
              {w.approvalNotes && <p className="hd-approval-notes">Observación anterior: {w.approvalNotes}</p>}
            </div>

            <div className="hd-worker-foot">
              <button className="hd-btn danger sm" onClick={() => handleReject(w)}>
                Rechazar
              </button>
              <button
                className="hd-btn ghost sm"
                onClick={() => {
                  setModalWorker(w);
                  setNotes("");
                }}
              >
                Pedir corrección
              </button>
              <button
                className="hd-btn sm"
                onClick={() => handleApprove(w)}
                disabled={!w.cvUrl || !w.certificateUrl}
                title={!w.cvUrl || !w.certificateUrl ? "Debe estar cargada la hoja de vida y el certificado" : "Aprobar manualmente"}
              >
                <Icon name="shieldCheck" size={15} /> Aprobar profesional
              </button>
            </div>
          </article>
        ))}
      </div>

      {modalWorker && (
        <Modal title={`Solicitar correcciones a ${modalWorker.name}`} onClose={() => setModalWorker(null)}>
          <p style={{ fontSize: 13.5, color: "#5a4138", margin: "0 0 14px" }}>
            Indica claramente qué documento o dato debe subsanar el profesional para ser aprobado:
          </p>
          <div className="hd-field">
            <label>Instrucciones de corrección</label>
            <textarea
              className="hd-textarea"
              rows={3}
              placeholder="Ej. La certificación del SENA no está legible o falta anexar certificado de antecedentes judiciales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
          </div>
          <div className="hd-modal-actions">
            <button className="hd-btn ghost" onClick={() => setModalWorker(null)}>
              Cancelar
            </button>
            <button className="hd-btn" onClick={() => handleRequestCorrections(modalWorker)}>
              Enviar solicitud de corrección
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Solicitudes({ state, wName, cName, cat }) {
  const [st, setSt] = useState("todas");
  const rows = state.requests.filter((r) => st === "todas" || r.status === st);

  return (
    <Card
      title={`${rows.length} solicitudes registradas`}
      action={
        <select
          className="hd-select"
          value={st}
          onChange={(e) => setSt(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="todas">Todos los estados</option>
          {["pendiente", "aceptada", "en_progreso", "completada", "rechazada", "cancelada"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      }
    >
      <div className="hd-table-wrap">
        <table className="hd-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Servicio</th>
              <th>Cliente</th>
              <th>Profesional</th>
              <th>Fecha</th>
              <th>Valor COP</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>#{r.id}</b>
                </td>
                <td>{r.title}</td>
                <td>{cName(r.clientId)}</td>
                <td>{wName(r.workerId)}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{fmtCOP(r.price)}</td>
                <td>
                  <Badge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Categorias({ state, dispatch, toast }) {
  return (
    <div className="hd-grid c3">
      {state.categories.map((c) => (
        <Card key={c.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <img src={c.img} alt={c.name} style={{ width: 44, height: 44 }} />
            <div>
              <strong style={{ fontSize: 16 }}>{c.name}</strong>
              <div style={{ fontSize: 13, color: "#8e7166" }}>Desde {fmtCOP(c.from)}/h</div>
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: "#5a4138", margin: "0 0 16px" }}>{c.desc}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: c.active ? "#0f9d70" : "#ba1a1a" }}>
              {c.active ? "Activa en catálogo" : "Pausada"}
            </span>
            <button
              className={`hd-btn sm ${c.active ? "ghost" : ""}`}
              onClick={() => {
                dispatch({ type: "toggleCategory", id: c.id });
                toast(`Categoría ${c.name} actualizada`);
              }}
            >
              {c.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Reportes({ state, wName, cName, cat, toast }) {
  const done = state.requests.filter((r) => r.status === "completada");
  const commissionRate = Number(state.settings?.commission ?? 15);
  const volume = done.reduce((a, r) => a + (Number(r.price) || 0), 0);
  const homeEarnings = Math.round(done.reduce((sum, r) => sum + homeCommissionForRequest(r, commissionRate), 0));
  const workerPayout = done.reduce((sum, r) => sum + workerEarningsForRequest(r, commissionRate), 0);
  const rate = Math.round((done.length / Math.max(state.requests.length, 1)) * 100);
  const monthlyCommission = monthlySeries(done, (r) => homeCommissionForRequest(r, commissionRate), (r) => r.completedAt || r.updatedAt || r.created || r.date).map((item) => ({ ...item, v: item.v / 1000000 }));

  const handleExportFinancial = () => {
    try {
      exportAdminFinancialExcel({
        requests: state.requests,
        workers: state.workers,
        clients: state.clients,
        categories: state.categories,
        settings: state.settings,
      });
      toast("Reporte financiero en Excel (.xlsx) descargado exitosamente");
    } catch (e) {
      console.error(e);
      toast("Error al generar el reporte en Excel");
    }
  };

  const handleExportWorkers = () => {
    try {
      exportAdminWorkersExcel(state.workers, state.categories, state.requests);
      toast("Directorio de profesionales en Excel (.xlsx) descargado");
    } catch (e) {
      console.error(e);
      toast("Error al exportar directorio de profesionales");
    }
  };

  return (
    <>
      <div className="hd-grid c4">
        <StatCard
          icon="dollar"
          tone="orange"
          label="Volumen total transaccionado"
          value={fmtCOP(volume)}
          hint={`${done.length} servicios completados`}
        />
        <StatCard
          icon="check"
          tone="green"
          label={`Ganancia neta HOME (${commissionRate}%)`}
          value={fmtCOP(homeEarnings)}
          hint="comisión recaudada"
        />
        <StatCard
          icon="users"
          tone="teal"
          label={`Neto generado para profesionales (${100 - commissionRate}%)`}
          value={fmtCOP(workerPayout)}
          hint="participación neta en servicios completados; no equivale a pagos liquidados"
        />
        <StatCard
          icon="star"
          tone="amber"
          label="Tasa de finalización"
          value={`${rate}%`}
          hint="servicios completados sobre solicitudes registradas"
        />
      </div>

      <div className="hd-grid c2">
        <Card title="Ingresos de Home por comisiones (millones COP)">
          <BarChart data={monthlyCommission} format={(v) => "$" + v.toFixed(2) + "M"} />
        </Card>

        <Card title="Descarga oficial de reportes en Excel (.xlsx)">
          <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#5a4138", lineHeight: 1.6 }}>
            Genera y descarga libros reales de Microsoft Excel con tablas formateadas, formato de moneda COP,
            desglose de comisiones ({commissionRate}% HOME / {100 - commissionRate}% profesional, según la configuración vigente) y hojas separadas de resumen y transacciones.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="hd-btn" onClick={handleExportFinancial}>
              <Icon name="download" size={16} /> Descargar Reporte Financiero (.xlsx)
            </button>
            <button className="hd-btn ghost" onClick={handleExportWorkers}>
              <Icon name="download" size={16} /> Descargar Directorio Profesionales (.xlsx)
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}

function Config({ state, dispatch, toast }) {
  const s = state.settings || { commission: 15, maintenance: false, notifyInApp: true };
  const set = (patch) => dispatch({ type: "settings", patch });

  return (
    <div className="hd-grid c2">
      <Card title="Parámetros comerciales y de intermediación">
        <div className="hd-setting">
          <div>
            <strong>Comisión HOME sobre servicios</strong>
            <span>Porcentaje que retiene HOME por transacción y garantía</span>
          </div>
          <select
            className="hd-select"
            value={s.commission || 15}
            onChange={(e) => {
              set({ commission: Number(e.target.value) });
              toast(`Comisión de HOME actualizada al ${e.target.value}%`);
            }}
          >
            {[10, 12, 15, 18, 20].map((n) => (
              <option key={n} value={n}>
                {n}% (Por defecto HOME: 15%)
              </option>
            ))}
          </select>
        </div>

        <div className="hd-setting">
          <div>
            <strong>Notificaciones en el panel</strong>
            <span>Mostrar avisos internos cuando haya actividad en solicitudes</span>
          </div>
          <button
            className={`hd-toggle ${s.notifyInApp !== false ? "on" : ""}`}
            aria-label="Notificaciones en el panel"
            onClick={() => set({ notifyInApp: s.notifyInApp === false })}
          />
        </div>

        <div className="hd-setting">
          <div>
            <strong>Modo mantenimiento</strong>
            <span>Suspende temporalmente nuevas contrataciones</span>
          </div>
          <button
            className={`hd-toggle ${s.maintenance ? "on" : ""}`}
            aria-label="Modo mantenimiento"
            onClick={() => set({ maintenance: !s.maintenance })}
          />
        </div>
      </Card>


    </div>
  );
}
