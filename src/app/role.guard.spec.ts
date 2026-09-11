import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './services/auth.service';
import { roleGuard } from './role.guard';

describe('Acceso a clientes pendientes', () => {
  const obtenerUsuarioActual = vi.fn();
  const obtenerPerfil = vi.fn();
  const createUrlTree = vi.fn((paths: string[]) => paths.join('/'));
  const route = { data: { roles: ['DUENO', 'SUPERVISOR'], requireStoredRole: true } } as unknown as ActivatedRouteSnapshot;
  const check = () => TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { obtenerUsuarioActual, obtenerPerfil } },
      { provide: Router, useValue: { createUrlTree } }
    ] });
    obtenerUsuarioActual.mockResolvedValue({ id: 'usuario', user_metadata: { rol: 'DUENO' } });
  });

  it.each(['DUENO', 'SUPERVISOR'])('permite al %s activo', async rol => {
    obtenerPerfil.mockResolvedValue({ rol, estado: 'ACTIVO' });
    expect(await check()).toBe(true);
  });

  it('no acepta el rol manipulable de metadata si el perfil es mozo', async () => {
    obtenerPerfil.mockResolvedValue({ rol: 'MOZO', estado: 'ACTIVO' });
    expect(await check()).toBe('/home');
  });

  it('bloquea a supervisores inactivos', async () => {
    obtenerPerfil.mockResolvedValue({ rol: 'SUPERVISOR', estado: 'INACTIVO' });
    expect(await check()).toBe('/home');
  });

  it('no permite entrar sin un perfil almacenado', async () => {
    obtenerPerfil.mockResolvedValue(null);
    expect(await check()).toBe('/login');
  });

  it('permite al cliente aprobado entrar a home sin ser personal', async () => {
    obtenerPerfil.mockResolvedValue({ rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' });
    const homeRoute = { data: {} } as ActivatedRouteSnapshot;
    expect(await TestBed.runInInjectionContext(() => roleGuard(homeRoute, {} as RouterStateSnapshot))).toBe(true);
  });

  it.each(['PENDIENTE', 'RECHAZADO'])('no permite al cliente %s entrar a home', async estado => {
    obtenerPerfil.mockResolvedValue({ rol: 'CLIENTE_REGISTRADO', estado });
    const homeRoute = { data: {} } as ActivatedRouteSnapshot;
    expect(await TestBed.runInInjectionContext(() => roleGuard(homeRoute, {} as RouterStateSnapshot))).toBe('/login');
  });
});
