# Trabajo diario con GitHub

Trabaja siempre en esta carpeta: C:\Users\juang\proyectos\meliponarios-frontend.
GitHub se actualiza cuando guardas una versión (commit) y la envías (push).
Guardar un archivo en el editor no lo sube automáticamente.

## Ejecutar el proyecto

- En una copia nueva, ejecuta `npm ci` para instalar las dependencias.
- Si no existe `.env.local`, copia `.env.example` con ese nombre y configura los valores locales.
- Ejecuta `npm run dev` para desarrollar y abre la dirección que aparezca.
- La autenticación requiere un backend compatible; subir este frontend no crea el servidor.

## Rutina después de conectar el repositorio remoto

Antes de empezar, con tus cambios anteriores guardados en Git:

```powershell
git pull --ff-only
npm run dev
```

Al terminar una mejora pequeña, guarda los archivos y ejecuta:

```powershell
npm run lint
npm run build
git status
git diff
git add .
git diff --cached --stat
git commit -m "Describe la mejora realizada"
git push
```

Si las verificaciones fallan, corrige el problema antes de guardar la versión.
Revisa la lista de archivos antes de confirmar. Nunca incluyas contraseñas ni claves.
`.env.local`, `node_modules` y `dist` están excluidos del repositorio.
Las variables VITE_ forman parte del frontend: no deben contener secretos.

## Cambios grandes o trabajo en equipo

Crea una rama para cada función con `git switch -c mejora/nombre-corto`.
Publica esa rama con `git push -u origin mejora/nombre-corto` y abre un pull request
para revisar e integrar los cambios a main desde GitHub.

En otra computadora, clona el mismo repositorio y ejecuta `npm ci`.
Antes de cambiar de computadora, confirma y sube tus cambios; en la otra, descarga
los cambios con `git pull --ff-only` antes de editar.

No uses `git push --force` para resolver rechazos. Revisa primero los cambios remotos.

Referencia: https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository
