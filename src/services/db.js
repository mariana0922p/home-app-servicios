import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase.js";


const LOCAL_USERS_KEY = "home_ppi_users_db";
const LOCAL_REQUESTS_KEY = "home_ppi_requests_db";
const LOCAL_SETTINGS_KEY = "home_ppi_settings_db";
const LOCAL_REVIEWS_KEY = "home_ppi_reviews_db";
const DEFAULT_SETTINGS = { commission: 15, maintenance: false, notifyInApp: true };

function getLocal(key, defaultVal) {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocal(key, val) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* El almacenamiento local es solo una caché de respaldo. */
  }
}

function cleanProfile(uid, profile) {
  return { ...profile, uid, updatedAt: new Date().toISOString() };
}

function publicProfessionalProfile(uid, profile) {
  return {
    uid,
    id: uid,
    name: profile.name || "Profesional HOME",
    role: "trabajador",
    cat: profile.cat || "",
    zone: profile.zone || "",
    rate: Number(profile.rate || 0),
    years: Number(profile.years || 0),
    bio: profile.bio || "",
    rating: Number(profile.rating || 0),
    jobs: Number(profile.jobs || 0),
    photo: profile.photo || "",
    portfolio: Array.isArray(profile.portfolio) ? profile.portfolio : [],
    status: profile.status || "pendiente",
    approvalStatus: profile.approvalStatus || "pendiente_revision",
    approvalNotes: profile.approvalNotes || "",
    updatedAt: new Date().toISOString(),
  };
}

function snapshotRows(snap) {
  return snap.docs.map((item) => ({ ...item.data(), id: item.id, uid: item.id }));
}

function normalizeCommissionRate(value, fallback = 0.15) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number > 1 ? number / 100 : number;
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  if (firebaseConfigured) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const profile = snap.data();
    const local = getLocal(LOCAL_USERS_KEY, {});
    local[uid] = profile;
    setLocal(LOCAL_USERS_KEY, local);
    return profile;
  }
  const local = getLocal(LOCAL_USERS_KEY, {});
  return local[uid] || null;
}

export async function saveUserProfile(uid, profileData) {
  if (!uid) throw new Error("No se pudo identificar el usuario.");
  const payload = cleanProfile(uid, profileData);
  const local = getLocal(LOCAL_USERS_KEY, {});
  const mergedProfile = { ...(local[uid] || {}), ...payload };
  local[uid] = mergedProfile;
  setLocal(LOCAL_USERS_KEY, local);

  if (firebaseConfigured) {
    // El perfil privado y los datos públicos del profesional viven separados.
    await setDoc(doc(db, "users", uid), payload, { merge: true });
    if (mergedProfile.role === "trabajador") {
      await setDoc(doc(db, "professionals", uid), publicProfessionalProfile(uid, mergedProfile), { merge: true });
    }
  }
  return true;
}

export async function updateUserStatus(uid, status) {
  const local = getLocal(LOCAL_USERS_KEY, {});
  if (local[uid]) {
    local[uid].status = status;
    setLocal(LOCAL_USERS_KEY, local);
  }
  if (!firebaseConfigured) return;
  await updateDoc(doc(db, "users", uid), { status, updatedAt: new Date().toISOString() });
  try {
    await updateDoc(doc(db, "professionals", uid), { status, updatedAt: new Date().toISOString() });
  } catch {
    // Los clientes y perfiles antiguos no tienen documento público de profesional.
  }
}

export async function updateWorkerApproval(uid, { approvalStatus, approvalNotes = "" }) {
  const status = approvalStatus === "aprobado" ? "activo" : approvalStatus === "rechazado" ? "rechazado" : "pendiente";
  const patch = { approvalStatus, approvalNotes, status, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const local = getLocal(LOCAL_USERS_KEY, {});
  if (local[uid]) {
    local[uid] = { ...local[uid], ...patch };
    setLocal(LOCAL_USERS_KEY, local);
  }
  if (!firebaseConfigured) return;
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("No se encontró el perfil del profesional en Firestore.");
  const nextProfile = { ...userSnap.data(), ...patch, uid };
  const batch = writeBatch(db);
  batch.update(userRef, patch);
  // Crear/actualizar el resumen público desde el perfil real evita publicar documentos antiguos
  // con un documento público incompleto. Los archivos privados nunca se copian al catálogo.
  batch.set(doc(db, "professionals", uid), publicProfessionalProfile(uid, nextProfile), { merge: true });
  await batch.commit();
}

/* SOLICITUDES: el identificador se genera por solicitud y no se comparte entre cuentas. */
export async function createRealRequest(requestData, commissionRate = 0.15) {
  const quoteAmount = Number(requestData.price || requestData.quoteAmount || 0);
  commissionRate = normalizeCommissionRate(commissionRate);
  const homeCommission = Math.round(quoteAmount * commissionRate);
  const workerEarnings = Math.max(0, quoteAmount - homeCommission);
  const newReq = {
    ...requestData,
    id: requestData.id || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    price: quoteAmount,
    quoteAmount,
    commissionRate,
    homeCommission,
    workerEarnings,
    status: requestData.status || "pendiente",
    created: requestData.created || new Date().toISOString().slice(0, 10),
    rating: requestData.rating ?? null,
    reviewText: requestData.reviewText ?? null,
    updatedAt: new Date().toISOString(),
  };
  const localReqs = getLocal(LOCAL_REQUESTS_KEY, []);
  setLocal(LOCAL_REQUESTS_KEY, [newReq, ...localReqs.filter((r) => r.id !== newReq.id)]);
  if (firebaseConfigured) await setDoc(doc(db, "requests", newReq.id), newReq);
  return newReq;
}

export async function updateRealRequest(id, patch, currentCommissionRate = 0.15) {
  if (!id) return null;
  const localReqs = getLocal(LOCAL_REQUESTS_KEY, []);
  const hasPriceChange = Object.prototype.hasOwnProperty.call(patch, "price")
    || Object.prototype.hasOwnProperty.call(patch, "quoteAmount");
  let original = localReqs.find((item) => item.id === id) || {};

  if (firebaseConfigured) {
    const snap = await getDoc(doc(db, "requests", id));
    if (snap.exists()) original = { ...snap.data(), id };
  }

  const commRate = normalizeCommissionRate(original.commissionRate, normalizeCommissionRate(currentCommissionRate));
  const price = patch.price !== undefined
    ? Number(patch.price)
    : patch.quoteAmount !== undefined
      ? Number(patch.quoteAmount)
      : Number(original.price || 0);
  const updatedReq = {
    ...original,
    ...patch,
    id,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };
  if (hasPriceChange) {
    updatedReq.price = price;
    updatedReq.quoteAmount = price;
    updatedReq.commissionRate = commRate;
    updatedReq.homeCommission = Math.round(price * commRate);
    updatedReq.workerEarnings = Math.max(0, price - updatedReq.homeCommission);
  }

  if (firebaseConfigured) {
    // Envía únicamente los campos modificados: cancelar una solicitud no debe reescribir
    // precio/comisiones, y los cambios de estado respetan las reglas de acceso por rol.
    await updateDoc(doc(db, "requests", id), {
      ...patch,
      ...(hasPriceChange ? {
        price,
        quoteAmount: price,
        commissionRate: commRate,
        homeCommission: Math.round(price * commRate),
        workerEarnings: Math.max(0, price - Math.round(price * commRate)),
      } : {}),
      updatedAt: patch.updatedAt || new Date().toISOString(),
    });
  }
  setLocal(LOCAL_REQUESTS_KEY, [updatedReq, ...localReqs.filter((item) => item.id !== id)]);
  return updatedReq;
}

export async function saveRealReview(review) {
  const local = getLocal(LOCAL_REVIEWS_KEY, []);
  setLocal(LOCAL_REVIEWS_KEY, [review, ...local.filter((item) => item.id !== review.id)]);
  if (firebaseConfigured) await setDoc(doc(db, "reviews", review.id), review);
}

export async function savePlatformCategory(category) {
  if (!category?.id) return;
  if (firebaseConfigured) await setDoc(doc(db, "categories", category.id), { ...category, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function getPlatformSettings() {
  if (firebaseConfigured) {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) return { ...DEFAULT_SETTINGS, ...snap.data() };
    return DEFAULT_SETTINGS;
  }
  return getLocal(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS);
}

export async function savePlatformSettings(patch) {
  const current = await getPlatformSettings();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  setLocal(LOCAL_SETTINGS_KEY, next);
  if (firebaseConfigured) await setDoc(doc(db, "settings", "global"), next, { merge: true });
  return next;
}

/**
 * Sincroniza datos según rol. Evita descargar perfiles privados de otros usuarios
 * a los paneles de cliente/profesional. Las solicitudes se actualizan en tiempo real.
 */
export function subscribeMarketplaceData({ role, uid }, onData, onError = () => {}) {
  if (!firebaseConfigured) {
    const users = getLocal(LOCAL_USERS_KEY, {});
    const requests = getLocal(LOCAL_REQUESTS_KEY, []);
    const reviews = getLocal(LOCAL_REVIEWS_KEY, []);
    const allWorkers = Object.values(users).filter((u) => u.role === "trabajador").map((user) => ({
      ...user,
      approvalStatus: user.approvalStatus || "pendiente_revision",
      status: user.approvalStatus === "aprobado" && user.status === "activo"
        ? "activo"
        : user.status === "suspendido" ? "suspendido" : "pendiente",
    }));
    const allClients = Object.values(users).filter((u) => u.role === "cliente");
    const workerVisible = role === "trabajador" ? allWorkers.filter((w) => w.uid === uid || w.id === uid) : allWorkers;
    onData({
      fromFirestore: false,
      workers: role === "admin" ? allWorkers : role === "cliente" ? allWorkers.filter((w) => w.status === "activo" && w.approvalStatus === "aprobado") : workerVisible,
      clients: role === "admin" ? allClients : allClients.filter((c) => c.uid === uid || c.id === uid),
      requests: role === "admin" ? requests : requests.filter((r) => role === "cliente" ? r.clientId === uid : r.workerId === uid),
      reviews: role === "admin" ? reviews : reviews.filter((r) => role === "cliente" ? true : r.workerId === uid),
      categories: [],
      settings: getLocal(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS),
    });
    return () => {};
  }

  const values = { users: [], profile: null, workers: [], requests: [], reviews: [], settings: DEFAULT_SETTINGS, categories: [] };
  const received = new Set();
  const listeners = [];
  const expectedKeys = role === "admin"
    ? ["users", "requests", "reviews", "settings", "categories"]
    : role === "trabajador"
    ? ["profile", "requests", "reviews", "settings", "categories"]
    : ["profile", "workers", "requests", "reviews", "settings", "categories"];

  const emitIfReady = () => {
    if (expectedKeys.some((key) => !received.has(key))) return;
    let workers = [];
    let clients = [];
    if (role === "admin") {
      workers = values.users.filter((u) => u.role === "trabajador").map((user) => {
        // Los registros antiguos sin decisión explícita también requieren aprobación manual.
        const approvalStatus = user.approvalStatus || "pendiente_revision";
        const status = approvalStatus === "aprobado" && user.status === "activo"
          ? "activo"
          : user.status === "suspendido" ? "suspendido" : "pendiente";
        return { ...user, approvalStatus, status };
      });
      clients = values.users.filter((u) => u.role === "cliente");
    } else if (role === "trabajador") {
      if (values.profile?.role === "trabajador") {
        const approvalStatus = values.profile.approvalStatus || "pendiente_revision";
        const status = approvalStatus === "aprobado" && values.profile.status === "activo"
          ? "activo"
          : values.profile.status === "suspendido" ? "suspendido" : "pendiente";
        workers = [{ ...values.profile, approvalStatus, status }];
      } else {
        workers = [];
      }
      const clientMap = new Map();
      values.requests.forEach((r) => {
        if (r.clientId) clientMap.set(r.clientId, {
          id: r.clientId, uid: r.clientId, name: r.clientName || "Cliente", phone: r.clientPhone || "", email: r.clientEmail || "",
        });
      });
      clients = [...clientMap.values()];
    } else {
      workers = values.workers;
      clients = values.profile?.role === "cliente" ? [values.profile] : [];
    }
    onData({
      fromFirestore: true,
      workers,
      clients,
      requests: values.requests,
      reviews: values.reviews,
      settings: values.settings,
      categories: values.categories || [],
    });
  };

  const listenCollection = (key, sourceQuery) => {
    listeners.push(onSnapshot(sourceQuery, (snap) => {
      values[key] = snapshotRows(snap);
      received.add(key);
      emitIfReady();
    }, onError));
  };
  const listenDoc = (key, path) => {
    listeners.push(onSnapshot(doc(db, ...path), (snap) => {
      values[key] = snap.exists() ? { ...snap.data(), id: snap.id, uid: snap.id } : null;
      received.add(key);
      emitIfReady();
    }, onError));
  };
  const listenSettings = () => {
    listeners.push(onSnapshot(doc(db, "settings", "global"), (snap) => {
      values.settings = snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : DEFAULT_SETTINGS;
      received.add("settings");
      emitIfReady();
    }, onError));
  };

  if (role === "admin") {
    listenCollection("users", collection(db, "users"));
    listenCollection("requests", collection(db, "requests"));
    listenCollection("reviews", collection(db, "reviews"));
    listenCollection("categories", collection(db, "categories"));
    listenSettings();
  } else if (role === "trabajador") {
    listenDoc("profile", ["users", uid]);
    listenCollection("requests", query(collection(db, "requests"), where("workerId", "==", uid)));
    listenCollection("reviews", query(collection(db, "reviews"), where("workerId", "==", uid)));
    listenCollection("categories", collection(db, "categories"));
    listenSettings();
  } else {
    listenDoc("profile", ["users", uid]);
    listenCollection("workers", query(
      collection(db, "professionals"),
      where("approvalStatus", "==", "aprobado"),
      where("status", "==", "activo")
    ));
    listenCollection("requests", query(collection(db, "requests"), where("clientId", "==", uid)));
    listenCollection("reviews", collection(db, "reviews"));
    listenCollection("categories", collection(db, "categories"));
    listenSettings();
  }

  return () => listeners.forEach((unsubscribe) => unsubscribe());
}

/** Compatibilidad para proyectos sin Firebase; no crea cuentas reales ni aprueba profesionales. */
export async function syncInitialData() {
  // Sin Firebase no existe una base real de autenticación. Se descartan cachés antiguas
  // de prototipos para evitar que se muestren cuentas/solicitudes de prueba como reales.
  if (firebaseConfigured) return;
  setLocal(LOCAL_USERS_KEY, {});
  setLocal(LOCAL_REQUESTS_KEY, []);
  setLocal(LOCAL_REVIEWS_KEY, []);
  setLocal(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS);
}

/** Catálogo mínimo público para la landing; solo devuelve profesionales aprobados. */
export function subscribePublicCatalog(onData, onError = () => {}) {
  if (!firebaseConfigured) {
    // La landing no trata cachés del navegador como catálogo oficial.
    onData({ workers: [], reviews: [] });
    return () => {};
  }
  let workers = [];
  let reviews = [];
  let gotWorkers = false;
  let gotReviews = false;
  const emit = () => {
    if (gotWorkers && gotReviews) onData({ workers, reviews });
  };
  const unsubWorkers = onSnapshot(
    query(collection(db, "professionals"), where("approvalStatus", "==", "aprobado"), where("status", "==", "activo")),
    (snap) => { workers = snapshotRows(snap); gotWorkers = true; emit(); },
    onError
  );
  const unsubReviews = onSnapshot(
    collection(db, "reviews"),
    (snap) => { reviews = snapshotRows(snap); gotReviews = true; emit(); },
    onError
  );
  return () => { unsubWorkers(); unsubReviews(); };
}
