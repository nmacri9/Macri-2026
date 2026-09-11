import { FormBuilder } from '@angular/forms';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { Camera, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { confirmarClaveValidator, RegistroClientePage } from './registro-cliente.page';
import { AuthService } from '../../services/auth.service';
import { DniScannerService } from '../../services/dni-scanner';

vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: vi.fn() }, CameraSource: { Prompt: 'PROMPT' }, CameraResultType: { DataUrl: 'dataUrl' }
}));

describe('Confirmación de contraseña de registro', () => {
  it('rechaza claves diferentes y se actualiza al corregir cualquiera de las dos', () => {
    const form = new FormBuilder().group({
      clave: ['primera123'], confirmarClave: ['segunda123']
    }, { validators: confirmarClaveValidator });

    expect(form.hasError('clavesDistintas')).toBe(true);
    form.controls.confirmarClave.setValue('primera123');
    expect(form.valid).toBe(true);
    form.controls.clave.setValue('tercera123');
    expect(form.hasError('clavesDistintas')).toBe(true);
  });
});

describe('Carga de foto de registro', () => {
  let page: RegistroClientePage;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    page = new RegistroClientePage(new FormBuilder(),
      { detectChanges: vi.fn(), markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
      {} as AuthService, {} as ModalController, {} as ToastController, {} as DniScannerService);
    page.ngOnInit();
  });

  it('permite elegir una imagen y la incorpora al formulario y a la vista previa', async () => {
    vi.mocked(Camera.getPhoto).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,foto', format: 'jpeg', saved: false });
    await page.tomarFoto();
    expect(Camera.getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: CameraSource.Prompt }));
    expect(page.fotoPreview).toBe('data:image/jpeg;base64,foto');
    expect(page.registroForm.get('foto')?.value).toBe(page.fotoPreview);
    expect(page.registroForm.get('foto')?.valid).toBe(true);
    expect(page.cargandoFoto).toBe(false);
  });

  it('en navegador abre el selector nativo sin cargar el módulo web de Capacitor', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const click = vi.fn();
    page.archivoFoto = { nativeElement: { value: 'anterior', click } } as unknown as ElementRef<HTMLInputElement>;
    await page.tomarFoto();
    expect(click).toHaveBeenCalledOnce();
    expect(Camera.getPhoto).not.toHaveBeenCalled();
  });

  it('cancelar conserva la foto anterior y permite reintentar', async () => {
    page.fotoPreview = 'foto-anterior';
    page.registroForm.patchValue({ foto: 'foto-anterior' });
    vi.mocked(Camera.getPhoto).mockRejectedValue(new Error('User cancelled photos app'));
    await page.tomarFoto();
    expect(page.fotoPreview).toBe('foto-anterior');
    expect(page.errorFoto).toBe('');
    expect(page.cargandoFoto).toBe(false);
  });

  it('muestra un error sin dar la foto por cargada si falla la selección', async () => {
    vi.mocked(Camera.getPhoto).mockRejectedValue(new Error('Permission denied'));
    await page.tomarFoto();
    expect(page.errorFoto).not.toBe('');
    expect(page.registroForm.get('foto')?.invalid).toBe(true);
    expect(page.cargandoFoto).toBe(false);
  });
});
