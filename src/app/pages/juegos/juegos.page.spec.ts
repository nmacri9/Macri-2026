import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { MesasService } from '../../services/mesas.service';
import { JuegosPage } from './juegos.page';
import bancoPreguntas from './preguntas.json';

function crearPagina(rpc = vi.fn().mockResolvedValue({ data: 10, error: null })) {
  let descuentoGuardado = 0;
  const llamadaRpc = vi.fn(async (...args: Parameters<typeof rpc>) => {
    const resultado = await rpc(...args);
    if (!resultado.error && typeof resultado.data === 'number') descuentoGuardado = resultado.data;
    return resultado;
  });
  const db = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'cliente-auth' } }, error: null }) },
    from: vi.fn().mockReturnValue({
      select: (columns: string) => columns === 'descuento_obtenido'
        ? { eq: () => ({ maybeSingle: () => Promise.resolve({ data: { descuento_obtenido: descuentoGuardado }, error: null }) }) }
        : { eq: () => ({ eq: () => ({ is: () => ({ not: () => ({ order: () => ({
          limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 1 }, error: null }) })
        }) }) }) }) }) }
    }),
    rpc: llamadaRpc
  };
  const page = new JuegosPage(
    { getClient: () => db } as unknown as SupabaseService,
    { obtenerClienteId: vi.fn().mockResolvedValue(7) } as unknown as MesasService,
    { markForCheck: vi.fn() } as unknown as ChangeDetectorRef
  );
  return { page, rpc: llamadaRpc };
}

describe('Jugá con Cepa', () => {
  beforeEach(() => localStorage.clear());

  it('elige cinco preguntas distintas del banco de 55 en cada partida', async () => {
    expect(bancoPreguntas).toHaveLength(55);
    const { page } = crearPagina();
    await page.cargarPremio();
    page.elegirJuego('verdadero-falso');
    expect(page.preguntas).toHaveLength(5);
    expect(new Set(page.preguntas.map(pregunta => pregunta.texto)).size).toBe(5);
    expect(page.preguntas.every(pregunta => bancoPreguntas.some(item => item.texto === pregunta.texto))).toBe(true);
  });

  it('guarda el porcentaje del primer juego y deja repetir sin otro premio', async () => {
    const { page, rpc } = crearPagina();
    await page.cargarPremio();
    page.elegirJuego('verdadero-falso');
    for (const pregunta of page.preguntas) page.responder(pregunta.respuesta);
    await vi.waitFor(() => expect(page.descuento).toBe(10));
    expect(rpc).toHaveBeenCalledWith('guardar_descuento_cepa', { p_porcentaje: 10 });
    expect(page.terminado).toBe(true);
    page.volverAJuegos();
    page.elegirJuego('verdadero-falso');
    for (const pregunta of page.preguntas) page.responder(pregunta.respuesta);
    expect(rpc).toHaveBeenCalledOnce();
    expect(page.resultado).toContain('por diversión');
    expect(page.intentados).toEqual(['verdadero-falso']);
    page.volverAJuegos();
    page.elegirJuego('memoria');
    for (const simbolo of new Set(page.cartas.map(carta => carta.simbolo))) {
      const [primera, segunda] = page.cartas.filter(carta => carta.simbolo === simbolo);
      page.girarCarta(primera.id);
      page.girarCarta(segunda.id);
    }
    expect(rpc).toHaveBeenCalledOnce();
    expect(page.descuento).toBe(10);
  });

  it('muestra las cartas de a una y reconoce una pareja', async () => {
    const { page, rpc } = crearPagina();
    await page.cargarPremio();
    page.elegirJuego('memoria');
    const primera = page.cartas[0];
    const pareja = page.cartas.find(carta => carta.id !== primera.id && carta.simbolo === primera.simbolo)!;
    page.girarCarta(primera.id);
    expect(primera.visible).toBe(true);
    page.girarCarta(pareja.id);
    expect(primera.encontrada && pareja.encontrada).toBe(true);
    expect(page.movimientos).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('deja jugar si todavía no existe la columna de descuentos, sin consumir el primer intento', async () => {
    const { page, rpc } = crearPagina();
    const db = (page as any).supabase.getClient();
    const from = db.from;
    db.from = vi.fn().mockImplementation((table: string) => {
      const query = from(table);
      return { select: (columns: string) => columns === 'descuento_obtenido'
        ? { eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: 'column does not exist' } }) }) }
        : query.select(columns) };
    });
    await page.cargarPremio();
    expect(page.disponible).toBe(true);
    expect(page.premiosDisponibles).toBe(false);
    page.elegirJuego('verdadero-falso');
    for (const pregunta of page.preguntas) page.responder(pregunta.respuesta);
    expect(rpc).not.toHaveBeenCalled();
    expect(page.intentados).toEqual([]);
  });

  it('si pierde un juego, puede ganar el descuento en la primera partida de otro', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 15, error: null });
    const { page } = crearPagina(rpc);
    await page.cargarPremio();
    page.elegirJuego('verdadero-falso');
    for (const pregunta of page.preguntas) page.responder(!pregunta.respuesta);
    expect(page.terminado).toBe(true);
    expect(page.descuento).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
    page.volverAJuegos();
    page.elegirJuego('memoria');
    for (const simbolo of new Set(page.cartas.map(carta => carta.simbolo))) {
      const [primera, segunda] = page.cartas.filter(carta => carta.simbolo === simbolo);
      page.girarCarta(primera.id);
      page.girarCarta(segunda.id);
    }
    await vi.waitFor(() => expect(page.descuento).toBe(15));
    expect(rpc).toHaveBeenCalledWith('guardar_descuento_cepa', { p_porcentaje: 15 });
    expect(JSON.parse(localStorage.getItem('cepa-juegos-v2:cliente-auth:1')!)).toEqual(['verdadero-falso', 'memoria']);
  });

  it('no consume la primera partida cuando Supabase no confirma el guardado', async () => {
    const { page } = crearPagina(vi.fn().mockResolvedValue({ data: null, error: null }));
    await page.cargarPremio();
    page.elegirJuego('verdadero-falso');
    for (const pregunta of page.preguntas) page.responder(pregunta.respuesta);
    await vi.waitFor(() => expect(page.procesando).toBe(false));
    expect(page.descuento).toBe(0);
    expect(page.resultadoPendiente).toBe(10);
    expect(page.intentados).toEqual([]);
  });
});
