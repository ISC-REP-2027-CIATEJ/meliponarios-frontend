# Grabaciones de especies

Coloca aquí únicamente archivos reales y autorizados que entregue el centro, por ejemplo melipona-beecheii.mp3. Esta entrega no contiene sonidos inventados.

En src/data/detalleMeliponarios.js cambia audio: null por audio: 'audio/especies/melipona-beecheii.mp3' en la especie correspondiente. La ruta es relativa a public; no escribas public al inicio. Comprueba que la extensión y las mayúsculas coincidan con el archivo.

El botón se habilita al tener una ruta. Permite reproducir y detener, solo mantiene una grabación a la vez y se detiene al cerrar la ventana o salir de la ficha. Si el archivo falla, aparece un mensaje. Usa grabaciones cortas y verifica que correspondan a la especie indicada.
