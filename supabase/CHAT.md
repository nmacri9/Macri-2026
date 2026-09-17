# Chat del salón

## Configuración

1. En el proyecto Supabase usado por `SupabaseService`, abrir **SQL Editor** y ejecutar
   `migrations/20260917170000_chat_mozo_cliente.sql` una sola vez.
2. El script crea `chat_mensajes`, las funciones `chat_participante` / `chat_enviar`,
   los permisos y la publicación para Realtime. No modifica mesas ni asignaciones.
3. Abrir `/chat-cliente` con un cliente aprobado y con un mozo activo en dos sesiones distintas.

El canal es **`chat-mozo-cliente`** (nombre confirmado). Usa `postgres_changes`, evento
`INSERT`, tabla `public.chat_mensajes`. Crear un canal en el inspector de Supabase no
crea almacenamiento ni habilita la publicación de una tabla. Esta implementación no
usa eventos Broadcast ni necesita políticas sobre `realtime.messages`.

Referencia: https://supabase.com/docs/guides/realtime/postgres-changes

## Comportamiento y permisos

- Sala común: todos los clientes aprobados y todos los mozos activos pueden leer.
- El acceso usa los perfiles existentes de `clientes` y `usuarios`; el login actual
  del proyecto no implementa perfiles de clientes anónimos.
- El cliente ingresa manualmente su número de mesa (1–9999). Es una declaración,
  no una asignación verificada: los flujos de alta y asignación aún están en desarrollo.
- El chat no consulta ni modifica `mesas` o `asignaciones_mesa`.
- La base fija nombre, rol y fecha/hora, y valida el número declarado por el cliente.
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
npm test -- --watch=false --ts-config=tsconfig.chat-spec.json --include=src/app/services/chat.service.spec.ts --include=src/app/pages/chat-cliente/chat-cliente.page.spec.ts
```

1. Cliente aprobado: ingresar la mesa y enviar una consulta; comprobar nombre, mesa, fecha y hora.
2. Mozo activo: recibirla sin refrescar, responder citándola y comprobar la recepción en el cliente.
3. Segundo cliente/mozo: comprobar que ve el mismo historial y puede participar.
4. Recargar o salir y volver: conservar historial, sin duplicar mensajes ni suscripciones.
5. Cortar y restaurar la conexión: conservar el borrador fallido y recuperar mensajes al reconectar.
6. Cliente sin número de mesa o con número inválido: puede leer, pero el envío queda bloqueado también en la base.
7. Otros roles / sesión cerrada: verificar que no pueden leer ni enviar mediante API.

La migración requiere las columnas que ya utiliza el repositorio:
`usuarios(id,nombres,apellidos,rol,estado)`,
`clientes(cliente_id,nombre,apellido,estado)`.
Si falla por un esquema diferente, la transacción se revierte; corregir ese esquema
antes de volver a ejecutar. No desactivar RLS.
