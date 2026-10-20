// DEMOSTRACIÓN. Sustituir por datos e imágenes autorizados por el centro.
// Los audios no se simulan: agregar aquí la ruta del archivo real recibido.
export const especiesDetalle = {
  "Melipona beecheii": {
    nombreComun: "Xunaan-kab",
    imagen: "abeja-dorada.png",
    audio: null,
    descripcion:
      "Abeja registrada en este ejemplo de meliponario. La ficha permite consultar su fotografía, descripción y, cuando esté disponible, su grabación de sonido.",
    nota: "Fotografía ilustrativa generada. La identificación y la descripción científica deben validarse con el centro.",
  },
  "Nannotrigona perilampoides": {
    nombreComun: "Nombre local por confirmar",
    imagen: "abeja-oscura.png",
    audio: null,
    descripcion:
      "Este registro reúne información sobre el tipo de abeja presente en el meliponario. El centro podrá completar el nombre local, sus características y su sonido.",
    nota: "Fotografía ilustrativa generada; no debe utilizarse para identificar a la abeja.",
  },
  "Scaptotrigona pectoralis": {
    nombreComun: "Nombre local por confirmar",
    imagen: "abeja-oscura.png",
    audio: null,
    descripcion:
      "Ficha de demostración para conocer esta abeja nativa, su imagen y las características que comparta el centro.",
    nota: "Imagen ilustrativa compartida temporalmente. Sustituir por la fotografía validada de esta abeja.",
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
      "Un espacio dedicado al cuidado de las abejas nativas sin aguijón. La conservación, los saberes locales y el encuentro con la comunidad forman parte de la historia que comparte este meliponario.",
    galeria: ["palapa.png", "cajas.png", "sendero.png"],
    abejas: ["Melipona beecheii", "Nannotrigona perilampoides"],
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
      "Entre árboles y flores, este ejemplo de meliponario invita a conocer las abejas nativas y los productos de la colmena que el responsable decida compartir.",
    galeria: ["cajas.png", "sendero.png"],
    abejas: ["Melipona beecheii", "Scaptotrigona pectoralis", "Nannotrigona perilampoides"],
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
    galeria: ["sendero.png", "palapa.png"],
    abejas: ["Melipona beecheii"],
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
