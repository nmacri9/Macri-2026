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

// public.mensajes conserva su id bigint y su fecha created_at.
export interface MensajeDB {
  id: number | string;
  created_at: string;
  autor_id: string;
  autor_nombre: string;
  autor_rol: ChatMensaje['autor_rol'];
  mesa_id: number | null;
  texto: string;
  respuesta_a: number | string | null;
  respuesta_texto: string | null;
  respuesta_autor: string | null;
}

export function mensajeDesdeDB(fila: MensajeDB): ChatMensaje {
  return {
    id: String(fila.id), creado_en: fila.created_at,
    autor_id: fila.autor_id, autor_nombre: fila.autor_nombre, autor_rol: fila.autor_rol,
    numero_mesa: fila.mesa_id, texto: fila.texto,
    respuesta_a: fila.respuesta_a === null ? null : String(fila.respuesta_a),
    respuesta_texto: fila.respuesta_texto, respuesta_autor: fila.respuesta_autor
  };
}

// El historial, la respuesta del envío y Realtime pueden traer la misma fila.
export function combinarMensajes(actuales: ChatMensaje[], nuevos: ChatMensaje[]): ChatMensaje[] {
  const mensajes = new Map(actuales.map(mensaje => [mensaje.id, mensaje]));
  nuevos.forEach(mensaje => mensajes.set(mensaje.id, mensaje));
  return [...mensajes.values()].sort((a, b) =>
    a.creado_en.localeCompare(b.creado_en) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}
