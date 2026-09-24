# Chat del salón

## Configuración

1. La consulta al catálogo realizada por el usuario confirmó que no existen
   `public.chat_participante` ni `public.chat_enviar`. Está pendiente confirmar
   la existencia de `chat_mensajes`; no se debe reemplazar una tabla existente.
2. Se preparó en la conversación un bloque de creación con los dos RPC, RLS y
   Realtime, validado en PostgreSQL 15 local con datos de prueba. Usa roles
   almacenados, admite `CLIENTE_ANONIMO` activo y obtiene la mesa de la asignación
   real. Queda pendiente su ejecución por el usuario en Supabase.
   No se generan archivos SQL ni se asume que las pruebas locales verifican el
   esquema remoto. El frontend consulta la asignación activa, pero esto no
   sustituye la instalación de los RPC.
3. Publicar `functions/enviar-notificacion/index.ts` junto con `chat.ts` antes de probar
   las push de esta versión. La función sigue usando el secreto existente
   `FIREBASE_SERVICE_ACCOUNT`; la rama del chat usa también las variables de Supabase.
   No se ha publicado automáticamente ni se han modificado datos remotos.
4. Abrir `/chat-cliente` con un cliente con mesa asignada y dos mozos activos en dispositivos distintos.

El canal es **`chat-mozo-cliente`** (nombre confirmado). Usa `postgres_changes`, evento
`INSERT`, tabla `public.chat_mensajes`. Crear un canal en el inspector de Supabase no
crea almacenamiento ni habilita la publicación de una tabla. Esta implementación no
usa eventos Broadcast ni necesita políticas sobre `realtime.messages`.

Referencia: https://supabase.com/docs/guides/realtime/postgres-changes

## Comportamiento y permisos

- Sala común: conserva historial, citas y Realtime entre clientes y mozos.
- El frontend admite clientes registrados aprobados, anónimos activos y mozos activos,
  usando los perfiles existentes de `clientes` y `usuarios`. El acceso del anónimo
  requiere completar también el ajuste del RPC y de las restricciones de la tabla.
- El cliente necesita una asignación activa para consultar. El menú requiere además
  `estado_escaneo = 'OCUPADA'`. Un guard comprueba ambos flujos al entrar por URL.
- La mesa se carga automáticamente y se vuelve a consultar antes de enviar;
  el cliente ya no escribe el número. El chat no modifica las asignaciones.
- La base existente fija nombre, rol y fecha/hora. Está pendiente sustituir allí
  la mesa declarada por la asignación real, después de revisar las funciones actuales.
- Cualquier mozo puede responder a un mensaje; su respuesta conserva la mesa de la
  consulta. Un mensaje general de un mozo se identifica como «Salón».
- Los mensajes solo se insertan mediante RPC. No hay permisos de edición o borrado.
- La hora se guarda como `timestamptz` y se muestra según la zona horaria del dispositivo.
- Se muestran los últimos 50 mensajes, con carga de anteriores y recuperación al reconectar.
- Los reintentos conservan el UUID para evitar duplicados ante una respuesta de red perdida.

## Verificación en Supabase

```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'chat_mensajes';

select policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename = 'chat_mensajes';
```

## Prueba con dos sesiones

Pruebas automatizadas aisladas del chat:

```sh
npm test -- --watch=false --ts-config=tsconfig.chat-spec.json --include=src/app/services/chat.service.spec.ts --include=src/app/services/chat-push.service.spec.ts --include=src/app/pages/chat-cliente/chat-cliente.page.spec.ts --include=src/app/mesa.guard.spec.ts --include=src/app/role.guard.spec.ts --include=src/app/pages/menu-productos/menu-productos.page.spec.ts --include=src/app/pages/cliente-escaneo-mesa/cliente-escaneo-mesa.page.spec.ts
```

1. Cliente aprobado con mesa asignada: enviar una consulta; comprobar nombre, mesa automática, fecha y hora.
2. Mozo activo: recibirla sin refrescar, responder citándola y comprobar la recepción en el cliente.
3. Segundo cliente/mozo: comprobar que ve el mismo historial y puede participar.
4. Recargar o salir y volver: conservar historial, sin duplicar mensajes ni suscripciones.
5. Cortar y restaurar la conexión: conservar el borrador fallido y recuperar mensajes al reconectar.
6. Cliente sin asignación activa: el guard y el servicio bloquean el acceso/envío.
   Después de actualizar el RPC, verificar también el rechazo de un envío directo por API.
7. Otros roles / sesión cerrada: verificar que no pueden leer ni enviar mediante API.

La integración utiliza las columnas existentes:
`usuarios(id,nombres,apellidos,rol,estado)`,
`clientes(cliente_id,nombre,apellido,estado)`.
`asignaciones_mesa(cliente_id,mesa_id,activa,estado_escaneo)` y `mesas(id,numero)`.
No desactivar RLS para resolver diferencias de esquema o permisos.

## Push y prueba en dispositivos

- Todos los mozos se suscriben al topic `mozos`; cada cliente a `chat_cliente_<auth-id>`.
- Las suscripciones del chat se actualizan al registrarse el dispositivo, cambiar de
  sesión y volver a Home. Se limpian las de la cuenta anterior antes de suscribir la nueva.
- El cliente manda a `enviar-notificacion` solo `mensaje_id`. La función comprueba
  la sesión, participación y autoría, y calcula el destinatario desde el mensaje guardado.
- Una consulta notifica a todos los mozos. El mozo debe tocar **Responder** en la
  consulta para notificar a ese cliente; los mensajes generales solo aparecen en la sala.
- Tocar la notificación abre el chat pasando por los guards. Si falla el aviso,
  se ofrece reintentarlo sin volver a insertar el mensaje.
- Dispositivos 1 y 4: iniciar sesión con dos mozos activos y permitir notificaciones.
  Desde otro dispositivo con cliente y mesa asignada, enviar una consulta y verificar
  recepción en ambos, también con la app en segundo plano. Responder desde el 4 y
  comprobar la push y el nombre/fecha/hora de la respuesta en el cliente.
- Repetir con cliente anónimo una vez completado el SQL. Cambiar de usuario en un
  dispositivo y comprobar que no recibe los avisos de la sesión anterior.

Las pruebas unitarias simulan FCM; no certifican entrega real. Quedan pendientes
el ajuste SQL, la publicación de la función y la prueba física en los dispositivos.
