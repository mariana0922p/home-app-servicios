export const fmtCOP = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");
export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1]} ${y}`;
};
export const STATUS = {
  pendiente: { label: "Pendiente", tone: "amber" },
  aceptada: { label: "Aceptada", tone: "teal" },
  en_progreso: { label: "En curso", tone: "orange" },
  completada: { label: "Completada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
  cancelada: { label: "Cancelada", tone: "gray" },
  activo: { label: "Activo", tone: "green" },
  suspendido: { label: "Suspendido", tone: "red" },
};
export const lookFor = (str = "") => [...str].reduce((a, c) => a + c.charCodeAt(0), 0) % 10;
export const today = () => new Date().toISOString().slice(0, 10);
export const downloadCSV = (filename, rows) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};
