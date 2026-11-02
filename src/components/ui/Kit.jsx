import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "./Icons.jsx";
import { STATUS, lookFor } from "../../data/utils.js";

/* ---------- Avatar ilustrado original de HOME ---------- */
const BG = ["#fde3d0", "#cdeeea", "#ffe7b8", "#f6d4c8", "#dbe9f3"];
const SKIN = ["#f1c9a5", "#d9a77c", "#b47b54", "#8d5a3b", "#f6d7bd"];
const HAIR = ["#2b1d14", "#4a2c1a", "#1f1b17", "#6b3f1d", "#a0522d"];
const SHIRT = ["#ea580c", "#006a63", "#dd9a2b", "#455a64", "#c2410c"];

export function Avatar({ look = 0, name = "", size = 44, ring, photo }) {
  const [imgError, setImgError] = useState(false);

  // Si el usuario cargó su propia foto o documento real y no ha fallado, mostrarla
  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={name || "Usuario"}
        loading="lazy"
        onError={() => setImgError(true)}
        className="hd-avatar"
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  // Avatar ilustrado original con código SVG nativo
  const l = typeof look === "number" ? Math.abs(look) : lookFor(look || name);
  const bg = BG[l % 5];
  const skin = SKIN[(l * 3 + 1) % 5];
  const hair = HAIR[(l * 2) % 5];
  const shirt = SHIRT[(l + 2) % 5];
  const style = l % 4;

  return (
    <svg
      className="hd-avatar"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "50%",
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
        display: "block",
      }}
    >
      <rect width="64" height="64" fill={bg} />
      {style === 1 && (
        <path d="M18 30C15 8 49 8 46 30V46C46 49 41 49 41 46V31H23V46C23 49 18 49 18 46Z" fill={hair} />
      )}
      <path d="M6 66C6 52 19 45 32 45S58 52 58 66Z" fill={shirt} />
      <rect x="27" y="37" width="10" height="10" rx="4" fill={skin} />
      <ellipse cx="32" cy="29" rx="11" ry="13" fill={skin} />
      {style === 0 && <path d="M20 28C19 13 45 13 44 28C40 20 24 20 20 28Z" fill={hair} />}
      {style === 1 && <path d="M20 27C21 14 43 14 44 27C38 21 26 21 20 27Z" fill={hair} />}
      {style === 2 && (
        <>
          <circle cx="32" cy="12" r="6" fill={hair} />
          <path d="M20 28C19 13 45 13 44 28C40 20 24 20 20 28Z" fill={hair} />
        </>
      )}
      {style === 3 && (
        <>
          <path d="M19 25C19 10 45 10 45 25Z" fill="#ea580c" />
          <rect x="17" y="24" width="30" height="4" rx="2" fill="#c2410c" />
        </>
      )}
      <circle cx="27.5" cy="31" r="1.3" fill="#1f1b17" />
      <circle cx="36.5" cy="31" r="1.3" fill="#1f1b17" />
      <path d="M28 36.5q4 3 8 0" stroke="#1f1b17" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Stars({ value = 0, size = 14, onChange }) {
  return (
    <span className="hd-stars" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= Math.round(value);
        const Tag = onChange ? "button" : "span";
        return (
          <Tag
            key={i}
            type={onChange ? "button" : undefined}
            onClick={onChange ? () => onChange(i) : undefined}
            className={`hd-star ${on ? "on" : ""}`}
          >
            <Icon name="star" size={size} fill={on ? "currentColor" : "none"} />
          </Tag>
        );
      })}
    </span>
  );
}

export const Badge = ({ status, children, tone }) => {
  const s = STATUS[status];
  return (
    <span className={`hd-badge tone-${tone || s?.tone || "gray"}`}>
      {children || s?.label || status}
    </span>
  );
};

/* ---------- Modal Responsive ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="hd-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`hd-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="hd-modal-handle-bar" onClick={onClose} />
        <div className="hd-modal-head">
          <h3>{title}</h3>
          <button className="hd-icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="hd-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, text, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="hd-toasts">
        {items.map((t) => (
          <div key={t.id} className={`hd-toast ${t.type}`}>
            <Icon name={t.type === "error" ? "x" : "check"} size={16} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Tarjetas y Estadísticas ---------- */
export const StatCard = ({ icon, label, value, hint, tone = "orange" }) => (
  <div className="hd-stat">
    <div className={`hd-stat-icon tone-${tone}`}>
      <Icon name={icon} size={20} />
    </div>
    <div className="hd-stat-info">
      <div className="hd-stat-label">{label}</div>
      <div className="hd-stat-value">{value}</div>
      {hint && <div className="hd-stat-hint">{hint}</div>}
    </div>
  </div>
);

export const Empty = ({ icon = "list", title, text }) => (
  <div className="hd-empty">
    <div className="hd-empty-icon">
      <Icon name={icon} size={26} />
    </div>
    <strong>{title}</strong>
    {text && <p>{text}</p>}
  </div>
);

export const Card = ({ title, action, children, className = "" }) => (
  <section className={`hd-card ${className}`}>
    {(title || action) && (
      <header className="hd-card-head">
        <h3>{title}</h3>
        {action}
      </header>
    )}
    {children}
  </section>
);

/* ---------- Gráficas SVG Originales ---------- */
export function BarChart({ data, format = (v) => v, color = "#ea580c", height = 190 }) {
  if (!data || data.length === 0) {
    return <Empty title="Sin datos suficientes para graficar" />;
  }
  const W = 360,
    pad = 26,
    max = Math.max(...data.map((d) => d.v)) * 1.15 || 1;
  const bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="hd-chart" role="img">
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={W - pad}
          y1={height - 24 - (height - 48) * t}
          y2={height - 24 - (height - 48) * t}
          stroke="#f0e6e0"
        />
      ))}
      {data.map((d, i) => {
        const h = ((height - 48) * d.v) / max;
        const x = pad + i * bw + bw * 0.2;
        const last = i === data.length - 1;
        return (
          <g key={d.m || i}>
            <rect
              x={x}
              y={height - 24 - h}
              width={bw * 0.6}
              height={Math.max(h, 4)}
              rx="7"
              fill={last ? color : color + "66"}
            />
            <text x={x + bw * 0.3} y={height - 8} textAnchor="middle" fontSize="11" fill="#5a4138">
              {d.m}
            </text>
            {last && (
              <text
                x={x + bw * 0.3}
                y={height - 30 - h}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#1f1b17"
              >
                {format(d.v)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function AreaChart({ data, color = "#006a63", height = 190, format = (v) => v }) {
  if (!data || data.length < 2) {
    return <Empty title="Esperando registros para graficar" />;
  }
  const W = 360,
    pad = 28,
    max = Math.max(...data.map((d) => d.v)) * 1.15 || 1;
  const step = (W - pad * 2) / (data.length - 1);
  const pts = data.map((d, i) => [pad + i * step, height - 26 - ((height - 52) * d.v) / max]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const gid = "ag" + color.replace("#", "");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="hd-chart" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={W - pad}
          y1={height - 26 - (height - 52) * t}
          y2={height - 26 - (height - 52) * t}
          stroke="#f0e6e0"
        />
      ))}
      <path
        d={`${line} L${pts[pts.length - 1][0]} ${height - 26} L${pts[0][0]} ${height - 26}Z`}
        fill={`url(#${gid})`}
      />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
          <text x={p[0]} y={height - 8} textAnchor="middle" fontSize="11" fill="#5a4138">
            {data[i].m}
          </text>
        </g>
      ))}
      <text
        x={pts[pts.length - 1][0]}
        y={pts[pts.length - 1][1] - 11}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#1f1b17"
      >
        {format(data[data.length - 1].v)}
      </text>
    </svg>
  );
}

export function Donut({ parts = [], center = 0 }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const R = 52,
    C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="hd-donut">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f0e6e0" strokeWidth="18" />
        {parts.map((p) => {
          const len = (p.value / total) * C;
          const el = (
            <circle
              key={p.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth="18"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 70 70)"
            />
          );
          acc += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1f1b17">
          {center}
        </text>
        <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#5a4138">
          solicitudes
        </text>
      </svg>
      <ul>
        {parts.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color }} />
            {p.label}
            <b>{Math.round((p.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Steps({ status }) {
  const order = ["pendiente", "aceptada", "en_progreso", "completada"];
  const labels = ["Enviada", "Aceptada", "En curso", "Completada"];
  const idx = order.indexOf(status);
  if (idx < 0) return null;
  return (
    <div className="hd-steps">
      {labels.map((l, i) => (
        <div key={l} className={`hd-step ${i <= idx ? "done" : ""}`}>
          <span>{i < idx || status === "completada" ? <Icon name="check" size={12} /> : i + 1}</span>
          <em>{l}</em>
        </div>
      ))}
    </div>
  );
}
