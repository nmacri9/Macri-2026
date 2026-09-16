import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// 1. Importamos las piezas específicas en lugar de todo el "admin"
import { initializeApp, getApps, cert } from "npm:firebase-admin/app"
import { getMessaging } from "npm:firebase-admin/messaging"

// 2. Usamos getApps() para verificar si ya está inicializado
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
  initializeApp({
    credential: cert(serviceAccount)
  });
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const nuevoRegistro = payload.record; 

    if (!nuevoRegistro) {
      return new Response(JSON.stringify({ error: 'No se recibieron datos' }), { status: 400 });
    }

    const nombre = nuevoRegistro.nombre || 'Un cliente';
    const apellido = nuevoRegistro.apellido || '';

    const mensaje: any = {
      notification: {
        title: '¡Nuevo Cliente Registrado!',
        body: `${nombre} ${apellido} está pendiente de aprobación.`
      },
      // Este es el tema de notificación. Para este código, envía a todos los suscritos a este "topic"
      topic: 'aprobacion_pendientes' 
    };

    if (nuevoRegistro.foto_url) {
        mensaje.notification.image = nuevoRegistro.foto_url;
    }

    // 3. Usamos getMessaging() en lugar de admin.messaging()
    const respuestaFirebase = await getMessaging().send(mensaje);
    
    return new Response(JSON.stringify({ success: true, respuestaFirebase }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error al enviar notificación:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
})