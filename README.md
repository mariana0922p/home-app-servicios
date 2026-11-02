# 🏠 HOME — Plataforma Real de Servicios para el Hogar

> **Plataforma de intermediación real y profesional entre clientes y técnicos especializados del hogar (Medellín y Valle de Aburrá).**  
> Desarrollada con React 18, Vite, Firebase Auth, Firestore y SheetJS (exportación real a Microsoft Excel `.xlsx`). 100% Responsive en celulares (320px–480px), tablets (768px–1024px) y PC.

---

## 🌟 Resumen de Implementación y Solución Arquitectónica

### 1. Conservación Estricta de la Identidad Visual Original de HOME
- **Paleta de Colores Institucional:** Colores corporativos originales respetados en su totalidad (`--primary: #ea580c`, `--secondary: #006a63`, `--background: #fff8f5`, etc.).
- **Recursos Gráficos Vectoriales Oficiales:** Iconografía e ilustraciones SVG nativas (`/img/cat-*.svg`, `/img/banner-*.svg`, `/img/logo.svg`, `/img/favicon.svg`).
- **Avatares Ilustrados:** Generador SVG nativo `<Avatar />` para todos los usuarios y perfiles, sin sustitución por fotos de stock.

### 2. Slider de Inicio de Sesión y Registro Corregido
- **Pastilla Deslizante (Pill) Milimétrica:** El indicador permanece completamente dentro de su contenedor (`width: calc(50% - 4px)`, `top: 4px; bottom: 4px; left: 4px`).
- **Desplazamiento Suave:** Transición CSS fluida (`transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)`) entre *Iniciar sesión* y *Crear cuenta*.
- **Ergonomía Táctil:** Textos legibles, botones clicables (`z-index: 2`), sin saltos de maquetación ni desbordamientos en ningún dispositivo móvil o de escritorio.

### 3. Autenticación Unificada y Redirección Automática por Rol
- **Sin Botones Públicos de Administrador:** Se eliminaron accesos públicos independientes. Todos los usuarios utilizan el mismo formulario de login.
- **Consulta de Rol Protegida:** El rol proviene directamente del documento del usuario en la base de datos (`users/{uid}`), nunca del cliente ni del formulario.
- **Redirección Automática:**
  - `cliente` ➔ Panel del Cliente (`ClientDashboard`)
  - `trabajador` ➔ Panel del Profesional (`WorkerDashboard`)
  - `admin` ➔ Panel de Administración (`AdminDashboard`)
- **Control de Suspensión:** Si una cuenta está marcada como `suspendido`, el sistema bloquea inmediatamente el acceso mostrando una pantalla explicativa y de cierre de sesión.
- **Script Seguro de Creación del Administrador:** Script seguro de consola (`scripts/create_admin.js`) para aprovisionar el primer administrador sin exponer credenciales públicamente.

### 4. Flujo Real de Solicitudes y Contrataciones
- **Búsqueda Filtrada:** Los clientes únicamente pueden ver y contratar profesionales que hayan sido **verificados y aprobados** por el administrador.
- **Creación de Solicitudes:** Con título, descripción, dirección, fecha programada, tarifa acordada y opción de adjuntar fotografías reales de la falla.
- **Ciclo de Estados:** `pendiente` ➔ `aceptada` (con cotización confirmada) ➔ `en_progreso` ➔ `completada`.
- **Calificación y Reseñas:** Los clientes califican con estrellas (1–5) y comentarios al finalizar el servicio.

### 5. Verificación y Aprobación Documental de Profesionales
- **Registro de Profesionales:** solicita especialidad, zona, tarifa base, años de experiencia, hoja de vida y certificado técnico. Ambos archivos se suben a Firebase Storage.
- **Estado Inicial:** toda cuenta nueva queda en `pendiente_revision`; el formulario no puede aprobar al profesional ni publicarlo en el catálogo.
- **Panel Administrativo:** muestra enlaces reales a la hoja de vida y al certificado. El botón de aprobación permanece bloqueado hasta que los dos archivos estén cargados. El administrador puede aprobar, solicitar correcciones o rechazar manualmente.

### 6. Modelo Financiero y Exportación Real a Excel (.xlsx)
- **Comisión Configurable de HOME:** Por defecto 15% para HOME y 85% para el profesional (congelado por transacción).
- **Panel "Mis Ganancias" del Profesional:**
  - Métricas de facturado bruto, retención por comisión de HOME y ganancia neta.
  - Botón: **"Descargar mis ganancias en Excel (.xlsx)"** con libros reales de Microsoft Excel generados mediante SheetJS, con formato moneda COP y totales calculados.
- **Panel "Finanzas de HOME" del Administrador:**
  - Volumen transaccionado, comisión total retenida y fondos liquidados a técnicos.
  - Botón: **"Descargar reporte financiero en Excel (.xlsx)"** con hojas separadas de Resumen Ejecutivo y Detalle Transaccional. Los valores se calculan desde las solicitudes completadas y no se consideran pagos liquidados.
  - Botón: **"Descargar directorio de profesionales en Excel (.xlsx)"**.

---

## 💻 Instalación y Ejecución Local

El proyecto requiere un archivo `.env` con las variables `VITE_FIREBASE_*` de tu propio proyecto de Firebase. Sin esa configuración no se pueden crear cuentas, registrar solicitudes ni persistir datos reales. No hay cuentas demo ni contraseñas predefinidas.

### Prerrequisitos
- **Node.js** v18 o superior.
- **npm** v9 o superior.

### Pasos
```bash
# 1. Instalar dependencias del proyecto
npm install

# 2. Iniciar servidor de desarrollo local
npm run dev

# 3. Compilar para producción
npm run build

# 4. Previsualizar compilación de producción
npm run preview
```

El servidor local estará disponible en: `http://localhost:5173`

### Configurar reglas y almacenamiento de Firebase

El proyecto incluye `firestore.rules`, `storage.rules`, `firestore.indexes.json` y `firebase.json`. Después de iniciar sesión en Firebase CLI para el proyecto que usa el `.env`, publica las reglas e índices:

```bash
firebase use --add  # Selecciona el mismo proyecto que está configurado en .env
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Asegúrate de que **Authentication** tenga habilitado Email/Password y que **Storage** esté inicializado en Firebase Console. Las reglas separan los datos privados (`users`) del resumen público (`professionals`), restringen solicitudes a cliente/profesional asignados y protegen la revisión documental.

### Modelo de ingresos de HOME

Por defecto, HOME retiene el **15%** del valor de un servicio completado y el profesional recibe el **85%**. La comisión se guarda con cada solicitud para mantener el cálculo de esa contratación; el administrador puede cambiar el porcentaje para futuras solicitudes en Configuración. Las cifras de reportes y las exportaciones se calculan a partir de las solicitudes guardadas en Firestore. Esta versión registra y calcula la comisión, pero no integra una pasarela de pagos ni transfiere dinero automáticamente; para recaudar el 15% dentro del flujo de pago se debe conectar un proveedor de pagos y definir el proceso de liquidación.

---

## 🛡️ Creación Segura del Primer Administrador

Para aprovisionar el primer administrador oficial de la plataforma, ejecuta en la terminal:

```bash
export ADMIN_EMAIL="tu-correo-real"
export ADMIN_PASSWORD="una-contrasena-segura-de-12-o-mas-caracteres"
export ADMIN_NAME="Nombre real del administrador"
node scripts/create_admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_NAME"
```

Antes de ejecutar el script, reemplaza los tres valores por los datos del administrador y luego instala el SDK administrativo con `npm install firebase-admin`. No guardes la contraseña en el repositorio ni la compartas. El script registrará la cuenta en Firebase Auth y creará su documento en Firestore (`users/{uid}`) con rol `admin` y permisos completos. Posteriormente, este usuario podrá ingresar directamente desde el formulario único de inicio de sesión de la landing page.

---

## 📁 Estructura del Proyecto

```
home-app-ppi-completo/
├── public/                     # Recursos gráficos originales de HOME
│   ├── img/
│   │   ├── logo.svg            # Logotipo oficial HOME
│   │   ├── favicon.svg         # Favicon institucional
│   │   ├── cat-*.svg           # Iconos vectoriales de especialidades
│   │   ├── banner-*.svg        # Banners originales ilustrados
│   │   └── admin-side.svg      # Ilustración del panel admin
│   └── ...
├── src/
│   ├── components/
│   │   ├── HomeLoginScreen.jsx # Landing page comercial y autenticación unificada con slider corregido
│   │   ├── dashboards/
│   │   │   ├── ClientDashboard.jsx  # Panel del Cliente (solicitudes, catálogo aprobado, reseñas)
│   │   │   ├── WorkerDashboard.jsx  # Panel del Profesional (agenda, Mis Ganancias, Excel .xlsx)
│   │   │   └── AdminDashboard.jsx   # Panel del Administrador (aprobación documental, finanzas, Excel .xlsx)
│   │   └── ui/
│   │       ├── Kit.jsx         # Kit UI original: Avatar ilustrado nativo, gráficas SVG, modales
│   │       ├── Shell.jsx       # Layout responsive para todos los roles
│   │       └── Icons.jsx       # Iconografía SVG del sistema
│   ├── data/
│   │   ├── excelExport.js      # Generador oficial de libros Excel (.xlsx) con SheetJS
│   │   ├── seed.js             # Categorías, zonas y textos de ayuda; no contiene cuentas de muestra
│   │   ├── store.jsx           # Estado global y sincronización Firestore por usuario autenticado
│   │   └── utils.js            # Funciones de formato COP, fechas y utilitarios
│   ├── services/
│   │   └── db.js               # Capa de Firestore y almacenamiento de documentos
│   ├── styles/
│   │   └── app.css             # Estilos completos responsive (móvil, tablet, PC) con paleta original
│   ├── App.jsx                 # Router de sesión por rol y control de suspensión
│   ├── firebase.js             # Inicialización de Firebase Auth, Firestore y Storage
│   └── main.jsx                # Entrada React
├── scripts/
│   └── create_admin.js         # Script seguro de aprovisionamiento de administrador
├── .env.example                # Variables de entorno de ejemplo
├── package.json                # Dependencias (incluye xlsx y firebase)
└── vite.config.js              # Configuración de compilación Vite
```

---

## 🔒 Variables de Entorno (`.env`)

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=home-app-ffaa2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=home-app-ffaa2
VITE_FIREBASE_STORAGE_BUCKET=home-app-ffaa2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

---

## 📄 Licencia y Derechos

© 2026 Home Marketplace S.A.S. Todos los derechos reservados. Medellín, Colombia.
