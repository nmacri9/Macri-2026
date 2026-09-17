import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroAnonimoPage } from './registro-anonimo.page';

describe('RegistroAnonimoPage', () => {
  let component: RegistroAnonimoPage;
  let fixture: ComponentFixture<RegistroAnonimoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistroAnonimoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
