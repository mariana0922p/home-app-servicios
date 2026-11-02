/**
 * Provisiona de forma segura la primera cuenta de administrador usando Firebase Admin SDK.
 * No contiene correos ni contraseñas predeterminados.
 *
 * Requisitos:
 *   1. Descarga una clave de cuenta de servicio desde Firebase Console > Configuración > Cuentas de servicio.
 *   2. Configura GOOGLE_APPLICATION_CREDENTIALS con la ruta local de esa clave (no la subas al repositorio).
 *   3. Ejecuta: node scripts/create_admin.js <correo> <contraseña_segura_de_12_o_más_caracteres> "Nombre del administrador"
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Lee solo las variables no definidas en el entorno; nunca imprime sus valores.
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Falta VITE_FIREBASE_PROJECT_ID en el archivo .env.");
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const adminAuth = getAuth(app);
const firestore = getFirestore(app);

async function main() {
  const [, , emailArg, passwordArg, ...nameParts] = process.argv;
  const email = (emailArg || "").trim();
  const password = passwordArg || "";
  const name = nameParts.join(" ").trim() || "Administrador HOME";

  if (!email || !password) {
    console.error('Uso: node scripts/create_admin.js <correo> <contraseña_segura_de_12_o_más_caracteres> "Nombre del administrador"');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Usa una contraseña de al menos 12 caracteres.");
    process.exit(1);
  }

  let user;
  try {
    user = await adminAuth.createUser({ email, password, displayName: name, emailVerified: false });
    console.log("Cuenta de autenticación creada.");
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      user = await adminAuth.getUserByEmail(email);
      console.log("La cuenta ya existía; se actualizará su perfil administrativo.");
    } else {
      console.error("No se pudo crear la cuenta:", error.message);
      process.exit(1);
    }
  }

  await firestore.collection("users").doc(user.uid).set({
    uid: user.uid,
    email: user.email,
    name,
    role: "admin",
    status: "activo",
    permissions: ["users.read", "users.write", "workers.verify", "financial.read", "financial.export", "settings.write"],
    updatedAt: new Date().toISOString(),
    ...(user.metadata.creationTime ? { createdAt: user.metadata.creationTime } : {}),
  }, { merge: true });

  console.log("Perfil administrativo configurado en Firestore.");
  console.log("Ya puede iniciar sesión desde el formulario general de HOME.");
}

main().catch((error) => {
  console.error("Error configurando el administrador:", error.message);
  process.exit(1);
});
