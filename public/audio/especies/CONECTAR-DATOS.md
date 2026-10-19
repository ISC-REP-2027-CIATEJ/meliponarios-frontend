# Incorporar datos del centro

Esta entrega usa archivos locales de demostración. No consulta todavía Supabase para los meliponarios. La integración posterior deberá respetar los campos y permisos acordados con el compañero.

## Especies y grabaciones

Archivo: src/data/detalleMeliponarios.js, objeto especiesDetalle.

1. Sustituye la imagen ilustrativa en public/images/detalle por una fotografía validada. Cambia el nombre de imagen en el registro si es necesario.
2. Completa nombreComun, descripcion y nota con información validada.
3. Coloca la grabación en public/audio/especies.
4. Cambia audio: null por la ruta relativa a public, por ejemplo:

```javascript
audio: 'audio/especies/melipona-beecheii.mp3'
```

No escribas public al inicio y respeta la extensión y las mayúsculas. No pongas credenciales en estos archivos. Este adaptador espera rutas locales; para URLs de almacenamiento del centro se ajustará el servicio al integrar la base de datos.

El botón permite reproducir y detener. Solo suena una especie a la vez. Se detiene al abrir otra ventana, cerrar la ventana o salir del detalle. Los errores de carga se muestran. No hay reproducción automática.

Comprueba también las cantidades de cajas y jobones en detalleMeliponarios[id].colonias. Su suma debe coincidir con colonias en src/data/meliponarios.js. Mantén la lista de especies de ambos archivos consistente.

## Responsable

Completa responsable.nombre, iniciales, rol y descripcion. Agrega solo contactos autorizados:

- telefono: número en formato internacional; activa Llamar.
- whatsapp: número con código de país; activa WhatsApp.
- correo: dirección válida; activa Enviar correo.

Con null no aparece un enlace falso. Los botones abren el medio de contacto y no envían mensajes automáticamente. Sustituye los perfiles de ejemplo antes de publicar registros reales.

## Punto de venta y Cómo llegar

Completa venta.direccion, venta.horario y venta.coordenadas como [latitud, longitud]. Las coordenadas deben ser números, no cadenas. Cambia ubicacionVerificada a true solamente después de comprobar que se pueden publicar.

Con coordenadas válidas y verificadas, el mapa pequeño y ampliado muestran ese punto y Cómo llegar abre Google Maps con el destino. La web no calcula una ruta propia ni envía la ubicación del visitante desde este botón.

Las coordenadas demo de src/data/ubicacionesDemo.js son una referencia visual mientras falta la ubicación exacta. No deben usarse para llegar a un meliponario real. Al conectar datos reales, unifica también la fuente de ubicaciones del mapa general.

## Productos

productosDetalle contiene nombre, categoria, presentacion, descripcion, imagen y disponible. Cada meliponario referencia sus productos por identificador. Las categorías se forman automáticamente a partir de los productos del sitio.

Actualiza también el resumen productos de src/data/meliponarios.js. No agregues afirmaciones medicinales no sustentadas. Las categorías incluidas son Alimentos, Artesanal, Uso tradicional y Cuidado personal; las futuras categorías pueden añadirse cuando el centro defina el catálogo.

## Imágenes

La galería utiliza public/images/meliponarios. Las especies y productos utilizan public/images/detalle. Las imágenes ampliadas se muestran completas con object-contain. Cambia imágenes y textos ilustrativos cuando exista material autorizado del centro.

## Límites actuales

Los filtros se conservan entre pantallas durante la sesión de la página; se restablecen al recargar. Copiar enlace copia la dirección actual: una URL de localhost solo funciona en el equipo donde está levantado el proyecto. Al publicar la web, el mismo botón copiará la URL pública.
