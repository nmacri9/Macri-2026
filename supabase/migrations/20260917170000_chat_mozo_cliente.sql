-- Ejecutar en SQL Editor del mismo proyecto que utiliza la aplicación.
-- Requiere solamente los perfiles existentes: usuarios y clientes.
-- Mesa manual: el alta de mesas y las asignaciones todavía están en desarrollo.
begin;

create table public.chat_mensajes (
  id uuid primary key,
  autor_id uuid not null references auth.users(id),
  autor_nombre text not null,
  autor_rol text not null check (autor_rol in ('MOZO', 'CLIENTE_REGISTRADO')),
  numero_mesa integer,
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  creado_en timestamptz not null default now(),
  respuesta_a uuid references public.chat_mensajes(id),
  respuesta_texto text,
  respuesta_autor text,
  check (autor_rol = 'MOZO' or numero_mesa is not null)
);

create index chat_mensajes_fecha_idx on public.chat_mensajes (creado_en desc, id desc);
alter table public.chat_mensajes enable row level security;

-- Solo perfiles persistidos habilitados. No se confía en user_metadata.
create function public.chat_puede_leer()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'MOZO' and u.estado = 'ACTIVO')
    or exists (select 1 from public.clientes c
      where c.cliente_id = auth.uid() and c.estado = 'APROBADO')
  );
$$;

create policy chat_lectura_sala on public.chat_mensajes
  for select to authenticated using ((select public.chat_puede_leer()));

revoke all on public.chat_mensajes from anon, authenticated;
grant select on public.chat_mensajes to authenticated;

create function public.chat_participante()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nombre text;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para abrir el chat.' using errcode = '42501';
  end if;

  select nullif(btrim(concat_ws(' ', u.nombres, u.apellidos)), '') into v_nombre
  from public.usuarios u
  where u.id = v_uid and u.rol = 'MOZO' and u.estado = 'ACTIVO';
  if found then
    return jsonb_build_object('id', v_uid, 'nombre', coalesce(v_nombre, 'Mozo'),
      'rol', 'MOZO', 'numero_mesa', null);
  end if;

  select nullif(btrim(concat_ws(' ', c.nombre, c.apellido)), '') into v_nombre
  from public.clientes c where c.cliente_id = v_uid and c.estado = 'APROBADO';
  if not found then
    raise exception 'Tu perfil no está habilitado para el chat.' using errcode = '42501';
  end if;

  return jsonb_build_object('id', v_uid, 'nombre', coalesce(v_nombre, 'Cliente'),
    'rol', 'CLIENTE_REGISTRADO', 'numero_mesa', null);
end;
$$;

create function public.chat_enviar(p_id uuid, p_texto text, p_respuesta_a uuid default null, p_numero_mesa integer default null)
returns public.chat_mensajes language plpgsql security definer set search_path = ''
as $$
declare
  v_persona jsonb;
  v_mesa integer;
  v_respuesta public.chat_mensajes;
  v_mensaje public.chat_mensajes;
  v_texto text := btrim(p_texto);
begin
  v_persona := public.chat_participante();
  if p_id is null or v_texto is null or char_length(v_texto) not between 1 and 2000 then
    raise exception 'Escribí un mensaje de entre 1 y 2000 caracteres.' using errcode = '22023';
  end if;

  -- Un reintento tras un corte de red devuelve el envío original sin duplicarlo.
  select * into v_mensaje from public.chat_mensajes where id = p_id;
  if found then
    if v_mensaje.autor_id = auth.uid() and v_mensaje.texto = v_texto
      and v_mensaje.respuesta_a is not distinct from p_respuesta_a
      and (v_persona ->> 'rol' = 'MOZO' or v_mensaje.numero_mesa is not distinct from p_numero_mesa) then
      return v_mensaje;
    end if;
    raise exception 'Identificador de mensaje ya utilizado.' using errcode = '22023';
  end if;

  if v_persona ->> 'rol' = 'CLIENTE_REGISTRADO' then
    if p_numero_mesa is null or p_numero_mesa not between 1 and 9999 then
      raise exception 'Ingresá un número de mesa entre 1 y 9999.' using errcode = '22023';
    end if;
    v_mesa := p_numero_mesa;
  end if;

  if p_respuesta_a is not null then
    select * into v_respuesta from public.chat_mensajes where id = p_respuesta_a;
    if not found then
      raise exception 'El mensaje al que respondés no existe.' using errcode = '22023';
    end if;
    if v_persona ->> 'rol' = 'MOZO' then
      v_mesa := v_respuesta.numero_mesa;
    end if;
  end if;

  insert into public.chat_mensajes (
    id, autor_id, autor_nombre, autor_rol, numero_mesa, texto,
    respuesta_a, respuesta_texto, respuesta_autor
  ) values (
    p_id, auth.uid(), v_persona ->> 'nombre', v_persona ->> 'rol', v_mesa, v_texto,
    p_respuesta_a, v_respuesta.texto, v_respuesta.autor_nombre
  ) on conflict (id) do nothing returning * into v_mensaje;

  -- También contempla dos reintentos concurrentes del mismo envío.
  if not found then
    select * into v_mensaje from public.chat_mensajes where id = p_id;
    if v_mensaje.autor_id <> auth.uid() or v_mensaje.texto <> v_texto
      or v_mensaje.respuesta_a is distinct from p_respuesta_a
      or (v_persona ->> 'rol' = 'CLIENTE_REGISTRADO' and v_mensaje.numero_mesa is distinct from p_numero_mesa) then
      raise exception 'Identificador de mensaje ya utilizado.' using errcode = '22023';
    end if;
  end if;
  return v_mensaje;
end;
$$;

revoke all on function public.chat_puede_leer() from public, anon;
revoke all on function public.chat_participante() from public, anon;
revoke all on function public.chat_enviar(uuid, text, uuid, integer) from public, anon;
grant execute on function public.chat_puede_leer() to authenticated;
grant execute on function public.chat_participante() to authenticated;
grant execute on function public.chat_enviar(uuid, text, uuid, integer) to authenticated;

-- El canal del cliente se llama chat-mozo-cliente y escucha INSERT de esta tabla.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_mensajes'
  ) then
    alter publication supabase_realtime add table public.chat_mensajes;
  end if;
end;
$$;

commit;
