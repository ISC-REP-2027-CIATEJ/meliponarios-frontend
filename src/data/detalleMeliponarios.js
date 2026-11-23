// DEMOSTRACIÓN. Sustituir por datos e imágenes autorizados por el centro.
// Los audios no se simulan: agregar aquí la ruta del archivo real recibido.
export const abejasDetalle = {
  "Melipona beecheii": {
    nombreComun: "Xunaan-kab",
    imagen: "abeja-dorada.png",
    audio: null,
    descripcion:
      "Tipo de abeja incluido como ejemplo. La ficha permitirá consultar su fotografía, descripción y grabación de sonido.",
    nota: "Fotografía ilustrativa generada. La identificación y la descripción deben validarse con el centro.",
  },
  "Nannotrigona perilampoides": {
    nombreComun: "Nombre local por confirmar",
    imagen: "abeja-oscura.png",
    audio: null,
    descripcion:
      "Este ejemplo reúne información de un tipo de abeja. El centro podrá completar el nombre local, sus características y su sonido.",
    nota: "Fotografía ilustrativa generada; no debe utilizarse para identificar la abeja.",
  },
  "Scaptotrigona pectoralis": {
    nombreComun: "Nombre local por confirmar",
    imagen: "abeja-oscura.png",
    audio: null,
    descripcion:
      "Ficha de demostración para consultar un tipo de abeja, su imagen ampliada y su descripción.",
    nota: "Imagen ilustrativa compartida temporalmente. Sustituir por una fotografía validada.",
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
      nombre: "Responsable por confirmar",
      iniciales: "RF",
      rol: "Responsable del meliponario",
      descripcion:
        "Ficha ilustrativa. El centro confirmará quién puede aparecer y qué medios de contacto autoriza publicar.",
      telefono: null,
      whatsapp: null,
      correo: null,
    },
    descripcion:
      "Un espacio dedicado al cuidado de las abejas nativas sin aguijón. La conservación, los saberes locales y el encuentro con la comunidad forman parte de la historia que podrá contar cada meliponario.",
    galeria: ["palapa.png", "cajas.png", "sendero.png"],
    abejas: [
      { especie: "Melipona beecheii" },
      { especie: "Nannotrigona perilampoides" },
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
      "Entre árboles y flores, este ejemplo de meliponario reúne abejas nativas. Aquí podrán consultarse los tipos de abejas registrados y los productos que la persona responsable decida publicar.",
    galeria: ["cajas.png", "sendero.png"],
    abejas: [
      { especie: "Melipona beecheii" },
      { especie: "Scaptotrigona pectoralis" },
      { especie: "Nannotrigona perilampoides" },
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
};
