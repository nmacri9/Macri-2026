import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficosEncuestasPage } from './graficos-encuestas.page';

describe('GraficosEncuestasPage', () => {
  let component: GraficosEncuestasPage;
  let fixture: ComponentFixture<GraficosEncuestasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GraficosEncuestasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
