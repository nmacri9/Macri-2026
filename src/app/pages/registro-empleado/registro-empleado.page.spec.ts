import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroEmpleadoPage } from './registro-empleado.page';

describe('RegistroEmpleadoPage', () => {
  let component: RegistroEmpleadoPage;
  let fixture: ComponentFixture<RegistroEmpleadoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistroEmpleadoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
