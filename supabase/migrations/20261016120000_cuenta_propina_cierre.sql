-- Punto 21. Reutiliza clientes, asignaciones, pedidos y usuarios existentes.
begin;

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  asignacion_id text not null unique,
  cliente_id uuid not null references auth.users(id),
  mesa_id text not null,
  estado text not null default 'solicitada' check (estado in ('solicitada', 'lista', 'pagada', 'confirmada')),
  items jsonb not null default '[]',
  subtotal numeric(14,2) not null default 0,
  descuento_porcentaje numeric not null default 0 check (descuento_porcentaje between 0 and 100),
  descuento numeric(14,2) not null default 0,
  propina_porcentaje integer check (propina_porcentaje in (0, 5, 10, 15, 20)),
  propina numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  creada_en timestamptz not null default now(),
  pagada_en timestamptz,
  confirmada_en timestamptz,
  confirmada_por uuid references auth.users(id),
  check (estado = 'solicitada' or propina_porcentaje is not null)
);

create table public.cuenta_avisos (
  id bigint generated always as identity primary key,
  cuenta_id uuid not null references public.cuentas(id),
  evento text not null check (evento in ('solicitud', 'pago', 'confirmacion')),
  topic text not null,
  enviado_en timestamptz,
  reclamado_en timestamptz,
  unique (cuenta_id, evento, topic)
);

alter table public.cuentas enable row level security;
alter table public.cuenta_avisos enable row level security;
revoke all on public.cuentas, public.cuenta_avisos from anon, authenticated;
grant select on public.cuentas to authenticated;
grant all on public.cuentas, public.cuenta_avisos to service_role;
grant usage, select on sequence public.cuenta_avisos_id_seq to service_role;
create policy cuentas_lectura on public.cuentas for select to authenticated using (
  cliente_id = auth.uid() or exists (
    select 1 from public.usuarios u where u.id = auth.uid()
      and u.rol in ('MOZO', 'DUENO', 'SUPERVISOR') and u.estado = 'ACTIVO'
  )
);

-- Una misma Push no se despacha en paralelo por dos dispositivos o reintentos.
create function public.reclamar_avisos_cuenta(p_cuenta_id uuid)
returns setof public.cuenta_avisos language sql security definer set search_path = public, pg_temp as $$
  update public.cuenta_avisos set reclamado_en = now() where id in (
    select id from public.cuenta_avisos where cuenta_id = p_cuenta_id and enviado_en is null
      and (reclamado_en is null or reclamado_en < now() - interval '2 minutes')
    for update skip locked
  ) returning *;
$$;
revoke all on function public.reclamar_avisos_cuenta(uuid) from public;
grant execute on function public.reclamar_avisos_cuenta(uuid) to service_role;

create function public.gestionar_cuenta(p_accion text, p_qr text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_asignacion public.asignaciones%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_items jsonb;
  v_subtotal numeric;
  v_descuento numeric;
  v_porcentaje integer;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para consultar tu cuenta.'; end if;
  if p_accion not in ('consultar', 'solicitar', 'propina', 'pagar') then raise exception 'Acción inválida.'; end if;

  select a.* into v_asignacion from public.asignaciones a
    join public.clientes c on c.id = a.cliente_id
    where c.cliente_id = auth.uid() and a.estado = 'asignado'
      and a.fecha_finalizacion is null and a.mesa_id is not null
    order by a.fecha_asignacion desc limit 1 for update of a;
  if not found then
    if p_accion in ('consultar', 'pagar') then
      select * into v_cuenta from public.cuentas where cliente_id = auth.uid()
        and estado = 'confirmada' order by creada_en desc limit 1;
      if found then return to_jsonb(v_cuenta); end if;
    end if;
    raise exception 'Necesitás una mesa asignada y un pedido recibido para pedir la cuenta.';
  end if;

  select * into v_cuenta from public.cuentas where asignacion_id = v_asignacion.id::text for update;
  if found and (p_accion = 'consultar' or v_cuenta.estado in ('pagada', 'confirmada')) then
    return to_jsonb(v_cuenta);
  end if;

  -- Agrupa todos los pedidos de esta visita, nunca los de una visita anterior.
  if not exists (select 1 from public.pedidos p where p.cliente_id = auth.uid()
    and p.mesa_id = v_asignacion.mesa_id and p.created_at >= v_asignacion.fecha_asignacion and p.estado = 'recibido')
    or exists (select 1 from public.pedidos p where p.cliente_id = auth.uid()
    and p.mesa_id = v_asignacion.mesa_id and p.created_at >= v_asignacion.fecha_asignacion
    and p.estado not in ('recibido', 'rechazado_mozo', 'cancelado')) then
    raise exception 'Confirmá la recepción de todos tus pedidos antes de solicitar la cuenta.';
  end if;
  if p_accion = 'consultar' then return null; end if;
  if p_accion = 'solicitar' then
    if v_cuenta.id is null then
      insert into public.cuentas (asignacion_id, cliente_id, mesa_id)
        values (v_asignacion.id::text, auth.uid(), v_asignacion.mesa_id::text) returning * into v_cuenta;
      insert into public.cuenta_avisos (cuenta_id, evento, topic) values (v_cuenta.id, 'solicitud', 'mozos');
    end if;
    return to_jsonb(v_cuenta);
  end if;
  if v_cuenta.id is null then raise exception 'Solicitá la cuenta al mozo primero.'; end if;

  if p_accion = 'propina' then
    -- Cinco contenidos exactos: no aceptar QR de mesas, DNI ni porcentajes arbitrarios.
    v_porcentaje := case p_qr when 'CEPA:PROPINA:20' then 20 when 'CEPA:PROPINA:15' then 15
      when 'CEPA:PROPINA:10' then 10 when 'CEPA:PROPINA:5' then 5 when 'CEPA:PROPINA:0' then 0 else null end;
    if v_porcentaje is null then raise exception 'QR inválido. Escaneá uno de los cinco códigos de propina de CEPA.'; end if;
    select jsonb_agg(item), sum((item->>'precio')::numeric * (item->>'cantidad')::numeric)
      into v_items, v_subtotal from public.pedidos p cross join lateral jsonb_array_elements(p.items::jsonb) item
      where p.cliente_id = auth.uid() and p.mesa_id = v_asignacion.mesa_id
        and p.created_at >= v_asignacion.fecha_asignacion and p.estado = 'recibido';
    if v_subtotal is null or v_subtotal < 0 then raise exception 'No se pudo calcular el consumo.'; end if;
    -- El módulo de juegos ya persiste el premio del primer intento en la asignación.
    v_descuento := coalesce((to_jsonb(v_asignacion)->>'descuento_obtenido')::numeric, 0);
    if v_descuento not in (0, 10, 15, 20) then raise exception 'El descuento de esta visita no es válido.'; end if;
    update public.cuentas set items = v_items, subtotal = round(v_subtotal, 2),
      descuento_porcentaje = v_descuento, descuento = round(v_subtotal * v_descuento / 100, 2),
      propina_porcentaje = v_porcentaje, estado = 'lista' where id = v_cuenta.id;
    update public.cuentas set propina = round((subtotal - descuento) * propina_porcentaje / 100, 2)
      where id = v_cuenta.id;
    update public.cuentas set total = subtotal - descuento + propina where id = v_cuenta.id;
  elsif p_accion = 'pagar' then
    if v_cuenta.estado <> 'lista' or v_cuenta.propina_porcentaje is null then
      raise exception 'Escaneá el QR de propina antes de generar y pagar la cuenta.';
    end if;
    update public.cuentas set estado = 'pagada', pagada_en = now() where id = v_cuenta.id;
    insert into public.cuenta_avisos (cuenta_id, evento, topic)
      select v_cuenta.id, 'pago', t from unnest(array['mozos', 'duenos', 'supervisores']) t
      on conflict do nothing;
  end if;
  select * into v_cuenta from public.cuentas where id = v_cuenta.id;
  return to_jsonb(v_cuenta);
end;
$$;

create function public.confirmar_pago_cuenta(p_cuenta_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cuenta public.cuentas%rowtype;
begin
  if not exists (select 1 from public.usuarios where id = auth.uid() and rol = 'MOZO' and estado = 'ACTIVO') then
    raise exception 'Solo un mozo activo puede confirmar el pago.';
  end if;
  select * into v_cuenta from public.cuentas where id = p_cuenta_id;
  if not found then raise exception 'Cuenta no encontrada.'; end if;
  -- Mismo orden de locks que gestionar_cuenta: visita, luego cuenta.
  perform 1 from public.asignaciones where id::text = v_cuenta.asignacion_id for update;
  select * into v_cuenta from public.cuentas where id = p_cuenta_id for update;
  if v_cuenta.estado = 'confirmada' then return; end if;
  if v_cuenta.estado <> 'pagada' then raise exception 'El cliente todavía no realizó el pago.'; end if;
  update public.cuentas set estado = 'confirmada', confirmada_en = now(), confirmada_por = auth.uid()
    where id = v_cuenta.id;
  update public.asignaciones set fecha_finalizacion = now(), updated_at = now()
    where id::text = v_cuenta.asignacion_id and fecha_finalizacion is null;
  update public.mesas set disponibilidad = 'VACIA' where id::text = v_cuenta.mesa_id;
  insert into public.cuenta_avisos (cuenta_id, evento, topic)
    values (v_cuenta.id, 'confirmacion', 'cliente_' || v_cuenta.cliente_id) on conflict do nothing;
end;
$$;

-- No se puede agregar o modificar consumo mientras se está cerrando la visita.
create function public.proteger_consumo_cuenta()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_asignacion public.asignaciones%rowtype;
  v_pedido public.pedidos%rowtype;
begin
  if tg_op = 'DELETE' then v_pedido := old; else v_pedido := new; end if;
  select a.* into v_asignacion from public.asignaciones a join public.clientes c on c.id = a.cliente_id
    where c.cliente_id = v_pedido.cliente_id and a.mesa_id = v_pedido.mesa_id and a.fecha_finalizacion is null
    and a.estado = 'asignado' order by a.fecha_asignacion desc limit 1 for update of a;
  if found and exists (select 1 from public.cuentas where asignacion_id = v_asignacion.id::text) then
    raise exception 'La cuenta de esta visita ya fue solicitada. No se puede modificar el consumo.';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger pedidos_cuenta_cerrando before insert or update or delete on public.pedidos
  for each row execute function public.proteger_consumo_cuenta();

revoke all on function public.gestionar_cuenta(text, text), public.confirmar_pago_cuenta(uuid), public.proteger_consumo_cuenta() from public;
grant execute on function public.gestionar_cuenta(text, text), public.confirmar_pago_cuenta(uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.cuentas;
  end if;
end $$;
commit;
