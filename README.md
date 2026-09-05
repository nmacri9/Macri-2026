# 🍷 Cepa - Gastronomía & Reserva

Trabajo Final Integrador (TFI) — Aplicación móvil desarrollada con Angular, Ionic y Capacitor.

---

## 👥 Equipo y Ramas de Trabajo

| Apellido y Nombre | Rama Principal (Branch) |
| :--- | :--- |
| **Garcia, Mateo**  | Backend y Base de Datos |
| **Macri, Nicolas** | UI/UX y Vistas Frontend |
| **Goncalves, Matias**  | Formularios y Autenticación |
| **Breyaui, Jaled**  | Arquitectura y Ruteo |

---

## 🚀 Seguimiento de Módulos y Objetivos

### 👨‍💻 Macri, Nicolas
* **Branch:** `nico-alta-platos`
* **Período de tarea:** 27/08/2026 — 04/09/2026
* **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. *(No hubo necesidad de reasignar plazos ni módulos).*
* **Módulos asignados:**
  * [x] **UI/UX y Assets:** Diseño de ícono, definición de paleta de colores global (`variables.scss`) y generación de assets nativos (Capacitor).
  * [x] **Splash Screen:** Integración estática y dinámica con animación de entrada (fade-in) y ruteo automático.
  * [x] **Login:** Maquetado responsive validado para móviles, con botones de acceso rápido.
  * [x] **Alta de Plato:** Contenedores adaptables para 3 fotos simultáneas sin scroll nativo, cumpliendo pautas UI de la cátedra.

### 👨‍💻 Garcia, Mateo
* **Período de tarea:** 27/08/2026 — 04/09/2026
* **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. *(No hubo necesidad de reasignar plazos ni módulos).
* **Módulos asignados:**
  * [x] **Módulo de Alta de Bebidas (Perfil "Cantinero"):** Implementación integral de la carga de bebidas para la carta con validaciones estrictas y respuesta háptica.
  * [x] **Diseño e Infraestructura DB:** Creación de tablas (`usuarios`, `productos`, `mesas`), restricciones `CHECK` y políticas de seguridad RLS en Supabase.
  * [x] **Lógica de Base de Datos y Triggers:** Refactorización del guardado enviando información como metadatos en `signUp()`. Creación de Triggers PL/pgSQL para asignar roles y estados automáticamente.
  * [x] **Storage y Cámara:** Integración con `@capacitor/camera` para 3 fotos obligatorias, optimización a Base64/Blob y subida al Bucket de Storage.

### 👨‍💻 Goncalves, Matias
* **Período de tarea:** 27/08/2026 — 04/09/2026
* **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. *(No hubo necesidad de reasignar plazos ni módulos).
* **Módulos asignados:**
  * [x] Formularios Reactivos y validaciones (correo/clave).
  * [x] **Lógica de Autenticación (`AuthService`):** Métodos de registro, inicio de sesión y gestión de roles con Supabase Auth.
  * [x] **Sesiones y Flujo de Empleados:** Registro de nuevos empleados sin bloqueo de validación por correo y restauración automática de la sesión del administrador al finalizar el proceso.
  * [x] Conexión lógica de botones de ingreso rápido.

### 👨‍💻 Breyaui, Jaled
* **Período de tarea:** [DD/MM/AAAA] — [DD/MM/AAAA]
* **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. *(No hubo necesidad de reasignar plazos ni módulos).
* **Módulos asignados:**
  * [x] Arquitectura general y sistema de ruteo (`app-routing`).
  * [x] Implementación de Guards y seguridad.
  * [x] **Loading Global:** Creación de `CepaSpinnerComponent`, un componente standalone reutilizable con animación y texto dinámico.
  * [x] **Componentes Compartidos:** Integración del header unificado `CepaHeaderComponent` con menú lateral.

---

## 🍷 Detalles Técnicos: Módulo Alta de Bebidas & Servicios Core
**Responsable Principal:** Mateo Garcia

Se implementó de manera integral el módulo de carga de bebidas para la carta, la arquitectura de servicios centrales en Angular y el esquema relacional de la base de datos en Supabase.

**1. Desarrollo de Servicios Globales en Angular:**
* **`ProductosService`:**
  * Integración con `@supabase/supabase-js` para la gestión de productos.
  * Métodos asíncronos (`async/await`) para la inserción de registros en la tabla `productos` y la subida secuencial/paralela de imágenes.
  * Manejo de excepciones, respuesta a fallos de red y generación de URLs públicas.

**2. Formulario, Captura y UI/UX:**
* Formulario reactivo (`@angular/forms`) capturando Nombre, Descripción, Tiempo de elaboración y Precio.
* Integración de respuesta háptica (`@capacitor/haptics`) ante errores de validación.
* Grid de 3 contenedores para vista previa de fotografías.
* Implementación de paleta de colores institucional (`#6B002B`, `#FCF3E1`) y tipografía *EB Garamond*.
* Configuración de `@ionic/pwa-elements` para asegurar el modal de cámara en entorno web (`ionic serve`).

---

## 📂 Archivos Modificados Destacados
* `src/theme/variables.scss`
* `src/app/app.routes.ts`
* `src/app/pages/splash/`, `src/app/pages/login/`, `src/app/pages/alta-plato/`, `src/app/pages/alta-bebida/`
* `src/app/shared/components/cepa-spinner/`, `src/app/shared/components/cepa-header/`
* `src/app/core/services/productos.service.ts`, `src/app/core/services/auth.service.ts`
* `resources/icon.png`, `resources/splash.png`

---

## 📸 Índice de Imágenes del Proyecto

> *A continuación se detallan todas las capturas correspondientes a íconos, pantallas de presentación, formularios y listados del proyecto.*

| # | Componente / Pantalla | Enlace de visualización |
| :-: | :--- | :--- |
| **1** | Ícono de la aplicación | [Ver imagen](./resources/icon.png) |
| **2** | Splash Screen Estático | [Ver imagen](./ruta-a-imagen/splash-estatico.png) |
| **3** | Splash Screen Dinámico | [Ver imagen](./ruta-a-imagen/splash-dinamico.png) |
| **4** | Login: Pantalla principal | [Ver imagen](./ruta-a-imagen/login.png) |
| **4** | Foto de prueba: Pantalla principal | [Ver imagen](./capturas/fotoprueba.webp) |
| **6** | Alta de Mesa: Vista | [Ver imagen](./ruta-a-imagen/alta-mesa.png) |
| **7** | Alta de Plato: Vista | [Ver imagen](./ruta-a-imagen/alta-plato-.png) |
| **8** | Alta de Bebida: Vista | [Ver imagen](./ruta-a-imagen/alta-bebida.png) |
| **9** | Alta de Empleado: Vista | [Ver imagen](./ruta-a-imagen/alta-empleado.png) |

