import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { initializeApp, getApps, cert } from "npm:firebase-admin/app"
import { getMessaging } from "npm:firebase-admin/messaging"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Inicializamos Firebase de forma segura (sin leer .length de undefined)
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
  initializeApp({ credential: cert(serviceAccount) });
}

serve(async (req) => {
  // 2. ATAJAMOS EL REQUERIMIENTO 'OPTIONS' QUE TE TIRA ERROR 500 EN LA CAPTURA
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const titulo = payload.titulo || 'Notificación';
    const cuerpo = payload.cuerpo || 'Tienes un nuevo aviso';
    const topic = payload.topic || 'aprobacion_pendientes';

    const mensaje: any = {
      notification: { title: titulo, body: cuerpo },
      topic: topic 
    };

    const respuestaFirebase = await getMessaging().send(mensaje);
    
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