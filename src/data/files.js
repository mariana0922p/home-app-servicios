// Utilidades para archivos: validación, compresión de imágenes y conversión a data URL.
// Los documentos se guardan en Firestore (colección workerDocs), sin depender de Firebase Storage.

export const MAX_DOC_BYTES = 700 * 1024; // 700 KB por documento (Firestore limita cada documento a 1 MiB)
export const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen no es válida."));
    img.src = src;
  });

/** Reduce una imagen a un máximo de `max` px por lado y la devuelve como JPEG data URL. */
export async function resizeImage(file, max = 640, quality = 0.75) {
  const img = await loadImage(await readAsDataURL(file));
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Prepara un documento (hoja de vida / certificado).
 * - PDF: se valida el tamaño tal cual.
 * - Imagen: se comprime automáticamente para que quepa.
 * Devuelve { name, type, size, data } o lanza Error con un mensaje listo para mostrar.
 */
export async function prepareDocument(file) {
  if (!file) throw new Error("Selecciona un archivo.");
  if (!DOC_TYPES.includes(file.type)) {
    throw new Error("Formato no permitido. Sube un PDF o una imagen (JPG, PNG).");
  }
  if (file.type === "application/pdf") {
    if (file.size > MAX_DOC_BYTES) {
      throw new Error("El PDF pesa más de 700 KB. Comprímelo (por ejemplo con ilovepdf.com) o súbelo como foto.");
    }
    return { name: file.name, type: file.type, size: file.size, data: await readAsDataURL(file) };
  }
  let data = await resizeImage(file, 1600, 0.8);
  if (data.length * 0.75 > MAX_DOC_BYTES) data = await resizeImage(file, 1200, 0.65);
  if (data.length * 0.75 > MAX_DOC_BYTES) data = await resizeImage(file, 900, 0.55);
  return {
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    type: "image/jpeg",
    size: Math.round(data.length * 0.75),
    data,
  };
}

/** data URL → Blob URL (permite previsualizar PDFs en un iframe sin bloqueos del navegador). */
export async function dataUrlToBlobUrl(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const prettySize = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
