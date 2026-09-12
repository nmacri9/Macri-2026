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

        async enviarCorreoPendiente(datos: DatosClienteEmail): Promise<boolean> {
        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#FCF3E1',
        bg_card: '#1B3B2D',
        border_card: '2px solid #C8B29E',
        font_family: "'EB Garamond', Georgia, serif",
        color_titulo: '#DBCBB9',
        size_titulo: '24px',
        color_texto: '#DBCBB9',
        size_texto: '16px',
        color_footer: '#C8B29E',
        titulo: 'Solicitud en Proceso ⏳',
        mensaje_html: `
            Estimado/a <strong>${datos.nombre}</strong>,<br><br>
            Hemos recibido correctamente tu solicitud de registro en <strong>CEPA Restó & Bar</strong>.<br><br>
            Nuestro equipo de supervisión se encuentra revisando la documentación enviada. Te notificaremos por este mismo medio una vez que tu acceso haya sido autorizado.
        `
        });
    }

    /**
     * 2. APROBADO (Contraste Máximo):
     * Estilo: Tarjeta Blanca con borde verde esmeralda, tipografía Sans-Serif moderna/gigante,
     * títulos en verde brillante y texto oscuro sobre fondo blanco.
     */
    async enviarCorreoAprobado(datos: DatosClienteEmail): Promise<boolean> {
        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#0A1912',                       // Fondo exterior verde ultra oscuro
        bg_card: '#FFFFFF',                       // Tarjeta BLANCA para alto contraste
        border_card: '5px solid #2E7D32',          // Borde grueso verde esmeralda
        font_family: "'Arial', 'Helvetica Neue', sans-serif",
        color_titulo: '#1B5E20',                  // Título Verde Bosque Intenso
        size_titulo: '34px',                      // Título GIGANTE
        color_texto: '#1C2833',                   // Texto Oscuro sobre tarjeta blanca
        size_texto: '19px',                       // Fuente grande
        color_footer: '#2E7D32',
        titulo: '¡CUENTA APROBADA! 🎉',
        mensaje_html: `
            <div style="background-color: #E8F5E9; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 15px;">
            <strong style="color: #2E7D32; font-size: 16px;">¡Bienvenido/a a la experiencia CEPA!</strong>
            </div>
            ¡Buenas noticias, <strong>${datos.nombre}</strong>!<br><br>
            Tu perfil ha sido verificado e ingresado exitosamente a nuestro sistema. Ya podés acceder a la aplicación y disfrutar de nuestros servicios.
        `
        });
    }

    /**
     * 3. RECHAZADO (Estilo Alerta Monospaciada):
     * Estilo: Tarjeta Bordó Oscura, fuente 'Courier New' (tipo informe/mecanografiado),
     * títulos en rojo claro y recuadro blanco de motivo.
     */
    async enviarCorreoRechazado(datos: DatosClienteEmail): Promise<boolean> {
        const motivo = datos.motivoRechazo || 'La documentación presentada no cumple con las políticas de ingreso.';

        return this.enviarPeticion({
        to_name: datos.nombre,
        to_email: datos.correo,
        bg_body: '#1E1E1E',                       // Fondo exterior Gris Oscuro Industrial
        bg_card: '#4A001E',                       // Tarjeta Carmesí/Bordó
        border_card: '3px solid #D32F2F',          // Borde Rojo Semántico
        font_family: "'Courier New', Courier, monospace", // Fuente Monospaciada tipo informe
        color_titulo: '#FFCDD2',                  // Título Rosa/Rojo Claro
        size_titulo: '22px',
        color_texto: '#F5F5F5',
        size_texto: '14px',                       // Fuente más compacta
        color_footer: '#EF9A9A',
        titulo: '[RECHAZADO] SOLICITUD DE INGRESO ⚠️',
        mensaje_html: `
            Estimado/a <strong>${datos.nombre}</strong>,<br><br>
            Le informamos que su solicitud de registro ha sido evaluada y <strong>NO HA SIDO APROBADA</strong>.<br><br>
            <div style="background-color: #FFFFFF; color: #B71C1C; border-left: 5px solid #D32F2F; padding: 12px; border-radius: 4px; margin: 15px 0; font-family: sans-serif; font-size: 13px;">
            <strong>DETALLE DE LA RESOLUCIÓN:</strong><br>${motivo}
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
