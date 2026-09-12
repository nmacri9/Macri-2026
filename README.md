# 🍷 Cepa - Gastronomía & Reserva

Trabajo Final Integrador (TFI) — Aplicación móvil desarrollada con Angular, Ionic y Capacitor.

---

## 👥 Equipo y Ramas de Trabajo

| Apellido y Nombre     | Rama Principal (Branch)     |
| :-------------------- | :--------------------------- |
| **Garcia, Mateo**     | Backend y Base de Datos     |
| **Macri, Nicolas**    | UI/UX y Vistas Frontend      |
| **Goncalves, Matias** | Formularios y Autenticación |
| **Breyaui, Jaled**    | Arquitectura y Ruteo         |

---

## 🚀 Seguimiento de Módulos y Objetivos

### 👨‍💻 Macri, Nicolas

- **Branch:** `nico-alta-platos`
- **Período de tarea:** 27/08/2026 — 07/09/2026
- **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. _(Modificaciones por corrección del profesor)._
- **Módulos asignados:**
  - [x] **UI/UX y Assets:** Diseño de ícono, definición de paleta de colores global (`variables.scss`) y generación de assets nativos (Capacitor).
  - [x] **Splash Screen:** Integración estática y dinámica con animación de entrada (fade-in) y ruteo automático.
  - [x] **Login:** Maquetado responsive validado para móviles, con botones de acceso rápido.
  - [x] **Alta de Plato:** Contenedores adaptables para 3 fotos simultáneas sin scroll nativo, cumpliendo pautas UI de la cátedra.
  - [x] **Registro de Cliente (Punto 5):** Pantalla completa de registro de cliente para Dispositivo 2, con lectura de QR/DNI vía `DniScannerService`, cámara nativa forzada (bloqueo de galería) y alta a Supabase con estado inicial `PENDIENTE`.
  - [x] **Rediseño de Paleta Institucional:** Migración de Login, Splash, Registro de Cliente, Alta de Plato y `CepaHeaderComponent` desde la paleta bordó/crema original a la nueva paleta verde oficial del proyecto.
  - [x] **Pulido de UI:** Jerarquía tipográfica, acentos de color en iconografía clave, radios de borde y espaciado consistente entre pantallas.

### 👨‍💻 Garcia, Mateo

- **Período de tarea:** 27/08/2026 — 04/09/2026
- **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. \*(No hubo necesidad de reasignar plazos ni módulos).
- **Módulos asignados:**
  - [x] **Módulo de Alta de Bebidas (Perfil "Cantinero"):** Implementación integral de la carga de bebidas para la carta con validaciones estrictas y respuesta háptica.
  - [x] **Diseño e Infraestructura DB:** Creación de tablas (`usuarios`, `productos`, `mesas`), restricciones `CHECK` y políticas de seguridad RLS en Supabase.
  - [x] **Lógica de Base de Datos y Triggers:** Refactorización del guardado enviando información como metadatos en `signUp()`. Creación de Triggers PL/pgSQL para asignar roles y estados automáticamente.
  - [x] **Storage y Cámara:** Integración con `@capacitor/camera` para 3 fotos obligatorias, optimización a Base64/Blob y subida al Bucket de Storage.
  - [x] **Sistema de Notificaciones por Correo Automático (EmailJS):** Integración del `EmailService` centralizado, automatización del flujo de registro/aprobación y plantilla HTML única con paleta diferenciada por estado.
  - [x] **Modal de Confirmación Interactivo (`ConfirmModalComponent`):** Reemplazo de los diálogos nativos por modales Ionic personalizados en los flujos de alta y de gestión de clientes.

### 👨‍💻 Goncalves, Matias

- **Período de tarea:** 27/08/2026 — 04/09/2026
- **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. \*(No hubo necesidad de reasignar plazos ni módulos).
- **Módulos asignados:**
  - [x] Formularios Reactivos y validaciones (correo/clave).
  - [x] **Lógica de Autenticación (`AuthService`):** Métodos de registro, inicio de sesión y gestión de roles con Supabase Auth.
  - [x] **Sesiones y Flujo de Empleados:** Registro de nuevos empleados sin bloqueo de validación por correo y restauración automática de la sesión del administrador al finalizar el proceso.
  - [x] Conexión lógica de botones de ingreso rápido.
  - [x] **Frontend de Administración (Punto 6):** Maquetado del listado de clientes pendientes de aprobación para la vista Dueño/Supervisor (Dispositivo 1), con controles de Aceptar/Rechazar y actualización en tiempo real vía Push Notifications.
  - [x] **Componente de Alerta Global Reutilizable:** Modal de confirmación dinámico e importable, estilizado con botones de acción en colores neón (Confirmar en verde, Cancelar en rojo).
  - [x] **Refactorización de Login:** Reemplazo de los múltiples botones de roles por un único botón de "Acceso Rápido" que redirige a una vista dedicada por perfil.

### 👨‍💻 Breyaui, Jaled

- **Período de tarea:** [27/08/2026] — [04/09/2026]
- **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. \*(No hubo necesidad de reasignar plazos ni módulos).
- **Módulos asignados:**
  - [x] Arquitectura general y sistema de ruteo (`app-routing`).
  - [x] Implementación de Guards para el alta de paltos, bebidas, mesas y empleados.
  - [x] **Loading Global:** Creación de `CepaSpinnerComponent`, un componente standalone reutilizable con animación y texto dinámico.
  - [x] **Pantalla Home:** Menu inicial desde donde se redirige a los formularios.
  - [x] **Módulo de Alta de Mesas**.

---

## 🍷 Detalles Técnicos: Módulo Alta de Bebidas & Servicios Core

**Responsable Principal:** Mateo Garcia

Se implementó de manera integral el módulo de carga de bebidas para la carta, la arquitectura de servicios centrales en Angular y el esquema relacional de la base de datos en Supabase.

**1. Desarrollo de Servicios Globales en Angular:**

- **`ProductosService`:**
  - Integración con `@supabase/supabase-js` para la gestión de productos.
  - Métodos asíncronos (`async/await`) para la inserción de registros en la tabla `productos` y la subida secuencial/paralela de imágenes.
  - Manejo de excepciones, respuesta a fallos de red y generación de URLs públicas.

**2. Formulario, Captura y UI/UX:**

- Formulario reactivo (`@angular/forms`) capturando Nombre, Descripción, Tiempo de elaboración y Precio.
- Integración de respuesta háptica (`@capacitor/haptics`) ante errores de validación.
- Grid de 3 contenedores para vista previa de fotografías.
- Implementación de paleta de colores institucional (`#6B002B`, `#FCF3E1`) y tipografía _EB Garamond_.
- Configuración de `@ionic/pwa-elements` para asegurar el modal de cámara en entorno web (`ionic serve`).

---

## 📧 Detalles Técnicos: Sistema de Notificaciones por Correo Automático (EmailJS)

**Responsable Principal:** Mateo Garcia

**1. Integración del Servicio Centralizado (`EmailService`):**

- Se configuró el cliente `@emailjs/browser` inyectado a nivel root para gestionar de forma asíncrona la comunicación transaccional con el cliente.
- Se resolvió el flujo integral de autenticación solucionando errores de ámbito de Gmail API (`412 Precondition Failed`) mediante la inclusión obligatoria de la Public Key (`PUBLIC_KEY`) en el constructor e invocación de peticiones.

**2. Automatización del Flujo de Registro y Aprobación:**

- **Registro Pendiente (`RegistroClientePage`):** Al completar el formulario e ingresar la solicitud en Supabase, se gatilla automáticamente el correo de confirmación en recepción. *(Pendiente: inyectar el `EmailService`, que hoy no está conectado a la lógica.)*

**3. Optimización de Assets en Envíos Nativos:**

- Se parametrizó el hosting de imágenes públicas (vía CDN/ImgBB) para garantizar la correcta visualización del isologotipo de CEPA en los clientes de correo (Gmail/Outlook), evitando bloqueos de recursos locales (`localhost` / `assets`).

**4. Rediseño y Paleta de Colores Exclusiva por Estado:**

- Se diseñó un esquema cromático e idéntico criterio tipográfico dentro de la plantilla HTML única (`template_78axyn3`) enviada por EmailJS, diferenciando visualmente el estado de cada solicitud.

**5. Modal de Confirmación Interactivo (`ConfirmModalComponent`):**

- Se reemplazaron los diálogos nativos del sistema por modales personalizados de Ionic (`ModalController`) con clase estilizada `.modal-alerta`.
- **En el Registro:** intercepta la acción en `confirmarAlta()`, exigiendo la confirmación del usuario antes de persistir los datos.
- **En la Gestión de Clientes:** intercepta las acciones `aceptarCliente()` y `rechazarCliente()`, confirmando la resolución antes de actualizar Supabase y enviar el mail.
- Respuesta háptica y toasts nativos vía `@capacitor/haptics`.

---

## 🧑‍💼 Detalles Técnicos: Frontend de Administración (Punto 6)

**Responsable Principal:** Matias Goncalves

**1. Gestión de Clientes Pendientes:**

- Maquetado del listado de clientes en espera de aprobación, diseñado específicamente para la vista del Dueño / Supervisor (Dispositivo 1).

**2. UI/UX - Regla Estricta de Pantalla:**

- Implementación de cálculo dinámico del alto de los contenedores para garantizar que ningún elemento del listado quede cortado por la mitad en el dispositivo.

**3. Controles de Acción:**

- Diseño de la interfaz y conexión de las acciones para "Aceptar" o "Rechazar" a cada cliente entrante.

**4. Tiempo Real:**

- Configuración de la recepción de Push Notifications para que el listado de clientes se actualice automáticamente sin necesidad de recargar la vista.

**5. Mejoras y Correcciones Adicionales:**

- **Componente de Alerta Global Reutilizable:** modal de confirmación dinámico (ej: "¿Desea dar de alta a este [usuario / plato / mesa]?"), importable para evitar repetición de código en las distintas pantallas de alta, estilizado con botones de acción en colores neón (Confirmar en verde brillante, Cancelar en rojo brillante).
- **Refactorización de la Pantalla de Login:** se optimizó la lógica del inicio de sesión, reemplazando los múltiples botones de roles por un único botón de "Acceso Rápido". Este redirige a una vista dedicada donde se renderizan los componentes de cada perfil con su respectiva foto (Dueño, Supervisor, Metre, Mozo, Cocinero, Cantinero, Cliente registrado, Anónimo), reduciendo la vista inicial a una sola línea de código clave.
- **Fix de UI en Accesos Rápidos:** resolución de un bug de renderizado responsivo donde los accesos rápidos mostraban un fondo negro en la versión web y blanco en mobile.

**6. Dependencias e Integración:**

- **Fase de Desarrollo:** el maquetado y la lógica visual se trabajaron inicialmente de forma aislada utilizando un JSON con clientes simulados.
- **Fase de Integración:** trabajo en conjunto con el Integrante 4 para el consumo de la base de datos real y la emisión de las acciones definitivas de aceptar/rechazar.

---

## 🌿 Detalles Técnicos: Registro de Cliente & Rediseño de Paleta Visual

**Responsable Principal:** Nicolas Macri

**1. Registro de Cliente (Punto 5):**

- Se partió de `registro-empleado.page.ts` (desarrollado por Integrante 1) como base, adaptándolo a los campos y reglas del cliente: sin campo `CUIL`, perfil limitado a `CLIENTE` / `METRE`.
- Extracción de la lógica de escaneo de QR de DNI a un service reutilizable (`DniScannerService`), inyectado por constructor en la página.
- Captura de foto forzada a `CameraSource.Camera` para bloquear el acceso a la galería, cumpliendo el requerimiento de la cátedra.
- Alta contra Supabase (`auth.signUp`) con estado inicial `PENDIENTE` en `options.data`, a la espera de que Integrante 4 lo persista en una tabla propia.

**2. Rediseño de Paleta Institucional:**

- Migración completa de Login, Splash, Registro de Cliente, Alta de Plato y el `CepaHeaderComponent` compartido, desde la paleta bordó/crema original a la nueva paleta verde institucional (`#132A20`, `#1B3B2D`, `#dbcbb9`, `#C8B29E`, `#091610`).
- Definición de una convención de uso por rol de color (fondo principal, fondo de tarjetas, texto principal, acentos, texto de botones) aplicada de forma consistente en las cinco pantallas.
- Ajustes de jerarquía visual: mayor peso tipográfico en los títulos, radios de borde más generosos (de `12px` a `16-18px`) acordes a la tipografía serif *EB Garamond*, e iconografía de acento diferenciada para la acción principal de cada pantalla (cámara/foto).

**3. Splash Screen (mejoras adicionales):**

- Animación de entrada propia del logo (`logoEntrance`), separada del pulso continuo.
- Barra de progreso indeterminada entre el logo y el listado del equipo.
- Ajuste del timing de la secuencia de animaciones (incluyendo el delay de navegación al login) para que el último nombre del equipo termine de aparecer antes de la transición.

---

## 📂 Archivos Modificados Destacados

- `src/theme/variables.scss`
- `src/app/app.routes.ts`
- `src/app/pages/splash/`, `src/app/pages/login/`, `src/app/pages/alta-plato/`, `src/app/pages/alta-bebida/`
- `src/app/shared/components/cepa-spinner/`, `src/app/shared/components/cepa-header/`
- `src/app/core/services/productos.service.ts`, `src/app/core/services/auth.service.ts`, `src/app/core/services/email.service.ts`, `src/app/core/services/dni-scanner.ts`
- `src/app/shared/confirm-modal/`
- `src/app/pages/registro-cliente/`
- `resources/icon.png`, `resources/splash.png`

---
---

## 📸 Índice de Imágenes del Proyecto

> _A continuación se detallan todas las capturas correspondientes a íconos, pantallas de presentación, formularios y listados del proyecto._

|   #   | Componente / Pantalla     | Enlace de visualización                          |
| :---: | :------------------------ | :----------------------------------------------- |
| **1** | Ícono de la aplicación    | [Ver imagen](./resources/icon.png)               |
| **2** | Spinner Dinámico          | [Ver imagen](./capturas/spinner.jpeg)            |
| **3** | Login: Pantalla principal | [Ver imagen](./capturas/login.jpeg)              |
| **4** | Pantalla principal        | [Ver imagen](./capturas/pantalla-principal.jpeg) |
| **5** | Alta de Mesa: Vista       | [Ver imagen](./capturas/alta-mesa.jpeg)          |
| **6** | Alta de Plato: Vista      | [Ver imagen](./capturas/alta-plato.jpeg)         |
| **7** | Alta de Bebida: Vista     | [Ver imagen](./capturas/alta-bebidas.jpeg)       |
| **8** | Alta de Empleado: Vista   | [Ver imagen](./capturas/alta-empleado.jpeg)      |
