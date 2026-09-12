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
    private SERVICE_ID = 'service_5ev3xxj'; 
    private PUBLIC_KEY = 'CnmkCtC5sn8SXky7V'; 
    private TEMPLATE_UNICA = 'template_78axyn3'; 

    constructor() {
        if (this.PUBLIC_KEY) {
        emailjs.init(this.PUBLIC_KEY);
        }
    }

    /**
   * 1. PENDIENTE: Fondo Crema Cálido, Tarjeta Verde Oscuro, Borde Beige Dorado, Tipografía Serif Elegante.
   */
    async enviarCorreoPendiente(datos: DatosClienteEmail): Promise<boolean> {
        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#F4ECE1',                       // Fondo Crema Cálido exterior
        bg_card: '#1B3B2D',                       // Tarjeta Verde Oscuro interno
        border_card: '3px solid #C8B29E',          // Borde Beige Dorado
        font_family: "'EB Garamond', Georgia, serif",
        color_titulo: '#C8B29E',                  // Título Beige Dorado
        size_titulo: '26px',
        color_texto: '#DBCBB9',
        size_texto: '17px',
        color_footer: '#A09080',
        titulo: 'Solicitud en Proceso ⏳',
        mensaje_html: `
            Estimado/a <strong>${datos.nombre}</strong>,<br><br>
            Hemos recibido correctamente tu solicitud de registro en <strong>CEPA Restó & Bar</strong>.<br><br>
            Nuestro equipo de supervisión se encuentra revisando la documentación enviada. Te notificaremos por este mismo medio una vez que tu acceso haya sido autorizado.
        `
        });
    }

    /**
     * 2. APROBADO: Fondo Verde Bosque, Tarjeta Verde Muy Oscuro, Borde Verde Esmeralda Éxito, Tipografía Sans-Serif Limpia.
     */
    async enviarCorreoAprobado(datos: DatosClienteEmail): Promise<boolean> {
        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#0E1F18',                       // Fondo Verde Bosque ultra oscuro exterior
        bg_card: '#132A20',                       // Tarjeta Verde principal
        border_card: '3px solid #4CAF50',          // Borde Verde Esmeralda brillante
        font_family: "'Helvetica Neue', Arial, sans-serif",
        color_titulo: '#81C784',                  // Título Verde Claro brillante
        size_titulo: '28px',
        color_texto: '#FFFFFF',
        size_texto: '18px',
        color_footer: '#81C784',
        titulo: '¡Cuenta Aprobada! 🎉',
        mensaje_html: `
            ¡Buenas noticias, <strong>${datos.nombre}</strong>!<br><br>
            Tu perfil ha sido verificado e ingresado exitosamente a nuestro sistema. Ya podés acceder a la aplicación y disfrutar de nuestra propuesta gastronómica.
        `
        });
    }

    /**
     * 3. RECHAZADO: Fondo Gris/Rojizo, Tarjeta Verde Oscuro, Borde Rojo Semántico, Tipografía Compacta.
     */
    async enviarCorreoRechazado(datos: DatosClienteEmail): Promise<boolean> {
        const motivo = datos.motivoRechazo || 'Incumplimiento de las políticas de validación.';

        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#2A1A1A',                       // Fondo Rojizo muy oscuro exterior
        bg_card: '#1B3B2D',                       // Tarjeta Verde Oscuro
        border_card: '3px solid #D32F2F',          // Borde Rojo Alerta
        font_family: "'Trebuchet MS', sans-serif",
        color_titulo: '#EF9A9A',                  // Título Rojo Suave
        size_titulo: '24px',
        color_texto: '#DBCBB9',
        size_texto: '16px',
        color_footer: '#EF9A9A',
        titulo: 'Solicitud No Aprobada ⚠️',
        mensaje_html: `
            Estimado/a <strong>${datos.nombre}</strong>,<br><br>
            Lamentamos informarle que su solicitud de registro en CEPA Restó & Bar no ha sido aprobada por la administración.<br><br>
            <div style="background-color: #132A20; color: #FFCDD2; border-left: 4px solid #D32F2F; padding: 12px 16px; border-radius: 8px; margin: 15px 0; font-size: 14px; text-align: left;">
            <strong style="color: #FFFFFF;">Motivo de rechazo:</strong><br>${motivo}
            </div>
        `
        });
    }

    private async enviarPeticion(params: any): Promise<boolean> {
        try {
        await emailjs.send(this.SERVICE_ID, this.TEMPLATE_UNICA, params, this.PUBLIC_KEY);
        console.log(`Correo enviado correctamente a: ${params.to_email}`);
        return true;
        } catch (error) {
        console.error('Error al enviar correo vía EmailJS:', error);
        return false;
        }
    }
}