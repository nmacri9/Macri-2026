# 🍷 Cepa - Gastronomía & Reserva

Trabajo Final Integrador (TFI) — App móvil para la gestión de un salón gastronómico: ingreso de clientes, mesas, pedidos y atención en tiempo real.

**Stack:** Angular · Ionic · Capacitor · Supabase (Auth, Postgres con RLS, Realtime, Storage, Edge Functions) · Firebase Cloud Messaging · EmailJS · Chart.js

---

## 👥 Equipo

| Apellido y Nombre     | Rama Principal (Branch)     | Período                   |
| :-------------------- | :-------------------------- | :------------------------ |
| **Garcia, Mateo**     | Backend y Base de Datos     | 27/08/2026 — 15/10/2026   |
| **Macri, Nicolas**    | UI/UX y Vistas Frontend     | 27/08/2026 — 15/10/2026   |
| **Goncalves, Matias** | Formularios y Autenticación | 27/08/2026 — 15/10/2026   |
| **Breyaui, Jaled**    | Arquitectura y Ruteo        | 27/08/2026 — 04/09/2026   |

---

## ✅ Funcionalidades

### Base de la app

| Funcionalidad | Qué hace | Resp. |
| :------------ | :------- | :---- |
| **Identidad visual** | Ícono, paleta verde institucional (`#132A20`, `#1B3B2D`, `#dbcbb9`, `#C8B29E`), tipografías *EB Garamond* e *Inter* y assets nativos con Capacitor. | Macri |
| **Splash dinámico** | Logo con animación de entrada, barra de progreso y paso automático al login. | Macri |
| **Login y acceso rápido** | Inicio de sesión con un botón de acceso rápido que lleva a una vista con un perfil por rol. | Macri · Goncalves |
| **Ruteo, guards y Home por rol** | Rutas protegidas por rol (`app.routes.ts`) y un Home que muestra solo las opciones del perfil activo. | Breyaui · Macri |
| **Loading global** | `CepaSpinnerComponent`: spinner reutilizable con texto dinámico. | Breyaui |
| **Modales de confirmación** | `ConfirmModalComponent` reemplaza los diálogos nativos en altas y gestión de clientes. | Garcia · Goncalves |
| **Base de datos** | Tablas con restricciones `CHECK` y políticas RLS, triggers PL/pgSQL que asignan rol y estado al registrarse, y Storage para las fotos. | Garcia |
| **Notificaciones push** | Topics de FCM por rol (`mozos`, `cocina`, `bar`, `cliente_<id>`…) y una Edge Function, `enviar-notificacion`, que las dispara. | Garcia · Macri |
| **Correos automáticos (Puntos 7–8)** | `EmailService` (EmailJS) con una plantilla HTML de color distinto por estado (en revisión, aprobado, rechazado) y logo en CDN para verse en Gmail y Outlook. | Garcia |

### Altas y carta

| Funcionalidad | Qué hace | Resp. |
| :------------ | :------- | :---- |
| **Alta de plato** | Formulario para el perfil Cocinero con validaciones y 3 fotos obligatorias, sin scroll. | Macri · Garcia |
| **Alta de bebida** | Carga para el perfil Cantinero con validaciones, vibración ante errores y 3 fotos obligatorias subidas a Storage. | Garcia |
| **Alta de mesa** | Mesas con número, capacidad, tipo, foto y código QR. | Breyaui |
| **Registro de empleado** | Alta de personal con su perfil (Cocinero, Mozo, Cantinero, Metre), lectura del QR del DNI y foto; el administrador conserva su sesión. | Goncalves |
| **Carta de productos (Punto 11)** | Listado con fotos, precio, descripción y tiempo de elaboración de cada producto. | Breyaui |
| **Chat con mozos (Punto 11)** | Chat en tiempo real entre clientes y mozos (Supabase Realtime) con push en ambos sentidos. | Breyaui |
| **Panel de Barra (Punto 17)** | Panel de comandas para barra implementado en `barra.page.ts`. | Macri |

### Ingreso del cliente y mesa

| Funcionalidad | Qué hace | Resp. |
| :------------ | :------- | :---- |
| **Registro de cliente (Punto 5)** | Formulario con lectura del QR del DNI (`DniScannerService`), foto solo con cámara nativa (galería bloqueada) y alta en estado `PENDIENTE`. | Macri |
| **Aprobación de clientes (Punto 6)** | Listado de pendientes para Dueño y Supervisor con aceptar o rechazar, actualización en tiempo real y modal de confirmación. | Goncalves · Breyaui |
| **Ingreso anónimo (Punto 9)** | Nombre y foto, sin correo ni contraseña; perfil `CLIENTE_ANONIMO` con validación de letras, espacios y acentos. | Goncalves |
| **QR de ingreso y lista de espera (Punto 9)** | Lectura nativa del QR del local (`@capacitor-mlkit/barcode-scanning`) que anota al cliente en `lista_espera` sin duplicados; sin mesa asignada no accede a mesas ni al menú. | Goncalves |
| **Asignación de mesa (Punto 10)** | El Metre vincula al cliente (anónimo o registrado) con una mesa y el cliente la confirma escaneando el QR de la mesa. | Breyaui |

### Pedidos y servicio

| Funcionalidad | Qué hace | Resp. |
| :------------ | :------- | :---- |
| **Carrito y envío (Punto 12)** | Carrito reactivo con total y tiempo estimado (el del producto más lento) siempre visibles; al enviar, el pedido queda en `pendiente_confirmacion`. | Macri · Garcia |
| **Revisión del mozo y ruteo (Puntos 13–14)** | El mozo confirma o rechaza; si rechaza, los ítems vuelven al carrito para editarlos. Al confirmar, el pedido se deriva a cocina (`PLATO`/`POSTRE`) y bar (`BEBIDA`) con push a cada sector. | Macri · Garcia |
| **Panel de Cocina (Punto 16)** | Comandas en `en_preparacion` con solo los ítems de cocina, agrupadas por mesa con hora, y despacho mediante modal de confirmación. | Goncalves |
| **Consolidación de sectores (Punto 18)** | Cocina y barra marcan su parte; cuando ambas están listas el pedido pasa a `listo_para_entregar` y se avisa por push al mozo y al cliente. | Macri |
| **Entrega y recepción (Punto 19)** | El mozo entrega (`entregado`) y el cliente confirma la recepción (`recibido`), lo que desbloquea Juegos, Encuesta y Pedir la cuenta. | Garcia |
| **Encuestas y gráficos (Punto 20)** | Encuesta con 6 tipos de control, una por pedido (`UNIQUE(pedido_id)`), y gráficos Chart.js (torta, barras y línea) mostrados de a uno por pantalla. | Goncalves |
| **Juegos con descuento** | Ahorcado, memotest y verdadero o falso para clientes con mesa; el primer premio da entre 10 % y 20 % de descuento (detalle más abajo). | Breyaui |
| **Cuenta y propina QR (Punto 21)** | Solicitud de cuenta con push al mozo y lectura obligatoria de uno de los cinco QR de satisfacción: Malo 0 %, Regular 5 %, Bueno 10 %, Muy Bueno 15 % y Excelente 20 %. Ticket con precios unitarios, importes, descuento de juegos, propina y total destacado. | Breyaui |
| **Pago simulado (Punto 21)** | El cliente simula el pago y espera la confirmación del mozo; se avisa por push al mozo, dueño y supervisor. | Breyaui |
| **Confirmación y liberación de mesa (Punto 22)** | El mozo confirma el pago, cierra la asignación y libera la mesa. Se notifica por push al cliente, dueño y supervisor; un nuevo escaneo de la mesa requiere una nueva asignación. | Breyaui |
| **Resultados desde el QR de ingreso (Punto 22)** | El QR de ingreso y lista de espera permite consultar los resultados de encuestas en gráficos de torta, barras y línea, uno por pantalla; también se reconoce desde el lector de mesa. | Breyaui |

**Estados de un pedido:**

```
pendiente_confirmacion → confirmado → listo_para_entregar → entregado → recibido
        └─ rechazado_mozo (vuelve al carrito)
```

---

## 🎮 Jugá con Cepa

Disponible para clientes registrados aprobados con una mesa asignada. La primera victoria da descuento (Ahorcado 20 %, Memoria 15 %, Verdadero o falso 10 %); solo se aplica el primero y después los juegos quedan por diversión. La base guarda únicamente `asignaciones.descuento_obtenido`.

- **Para habilitarlo:** aplicar la migración [`supabase/migrations/20260930160000_juegos_descuentos.sql`](./supabase/migrations/20260930160000_juegos_descuentos.sql) con una cuenta administradora; la app no crea la columna.
- **Aplicación en la cuenta:** el descuento guardado en la asignación se descuenta del consumo antes de calcular la propina. La validación de las victorias en el servidor sigue pendiente.

---

## Índice de Imágenes del Proyecto

> _A continuación se detallan todas las capturas correspondientes a íconos, pantallas de presentación, formularios y listados del proyecto._

Componente / Pantalla              | Enlace de visualización                         |
 :--------------------------------- | :---------------------------------------------- |
 Ícono de la aplicación             | [Ver imagen](./resources/icon.png)             |
 Splash Dinámico                    | [Ver imagen](./capturas/Splash-screen.jpeg)    |
 Spinner                            | [Ver imagen](./capturas/spinner.jpeg)          |
 Login: Pantalla principal          | [Ver imagen](./capturas/login.jpeg)            |
 Pantalla principal                 | [Ver imagen](./capturas/home.jpg)              |
 Alta de Mesa: Vista                | [Ver imagen](./capturas/alta-mesa.jpg)         |
 Alta de Plato: Vista               | [Ver imagen](./capturas/carga-plato.jpg)       |
 Alta de Bebida: Vista              | [Ver imagen](./capturas/carga-barra.jpg)       |
 Alta de Empleado: Vista            | [Ver imagen](./capturas/alta-empleado.jpeg)    |
 Registro de Empleado: Vista        | [Ver imagen](./capturas/Registro-empleado.jpeg)|
 Clientes pendientes: Vista         | [Ver imagen](./capturas/cliente-pendiente.jpeg)|
 Asignación de mesa (Metre): Vista  | [Ver imagen](./capturas/Asignar-mesa.jpeg)     |
 Realizar pedido (Cliente): Vista   | [Ver imagen](./capturas/pedido.jpeg)            |
 Menú de pedidos (Cliente): Vista   | [Ver imagen](./capturas/menu.jpeg)             |
 Escanear mesa (Cliente): Vista     | [Ver imagen](./capturas/escanear-mesa.jpeg)    |
 Ingreso al local (Cliente): Vista  | [Ver imagen](./capturas/ingreso-local.jpg)     |
 Confirmar pedido (Mozo): Vista     | [Ver imagen](./capturas/confirmar-pedido.jpg)  | 
 Comandas (Cocinero/Cantinero): Vista | [Ver imagen](./capturas/comandas-cocina.jpg) |
 Vista de Encuestas                 | [Ver imagen](./capturas/encuestas.jpg)         |
 Vista de Encuestas 2               | [Ver imagen](./capturas/encuestas-2.jpg)       | 
 Gráfico torta                      | [Ver imagen](./capturas/grafico-torta.jpg)     |
 Gráfico barra                      | [Ver imagen](./capturas/grafico-barra.jpg)     |
 Gráfico lineal                     | [Ver imagen](./capturas/grafico-lineal.jpg)    |
 Juegos                             | [Ver imagen](./capturas/juegos.jpg)            |
 Pedir Propina                      | [Ver imagen](./capturas/propina.jpg)           |
 Cierre de Cuenta (Punto 21)        | [Ver imagen](./capturas/cuenta.jpg)            |

## Índice de Imágenes QRs
Componente / Pantalla              | Enlace de visualización                         |
 :--------------------------------- | :----------------------------------------------|
 QR MESA 2           | [Ver imagen](./capturas/mesa-dos.jpg) |
 QR MESA 3           | [Ver imagen](./capturas/mesa-tres.jpg) |
 QR MESA 4           | [Ver imagen](./capturas/mesa-cuatro.jpg) |
 QR MESA 6           | [Ver imagen](./capturas/mesa-seis.jpg) |
 QR MESA 13          | [Ver imagen](./capturas/mesa-trece.jpg) |
 QR MESA 11          | [Ver imagen](./capturas/mesa-once.jpg) |
 QR MESA 14          | [Ver imagen](./capturas/mesa-catorce.jpg) |
 QR MESA 12          | [Ver imagen](./capturas/mesa-doce.jpg) |
 Propina 0%          | [Ver imagen](./capturas/propi-cero.jpg) |
 Propina 5%          | [Ver imagen](./capturas/propi-cinco.jpg) |
 Propina 10%         | [Ver imagen](./capturas/propi-diez.jpg) |
 Propina 15%         | [Ver imagen](./capturas/propi-quince.jpg) |
 Propina 20%         | [Ver imagen](./capturas/propi-veinte.jpg) |
 QR Ingreso          | [Ver imagen](./capturas/qr-ingreso.jpg) |


 
