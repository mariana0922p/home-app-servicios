import * as XLSX from "xlsx";
import { fmtCOP, fmtDate } from "./utils.js";

// Función de seguridad contra Inyección de Fórmulas en Excel (CSV/XLSX Injection)
export function sanitizeCell(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("=") || trimmed.startsWith("+") || trimmed.startsWith("-") || trimmed.startsWith("@")) {
      return `'${value}`;
    }
  }
  return value ?? "";
}

// -------------------------------------------------------------
// 1. REPORTE DE GANANCIAS INDIVIDUAL DEL PROFESIONAL
// -------------------------------------------------------------
export function exportWorkerEarningsExcel(worker, requests = [], settlements = []) {
  const wb = XLSX.utils.book_new();

  const rateFor = (r) => {
    const raw = Number(r.commissionRate ?? 0.15);
    return raw > 1 ? raw / 100 : raw;
  };
  const commissionFor = (r) => r.homeCommission != null
    ? Number(r.homeCommission)
    : Math.round((Number(r.price) || 0) * rateFor(r));
  const netFor = (r) => r.workerEarnings != null
    ? Number(r.workerEarnings)
    : Math.max(0, (Number(r.price) || 0) - commissionFor(r));
  // Filtrar solo las solicitudes completadas del profesional
  const completed = requests.filter((r) => r.workerId === worker.id && r.status === "completada");
  const totalBilled = completed.reduce((acc, r) => acc + (Number(r.price) || 0), 0);
  const totalCommission = completed.reduce((acc, r) => acc + commissionFor(r), 0);
  const totalNet = completed.reduce((acc, r) => acc + netFor(r), 0);
  
  const totalPaid = settlements
    .filter((s) => s.workerId === worker.id && s.status === "pagado")
    .reduce((acc, s) => acc + (s.amount || 0), 0);
  const pendingSettlement = Math.max(0, totalNet - totalPaid);

  // Hoja 1: Resumen
  const summaryData = [
    ["HOME MARKETPLACE - REPORTE DE GANANCIAS DEL PROFESIONAL"],
    ["Fecha de generación:", new Date().toLocaleString("es-CO")],
    [],
    ["DATOS DEL PROFESIONAL"],
    ["Nombre:", sanitizeCell(worker.name)],
    ["Identificación / ID:", sanitizeCell(worker.id)],
    ["Correo:", sanitizeCell(worker.email)],
    ["Teléfono:", sanitizeCell(worker.phone)],
    ["Especialidad:", sanitizeCell(worker.cat)],
    ["Zona de atención:", sanitizeCell(worker.zone)],
    [],
    ["RESUMEN FINANCIERO CONSOLIDADO"],
    ["Métrica", "Valor"],
    ["Total de servicios completados:", completed.length],
    ["Total facturado (Valor de servicios):", totalBilled],
    ["Comisión retenida por HOME (según cada solicitud):", totalCommission],
    ["Importe neto correspondiente al profesional (según cada solicitud):", totalNet],
    ["Total pagos efectivamente liquidados y recibidos:", totalPaid],
    ["Saldo pendiente por liquidar:", pendingSettlement],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  // Ajuste de anchos de columna
  wsSummary["!cols"] = [{ wch: 45 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen General");

  // Hoja 2: Detalle de Servicios Completados
  const detailHeaders = [
    "ID Solicitud",
    "Fecha del Servicio",
    "Servicio / Descripción",
    "Valor Total (COP)",
    "Comisión HOME (COP)",
    "Neto Profesional (COP)",
    "Estado del Servicio",
    "Estado de Liquidación",
    "Dirección de Atención"
  ];

  const detailRows = completed.map((r) => {
    const comm = commissionFor(r);
    const net = netFor(r);
    return [
      sanitizeCell(r.id),
      r.date || "—",
      sanitizeCell(r.title),
      r.price || 0,
      comm,
      net,
      "Completado",
      r.settlementStatus || "Pendiente de registro",
      sanitizeCell(r.address)
    ];
  });

  // Fila de totales
  if (detailRows.length > 0) {
    detailRows.push([
      "TOTALES",
      "",
      "",
      totalBilled,
      totalCommission,
      totalNet,
      "",
      "",
      ""
    ]);
  }

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  wsDetail["!cols"] = [
    { wch: 14 },
    { wch: 15 },
    { wch: 35 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle de Servicios");

  // Descarga directa del archivo .xlsx
  const safeName = (worker.name || "profesional").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `HOME_Ganancias_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// -------------------------------------------------------------
// 2. REPORTE FINANCIERO GENERAL DE HOME (ADMINISTRADOR)
// -------------------------------------------------------------
export function exportAdminFinancialExcel({
  requests = [],
  workers = [],
  clients = [],
  categories = [],
  settlements = [],
  settings = { commission: 15 },
  filters = {}
}) {
  const wb = XLSX.utils.book_new();

  // Filtrado de solicitudes según filtros seleccionados
  let filtered = [...requests];
  if (filters.startDate) {
    filtered = filtered.filter((r) => r.date >= filters.startDate);
  }
  if (filters.endDate) {
    filtered = filtered.filter((r) => r.date <= filters.endDate);
  }
  if (filters.cat && filters.cat !== "todas") {
    filtered = filtered.filter((r) => r.cat === filters.cat);
  }
  if (filters.status && filters.status !== "todas") {
    filtered = filtered.filter((r) => r.status === filters.status);
  }

  const completed = filtered.filter((r) => r.status === "completada");
  const rateFor = (r) => {
    const raw = Number(r.commissionRate);
    return r.commissionRate != null ? (raw >= 0 && raw <= 1 ? raw : raw / 100) : Number(settings.commission ?? 15) / 100;
  };
  const commissionFor = (r) => r.homeCommission != null
    ? Number(r.homeCommission)
    : Math.round((Number(r.price) || 0) * rateFor(r));
  const netFor = (r) => r.workerEarnings != null
    ? Number(r.workerEarnings)
    : Math.max(0, (Number(r.price) || 0) - commissionFor(r));
  const totalVolume = completed.reduce((acc, r) => acc + (Number(r.price) || 0), 0);
  const totalHomeGross = completed.reduce((acc, r) => acc + commissionFor(r), 0);
  const totalWorkersNet = completed.reduce((acc, r) => acc + netFor(r), 0);
  
  const totalSettledToWorkers = settlements
    .filter((s) => s.status === "pagado")
    .reduce((acc, s) => acc + (s.amount || 0), 0);
  const pendingSettlements = Math.max(0, totalWorkersNet - totalSettledToWorkers);

  // Helper nombres
  const getWorkerName = (id) => workers.find((w) => w.id === id)?.name || "Profesional no asignado";
  const getClientName = (id) => clients.find((c) => c.id === id)?.name || "Cliente general";
  const getCatName = (id) => categories.find((c) => c.id === id)?.name || id;

  // Hoja 1: Resumen Ejecutivo
  const summaryAoa = [
    ["HOME MARKETPLACE - INFORME FINANCIERO Y LIQUIDACIONES"],
    ["Fecha de emisión:", new Date().toLocaleString("es-CO")],
    ["Período considerado:", `${filters.startDate || "Inicio"} hasta ${filters.endDate || "Presente"}`],
    ["Tasa de comisión HOME configurada:", `${settings.commission}%`],
    [],
    ["INDICADORES CLAVE DE NEGOCIO"],
    ["Concepto", "Cifra"],
    ["Total solicitudes en el período:", filtered.length],
    ["Servicios completados exitosamente:", completed.length],
    ["Tasa de finalización efectiva:", `${filtered.length ? Math.round((completed.length / filtered.length) * 100) : 0}%`],
    ["Volumen total transado (Mano de obra):", totalVolume],
    ["Comisiones brutas generadas para HOME:", totalHomeGross],
    ["Importe neto adeudado a profesionales:", totalWorkersNet],
    ["Liquidaciones registradas en HOME:", totalSettledToWorkers],
    ["Neto sin liquidación registrada:", pendingSettlements],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary["!cols"] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Ejecutivo");

  // Hoja 2: Operaciones y Transacciones
  const txHeaders = [
    "ID Transacción / Solicitud",
    "Fecha",
    "Cliente",
    "Profesional",
    "Categoría",
    "Concepto del Trabajo",
    "Valor Total (COP)",
    "% Comisión",
    "Comisión HOME (COP)",
    "Neto Profesional (COP)",
    "Estado Servicio",
    "Estado Liquidación",
    "Dirección"
  ];

  const txRows = filtered.map((r) => {
    const isDone = r.status === "completada";
    const rateFraction = rateFor(r);
    const commRate = Math.round(rateFraction * 10000) / 100;
    const commVal = isDone ? commissionFor(r) : 0;
    const netVal = isDone ? netFor(r) : 0;

    return [
      sanitizeCell(r.id),
      r.date || "—",
      sanitizeCell(getClientName(r.clientId)),
      sanitizeCell(getWorkerName(r.workerId)),
      sanitizeCell(getCatName(r.cat)),
      sanitizeCell(r.title),
      r.price || 0,
      `${commRate}%`,
      commVal,
      netVal,
      sanitizeCell(r.status),
      r.settlementStatus || (isDone ? "Pendiente" : "N/A"),
      sanitizeCell(r.address)
    ];
  });

  if (txRows.length > 0) {
    txRows.push([
      "TOTALES (Completadas)",
      "",
      "",
      "",
      "",
      "",
      totalVolume,
      "",
      totalHomeGross,
      totalWorkersNet,
      "",
      "",
      ""
    ]);
  }

  const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
  wsTx["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 32 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, "Transacciones y Operaciones");

  // Hoja 3: Consolidado por Categoría
  const catHeaders = ["Categoría", "Servicios Registrados", "Servicios Completados", "Volumen Total (COP)", "Comisión HOME (COP)"];
  const catRows = categories.map((c) => {
    const catReqs = filtered.filter((r) => r.cat === c.id);
    const catDone = catReqs.filter((r) => r.status === "completada");
    const vol = catDone.reduce((acc, r) => acc + (r.price || 0), 0);
    const comm = catDone.reduce((acc, r) => acc + commissionFor(r), 0);
    return [
      sanitizeCell(c.name),
      catReqs.length,
      catDone.length,
      vol,
      comm
    ];
  });

  const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
  wsCat["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsCat, "Consolidado Categorías");

  // Descarga directa
  const fileName = `HOME_Reporte_Financiero_General_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// -------------------------------------------------------------
// 3. REPORTE DE PROFESIONALES Y ESTADO DE APROBACIÓN
// -------------------------------------------------------------
export function exportAdminWorkersExcel(workers = [], categories = [], requests = []) {
  const wb = XLSX.utils.book_new();

  const getCatName = (id) => categories.find((c) => c.id === id)?.name || id;

  const headers = [
    "ID Profesional",
    "Nombre y Apellidos",
    "Correo Electrónico",
    "Teléfono",
    "Especialidad",
    "Zona de Atención",
    "Años Experiencia",
    "Tarifa / Hora (COP)",
    "Estado de Aprobación",
    "Servicios Completados",
    "Calificación Promedio",
    "Total Ganancias Generadas (COP)",
    "Estado Disponibilidad"
  ];

  const rows = workers.map((w) => {
    const workerReqs = requests.filter((r) => r.workerId === w.id && r.status === "completada");
    const totalEarnings = workerReqs.reduce((acc, r) => {
      const commission = r.homeCommission != null
        ? Number(r.homeCommission)
        : Math.round(Number(r.price || 0) * (Number(r.commissionRate ?? 0.15) > 1 ? Number(r.commissionRate) / 100 : Number(r.commissionRate ?? 0.15)));
      const net = r.workerEarnings != null
        ? Number(r.workerEarnings)
        : Math.max(0, Number(r.price || 0) - commission);
      return acc + net;
    }, 0);

    return [
      sanitizeCell(w.id),
      sanitizeCell(w.name),
      sanitizeCell(w.email),
      sanitizeCell(w.phone),
      sanitizeCell(getCatName(w.cat)),
      sanitizeCell(w.zone),
      w.years || 0,
      w.rate || 0,
      sanitizeCell(w.approvalStatus || "pendiente_revision"),
      workerReqs.length,
      w.rating ?? 0,
      totalEarnings,
      w.available ? "Disponible" : "No disponible"
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 28 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 25 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Profesionales HOME");

  const fileName = `HOME_Reporte_Profesionales_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
