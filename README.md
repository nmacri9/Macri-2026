# Cepa - Gastronomía & Reserva

Trabajo Final Integrador (TFI) desarrollado con Angular + Ionic + Capacitor.

## Organización del equipo

Antes de comenzar el desarrollo, el equipo realizó una reunión virtual para dividir las tareas según los siguientes roles:

- **Integrante 1:** Mateo — Backend, BD y Servicios (Supabase)  
- **Integrante 2:** Nicolas — UI/UX y Componentes Visuales (Ionic)
- **Integrante 3:** Matias — Formularios, Validaciones y Autenticación
- **Integrante 4:** Jaled — Arquitectura, Ruteo y Seguridad (Angular)

---

## Integrante 1 - Backend, BD y Servicios 
 Responsable: Mateo Garcia

## Integrante 2 — UI/UX y Componentes Visuales (Ionic)

Responsable: Nicolas Macri

### Tareas realizadas

**1. Diseño del ícono y paleta de colores**
- Ícono generado y ajustado con Adobe Express / herramientas de IA.
- Paleta de colores definida:
  - Bordó: `#6B002B`
  - Marron oscuro: `##3A2B30`
  - Crema: `#FCF3E1`
  - Blanco hueso: `#FAF9F7`
- Variables de color aplicadas globalmente en `src/theme/variables.scss`.
- Assets nativos (ícono y splash estático) generados con `@capacitor/assets` para Android.

**2. Splash Screen**
- Splash estático generado vía Capacitor (`icon.png`, `splash.png`).
- Splash dinámico (Angular) en `src/app/pages/splash/`:
  - Muestra el logo de la marca y los nombres del equipo.
  - Animación de entrada (fade-in).
  - Navegación automática a `/login` luego de 3 segundos.

**3. Pantalla de Login**
- Maquetado completo en `src/app/pages/login/` usando componentes nativos de Ionic (`ion-item`, `ion-input`, `ion-button`, `ion-icon`).
- Campos de correo electrónico y contraseña con íconos.
- Botón principal de "Ingresar".
- Sección de accesos rápidos (Cliente / Mozo / Admin) con estilo diferenciado (outline).
- Diseño responsive, validado en vista mobile (media queries para pantallas ≤400px).
- Tipografía EB Garamond aplicada para mantener coherencia visual con el logo de marca.


### Archivos modificados/creados
- `src/theme/variables.scss`
- `src/app/pages/splash/` (`.html`, `.ts`, `.scss`)
- `src/app/pages/login/` (`.html`, `.ts`, `.scss`)
- `src/assets/icono.png`, `src/assets/icon.png`
- `resources/icon.png`, `resources/splash.png`
- `src/index.html` (import de fuente EB Garamond)

---

## Integrante 3 — Formularios, Validaciones y Autenticación

Responsable: Matias

_(Completar: Formularios Reactivos, validaciones de correo/clave, botones de ingreso rápido conectados, integración con Supabase)_

---

## Integrante 4 — Arquitectura, Ruteo y Seguridad

Responsable: Jaled

_(Completar: app-routing, Guards, estructura de carpetas y componentes compartidos)_