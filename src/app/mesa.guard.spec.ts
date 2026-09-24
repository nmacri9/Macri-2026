import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './services/auth.service';
import { MesasService } from './services/mesas.service';
import { mesaGuard } from './mesa.guard';

describe('Acceso a menú y consulta al mozo', () => {
  const obtenerPerfil = vi.fn();
  const obtenerAsignacionActiva = vi.fn();
  const check = (permitirMozo = true, requiereEscaneo = true) => TestBed.runInInjectionContext(() => mesaGuard(
    { data: { permitirMozo, requiereEscaneo } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { obtenerPerfil } },
      { provide: MesasService, useValue: { obtenerAsignacionActiva } },
      { provide: Router, useValue: { createUrlTree: (paths: string[]) => paths.join('/') } }
    ] });
  });
  it.each(['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'])('permite %s con mesa vinculada', async rol => {
    obtenerPerfil.mockResolvedValue({ id: 'cliente', rol, estado: rol === 'CLIENTE_REGISTRADO' ? 'APROBADO' : 'ACTIVO' });
    obtenerAsignacionActiva.mockResolvedValue({ vinculada: true });
    expect(await check()).toBe(true);
    expect(obtenerAsignacionActiva).toHaveBeenCalledWith('cliente');
  });
  it.each([null, { vinculada: false }])('bloquea acceso directo sin escanear la mesa: %s', async asignacion => {
    obtenerPerfil.mockResolvedValue({ id: 'cliente', rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' });
    obtenerAsignacionActiva.mockResolvedValue(asignacion);
    expect(await check()).toBe('/cliente-escaneo-mesa');
  });
  it('permite al mozo activo entrar al chat sin asignarle una mesa', async () => {
    obtenerPerfil.mockResolvedValue({ rol: 'MOZO', estado: 'ACTIVO' });
    expect(await check()).toBe(true);
    expect(obtenerAsignacionActiva).not.toHaveBeenCalled();
    expect(await check(false)).toBe('/home');
  });
  it('habilita la consulta al asignar mesa, pero exige el QR para abrir el menú', async () => {
    obtenerPerfil.mockResolvedValue({ id: 'cliente', rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' });
    obtenerAsignacionActiva.mockResolvedValue({ vinculada: false });
    expect(await check(true, false)).toBe(true);
    expect(await check(false, true)).toBe('/cliente-escaneo-mesa');
  });
  it.each([
    { rol: 'MOZO', estado: 'INACTIVO' },
    { rol: 'CLIENTE_REGISTRADO', estado: 'PENDIENTE' },
    { rol: 'CLIENTE_ANONIMO', estado: 'INACTIVO' },
    { rol: 'COCINERO', estado: 'ACTIVO' },
    null
  ])('rechaza perfiles no habilitados: %s', async perfil => {
    obtenerPerfil.mockResolvedValue(perfil);
    expect(await check()).toBe('/home');
  });
  it('no permite acceso si falla la comprobación de la mesa', async () => {
    obtenerPerfil.mockResolvedValue({ id: 'cliente', rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' });
    obtenerAsignacionActiva.mockRejectedValue(new Error('Sin conexión'));
    expect(await check()).toBe('/home');
  });
});
