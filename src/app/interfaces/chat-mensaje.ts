export interface ChatMensaje {
  id: string;
  autor_id: string;
  autor_nombre: string;
  autor_rol: 'MOZO' | 'CLIENTE_REGISTRADO' | 'CLIENTE_ANONIMO';
  numero_mesa: number | null;
  texto: string;
  creado_en: string;
  respuesta_a: string | null;
  respuesta_texto: string | null;
  respuesta_autor: string | null;
}

export interface ChatParticipante {
  id: string;
  nombre: string;
  rol: 'MOZO' | 'CLIENTE_REGISTRADO' | 'CLIENTE_ANONIMO';
  numero_mesa: number | null;
}

// El historial, la respuesta del envío y Realtime pueden traer la misma fila.
export function combinarMensajes(actuales: ChatMensaje[], nuevos: ChatMensaje[]): ChatMensaje[] {
  const mensajes = new Map(actuales.map(mensaje => [mensaje.id, mensaje]));
  nuevos.forEach(mensaje => mensajes.set(mensaje.id, mensaje));
  return [...mensajes.values()].sort((a, b) =>
    a.creado_en.localeCompare(b.creado_en) || a.id.localeCompare(b.id));
}
