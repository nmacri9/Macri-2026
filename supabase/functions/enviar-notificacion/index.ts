import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import admin from "npm:firebase-admin"

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const nuevoRegistro = payload.record; 

    if (!nuevoRegistro) {
      return new Response(JSON.stringify({ error: 'No se recibieron datos' }), { status: 400 });
    }

    // Usamos 'nombre' y 'apellido' en singular, tal como están en tu tabla 'clientes'
    const nombre = nuevoRegistro.nombre || 'Un cliente';
    const apellido = nuevoRegistro.apellido || '';

    const mensaje: any = {
      notification: {
        title: '¡Nuevo Cliente Registrado!',
        body: `${nombre} ${apellido} está pendiente de aprobación.`
      },
      topic: 'aprobacion_pendientes'
    };

    // Solo adjuntamos la imagen si realmente existe
    if (nuevoRegistro.foto_url) {
        mensaje.notification.image = nuevoRegistro.foto_url;
    }

    const respuestaFirebase = await admin.messaging().send(mensaje);
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