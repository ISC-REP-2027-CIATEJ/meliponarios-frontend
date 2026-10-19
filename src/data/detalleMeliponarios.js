// DEMOSTRACIÓN. Sustituir por datos e imágenes autorizados por el centro.
// Los audios no se simulan: agregar aquí la ruta del archivo real recibido.
export const especiesDetalle = {
  "Melipona beecheii": {
    nombreComun: "Xunaan-kab",
    imagen: "abeja-dorada.png",
    audio: null,
    descripcion:
      "Especie registrada en este ejemplo de meliponario. La ficha permitirá consultar su fotografía, descripción y grabación de sonido.",
    nota: "Fotografía ilustrativa generada. La identificación y la descripción científica deben validarse con el centro.",
  },
  "Nannotrigona perilampoides": {
    nombreComun: "Nombre local por confirmar",
    imagen: "abeja-oscura.png",
    audio: null,
    descripcion:
      "Este registro reúne los datos de la especie presente en el meliponario. El centro podrá completar el nombre local, sus características y su sonido.",
    nota: "Fotografía ilustrativa generada; no debe utilizarse para identificar la especie.",
  },
  "Scaptotrigona pectoralis": {
    nombreComun: "Nombre local por confirmar",
    imagen: "abeja-oscura.png",
    audio: null,
    descripcion:
      "Ficha de demostración para consultar una especie registrada, su imagen ampliada y las cajas donde se mantiene.",
    nota: "Imagen ilustrativa compartida temporalmente. Sustituir por la fotografía validada de esta especie.",
  },
};

export const productosDetalle = {
  miel: {
    nombre: "Miel de melipona",
    categoria: "Alimentos",
    presentacion: "Frasco de 250 ml",
    imagen: "miel.png",
    descripcion:
      "Presentación ilustrativa de miel del productor. Consulta directamente su disponibilidad y características.",
    disponible: true,
  },
  cera: {
    nombre: "Cera de melipona",
    categoria: "Artesanal",
    presentacion: "Pieza de 50 g",
    imagen: "cera.png",
    descripcion:
      "Cera para elaboración artesanal. La presentación y las cantidades se confirman con el responsable.",
    disponible: true,
  },
  propoleo: {
    nombre: "Propóleo",
    categoria: "Uso tradicional",
    presentacion: "Presentación por confirmar",
    imagen: "propoleo.png",
    descripcion:
      "Producto registrado por el responsable para consulta. No se indican propiedades terapéuticas ni instrucciones de uso.",
    disponible: true,
  },
  jabon: {
    nombre: "Jabón artesanal",
    categoria: "Cuidado personal",
    presentacion: "Barra de 100 g",
    imagen: "jabon.png",
    descripcion:
      "Ejemplo de producto de cuidado personal. Consulta sus ingredientes y disponibilidad con el productor.",
    disponible: false,
  },
};

export const detalleMeliponarios = {
  "xunaan-kab": {
    responsable: {
      nombre: "Don Jorge Pech",
      iniciales: "JP",
      rol: "Responsable del meliponario",
      descripcion:
        "Perfil de demostración para presentar a la persona que cuida este meliponario. El centro confirmará la información y los medios de contacto que pueden publicarse.",
      telefono: null,
      whatsapp: null,
      correo: null,
    },
    descripcion:
      "Un espacio dedicado al cuidado de las abejas nativas sin aguijón. En este ejemplo, las colonias se mantienen bajo una palapa y se combinan cajas racionales con jobones. La conservación, los saberes locales y el encuentro con la comunidad forman parte de la historia que contará cada meliponario.",
    estructura: "Palapa tradicional",
    entorno: "Vegetación de selva baja",
    clima: "Cálido · dato de ejemplo",
    galeria: ["palapa.png", "cajas.png", "sendero.png"],
    colonias: [
      { especie: "Melipona beecheii", cajas: 18, jobones: 12 },
      { especie: "Nannotrigona perilampoides", cajas: 6, jobones: 0 },
    ],
    productos: ["miel", "cera", "jabon"],
    venta: {
      nombre: "Punto de venta del meliponario",
      direccion: null,
      coordenadas: null,
      ubicacionVerificada: false,
      horario: null,
    },
  },
  "las-flores": {
    responsable: {
      nombre: "Responsable por confirmar",
      iniciales: "RF",
      rol: "Reserva Las Flores",
      descripcion:
        "El centro proporcionará los datos del responsable y sus medios de contacto autorizados.",
      telefono: null,
      whatsapp: null,
      correo: null,
    },
    descripcion:
      "Entre árboles y flores, este ejemplo de meliponario reúne colonias en cajas de madera. Aquí podrán consultarse las especies registradas, las características del sitio y los productos que el responsable decida publicar.",
    estructura: "Cobertizo de madera",
    entorno: "Jardín con vegetación local",
    clima: "Por confirmar",
    galeria: ["cajas.png", "sendero.png"],
    colonias: [
      { especie: "Melipona beecheii", cajas: 8, jobones: 4 },
      { especie: "Scaptotrigona pectoralis", cajas: 8, jobones: 0 },
      { especie: "Nannotrigona perilampoides", cajas: 4, jobones: 0 },
    ],
    productos: ["miel", "propoleo"],
    venta: {
      nombre: "Venta directa con el responsable",
      direccion: null,
      coordenadas: null,
      ubicacionVerificada: false,
      horario: null,
    },
  },
  mayab: {
    responsable: {
      nombre: "Responsable por confirmar",
      iniciales: "SM",
      rol: "Santuario del Mayab",
      descripcion:
        "Información pendiente de completar y validar con el centro.",
      telefono: null,
      whatsapp: null,
      correo: null,
    },
    descripcion:
      "Un sitio de demostración para la conservación de las abejas nativas y su entorno. Su registro está pendiente de revisión, por lo que todavía no publica productos ni datos de contacto.",
    estructura: "Palapa",
    entorno: "Vegetación local",
    clima: "Por confirmar",
    galeria: ["sendero.png", "palapa.png"],
    colonias: [{ especie: "Melipona beecheii", cajas: 8, jobones: 4 }],
    productos: [],
    venta: {
      nombre: "Punto de venta por confirmar",
      direccion: null,
      coordenadas: null,
      ubicacionVerificada: false,
      horario: null,
    },
  },
};
