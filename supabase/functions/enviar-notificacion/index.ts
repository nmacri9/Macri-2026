import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { initializeApp, getApps, cert } from "npm:firebase-admin/app"
import { getMessaging } from "npm:firebase-admin/messaging"
import { notificacionChat } from './chat.ts'
import { notificarCuenta } from './cuenta.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Inicializamos Firebase de forma segura
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
  initializeApp({ credential: cert(serviceAccount) });
}

serve(async (req) => {
  // 2. Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    if (payload.cuenta_id) {
      const resultado = await notificarCuenta(req, payload.cuenta_id, mensaje => getMessaging().send({
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
          visibility: 'public'
          // Quitamos channelId fijo para que Android no lo descarte si el canal no fue registrado
        }
      },
      topic: topic
    };

    const respuestaFirebase = await getMessaging().send(mensaje);
    console.log(`Notificación enviada con éxito a topic [${topic}]:`, respuestaFirebase);
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
