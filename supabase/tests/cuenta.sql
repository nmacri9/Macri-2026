-- Prueba de integración para una base DESCARTABLE con el esquema de la app.
-- Usa los datos de prueba descriptos en docs/punto-21.md. No correr en producción.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  begin
    perform gestionar_cuenta('solicitar');
    raise exception 'TEST: permitió solicitar antes de recibir todos los pedidos';
  exception when others then
    if sqlerrm not like 'Confirmá la recepción%' then raise; end if;
  end;
end $$;
update pedidos set estado='recibido' where estado='entregado';
set local role authenticated;
select gestionar_cuenta('solicitar');
select gestionar_cuenta('solicitar');
do $$ declare c jsonb; begin
  c := gestionar_cuenta('consultar');
  assert c->>'estado' = 'solicitada';
  assert c->'items' = '[]'::jsonb;
  begin
    perform gestionar_cuenta('pagar');
    raise exception 'TEST: permitió pagar sin QR';
  exception when others then
    if sqlerrm not like 'Escaneá el QR%' then raise; end if;
  end;
  begin
    perform gestionar_cuenta('propina','MESA_4');
    raise exception 'TEST: aceptó un QR de mesa';
  exception when others then
    if sqlerrm not like 'QR inválido%' then raise; end if;
  end;
  c := gestionar_cuenta('propina','CEPA:PROPINA:20');
  assert (c->>'subtotal')::numeric = 2500, 'Debe incluir los dos pedidos y excluir la visita anterior';
  assert (c->>'descuento')::numeric = 250;
  assert (c->>'propina')::numeric = 450;
  assert (c->>'total')::numeric = 2700;
  assert jsonb_array_length(c->'items') = 2;
  c := gestionar_cuenta('propina','CEPA:PROPINA:15');
  assert (c->>'propina')::numeric = 337.5;
  c := gestionar_cuenta('propina','CEPA:PROPINA:10');
  assert (c->>'propina')::numeric = 225;
  c := gestionar_cuenta('propina','CEPA:PROPINA:5');
  assert (c->>'propina')::numeric = 112.5;
  c := gestionar_cuenta('propina','CEPA:PROPINA:0');
  assert (c->>'total')::numeric = 2250;
  assert c->>'estado' = 'lista';
  c := gestionar_cuenta('pagar');
  assert c->>'estado' = 'pagada';
  assert gestionar_cuenta('pagar') = c, 'El segundo pago debe ser idempotente';
  begin
    perform confirmar_pago_cuenta((c->>'id')::uuid);
    raise exception 'TEST: el cliente confirmó su propio pago';
  exception when others then
    if sqlerrm not like 'Solo un mozo%' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from cuentas) = 1;
  assert (select count(*) from cuenta_avisos where evento='solicitud') = 1;
  assert (select count(*) from cuenta_avisos where evento='pago') = 3;
  assert (select array_agg(topic order by topic) from cuenta_avisos where evento='pago') = array['duenos','mozos','supervisores'];
  assert (select disponibilidad from mesas where id=4) = 'OCUPADA';
  assert (select fecha_finalizacion from asignaciones where id=1) is null;
  begin
    insert into pedidos (cliente_id,mesa_id,items,total,estado) values ('00000000-0000-0000-0000-000000000001',4,'[]',100,'pendiente_confirmacion');
    raise exception 'TEST: permitió agregar consumo tras el pago';
  exception when others then
    if sqlerrm not like 'La cuenta de esta visita%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
set local role authenticated;
do $$ begin assert (select count(*) from cuentas) = 0, 'RLS debe ocultar cuentas ajenas'; end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set local role authenticated;
select confirmar_pago_cuenta(id) from cuentas;
select confirmar_pago_cuenta(id) from cuentas;
reset role;
do $$ begin
  assert (select estado from cuentas) = 'confirmada';
  assert (select disponibilidad from mesas where id=4) = 'VACIA';
  assert (select fecha_finalizacion from asignaciones where id=1) is not null;
  assert (select count(*) from cuenta_avisos where evento='confirmacion') = 1;
end $$;
set local role service_role;
do $$ declare c uuid; n integer; begin
  select id into c from cuentas;
  select count(*) into n from reclamar_avisos_cuenta(c);
  assert n = 5;
  select count(*) into n from reclamar_avisos_cuenta(c);
  assert n = 0, 'No reclamar dos veces un aviso en curso';
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set local role authenticated;
do $$ begin assert gestionar_cuenta('consultar')->>'estado' = 'confirmada'; end $$;
reset role;
rollback;
