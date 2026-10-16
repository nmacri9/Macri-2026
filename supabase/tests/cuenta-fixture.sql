-- SOLO para una base local descartable, no para el Supabase del equipo.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
grant usage on schema auth, public to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
create table public.usuarios(id uuid primary key, rol text, estado text);
create table public.clientes(id bigint primary key, cliente_id uuid);
create table public.mesas(id bigint primary key, disponibilidad text);
create table public.asignaciones(id bigint primary key, cliente_id bigint, mesa_id bigint, estado text, fecha_asignacion timestamptz, fecha_finalizacion timestamptz, updated_at timestamptz, descuento_obtenido numeric);
create table public.pedidos(id uuid primary key default gen_random_uuid(), cliente_id uuid, mesa_id bigint, items jsonb, total numeric, estado text, created_at timestamptz default now());
grant select on public.usuarios to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'), ('00000000-0000-0000-0000-000000000003');
insert into usuarios values ('00000000-0000-0000-0000-000000000001','CLIENTE_REGISTRADO','APROBADO'), ('00000000-0000-0000-0000-000000000002','MOZO','ACTIVO'), ('00000000-0000-0000-0000-000000000003','CLIENTE_ANONIMO','ACTIVO');
insert into clientes values (1,'00000000-0000-0000-0000-000000000001'), (3,'00000000-0000-0000-0000-000000000003');
insert into mesas values (4,'OCUPADA');
insert into asignaciones values (1,1,4,'asignado',now()-interval '1 hour',null,now(),10);
insert into pedidos (cliente_id,mesa_id,items,total,estado,created_at) values
 ('00000000-0000-0000-0000-000000000001',4,'[{"nombre":"Visita anterior","precio":9999,"cantidad":1}]',9999,'recibido',now()-interval '2 days'),
 ('00000000-0000-0000-0000-000000000001',4,'[{"nombre":"Plato","precio":1000,"cantidad":2}]',2000,'recibido',now()-interval '30 minutes'),
 ('00000000-0000-0000-0000-000000000001',4,'[{"nombre":"Bebida","precio":500,"cantidad":1}]',500,'entregado',now()-interval '20 minutes');
