import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductosService } from '../../services/productos.service';
import { MenuProductosPage } from './menu-productos.page';

describe('Menú de productos', () => {
  const listarProductos = vi.fn();
  const producto = {
    id: 1, nombre: 'Risotto', descripcion: 'Arroz con hongos', precio: 12500,
    tipo: 'PLATO', imagenes: ['uno.jpg', 'dos.jpg', 'tres.jpg'],
  };

  beforeEach(() => {
    listarProductos.mockReset().mockResolvedValue([producto]);
    TestBed.configureTestingModule({
      imports: [MenuProductosPage],
      providers: [provideRouter([]), { provide: ProductosService, useValue: { listarProductos } }],
    });
  });

  it('muestra los datos y recorre las tres fotos sin mostrar imágenes vecinas', async () => {
    const fixture = TestBed.createComponent(MenuProductosPage);
    await fixture.componentInstance.cargarProductos();
    fixture.detectChanges();
    const elemento: HTMLElement = fixture.nativeElement;
    expect(elemento.textContent).toContain('Risotto');
    expect(elemento.textContent).toContain('Arroz con hongos');
    expect(elemento.querySelector('.precio')?.textContent).toContain('12.500,00');
    const botones = elemento.querySelectorAll<HTMLButtonElement>('.controles button');
    for (const foto of ['dos.jpg', 'tres.jpg', 'uno.jpg']) {
      botones[1].click();
      fixture.detectChanges();
      expect(elemento.querySelectorAll('.foto-contenedor img')).toHaveLength(1);
      expect(elemento.querySelector('img')?.getAttribute('src')).toBe(foto);
    }
    botones[0].click();
    fixture.detectChanges();
    expect(elemento.querySelector('img')?.getAttribute('src')).toBe('tres.jpg');
    elemento.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(elemento.querySelector('.sin-foto')?.textContent).toContain('Imagen no disponible');
  });

  it('permite reintentar una carga fallida y muestra el estado vacío', async () => {
    listarProductos.mockRejectedValueOnce(new Error('Sin conexión'));
    const fixture = TestBed.createComponent(MenuProductosPage);
    await fixture.componentInstance.cargarProductos();
    fixture.detectChanges();
    const elemento: HTMLElement = fixture.nativeElement;
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar');
    listarProductos.mockResolvedValueOnce([]);
    elemento.querySelector<HTMLButtonElement>('.reintentar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Todavía no hay productos disponibles');
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
  });
});
