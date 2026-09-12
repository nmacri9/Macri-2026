import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';

export interface DatosClienteEmail {
    nombre: string;
    correo: string;
    motivoRechazo?: string;
    }

    @Injectable({
    providedIn: 'root'
    })
    export class EmailService {
    // Claves del servicio del grupo
    private SERVICE_ID = 'service_5ev3xxj'; 
    private PUBLIC_KEY = 'CnmkCtC5sn8SXky7V'; 
    private TEMPLATE_UNICA = 'template_78axyn3'; 

    constructor() {
        emailjs.init(this.PUBLIC_KEY);
    }

    /**
     * 1. Notificación: Registro en Revisión (Pendiente)
     * Estilo: Fondo Crema, Tipografía Serif Elegante (EB Garamond), Borde Dorado.
     */
    async enviarCorreoPendiente(datos: DatosClienteEmail): Promise<boolean> {
        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#FCF3E1',
        bg_card: '#FFFFFF',
        border_card: '2px solid #D4AF37',
        font_family: "'EB Garamond', Georgia, serif",
        color_titulo: '#6B002B',
        size_titulo: '26px',
        color_texto: '#4A4A4A',
        size_texto: '18px',
        color_footer: '#888888',
        titulo: 'Solicitud en Proceso ⏳',
        mensaje_html: `
            Estimado/a <strong>${datos.nombre}</strong>,<br><br>
            Hemos recibido correctamente tu solicitud de registro en <strong>CEPA Restó & Bar</strong>.<br><br>
            Nuestro equipo de supervisión se encuentra revisando la documentación enviada. Te notificaremos por este mismo medio una vez que tu acceso haya sido autorizado.
        `
        });
    }

    /**
     * 2. Notificación: Cliente Aprobado
     * Estilo: Fondo Verde Exito, Tipografía Sans-Serif Limpia (Helvetica), Fuente Grande (20px).
     */
    async enviarCorreoAprobado(datos: DatosClienteEmail): Promise<boolean> {
        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#E8F5E9',
        bg_card: '#FFFFFF',
        border_card: '4px solid #2E7D32',
        font_family: "'Helvetica Neue', Arial, sans-serif",
        color_titulo: '#2E7D32',
        size_titulo: '32px',
        color_texto: '#2C3E50',
        size_texto: '20px',
        color_footer: '#666666',
        titulo: '¡Cuenta Aprobada! 🎉',
        mensaje_html: `
            ¡Buenas noticias, <strong>${datos.nombre}</strong>!<br><br>
            Tu perfil ha sido verificado e ingresado exitosamente a nuestro sistema. Ya podés acceder a la aplicación y disfrutar de nuestros servicios.
        `
        });
    }

    /**
     * 3. Notificación: Cliente Rechazado
     * Estilo: Tarjeta Bordó Oscuro, Tipografía Trebuchet MS, Fuente Compacta (15px), Recuadro de Motivo.
     */
    async enviarCorreoRechazado(datos: DatosClienteEmail): Promise<boolean> {
        const motivo = datos.motivoRechazo || 'Incumplimiento de las políticas de validación.';

        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#F5F5F5',
        bg_card: '#6B002B',
        border_card: 'none',
        font_family: "'Trebuchet MS', sans-serif",
        color_titulo: '#FFCDD2',
        size_titulo: '24px',
        color_texto: '#FCF3E1',
        size_texto: '15px',
        color_footer: '#E0E0E0',
        titulo: 'Solicitud No Aprobada ⚠️',
        mensaje_html: `
            Estimado/a <strong>${datos.nombre}</strong>,<br><br>
            Lamentamos informarle que su solicitud de registro en CEPA no ha sido aprobada por la administración.<br><br>
            <div style="background-color: #FFFFFF; color: #C62828; border-left: 5px solid #D32F2F; padding: 12px; border-radius: 4px; margin: 15px 0; font-size: 14px;">
            <strong>Motivo de rechazo:</strong><br>${motivo}
            </div>
        `
        });
    }

    private async enviarPeticion(params: any): Promise<boolean> {
        try {
        await emailjs.send(this.SERVICE_ID, this.TEMPLATE_UNICA, params);
        console.log(`Correo enviado correctamente a: ${params.to_email}`);
        return true;
        } catch (error) {
        console.error('Error al enviar correo vía EmailJS:', error);
        return false;
        }
    }
}