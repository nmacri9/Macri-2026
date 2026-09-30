alter table public.asignaciones
  add column if not exists descuento_obtenido integer not null default 0;

create or replace function public.guardar_descuento_cepa(p_porcentaje integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descuento integer;
begin
  if p_porcentaje not in (10, 15, 20) then
    raise exception 'Descuento inválido';
  end if;

  update public.asignaciones a
  set descuento_obtenido = case when a.descuento_obtenido = 0 then p_porcentaje else a.descuento_obtenido end
  from public.clientes c
  where c.id = a.cliente_id
    and c.cliente_id = auth.uid()
    and a.estado = 'asignado'
    and a.fecha_finalizacion is null
    and a.mesa_id is not null
  returning a.descuento_obtenido into v_descuento;

  if not found then raise exception 'No hay mesa asignada'; end if;
  return v_descuento;
end;
$$;

revoke all on function public.guardar_descuento_cepa(integer) from public;
grant execute on function public.guardar_descuento_cepa(integer) to authenticated;
