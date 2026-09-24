import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

// El cliente manda únicamente el id del mensaje guardado. El destinatario y el
// contenido de la push se obtienen de la sala usando los permisos del usuario.
export async function notificacionChat(req: Request, mensajeId: string) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new Error('Sesión requerida');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión inválida');
  const { error: participanteError } = await supabase.rpc('chat_participante');
  if (participanteError) throw participanteError;
  const { data: mensaje, error } = await supabase.from('chat_mensajes')
    .select('id, autor_id, autor_nombre, autor_rol, numero_mesa, respuesta_a')
    .eq('id', mensajeId).single();
  if (error || !mensaje || mensaje.autor_id !== user.id) throw new Error('Mensaje no autorizado');

  if (mensaje.autor_rol !== 'MOZO') {
    return {
      topic: 'mozos',
      notification: { title: `Consulta de la mesa ${mensaje.numero_mesa}`, body: `${mensaje.autor_nombre} envió una consulta al salón.` },
      data: { ruta: '/chat-cliente', mensaje_id: mensaje.id }
    };
  }
  if (!mensaje.respuesta_a) return null; // Los anuncios generales quedan en la sala.
  const { data: consulta, error: consultaError } = await supabase.from('chat_mensajes')
    .select('autor_id, autor_rol').eq('id', mensaje.respuesta_a).single();
  if (consultaError || !consulta) throw new Error('Consulta no encontrada');
  if (consulta.autor_rol === 'MOZO') return null;
  return {
    topic: `chat_cliente_${consulta.autor_id}`,
    notification: { title: `${mensaje.autor_nombre} respondió tu consulta`, body: `Mesa ${mensaje.numero_mesa}. Abrí el chat para ver la respuesta.` },
    data: { ruta: '/chat-cliente', mensaje_id: mensaje.id }
  };
}
