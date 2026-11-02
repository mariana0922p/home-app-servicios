import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { CATEGORIES } from "./seed.js";
import { today } from "./utils.js";
import { firebaseConfigured } from "../firebase.js";
import {
  createRealRequest,
  updateRealRequest,
  saveUserProfile,
  updateUserStatus,
  updateWorkerApproval,
  savePlatformSettings,
  savePlatformCategory,
  saveRealReview,
  subscribeMarketplaceData,
  syncInitialData,
} from "../services/db.js";

const initial = () => ({
  categories: CATEGORIES,
  // Los perfiles, solicitudes y reseñas provienen de cuentas reales, nunca de usuarios de ejemplo.
  workers: [],
  clients: [],
  requests: [],
  reviews: [],
  settings: { commission: 15, maintenance: false, notifyInApp: true },
});

function load() {
  // No se hidratan snapshots antiguos del localStorage: podrían contener cuentas de prueba.
  // El estado real llega desde Firestore al autenticar un usuario.
  if (!firebaseConfigured) syncInitialData();
  return initial();
}

const patchById = (list, id, patch) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));
const normalizeCommissionRate = (value, fallback = 0.15) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number > 1 ? number / 100 : number;
};

function reducer(s, a) {
  switch (a.type) {
    case "hydrate":
      return {
        ...s,
        categories: CATEGORIES.map((base) => ({
          ...base,
          ...(a.data.categories || []).find((item) => item.id === base.id),
        })),
        workers: a.data.workers || [],
        clients: a.data.clients || [],
        requests: a.data.requests || [],
        reviews: a.data.reviews || [],
        settings: { ...s.settings, ...(a.data.settings || {}) },
      };

    case "reset":
      return initial();

    case "identity": {
      if (a.role !== "trabajador" && a.role !== "cliente") return s;
      if (!a.uid) return s;
      const id = a.uid;
      const key = a.role === "trabajador" ? "workers" : "clients";
      const existing = s[key].find((x) => x.id === id);
      const record = {
        ...(existing || {}),
        ...a.patch,
        id,
        uid: id,
        role: a.role,
        status: a.patch.status || existing?.status || (a.role === "trabajador" ? "pendiente" : "activo"),
        ...(a.role === "trabajador" ? { approvalStatus: a.patch.approvalStatus || existing?.approvalStatus || "pendiente_revision" } : {}),
      };
      return { ...s, [key]: existing ? patchById(s[key], id, record) : [record, ...s[key]] };
    }

    case "createRequest": {
      const commissionRate = normalizeCommissionRate(
        a.req.commissionRate, Number(s.settings?.commission ?? 15) / 100
      );
      const price = Number(a.req.price || a.req.quoteAmount || 0);
      const homeCommission = Math.round(price * commissionRate);
      const workerEarnings = Math.max(0, price - homeCommission);
      const req = {
        ...a.req,
        id: a.req.id || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        price,
        quoteAmount: price,
        commissionRate,
        homeCommission,
        workerEarnings,
        created: today(),
        status: "pendiente",
        rating: null,
      };
      if (!a.persisted) createRealRequest(req, commissionRate).catch((err) => console.error("No se pudo guardar la solicitud:", err));
      return { ...s, requests: [req, ...s.requests.filter((item) => item.id !== req.id)] };
    }

    case "setRequest": {
      const commissionRate = Number(s.settings?.commission ?? 15) / 100;
      const target = s.requests.find((r) => r.id === a.id);
      const effectiveRate = normalizeCommissionRate(target?.commissionRate, commissionRate);
      const changesPrice = Object.prototype.hasOwnProperty.call(a.patch, "price")
        || Object.prototype.hasOwnProperty.call(a.patch, "quoteAmount");
      const updatedPrice = a.patch.price !== undefined
        ? Number(a.patch.price)
        : a.patch.quoteAmount !== undefined
          ? Number(a.patch.quoteAmount)
          : Number(target?.price || 0);
      const computedPatch = { ...a.patch, updatedAt: new Date().toISOString() };
      // Solo recalcular importes si cambió la cotización. Una cancelación o cambio de estado
      // no debe reescribir campos financieros que las reglas de Firestore protegen.
      if (changesPrice) {
        const homeCommission = Math.round(updatedPrice * effectiveRate);
        Object.assign(computedPatch, {
          price: updatedPrice,
          quoteAmount: updatedPrice,
          commissionRate: effectiveRate,
          homeCommission,
          workerEarnings: Math.max(0, updatedPrice - homeCommission),
        });
      }
      updateRealRequest(a.id, computedPatch, effectiveRate).catch((err) => console.error("No se pudo actualizar la solicitud:", err));
      return { ...s, requests: patchById(s.requests, a.id, computedPatch) };
    }

    case "updateWorker": {
      if (!a.persisted) saveUserProfile(a.id, a.patch).catch((err) => console.error("No se pudo actualizar el perfil profesional:", err));
      return { ...s, workers: patchById(s.workers, a.id, a.patch) };
    }

    case "setWorkerApproval": {
      const { id, approvalStatus, approvalNotes = "" } = a;
      const status = approvalStatus === "aprobado" ? "activo" : approvalStatus === "rechazado" ? "rechazado" : "pendiente";
      if (!a.persisted) updateWorkerApproval(id, { approvalStatus, approvalNotes }).catch((err) => console.error("No se pudo guardar la aprobación:", err));
      return { ...s, workers: patchById(s.workers, id, { approvalStatus, approvalNotes, status }) };
    }

    case "updateClient": {
      saveUserProfile(a.id, a.patch).catch((err) => console.error("No se pudo actualizar el cliente:", err));
      return { ...s, clients: patchById(s.clients, a.id, a.patch) };
    }

    case "toggleUserStatus": {
      const { id, role, currentStatus } = a;
      const nextStatus = currentStatus === "activo" ? "suspendido" : "activo";
      updateUserStatus(id, nextStatus).catch((err) => console.error("No se pudo actualizar el estado:", err));
      const key = role === "trabajador" ? "workers" : "clients";
      return { ...s, [key]: patchById(s[key], id, { status: nextStatus }) };
    }

    case "toggleCategory": {
      const categories = s.categories.map((c) => (c.id === a.id ? { ...c, active: !c.active } : c));
      const changed = categories.find((c) => c.id === a.id);
      if (changed) savePlatformCategory(changed).catch((err) => console.error("No se pudo guardar la categoría:", err));
      return { ...s, categories };
    }

    case "settings": {
      savePlatformSettings(a.patch).catch((err) => console.error("No se pudo guardar la configuración:", err));
      return { ...s, settings: { ...s.settings, ...a.patch } };
    }

    case "addReview":
      saveRealReview(a.review).catch((err) => console.error("No se pudo guardar la reseña:", err));
      return { ...s, reviews: [a.review, ...s.reviews.filter((r) => r.id !== a.review.id)] };

    case "registerNewUser": {
      const { role, userDoc } = a;
      const key = role === "trabajador" ? "workers" : "clients";
      return { ...s, [key]: [userDoc, ...s[key].filter((u) => u.id !== userDoc.id)] };
    }

    default:
      return s;
  }
}

const Ctx = createContext(null);

export function DataProvider({ session, children }) {
  const [state, dispatch] = useReducer(reducer, null, load);

  useEffect(() => {
    const uid = session?.user?.uid;
    if (!uid || !session?.role) return undefined;
    const unsubscribe = subscribeMarketplaceData(
      { role: session.role, uid },
      (data) => dispatch({ type: "hydrate", data }),
      (error) => console.error("Error sincronizando información de HOME:", error)
    );
    return unsubscribe;
  }, [session?.role, session?.user?.uid]);

  useEffect(() => {
    if (!session?.user || !session?.role || session.role === "admin") return;
    const uid = session.user.uid;
    const name = session.profile?.name || session.user?.displayName || session.user?.email?.split("@")[0];
    if (!name) return;
    dispatch({
      type: "identity",
      role: session.role,
      uid,
      patch: {
        name,
        email: session.user?.email || session.profile?.email || "",
        ...(session.profile?.phone ? { phone: session.profile.phone } : {}),
        ...(session.profile?.status ? { status: session.profile.status } : {}),
        ...(session.profile?.approvalStatus ? { approvalStatus: session.profile.approvalStatus } : {}),
        ...(session.profile?.cat ? { cat: session.profile.cat } : {}),
        ...(session.profile?.zone ? { zone: session.profile.zone } : {}),
      },
    });
  }, [session]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
