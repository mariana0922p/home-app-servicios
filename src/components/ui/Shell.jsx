import React, { useEffect, useState } from "react";
import { Icon } from "./Icons.jsx";
import { Avatar } from "./Kit.jsx";

const ROLE_LABEL = {
  cliente: "Cliente",
  trabajador: "Profesional",
  admin: "Administrador",
};

export default function Shell({
  role,
  nav,
  active,
  onNav,
  user,
  onLogout,
  title,
  subtitle,
  notifications = [],
  children,
}) {
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [active]);

  const go = (id) => {
    onNav(id);
    setOpen(false);
    setBell(false);
  };

  return (
    <div className={`hd-app role-${role}`}>
      {open && <div className="hd-scrim" onClick={() => setOpen(false)} />}

      {/* Barra lateral / Drawer */}
      <aside className={`hd-side ${open ? "open" : ""}`}>
        <div className="hd-side-brand">
          <img src="/img/logo.svg" alt="Home" width="40" height="40" style={{ borderRadius: 12 }} />
          <div className="hd-brand-text">
            <strong>Home</strong>
            <span>{role === "admin" ? "Panel de administración" : "Servicios para el Hogar"}</span>
          </div>
          <button
            className="hd-icon-btn hd-side-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú lateral"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav className="hd-nav">
          {nav.map((n) => (
            <button
              key={n.id}
              className={n.id === active ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
              {n.badge > 0 && <b>{n.badge}</b>}
            </button>
          ))}
        </nav>

        <div className="hd-side-foot">
          <div className="hd-guarantee">
            <Icon name="shieldCheck" size={20} />
            <div>
              <strong>Garantía Home</strong>
              <span>30 días en cada servicio</span>
            </div>
          </div>
          <div className="hd-userbox">
            <Avatar look={user.look} name={user.name} photo={user.photo} size={42} />
            <div className="hd-userbox-info">
              <strong>{user.name}</strong>
              <span>{ROLE_LABEL[role]}</span>
            </div>
          </div>
          <button className="hd-logout" onClick={onLogout}>
            <Icon name="logout" size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="hd-content">

        <header className="hd-top">
          <button
            className="hd-icon-btn hd-burger"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="hd-top-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="hd-top-actions">
            <div className="hd-bell-wrap">
              <button
                className="hd-icon-btn"
                onClick={() => setBell((b) => !b)}
                aria-label="Notificaciones"
              >
                <Icon name="bell" size={18} />
                {notifications.length > 0 && <i className="hd-dot">{notifications.length}</i>}
              </button>
              {bell && (
                <div className="hd-pop">
                  <div className="hd-pop-head">
                    <span>Notificaciones</span>
                    <button
                      className="hd-link"
                      style={{ fontSize: 11 }}
                      onClick={() => setBell(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                  {notifications.length === 0 && <p className="hd-pop-empty">Estás al día ✨</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className="hd-pop-item">
                      <Icon name={n.icon || "bell"} size={16} />
                      <div>
                        <span>{n.text}</span>
                        <em>{n.time}</em>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="hd-chip" onClick={() => onNav("perfil")}>
              <Avatar look={user.look} name={user.name} photo={user.photo} size={32} />
              <span>{user.name.split(" ")[0]}</span>
            </div>
          </div>
        </header>

        <main className="hd-page">{children}</main>

        <footer className="hd-foot">
          © 2026 Home Marketplace · Soluciones para el Hogar · Medellín, Colombia
        </footer>
      </div>

      {/* Navegación inferior fija en móviles (Mobile Bottom Navigation) */}
      <nav className="hd-bottom-nav" aria-label="Navegación móvil">
        {nav.map((n) => (
          <button
            key={n.id}
            className={`hd-bnav-btn ${n.id === active ? "active" : ""}`}
            onClick={() => go(n.id)}
          >
            <div className="hd-bnav-icon-wrap">
              <Icon name={n.icon} size={20} />
              {n.badge > 0 && <span className="hd-bnav-badge">{n.badge}</span>}
            </div>
            <span className="hd-bnav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
