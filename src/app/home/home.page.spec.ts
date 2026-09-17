import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, NavController, Platform, ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  const obtenerPerfil = vi.fn();

  beforeEach(() => {
    obtenerPerfil.mockReset();
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {
          obtenerUsuarioActual: vi.fn().mockResolvedValue({ id: 'usuario', email: 'cliente@cepa.com' }),
          obtenerPerfil,
        } },
        { provide: SupabaseService, useValue: {} },
        ...[AlertController, NavController, Platform, ToastController].map(provide => ({ provide, useValue: {} })),
      ],
    });
  });

  it.each(['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'])('muestra productos al %s al volver a Home', async rol => {
    const fixture = TestBed.createComponent(HomePage);
    obtenerPerfil.mockResolvedValueOnce({ rol: 'COCINERO', estado: 'ACTIVO' });
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/menu-productos"]')).toBeNull();
    obtenerPerfil.mockResolvedValueOnce({ rol, estado: 'APROBADO', nombres: 'Cliente' });
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/menu-productos"]')?.textContent).toContain('Menú de productos');
    expect(fixture.nativeElement.querySelector('a[href="/alta-plato"]')).toBeNull();
  });

  it('permite reintentar cuando falla la consulta del perfil', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(HomePage);
    obtenerPerfil.mockRejectedValueOnce(new Error('Sin conexión'));
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    obtenerPerfil.mockResolvedValueOnce({ rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' });
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/menu-productos"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    log.mockRestore();
  });
});
