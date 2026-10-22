import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { notificacionChat } from './chat.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Firebase se carga dentro del handler: un secreto inválido o un error del SDK
// no debe impedir que arranque la función ni que responda el preflight CORS.
async function obtenerMessaging() {
  const [{ initializeApp, getApps, cert }, { getMessaging }] = await Promise.all([
    import('npm:firebase-admin/app'),
    import('npm:firebase-admin/messaging'),
  ]);
  if (getApps().length === 0) {
    const secreto = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!secreto) throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT');
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(secreto);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no contiene JSON válido');
    }
    if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT requiere project_id, client_email y private_key');
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getMessaging();
}

serve(async (req) => {
  // 2. Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const messaging = await obtenerMessaging();
    if (payload.cuenta_id) {
      // Un problema en el módulo de cuentas no debe detener todos los avisos.
      const { notificarCuenta } = await import('./cuenta.ts');
      if (typeof notificarCuenta !== 'function') {
        throw new Error('Despliegue incompleto: cuenta.ts debe exportar notificarCuenta');
      }
      const resultado = await notificarCuenta(req, payload.cuenta_id, mensaje => messaging.send({
        ...mensaje,
        android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
        apns: { payload: { aps: { sound: 'default', contentAvailable: true } } },
      }));
      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    const chat = payload.mensaje_id ? await notificacionChat(req, payload.mensaje_id) : undefined;
    if (chat === null) {
      return new Response(JSON.stringify({ success: true, omitida: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }
    const titulo = payload.titulo || 'Notificación';
    const cuerpo = payload.cuerpo || 'Tienes un nuevo aviso';
    const topic = payload.topic || 'aprobacion_pendientes';

   const mensaje: any = {
      notification: { 
        title: titulo, 
        body: cuerpo 
      },
      data: {
        title: titulo,
        body: cuerpo,
        topic: topic,
        ...(payload.data || {})
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'max',
          visibility: 'public',
          // Debe coincidir con el canal creado por la app y con AndroidManifest.xml.
          channelId: 'default'
        }
      },
      topic: topic,
      ...(chat ?? {})
    };

    const respuestaFirebase = await messaging.send(mensaje);
    console.log(`Notificación enviada con éxito a topic [${mensaje.topic}]:`, respuestaFirebase);
    return new Response(JSON.stringify({ success: true, respuestaFirebase }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error enviando push:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
})
