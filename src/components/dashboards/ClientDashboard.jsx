import React, { useMemo, useState } from "react";
import Shell from "../ui/Shell.jsx";
import { Icon } from "../ui/Icons.jsx";
import { Avatar, Badge, Card, Empty, Modal, StatCard, Stars, Steps, useToast } from "../ui/Kit.jsx";
import { useStore } from "../../data/store.jsx";
import { FAQ } from "../../data/seed.js";
import { fmtCOP, fmtDate, today } from "../../data/utils.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, firebaseConfigured } from "../../firebase.js";
import { createRealRequest } from "../../services/db.js";

export default function ClientDashboard({ session, onLogout }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [section, setSection] = useState("inicio");
  const [catFilter, setCatFilter] = useState("todas");
  const [booking, setBooking] = useState(null); // trabajador a contratar
  const [rating, setRating] = useState(null); // solicitud a calificar
  const [viewWorker, setViewWorker] = useState(null); // ver portafolio de profesional
  const userId = session?.user?.uid || "";

  const me = state.clients.find((c) => c.id === userId) || {
    id: userId,
    uid: userId,
    name: session?.profile?.name || session?.user?.displayName || session?.user?.email?.split("@")[0] || "Cliente",
    email: session?.user?.email || session?.profile?.email || "",
    phone: session?.profile?.phone || "",
    photo: session?.profile?.photo || "",
    status: session?.profile?.status || "activo",
  };
  const mine = useMemo(() => state.requests.filter((r) => r.clientId === userId), [state.requests, userId]);
  const worker = (id) => state.workers.find((w) => w.id === id);
  const cat = (id) => state.categories.find((c) => c.id === id);
  const active = mine.filter((r) => ["pendiente", "aceptada", "en_progreso"].includes(r.status));
  const done = mine.filter((r) => r.status === "completada");

  const notifications = state.settings?.notifyInApp === false ? [] : mine
    .filter((r) => ["aceptada", "en_progreso"].includes(r.status))
    .map((r) => ({
      id: r.id,
      icon: "check",
      text: `${worker(r.workerId)?.name || "Tu profesional"} ${
        r.status === "aceptada" ? "aceptó" : "está atendiendo"
      }: ${r.title}`,
      time: fmtDate(r.date),
    }));

  const nav = [
    { id: "inicio", label: "Inicio", icon: "home" },
    { id: "explorar", label: "Buscar profesionales", icon: "search" },
    { id: "solicitudes", label: "Mis solicitudes", icon: "list", badge: active.length },
    { id: "perfil", label: "Mi perfil y ayuda", icon: "user" },
  ];

  const titles = {
    inicio: [`¡Hola, ${me.name.split(" ")[0]}! 👋`, "Aquí tienes el resumen de tu hogar"],
    explorar: ["Buscar profesionales", "Verificados, con fotos reales y Garantía Home"],
    solicitudes: ["Mis solicitudes", "Sigue en tiempo real el estado de cada servicio"],
    perfil: ["Mi perfil y ayuda", "Tus datos personales y preguntas frecuentes"],
  };

  const maintenanceMode = state.settings?.maintenance === true;
  const startBooking = (w) => {
    if (maintenanceMode) {
      toast("HOME está en mantenimiento. La contratación se habilitará cuando finalice.", "error");
      return;
    }
    setBooking(w);
  };
  const goCategory = (id) => {
    setCatFilter(id);
    setSection("explorar");
  };

  return (
    <Shell
      role="cliente"
      nav={nav}
      active={section}
      onNav={setSection}
      onLogout={onLogout}
      user={{ name: me.name, look: 5, photo: me.photo }}
      title={titles[section][0]}
      subtitle={titles[section][1]}
      notifications={notifications}
    >
      {maintenanceMode && (
        <div className="hd-maintenance-banner" role="status">
          <strong>Modo mantenimiento activo.</strong> Puedes consultar tus solicitudes, pero no crear nuevas contrataciones.
        </div>
      )}
      {section === "inicio" && (
        <Inicio
          {...{
            me,
            state,
            mine,
            active,
            done,
            worker,
            cat,
            goCategory,
            startBooking,
            setViewWorker,
            setSection,
          }}
        />
      )}

      {section === "explorar" && (
        <Explorar
          {...{ state, catFilter, setCatFilter, startBooking, setViewWorker }}
        />
      )}

      {section === "solicitudes" && (
        <Solicitudes
          {...{ mine, worker, cat, dispatch, toast, setRating, setSection }}
        />
      )}

      {section === "perfil" && <Perfil {...{ me, dispatch, toast }} />}

      {/* Modal de contratación */}
      {booking && (
        <BookingModal
          worker={booking}
          cat={cat(booking.cat)}
          me={me}
          onClose={() => setBooking(null)}
          onSubmit={async (data) => {
            if (!userId) throw new Error("Tu sesión expiró. Inicia sesión nuevamente para enviar la solicitud.");
            const { photoFile, ...formData } = data;
            const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            let photoUrl;
            if (photoFile) {
              if (!firebaseConfigured) throw new Error("Firebase Storage debe estar configurado para adjuntar fotografías.");
              const photoRef = storageRef(storage, `request-attachments/${userId}/${requestId}/${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
              await uploadBytes(photoRef, photoFile, { contentType: photoFile.type });
              photoUrl = await getDownloadURL(photoRef);
            }
            const requestData = {
              ...formData,
              ...(photoUrl ? { photoUrl } : {}),
              id: requestId,
              clientId: userId,
              clientName: me.name,
              clientPhone: me.phone || "",
              clientEmail: me.email || session?.user?.email || "",
              workerId: booking.id,
              workerName: booking.name,
              cat: booking.cat,
              status: "pendiente",
              created: today(),
            };
            const savedRequest = await createRealRequest(requestData, Number(state.settings?.commission ?? 15) / 100);
            dispatch({ type: "createRequest", req: savedRequest, persisted: true });
            setBooking(null);
            setSection("solicitudes");
            toast(`¡Solicitud enviada a ${booking.name.split(" ")[0]}! Le llegará en su panel de profesional.`);
          }}
        />
      )}

      {/* Modal de perfil y portafolio del profesional */}
      {viewWorker && (
        <WorkerProfileModal
          worker={viewWorker}
          cat={cat(viewWorker.cat)}
          reviews={state.reviews.filter((v) => v.workerId === viewWorker.id)}
          onClose={() => setViewWorker(null)}
          onBook={() => {
            const w = viewWorker;
            setViewWorker(null);
            startBooking(w);
          }}
        />
      )}

      {/* Modal de calificación */}
      {rating && (
        <RateModal
          req={rating}
          worker={worker(rating.workerId)}
          onClose={() => setRating(null)}
          onSubmit={(stars, text) => {
            dispatch({ type: "setRequest", id: rating.id, patch: { rating: stars } });
            dispatch({
              type: "addReview",
              review: {
                id: "v" + Date.now(),
                workerId: rating.workerId,
                client: me.name,
                clientId: userId,
                requestId: rating.id,
                photo: me.photo,
                rating: stars,
                date: today(),
                text: text || "Excelente servicio, muy recomendado.",
              },
            });
            setRating(null);
            toast("¡Gracias por calificar el servicio!");
          }}
        />
      )}
    </Shell>
  );
}

/* ---------------- Inicio ---------------- */
function Inicio({
  me,
  state,
  mine,
  active,
  done,
  worker,
  cat,
  goCategory,
  startBooking,
  setViewWorker,
  setSection,
}) {
  const spent = done.reduce((a, r) => a + r.price, 0);
  const top = [...state.workers]
    .filter((w) => w.status === "activo" && w.approvalStatus === "aprobado")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  return (
    <>
      <section
        className="hd-hero hd-hero-client"
        style={{
          backgroundImage:
            "linear-gradient(100deg, rgba(31,27,23,.82) 0%, rgba(31,27,23,.35) 100%), url(/img/real/banner-cliente.jpg)",
        }}
      >
        <div className="hd-hero-badge">
          <Icon name="shieldCheck" size={16} />
          <span>Garantía Home 100% Protegida en Medellín</span>
        </div>
        <h2>Tu hogar en manos de profesionales reales y verificados.</h2>
        <p>
          Encuentra electricistas, plomeros, pintores y constructores calificados. Cotizaciones claras y
          cobertura de 30 días en cada servicio.
        </p>
        <div className="hd-hero-actions">
          <button className="hd-btn light" onClick={() => setSection("explorar")}>
            <Icon name="search" size={16} /> Buscar profesional
          </button>
          <button className="hd-btn ghost" onClick={() => setSection("solicitudes")}>
            Mis solicitudes ({active.length})
          </button>
        </div>
      </section>

      <div className="hd-grid c4">
        <StatCard icon="clock" tone="amber" label="En proceso" value={active.length} hint="solicitudes activas" />
        <StatCard icon="check" tone="green" label="Completados" value={done.length} hint="servicios con garantía" />
        <StatCard icon="dollar" tone="orange" label="Invertido" value={fmtCOP(spent)} hint="en mantenimiento" />
        <StatCard icon="shieldCheck" tone="teal" label="Garantía" value="30 días" hint="cobertura incluida" />
      </div>

      <Card
        title="¿Qué necesitas reparar o mejorar hoy?"
        action={
          <button className="hd-link" onClick={() => setSection("explorar")}>
            Ver catálogo completo <Icon name="chevron" size={14} />
          </button>
        }
      >
        <div className="hd-grid c3 hd-cat-grid">
          {state.categories
            .filter((c) => c.active)
            .map((c) => (
              <button key={c.id} className="hd-cat hd-cat-real" onClick={() => goCategory(c.id)}>
                <div className="hd-cat-img-wrap">
                  <img src={c.img} alt={c.name} loading="lazy" />
                  <span className="hd-cat-tag">{c.tag}</span>
                </div>
                <div className="hd-cat-body">
                  <strong>
                    {c.emoji} {c.name}
                  </strong>
                  <span>Desde {fmtCOP(c.from)}/hora</span>
                </div>
              </button>
            ))}
        </div>
      </Card>

      <div className="hd-grid main">
        <Card
          title="Tus próximos servicios"
          action={
            <button className="hd-link" onClick={() => setSection("solicitudes")}>
              Ver todas ({mine.length})
            </button>
          }
        >
          {active.length === 0 ? (
            <Empty
              icon="calendar"
              title="No tienes servicios en proceso"
              text="Cuando solicites un profesional, aquí verás el progreso paso a paso."
            />
          ) : (
            <div className="hd-list">
              {active.slice(0, 4).map((r) => {
                const w = worker(r.workerId);
                return (
                  <div key={r.id} className="hd-row">
                    <Avatar look={w?.look} name={w?.name} photo={w?.photo} size={44} />
                    <div className="hd-row-main">
                      <strong>{r.title}</strong>
                      <span>
                        {w?.name} · {fmtDate(r.date)}
                      </span>
                    </div>
                    <Badge status={r.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Profesionales mejor calificados">
          <div className="hd-list">
            {top.map((w) => (
              <div
                key={w.id}
                className="hd-row hd-row-clickable"
                onClick={() => setViewWorker(w)}
                style={{ cursor: "pointer" }}
              >
                <Avatar look={w.look} name={w.name} photo={w.photo} size={46} />
                <div className="hd-row-main">
                  <strong>{w.name}</strong>
                  <span>
                    {cat(w.cat)?.name} · {w.zone}
                  </span>
                </div>
                <div className="hd-row-end">
                  <Stars value={w.rating} />
                  <b style={{ fontSize: 13 }}>{w.rating}</b>
                </div>
              </div>
            ))}
          </div>
          {top[0] && (
            <button
              className="hd-btn ghost sm"
              style={{ marginTop: 14, width: "100%" }}
              onClick={() => startBooking(top[0])}
            >
              Solicitar a {top[0].name.split(" ")[0]} ({fmtCOP(top[0].rate)}/h)
            </button>
          )}
        </Card>
      </div>

      <div className="hd-tip">
        <div className="ic">
          <Icon name="shieldCheck" size={24} />
        </div>
        <div>
          <strong>Respaldo de Calidad Home</strong>
          <span>
            Cada uno de nuestros profesionales pasa por validación de antecedentes policiales, matrícula técnica
            y verificación presencial en el Valle de Aburrá.
          </span>
        </div>
      </div>
    </>
  );
}

/* ---------------- Explorar ---------------- */
function Explorar({ state, catFilter, setCatFilter, startBooking, setViewWorker }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const activeCats = state.categories.filter((c) => c.active);

  const list = state.workers
    .filter((w) => w.status === "activo" && w.approvalStatus === "aprobado")
    .filter((w) => activeCats.some((c) => c.id === w.cat))
    .filter((w) => catFilter === "todas" || w.cat === catFilter)
    .filter((w) => (w.name + " " + w.bio + " " + w.zone).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === "rating" ? b.rating - a.rating : sort === "price" ? a.rate - b.rate : b.years - a.years
    );

  return (
    <>
      <div className="hd-toolbar">
        <div className="hd-search">
          <Icon name="search" size={18} />
          <input
            placeholder="Busca por servicio, nombre o zona (ej. Poblado, plomero)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="hd-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Ordenar profesionales"
        >
          <option value="rating">Mayor calificación</option>
          <option value="price">Menor tarifa</option>
          <option value="years">Más años de experiencia</option>
        </select>
      </div>

      <div className="hd-chips">
        <button
          className={`hd-chipbtn ${catFilter === "todas" ? "active" : ""}`}
          onClick={() => setCatFilter("todas")}
        >
          Todas las categorías
        </button>
        {activeCats.map((c) => (
          <button
            key={c.id}
            className={`hd-chipbtn ${catFilter === c.id ? "active" : ""}`}
            onClick={() => setCatFilter(c.id)}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty
            icon="search"
            title="Sin resultados"
            text="Prueba con otra categoría, revisa la ortografía o remueve los filtros."
          />
        </Card>
      ) : (
        <div className="hd-grid c3">
          {list.map((w) => (
            <article key={w.id} className="hd-worker hd-worker-card">
              <div className="hd-worker-head">
                <Avatar look={w.look} name={w.name} photo={w.photo} size={58} />
                <div>
                  <strong>{w.name}</strong>
                  <span>{state.categories.find((c) => c.id === w.cat)?.name}</span>
                  <div className="hd-verified">
                    <Icon name="shieldCheck" size={14} /> Profesional verificado
                  </div>
                </div>
              </div>

              <div className="hd-meta">
                <span>
                  <Stars value={w.rating} size={13} /> <b>{w.rating}</b> ({w.jobs} trabajos)
                </span>
                <span>
                  <Icon name="pin" size={14} /> {w.zone}
                </span>
                <span>
                  <Icon name="briefcase" size={14} /> {w.years} años exp.
                </span>
              </div>

              <p>{w.bio}</p>

              {/* Muestra previa del portafolio */}
              {w.portfolio && w.portfolio.length > 0 && (
                <div
                  className="hd-worker-portfolio-strip"
                  onClick={() => setViewWorker(w)}
                  title="Ver portafolio de trabajos realizados"
                >
                  {w.portfolio.slice(0, 3).map((img, idx) => (
                    <img key={idx} src={img} alt={`Trabajo ${idx + 1}`} loading="lazy" />
                  ))}
                  <span className="hd-portfolio-more">Ver fotos →</span>
                </div>
              )}

              <div className="hd-worker-foot">
                <div className="hd-price">
                  {fmtCOP(w.rate)} <small>/hora</small>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="hd-btn ghost sm" onClick={() => setViewWorker(w)}>
                    Perfil
                  </button>
                  <button className="hd-btn sm" onClick={() => startBooking(w)}>
                    Solicitar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Solicitudes ---------------- */
function Solicitudes({ mine, worker, cat, dispatch, toast, setRating, setSection }) {
  const [tab, setTab] = useState("todas");
  const tabs = [
    ["todas", "Todas"],
    ["activas", "Activas"],
    ["completada", "Completadas"],
    ["cerradas", "Canceladas"],
  ];

  const filt = mine.filter((r) =>
    tab === "todas"
      ? true
      : tab === "activas"
      ? ["pendiente", "aceptada", "en_progreso"].includes(r.status)
      : tab === "completada"
      ? r.status === "completada"
      : ["cancelada", "rechazada"].includes(r.status)
  );

  return (
    <>
      <div className="hd-tabs">
        {tabs.map(([id, l]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {l}
          </button>
        ))}
      </div>

      {filt.length === 0 ? (
        <Card>
          <Empty
            icon="list"
            title="No hay solicitudes en esta sección"
            text="Explora los profesionales disponibles y programa tu primer servicio."
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button className="hd-btn" onClick={() => setSection("explorar")}>
              Buscar profesionales
            </button>
          </div>
        </Card>
      ) : (
        filt.map((r) => {
          const w = worker(r.workerId);
          return (
            <article key={r.id} className="hd-req">
              <div className="hd-req-top">
                <Avatar look={w?.look ?? 0} name={w?.name} photo={w?.photo} size={50} />
                <div className="hd-row-main" style={{ minWidth: 200 }}>
                  <strong style={{ whiteSpace: "normal" }}>{r.title}</strong>
                  <span>
                    {cat(r.cat)?.emoji} {cat(r.cat)?.name} · {w?.name} · Ref: {r.id}
                  </span>
                </div>
                <Badge status={r.status} />
              </div>

              {["pendiente", "aceptada", "en_progreso", "completada"].includes(r.status) && (
                <Steps status={r.status} />
              )}

              {r.desc && (
                <p style={{ margin: 0, fontSize: 13.5, color: "#5a4138", lineHeight: 1.55 }}>
                  {r.desc}
                </p>
              )}

              <div className="hd-meta">
                <span>
                  <Icon name="calendar" size={14} /> {fmtDate(r.date)}
                </span>
                <span>
                  <Icon name="pin" size={14} /> {r.address}
                </span>
                <span>
                  <Icon name="dollar" size={14} /> Presupuesto: {fmtCOP(r.price)}
                </span>
                <span className="hd-guarantee-pill">
                  <Icon name="shieldCheck" size={13} /> Garantía Home 30 días
                </span>
              </div>

              <div className="hd-req-actions">
                {w && ["aceptada", "en_progreso"].includes(r.status) && (
                  <button
                    className="hd-btn ghost sm"
                    onClick={() =>
                      toast(`Conectando con ${w.name.split(" ")[0]} al ${w.phone}...`)
                    }
                  >
                    <Icon name="phone" size={14} /> Contactar ({w.phone})
                  </button>
                )}

                {r.status === "completada" &&
                  (r.rating ? (
                    <span className="hd-meta" style={{ gap: 4 }}>
                      <Stars value={r.rating} /> <b>Tu calificación: {r.rating}★</b>
                    </span>
                  ) : (
                    <button className="hd-btn sm" onClick={() => setRating(r)}>
                      <Icon name="star" size={15} /> Calificar servicio
                    </button>
                  ))}

                {r.status === "pendiente" && (
                  <button
                    className="hd-btn danger sm"
                    onClick={() => {
                      dispatch({ type: "setRequest", id: r.id, patch: { status: "cancelada" } });
                      toast("Solicitud cancelada correctamente.");
                    }}
                  >
                    Cancelar solicitud
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
    </>
  );
}

/* ---------------- Perfil ---------------- */
function Perfil({ me, dispatch, toast }) {
  const [f, setF] = useState({ name: me.name, phone: me.phone, address: me.address });
  const [open, setOpen] = useState(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="hd-grid main">
      <Card title="Mis datos personales">
        <div className="hd-profile-head" style={{ marginBottom: 20 }}>
          <Avatar look={5} name={me.name} photo={me.photo} size={76} ring="#ea580c" />
          <div>
            <strong style={{ fontSize: 18 }}>{me.name}</strong>
            <br />
            <span style={{ fontSize: 13, color: "#5a4138" }}>{me.email}</span>
            <div style={{ marginTop: 4 }}>
              <span className="hd-badge tone-green">Cliente verificado</span>
            </div>
          </div>
        </div>

        <div className="hd-field">
          <label>Nombre completo</label>
          <input className="hd-input" value={f.name} onChange={set("name")} />
        </div>

        <div className="hd-form-row">
          <div className="hd-field">
            <label>Teléfono móvil</label>
            <input className="hd-input" value={f.phone} onChange={set("phone")} />
          </div>
          <div className="hd-field">
            <label>Dirección principal (Medellín)</label>
            <input className="hd-input" value={f.address} onChange={set("address")} />
          </div>
        </div>

        <button
          className="hd-btn"
          onClick={() => {
            dispatch({ type: "updateClient", id: me.id, patch: f });
            toast("Tus datos fueron actualizados.");
          }}
        >
          Guardar cambios
        </button>
      </Card>

      <Card title="Preguntas frecuentes y soporte">
        {FAQ.map(([q, a], i) => (
          <div className="hd-faq" key={q}>
            <button onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{q}</span>
              <Icon
                name="chevronDown"
                size={18}
                style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            </button>
            {open === i && <p>{a}</p>}
          </div>
        ))}
        <div className="hd-tip" style={{ marginTop: 14 }}>
          <div className="ic">
            <Icon name="phone" size={22} />
          </div>
          <div>
            <strong>Línea de atención y soporte WhatsApp</strong>
            <span>Lunes a Sábado 7:00 am - 7:00 pm · (+57) 300 912 3456</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Modales ---------------- */
function BookingModal({ worker, cat, me, onClose, onSubmit }) {
  const [f, setF] = useState({
    title: "",
    desc: "",
    date: today(),
    address: me.address,
    price: worker.rate,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.title.trim() && f.date && !submitting;
  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit({ ...f, price: Number(f.price) || 0, photoFile: photoFile || undefined });
    } catch (error) {
      console.error("No se pudo enviar la solicitud:", error);
      setSubmitError(error?.message || "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Solicitar servicio" onClose={onClose}>
      <div className="hd-profile-head" style={{ marginBottom: 18 }}>
        <Avatar look={worker.look} name={worker.name} photo={worker.photo} size={54} />
        <div>
          <strong style={{ fontSize: 16 }}>{worker.name}</strong>
          <br />
          <span style={{ fontSize: 13, color: "#5a4138" }}>
            {cat?.name} · Tarifa base: {fmtCOP(worker.rate)}/hora
          </span>
        </div>
      </div>

      <div className="hd-field">
        <label>¿Qué servicio o reparación necesitas?</label>
        <input
          className="hd-input"
          placeholder="Ej. Fuga en lavaplatos o instalación de luminaria"
          value={f.title}
          onChange={set("title")}
          autoFocus
        />
      </div>

      <div className="hd-field">
        <label>Detalles del problema o espacio</label>
        <textarea
          className="hd-textarea"
          placeholder="Describe brevemente lo que ocurre para que el profesional lleve las herramientas y repuestos adecuados..."
          value={f.desc}
          onChange={set("desc")}
        />
      </div>

      <div className="hd-form-row">
        <div className="hd-field">
          <label>Fecha programada</label>
          <input
            type="date"
            className="hd-input"
            min={today()}
            value={f.date}
            onChange={set("date")}
          />
        </div>
        <div className="hd-field">
          <label>Presupuesto estimado (COP)</label>
          <input
            type="number"
            min="0"
            step="5000"
            className="hd-input"
            value={f.price}
            onChange={set("price")}
          />
        </div>
      </div>

      <div className="hd-field">
        <label>Dirección en el Área Metropolitana</label>
        <input className="hd-input" value={f.address} onChange={set("address")} />
      </div>

      {/* La fotografía se sube a Firebase Storage al enviar la solicitud. */}
      <div className="hd-field">
        <label>Fotos del daño o espacio (opcional)</label>
        <div className={`hd-photo-uploader ${photoPreview ? "uploaded" : ""}`}>
          {photoPreview ? (
            <div className="hd-photo-preview">
              <img src={photoPreview} alt="Foto adjunta" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "cover" }} />
              <button
                type="button"
                className="hd-link"
                style={{ fontSize: 12, marginTop: 4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
              >
                ✕ Quitar fotografía
              </button>
            </div>
          ) : (
            <label className="hd-photo-prompt" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="camera" size={20} />
              <span>Adjuntar foto del daño o espacio (JPG, PNG)</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    setSubmitError("Adjunta una imagen JPG o PNG.");
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setSubmitError("La fotografía debe pesar máximo 5 MB.");
                    return;
                  }
                  setSubmitError("");
                  setPhotoFile(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          )}
        </div>
      </div>

      {submitError && <div className="hd-form-error" role="alert">{submitError}</div>}

      <div className="hd-guarantee-note">
        <Icon name="shieldCheck" size={18} />
        <div>
          <strong>Protegido con Garantía Home</strong>
          <span>30 días de cobertura y pago contra satisfacción.</span>
        </div>
      </div>

      <div className="hd-modal-actions">
        <button className="hd-btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="hd-btn" disabled={!ok} onClick={submit}>
          {submitting ? "Enviando solicitud…" : "Enviar solicitud directa"}
        </button>
      </div>
    </Modal>
  );
}

function WorkerProfileModal({ worker, cat, reviews = [], onClose, onBook }) {
  return (
    <Modal title={`Perfil de ${worker.name}`} onClose={onClose} wide>
      <div className="hd-worker-modal-body">
        <div className="hd-worker-modal-head">
          <Avatar look={worker.look} name={worker.name} photo={worker.photo} size={80} ring="#006a63" />
          <div>
            <h2>{worker.name}</h2>
            <div className="hd-badge-pill-inline">
              <Icon name="shieldCheck" size={15} />
              <span>Profesional Verificado · Licencia activa</span>
            </div>
            <p className="hd-sub">
              {cat?.emoji} Especialista en {cat?.name} · {worker.zone}
            </p>
          </div>
        </div>

        <div className="hd-grid c3" style={{ margin: "18px 0" }}>
          <div className="hd-mini-stat">
            <strong>{worker.rating.toFixed(1)} ★</strong>
            <span>{worker.jobs} servicios realizados</span>
          </div>
          <div className="hd-mini-stat">
            <strong>{worker.years} años</strong>
            <span>de trayectoria técnica</span>
          </div>
          <div className="hd-mini-stat">
            <strong>{fmtCOP(worker.rate)}</strong>
            <span>tarifa estimada / hora</span>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <h4 style={{ margin: "0 0 6px" }}>Acerca del profesional</h4>
          <p style={{ margin: 0, color: "#5a4138", lineHeight: 1.6, fontSize: 14 }}>{worker.bio}</p>
        </div>

        {/* Galería de fotos reales de trabajos */}
        {worker.portfolio && worker.portfolio.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 10px" }}>Fotos reales de trabajos anteriores</h4>
            <div className="hd-portfolio-grid">
              {worker.portfolio.map((img, i) => (
                <div key={i} className="hd-portfolio-item">
                  <img src={img} alt={`Trabajo realizado ${i + 1}`} loading="lazy" />
                  <span className="hd-portfolio-caption">Trabajo certificado #{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reseñas de clientes */}
        <div>
          <h4 style={{ margin: "0 0 10px" }}>Opiniones de clientes verificados ({reviews.length})</h4>
          {reviews.length === 0 ? (
            <p style={{ color: "#8e7166", fontSize: 13 }}>Este profesional aún no tiene reseñas públicas.</p>
          ) : (
            <div className="hd-reviews-list">
              {reviews.map((v) => (
                <div key={v.id} className="hd-review-card">
                  <div className="hd-review-head">
                    <Avatar look={lookFor(v.client)} name={v.client} photo={v.photo} size={36} />
                    <div>
                      <strong>{v.client}</strong>
                      <span>{fmtDate(v.date)}</span>
                    </div>
                    <Stars value={v.rating} size={13} />
                  </div>
                  <p>{v.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hd-modal-actions" style={{ marginTop: 24 }}>
          <button className="hd-btn ghost" onClick={onClose}>
            Cerrar
          </button>
          <button className="hd-btn" onClick={onBook}>
            <Icon name="calendar" size={16} /> Solicitar a {worker.name.split(" ")[0]}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RateModal({ req, worker, onClose, onSubmit }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  return (
    <Modal title="Califica el servicio recibido" onClose={onClose}>
      <div className="hd-profile-head" style={{ marginBottom: 16 }}>
        <Avatar look={worker?.look ?? 0} name={worker?.name} photo={worker?.photo} size={54} />
        <div>
          <strong>{worker?.name}</strong>
          <br />
          <span style={{ fontSize: 13, color: "#5a4138" }}>{req.title}</span>
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "10px 0 20px" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>¿Cómo calificarías el trabajo?</p>
        <Stars value={stars} size={36} onChange={setStars} />
      </div>

      <div className="hd-field">
        <label>Comentario y testimonio</label>
        <textarea
          className="hd-textarea"
          placeholder="Escribe tu opinión sobre la puntualidad, limpieza y calidad del trabajo..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="hd-modal-actions">
        <button className="hd-btn ghost" onClick={onClose}>
          Ahora no
        </button>
        <button className="hd-btn" onClick={() => onSubmit(stars, text)}>
          Publicar calificación
        </button>
      </div>
    </Modal>
  );
}
