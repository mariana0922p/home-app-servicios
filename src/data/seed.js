// Catálogo estático de servicios, zonas y textos de ayuda. No se crean cuentas ni solicitudes de muestra.

export const CATEGORIES = [
  {
    id: "plomeria",
    name: "Plomería",
    emoji: "🔧",
    img: "/img/real/cat-plomeria.jpg",
    from: 45000,
    tag: "Urgencias y Redes",
    desc: "Detección de fugas no visibles, destape de cañerías, grifería, calentadores a gas y redes hidráulicas.",
    active: true,
  },
  {
    id: "electricidad",
    name: "Electricidad",
    emoji: "⚡",
    img: "/img/real/cat-electricidad.jpg",
    from: 55000,
    tag: "Certificación RETIE",
    desc: "Instalaciones eléctricas certificadas, cambio de tableros de breakers, iluminación LED y cortocircuitos.",
    active: true,
  },
  {
    id: "pintura",
    name: "Pintura",
    emoji: "🎨",
    img: "/img/real/cat-pintura.jpg",
    from: 40000,
    tag: "Acabados Finos",
    desc: "Pintura de interiores y exteriores, estuco veneciano, impermeabilización y acabados decorativos.",
    active: true,
  },
  {
    id: "carpinteria",
    name: "Carpintería",
    emoji: "🪚",
    img: "/img/real/cat-carpinteria.jpg",
    from: 50000,
    tag: "Muebles a Medida",
    desc: "Diseño y reparación de cocinas integrales, closets, puertas en madera maciza y muebles modulares RH.",
    active: true,
  },
  {
    id: "climatizacion",
    name: "Climatización",
    emoji: "❄️",
    img: "/img/real/cat-climatizacion.jpg",
    from: 70000,
    tag: "Minisplit e Inverter",
    desc: "Mantenimiento preventivo, desinfección profunda, recarga de refrigerante e instalación de aires acondicionados.",
    active: true,
  },
  {
    id: "reformas",
    name: "Reformas",
    emoji: "🔨",
    img: "/img/real/cat-reformas.jpg",
    from: 60000,
    tag: "Obra y Remodelación",
    desc: "Instalación de drywall, enchapes en porcelanato, remodelación integral de baños y cocinas.",
    active: true,
  },
];

export const ZONES = [
  "El Poblado",
  "Laureles",
  "Envigado",
  "Belén",
  "Sabaneta",
  "Itagüí",
  "Robledo",
  "Bello",
];

export const INITIAL_SETTINGS = {
  commission: 15, // 15% para HOME, 85% para el profesional
  maintenance: false,
  notifyInApp: true,
};

export const FAQ = [
  [
    "¿Cómo funciona la Garantía Home?",
    "Cada servicio contratado a través de HOME cuenta con cobertura sobre mano de obra durante 30 días. Si algo falla o no queda en óptimas condiciones, el profesional lo corrige sin costo adicional.",
  ],
  [
    "¿Cómo se verifica a cada profesional?",
    "Revisamos rigurosamente documento de identidad, antecedentes judiciales y policiales, matrícula profesional o certificación técnica (ej. RETIE, SENA) y referencias de trabajos comprobables antes de aprobar su perfil.",
  ],
  [
    "¿Puedo cancelar o reagendar una solicitud?",
    "Sí. Puedes cancelar sin penalidad mientras la solicitud esté pendiente de respuesta. Si ya fue aceptada, puedes coordinar directamente con el profesional asignado.",
  ],
  [
    "¿Cuáles son los métodos de pago aceptados?",
    "Pagas directamente al profesional al terminar y verificar el trabajo (Nequi, Daviplata, transferencia o efectivo). La plataforma registra la transacción y genera el soporte correspondiente.",
  ],
  [
    "¿Cómo se distribuyen las ganancias entre HOME y el profesional?",
    "HOME retiene únicamente la comisión acordada (por defecto 15% sobre el valor del servicio) para cubrir la garantía y la plataforma, mientras el profesional recibe el 85% neto de su trabajo.",
  ],
];
