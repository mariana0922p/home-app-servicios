// Documentos del profesional (hoja de vida y certificado) guardados en Firestore.
// No usa Firebase Storage (que exige plan de pago): funciona en el plan Spark gratuito.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export async function saveWorkerDoc(uid, kind, file) {
  // kind: "cv" | "cert"
  await setDoc(doc(db, "workerDocs", `${uid}_${kind}`), {
    uid,
    kind,
    name: file.name,
    type: file.type,
    size: file.size,
    data: file.data,
    uploadedAt: new Date().toISOString(),
  });
}

export async function getWorkerDoc(uid, kind) {
  const snap = await getDoc(doc(db, "workerDocs", `${uid}_${kind}`));
  return snap.exists() ? snap.data() : null;
}
