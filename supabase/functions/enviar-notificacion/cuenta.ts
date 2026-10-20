import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

type Aviso = { id: number; evento: string; topic: string };
type Mensaje = { topic: string; notification: { title: string; body: string }; data: Record<string, string> };

// Reutiliza Firebase de enviar-notificacion. Los destinatarios salen de la cola
// creada por las RPC, nunca de un topic o importe recibido del cliente.
export async function notificarCuenta(req: Request, cuentaId: string, enviar: (mensaje: Mensaje) => Promise<unknown>) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new Error('Sesión requerida');
  const url = Deno.env.get('SUPABASE_URL')!;
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await usuario.auth.getUser();
  if (authError || !user) throw new Error('Sesión inválida');
  // RLS permite al cliente dueño de la cuenta y al personal habilitado.
  const { data: cuenta, error } = await usuario.from('cuentas').select('id, mesa_id, total').eq('id', cuentaId).single();
  if (error || !cuenta) throw new Error('Cuenta no autorizada');
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: avisos, error: errorAvisos } = await admin.rpc('reclamar_avisos_cuenta', { p_cuenta_id: cuentaId });
  if (errorAvisos) throw errorAvisos;

  await Promise.allSettled((avisos as Aviso[]).map(async aviso => {
    try {
      const solicitud = aviso.evento === 'solicitud';
      const confirmacion = aviso.evento === 'confirmacion';
      const confirmacionPersonal = confirmacion && ['duenos', 'supervisores'].includes(aviso.topic);
      const importe = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS',
      }).format(Number(cuenta.total));
      await enviar({
        topic: aviso.topic,
        notification: {
          title: solicitud ? 'Solicitud de cuenta' : confirmacion ? 'Pago confirmado por el mozo' : 'Pago simulado recibido',
          body: solicitud ? `La mesa ${cuenta.mesa_id} solicitó la cuenta.`
            : confirmacionPersonal ? `El mozo confirmó el pago de ${importe} de la mesa ${cuenta.mesa_id}.`
            : confirmacion ? `La cuenta de la mesa ${cuenta.mesa_id} está cerrada. ¡Gracias por tu visita!`
            : `Mesa ${cuenta.mesa_id}: $${Number(cuenta.total).toFixed(2)}. Pendiente de confirmación del mozo.`,
        },
        data: { cuenta_id: cuenta.id, ruta: confirmacionPersonal ? '/home' : confirmacion ? '/cuenta' : aviso.topic === 'mozos' ? '/confirmar-pedido' : '/home' },
      });
      const { error: guardadoError } = await admin.from('cuenta_avisos').update({ enviado_en: new Date().toISOString() }).eq('id', aviso.id);
      if (guardadoError) throw guardadoError;
    } catch (error) {
      await admin.from('cuenta_avisos').update({ reclamado_en: null }).eq('id', aviso.id);
      throw error;
    }
  }));
  const { count, error: conteoError } = await admin.from('cuenta_avisos').select('id', { count: 'exact', head: true })
    .eq('cuenta_id', cuentaId).is('enviado_en', null);
  if (conteoError) throw conteoError;
  return { pendientes: count ?? 0 };
}
