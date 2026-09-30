# 🍷 Cepa - Gastronomía & Reserva

Trabajo Final Integrador (TFI) — Aplicación móvil desarrollada con Angular, Ionic y Capacitor.

---

## 👥 Equipo y Ramas de Trabajo

| Apellido y Nombre     | Rama Principal (Branch)     |
| :-------------------- | :-------------------------- |
| **Garcia, Mateo**     | Backend y Base de Datos     |
| **Macri, Nicolas**    | UI/UX y Vistas Frontend     |
| **Goncalves, Matias** | Formularios y Autenticación |
| **Breyaui, Jaled**    | Arquitectura y Ruteo        |

---

## 📋 Seguimiento de Módulos y Objetivos

### 👨‍💻 Macri, Nicolas — Módulos UI/UX, Registro, Control de Accesos y Flujo de Pedidos

- **Branch:** `nico-alta-platos` / `feature/arreglos`
- **Período general de tareas:** 27/08/2026 — 25/09/2026

#### 🔹 1. UI/UX Global, Assets y Rediseño de Paleta Institucional
- **Período:** 27/08/2026 — 01/09/2026
- **Detalle:** 
  - Diseño de ícono corporativo, definición de la paleta de colores global (`variables.scss`) adaptada a la identidad visual verde institucional (`#132A20`, `#1B3B2D`, `#dbcbb9`, `#C8B29E`).
  - Generación de assets nativos con Capacitor y configuración de tipografías (`EB Garamond` e `Inter`).

#### 🔹 2. Splash Screen Dinámico y Animaciones de Entrada
- **Período:** 02/09/2026 — 05/09/2026
- **Detalle:** 
  - Integración de animación de entrada propia (`logoEntrance`) con efecto fade-in, separada del pulso continuo.
  - Implementación de barra de progreso indeterminada y sincronización del timing de navegación hacia el login.

#### 🔹 3. Registro de Cliente (Punto 5) y Cámara Forzada
- **Período:** 06/09/2026 — 12/09/2026
- **Detalle:** 
  - Desarrollo del formulario adaptado para el perfil cliente, extrayendo la lógica de lectura de DNI/QR a un servicio reutilizable (`DniScannerService`).
  - Configuración estricta de la cámara nativa mediante `CameraSource.Camera` para **bloquear por completo el acceso a la galería de fotos**, cumpliendo el requerimiento de la cátedra.
  - Alta contra Supabase (`auth.signUp`) configurando estado inicial `PENDIENTE`.

#### 🔹 4. Validaciones de Formularios y Sincronización de Roles (Home / Routes)
- **Período:** 13/09/2026 — 18/09/2026
- **Detalle:** 
  - Incorporación de expresiones regulares (`Validators.pattern`) en los campos de nombre y descripción de platos y bebidas para admitir exclusivamente letras, acentos y espacios.
  - Sincronización estricta entre el sistema de ruteo (`app.routes.ts`) y la lógica de perfiles en `HomePage`, ocultando y mostrando dinámicamente botones según el rol activo (Dueño, Supervisor, Cocinero, Cantinero, Mozo, Metre y Clientes).

#### 🔹 5. Circuito de Pedidos, Revisión del Mozo (Punto 13) y Notificaciones Push
- **Período:** 19/09/2026 — 25/09/2026
- **Detalle:**
  - Rediseño UI/UX de `PedidoPage` en formato de **pantalla única sin scroll**, incorporando la vista conmutable **"Ver Pedido"** con controles tipo píldora (`+` / `-`) y cierre rápido.
  - Implementación del flujo de rechazo por parte del mozo (`rechazado_mozo`): recuperación automática de los ítems rechazados hacia el carrito para edición de cantidades/productos y reenvío en tiempo real.
  - Gestión dinámica de canales Push con `@capacitor-community/fcm` (`mozos` y `cliente_${id}`) e invocación de la Edge Function `enviar-notificacion`.

---

### 👨‍💻 Garcia, Mateo — Backend, Servicios Core y Ruteo de Pedidos

- **Período de tarea:** 27/08/2026 — 25/09/2026
- **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. *(No hubo necesidad de reasignar plazos ni módulos).*
- **Módulos asignados:**
  - [x] **Módulo de Alta de Bebidas (Perfil "Cantinero"):** Implementación integral de la carga de bebidas para la carta con validaciones estrictas y respuesta háptica.
  - [x] **Diseño e Infraestructura DB:** Creación de tablas (`usuarios`, `productos`, `mesas`, `pedidos`), restricciones `CHECK` y políticas de seguridad RLS en Supabase.
  - [x] **Lógica de Base de Datos y Triggers:** Refactorización del guardado enviando información como metadatos en `signUp()`. Creación de Triggers PL/pgSQL para asignar roles y estados automáticamente.
  - [x] **Storage y Cámara:** Integración con `@capacitor/camera` para 3 fotos obligatorias, optimización a Base64/Blob y subida al Bucket de Storage.
  - [x] **Sistema de Notificaciones por Correo Automático (EmailJS):** Integración del `EmailService` centralizado, automatización del flujo de registro/aprobación y plantilla HTML única con paleta diferenciada por estado.
  - [x] **Modal de Confirmación Interactivo (`ConfirmModalComponent`):** Reemplazo de los diálogos nativos por modales Ionic personalizados en los flujos de alta y de gestión de clientes.
  - [x] **Motor de Pedidos y Ruteo por Sectores (`PedidosService` y `CarritoService`):** Gestión de estado reactivo del carrito en memoria, confirmación del mozo y derivación automática de comandas hacia Cocina (`PLATO`/`POSTRE`) y Bar (`BEBIDA`) con disparo de notificaciones Push por sector.

---

### 👨‍💻 Goncalves, Matias — Ingreso Anónimo, Administración y Panel de Cocina

- **Branch:** `rama-matias-goncalves` 
- **Período general de tareas:** 10/09/2026 — 25/09/2026

#### 🔹 1. Pantalla de Registro Anónimo y Validaciones (Punto 9)
- **Período:** 10/09/2026 — 12/09/2026
- **Detalle:** 
  - Formulario simplificado que solicita el nombre del usuario y una fotografía personal capturada en caliente desde el dispositivo, con soporte híbrido de compatibilidad para pruebas en PC mediante `FileReader`.
  - Validación estricta en tiempo real mediante expresiones regulares para permitir únicamente letras, espacios y acentos, bloqueando números y símbolos.
  - Sincronización de perfiles con rol `CLIENTE_ANONIMO` en Supabase utilizando la estrategia `.upsert()` para prevenir conflictos ante triggers automáticos.

#### 🔹 2. Escaneo de Código QR de Ingreso
- **Período:** 13/09/2026 — 15/09/2026
- **Detalle:** 
  - Integración del plugin `@capacitor-mlkit/barcode-scanning` para lectura nativa y optimizada del QR de entrada al establecimiento.
  - Implementación de un puente de desarrollo web para simular la lectura de códigos desde entornos de escritorio sin hardware de cámara físico.

#### 🔹 3. Gestión de Lista de Espera y Restricciones de Acceso
- **Período:** 16/09/2026 — 18/09/2026
- **Detalle:** 
  - Inserción automatizada del cliente en la tabla `lista_espera` de Supabase al validar con éxito el QR de entrada.
  - Lógica de prevención de duplicados que comprueba si el usuario ya posee un registro activo con estado en espera antes de permitir nuevas inserciones.
  - Configuración de guardas lógicas de seguridad para bloquear el acceso de clientes anónimos al escaneo de mesas o sectores operativos si no completaron el circuito de ingreso y asignación por parte del Metre.

#### 🔹 4. Panel de Cocina — Gestión de Comandas (Punto 16)
- **Período:** 19/09/2026 — 25/09/2026
- **Detalle:**
  - Lectura en tiempo real de pedidos filtrados por `en_preparacion`, aislando exclusivamente los ítems correspondientes al sector cocina (`PLATO` y `POSTRE`).
  - Diseño de tarjetas agrupadas por mesa con hora exacta y despacho seguro mediante modal de confirmación personalizado.

---

### 👨‍💻 Breyaui, Jaled

- **Período de tarea:** 27/08/2026 — 04/09/2026
- **Observaciones / Reasignaciones:** Tareas completadas en tiempo y forma. *(No hubo necesidad de reasignar plazos ni módulos).*
- **Módulos asignados:**
  - [x] Arquitectura general y sistema de ruteo (`app-routing`).
  - [x] Implementación de Guards para el alta de platos, bebidas, mesas y empleados.
  - [x] **Loading Global:** Creación de `CepaSpinnerComponent`, un componente standalone reutilizable con animación y texto dinámico.
  - [x] **Pantalla Home:** Menú inicial desde donde se redirige a los formularios.
  - [x] **Módulo de Alta de Mesas**.
  - [x] **Registro de nuevos clientes**.
  - [x] **Aceptación o rechazo de clientes por parte del supervisor**.
  - [x] **Chat entre mozos y clientes**.
  - [x] **Configuración RealTime Channel en Supabase**.
  - [x] **Listado de productos con imágenes y demás información solicitada por las consignas**.

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

- **Registro Pendiente (`RegistroClientePage`):** Al completar el formulario e ingresar la solicitud en Supabase, se gatilla automáticamente el correo de confirmación en recepción. _(Pendiente: inyectar el `EmailService`, que hoy no está conectado a la lógica.)_

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

## 🛎️ Detalles Técnicos: Motor de Pedidos, Carrito Reactivo y Ruteo por Sectores

**Responsable Principal:** Mateo Garcia

**1. `PedidosService` (`src/app/services/pedidos.service.ts`):**

Servicio centralizado para la interacción con Supabase y la lógica de negocio de los pedidos:
- **Confirmación y Ruteo Automático (`confirmarPedidoYRutear`):**
  - Cambia el estado general del pedido (Mozo) a `'confirmado'`.
  - **Motor de Desglose/Ruteo:** Analiza el array de ítems (`items`) según la categoría del producto (`tipo` / `categoria`) y actualiza en la base de datos:
    - `estado_cocina`: `'en_preparacion'` (si el pedido contiene `PLATO` o `POSTRE`) o `'no_aplica'`.
    - `estado_bar`: `'en_preparacion'` (si el pedido contiene `BEBIDA`) o `'no_aplica'`.
  - Registra el ID del mozo que confirmó (`confirmado_por`) y la marca temporal (`fecha_confirmacion`).
- **Disparo de Notificaciones Push (`notificarSectores`):** Invoca Edge Functions de Supabase para enviar alertas push dirigidas a los canales/topics de `'cocina'` y `'bar'` según corresponda.

**2. `CarritoService` (`src/app/services/carrito.service.ts`):**

Servicio desacoplado enfocado exclusivamente en la gestión del estado en memoria de la UI (*Single Responsibility Principle*):
- Control de ítems agregados/eliminados, cálculo dinámico del total en ARS y estimación del tiempo de elaboración en tiempo real mediante RxJS (`BehaviorSubject`).

**3. Panel del Mozo (`ConfirmarPedidoPage`):**

- Integración del método `confirmarPedidoYRutear()` mediante modales de confirmación.
- Transición de pedidos de `'pendiente_confirmacion'` a `'confirmado'`, liberando la comanda a los sectores de preparación.
- Opción de envío a revisión (`'rechazado_mozo'`) notificando al cliente para la edición del pedido.

**4. App Cliente (`PedidoPage` & `HomePage`):**

- **Garantía de Ruteo:** Inclusión de la propiedad `tipo` (`PLATO`, `BEBIDA`, `POSTRE`) en la estructura del payload enviado a la base de datos.
- **Actualización en Tiempo Real:** Suscripción al canal de Supabase Realtime (`postgres_changes`) para detectar cuando el estado del pedido cambia a `'confirmado'` o `'en_preparacion'`.
- **Desbloqueo de Secciones:** Habilitación condicional en la UI de los accesos a **"Ver Estado del Pedido"** y la sección de **"Juegos / Descuentos"** tras la confirmación por parte del mozo.

---

## 🧑‍💼 Detalles Técnicos: Frontend de Administración (Punto 6) & Panel de Cocina (Punto 16)

**Responsable Principal:** Matias Goncalves

### A. Gestión de Clientes Pendientes y Accesos (Punto 6)

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

### B. Panel de Cocina — Gestión de Comandas (Punto 16)

- **Lectura en Tiempo Real:** Visualización automática de los pedidos entrantes filtrados por el estado `en_preparacion`, separando la lógica de la cocina del bar (solo muestra `PLATO` y `POSTRE`).
- **Diseño de Tarjetas:** Cumplimiento de los requisitos de UI agrupando las comandas por número de mesa, detallando la hora exacta del pedido y los ítems a elaborar con sus respectivas cantidades.
- **Despacho Seguro:** Implementación de un modal de confirmación personalizado para marcar los pedidos como `listo` y actualizar la base de datos en Supabase, respetando la regla estricta de no utilizar alertas nativas (`alert()`).
- **Consistencia Visual:** Integración de los componentes globales del proyecto (`<app-cepa-header>` y `<app-cepa-spinner>`) para mantener el diseño oscuro de la marca y proveer feedback visual de carga.

---

## 🌿 Detalles Técnicos: Registro de Cliente, Rediseño Visual & Flujo de Revisión de Pedidos

**Responsable Principal:** Nicolas Macri

**1. Registro de Cliente (Punto 5):**

- Se partió de `registro-empleado.page.ts` (desarrollado por Integrante 1) como base, adaptándolo a los campos y reglas del cliente: sin campo `CUIL`, perfil limitado a `CLIENTE` / `METRE`.
- Extracción de la lógica de escaneo de QR de DNI a un service reutilizable (`DniScannerService`), inyectado por constructor en la página.
- Captura de foto forzada a `CameraSource.Camera` para bloquear el acceso a la galería, cumpliendo el requerimiento de la cátedra.
- Alta contra Supabase (`auth.signUp`) con estado inicial `PENDIENTE` en `options.data`, a la espera de que Integrante 4 lo persista en una tabla propia.

**2. Rediseño de Paleta Institucional:**

- Migración completa de Login, Splash, Registro de Cliente, Alta de Plato y el `CepaHeaderComponent` compartido, desde la paleta bordó/crema original a la nueva paleta verde institucional (`#132A20`, `#1B3B2D`, `#dbcbb9`, `#C8B29E`, `#091610`).
- Definición de una convención de uso por rol de color (fondo principal, fondo de tarjetas, texto principal, acentos, texto de botones) aplicada de forma consistente en las pantallas.
- Ajustes de jerarquía visual: mayor peso tipográfico en los títulos, radios de borde más generosos (de `12px` a `16-18px`) acordes a la tipografía serif _EB Garamond_, e iconografía de acento diferenciada para la acción principal de cada pantalla (cámara/foto).

**3. Splash Screen (mejoras adicionales):**

- Animación de entrada propia del logo (`logoEntrance`), separada del pulso continuo.
- Barra de progreso indeterminada entre el logo y el listado del equipo.
- Ajuste del timing de la secuencia de animaciones (incluyendo el delay de navegación al login) para que el último nombre del equipo termine de aparecer antes de la transición.

**4. Interfaz de Pedidos en Pantalla Única y Circuito de Revisión (Puntos 12, 13 y 14):**

- **Diseño en Pantalla Única (*Zero-Scroll Layout*):** Reestructuración de `PedidoPage` separando la vista del menú principal y el detalle del carrito mediante un panel conmutable (**"Ver Pedido"**) dentro de la misma página, evitando superposiciones y desplazamientos innecesarios.
- **Edición y Reenvío tras Rechazo del Mozo (Punto 13):** Al recibir el estado `'rechazado_mozo'`, la vista hidrata automáticamente el `CarritoService` con los productos originales, despliega un banner de alerta contextual y permite modificar cantidades, quitar o sumar platos antes de actualizar la comanda en Supabase.
- **Canales Dinámicos de Push Notifications (FCM):** Configuración en `HomePage`, `PedidoPage` y `ConfirmarPedidoPage` de suscripciones dinámicas con `@capacitor-community/fcm` (`mozos` y `cliente_${id}`), asegurando las alertas bidireccionales entre el mozo y el cliente.

---

## Jugá con Cepa

El acceso del home aparece para clientes registrados aprobados con una mesa asignada. La primera partida de cada juego puede dar descuento: Ahorcado 20%, Memoria 15% o Verdadero o falso 10%. Si pierde uno, puede intentar otro por su premio. Solo se aplica el primer descuento que gana; desde entonces todos los juegos quedan disponibles para jugar por diversión. La app recuerda qué juegos ya intentó en el dispositivo; la base solo guarda `asignaciones.descuento_obtenido`.

Para habilitar los juegos en una base de Supabase existente, aplicá la migración [`supabase/migrations/20260930160000_juegos_descuentos.sql`](./supabase/migrations/20260930160000_juegos_descuentos.sql) con una cuenta administradora. El código de la app no crea la columna ni la función automáticamente. La base solo guarda el porcentaje obtenido; no conoce los juegos ni sus intentos.

El premio se registra para la visita, pero aún no modifica el total del pedido ni el cobro. Como la app resuelve la partida, antes de usar este dato para cobrar hace falta validar las victorias en el servidor.

---

## 📸 Índice de Imágenes del Proyecto

> _A continuación se detallan todas las capturas correspondientes a íconos, pantallas de presentación, formularios y listados del proyecto._

|   #    | Componente / Pantalla               | Enlace de visualización                        |
| :----: | :---------------------------------- | :--------------------------------------------- |
| **1**  | Ícono de la aplicación              | [Ver imagen](./resources/icon.png)             |
| **2**  | Splash Dinámico                     | [Ver imagen](./capturas/Splash-screen.jpeg)    |
| **3**  | Spinner                             | [Ver imagen](./capturas/spinner.jpeg)          |
| **4**  | Login: Pantalla principal           | [Ver imagen](./capturas/login.jpeg)            |
| **5**  | Pantalla principal                  | [Ver imagen](./capturas/home.jpeg)             |
| **6**  | Alta de Mesa: Vista                 | [Ver imagen](./capturas/alta-mesa.jpeg)        |
| **7**  | Alta de Plato: Vista                | [Ver imagen](./capturas/alta-plato.jpeg)       |
| **8**  | Alta de Bebida: Vista               | [Ver imagen](./capturas/alta-bebida.jpeg)      |
| **9**  | Alta de Empleado: Vista             | [Ver imagen](./capturas/alta-empleado.jpeg)    |
| **10** | Registro de Empleado: Vista         | [Ver imagen](./capturas/Registro-empleado.jpeg)|
| **11** | Clientes pendientes: Vista          | [Ver imagen](./capturas/cliente-pendiente.jpeg)|
| **12** | Asignación de mesa (Metre): Vista   | [Ver imagen](./capturas/Asignar-mesa.jpeg)     |
| **13** | Realizar pedido (Cliente): Vista    | [Ver imagen](./capturas/.jpeg)                 |
| **14** | Menú de pedidos (Cliente): Vista    | [Ver imagen](./capturas/menu.jpeg)             |
| **15** | Escanear mesa (Cliente): Vista      | [Ver imagen](./capturas/escanear-mesa.jpeg)    |
| **16** | Ingreso al local (Cliente): Vista   | [Ver imagen](./capturas/.jpeg)                 |
| **17** | Confirmar pedido (Mozo): Vista      | [Ver imagen](./capturas/.jpeg)                 |
| **18** | Gestion Comandas (Cocinero): Vista  | [Ver imagen](./capturas/.jpeg)             |





