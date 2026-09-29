import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetreAsignacionPage } from './metre-asignacion.page';
import { MesasService } from '../../services/mesas.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

describe('Asignación de mesas por el metre', () => {
  const obtenerMesasDisponibles = vi.fn();
  const asignarMesaACliente = vi.fn();
  const obtenerUsuarioActual = vi.fn();
  const order = vi.fn();
  const create = vi.fn();
  const cliente = { id: 1, cliente_id: 5, clientes: { nombre: 'Ana', apellido: '' }, cantidad_personas: 1, estado: 'esperando' };
  const mesa = { id: 10, capacidad: 4, tipo: 'ESTANDAR', qr_token: 'token' };

  beforeEach(() => {
    vi.resetAllMocks();
    obtenerMesasDisponibles.mockResolvedValue([mesa]);
    obtenerUsuarioActual.mockResolvedValue({ id: 'metre' });
    order.mockResolvedValue({ data: [cliente], error: null });
    create.mockResolvedValue({ present: vi.fn() });
    const consulta = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), order };
    TestBed.configureTestingModule({
      imports: [MetreAsignacionPage],
      providers: [
        provideRouter([]),
        { provide: MesasService, useValue: { obtenerMesasDisponibles, asignarMesaACliente } },
        { provide: AuthService, useValue: { obtenerUsuarioActual } },
        { provide: SupabaseService, useValue: { getClient: () => ({ from: () => consulta }) } },
        { provide: ToastController, useValue: { create } }
      ]
    });
  });

  it('carga opciones reales en el selector y vuelve a consultar al reingresar', async () => {
    const fixture = TestBed.createComponent(MetreAsignacionPage);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('ion-select-option')).toHaveLength(1);
    expect(element.querySelector('ion-select-option')?.textContent).toContain('Mesa 10');
    expect(element.textContent).toContain('Mesas disponibles: 1');
    obtenerMesasDisponibles.mockResolvedValueOnce([{ ...mesa, id: 11 }]);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(obtenerMesasDisponibles).toHaveBeenCalledTimes(2);
    expect(element.querySelector('ion-select-option')?.textContent).toContain('Mesa 11');
  });

  it('distingue un error de carga de una lista realmente vacía y permite reintentar', async () => {
    obtenerMesasDisponibles.mockRejectedValueOnce({ code: '42501', message: 'permission denied' });
    const fixture = TestBed.createComponent(MetreAsignacionPage);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('no tiene permiso');
    expect(element.textContent).not.toContain('No hay mesas disponibles');
    await fixture.componentInstance.cargarMesas();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll('ion-select-option')).toHaveLength(1);
  });

  it('avisa y deshabilita el selector cuando la consulta devuelve cero mesas', async () => {
    obtenerMesasDisponibles.mockResolvedValue([]);
    const fixture = TestBed.createComponent(MetreAsignacionPage);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('No hay mesas disponibles');
    expect((element.querySelector('ion-select') as HTMLElement & { disabled: boolean }).disabled).toBe(true);
  });

  it('actualiza las mesas aunque falle la consulta de la lista de espera', async () => {
    order.mockResolvedValue({ data: null, error: { code: '42703', message: 'column missing' } });
    const fixture = TestBed.createComponent(MetreAsignacionPage);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Mesas disponibles: 1');
    expect(element.textContent).toContain('column missing');
    expect(element.textContent).not.toContain('No hay clientes pendientes');
  });

  it('limpia una mesa seleccionada si dejó de estar disponible', async () => {
    const fixture = TestBed.createComponent(MetreAsignacionPage);
    const page = fixture.componentInstance;
    await page.ionViewWillEnter();
    page.listaEspera[0].mesaSeleccionadaId = mesa.id;
    obtenerMesasDisponibles.mockResolvedValueOnce([]);
    await page.cargarMesas();
    expect(page.listaEspera[0].mesaSeleccionadaId).toBeNull();
    await page.asignarMesa(page.listaEspera[0]);
    expect(asignarMesaACliente).not.toHaveBeenCalled();
  });

  it('asigna la mesa al cliente con el usuario de la sesión y recarga las opciones', async () => {
    const fixture = TestBed.createComponent(MetreAsignacionPage);
    const page = fixture.componentInstance;
    await page.ionViewWillEnter();
    page.listaEspera[0].mesaSeleccionadaId = mesa.id;
    obtenerMesasDisponibles.mockResolvedValueOnce([]);
    order.mockResolvedValueOnce({ data: [], error: null });
    await page.asignarMesa(page.listaEspera[0]);
    expect(asignarMesaACliente).toHaveBeenCalledWith(1, 10);
    expect(page.listaEspera).toEqual([]);
    expect(page.asignando).toBe(false);
  });
});
