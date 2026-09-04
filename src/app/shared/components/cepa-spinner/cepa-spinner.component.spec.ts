import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CepaSpinnerComponent } from './cepa-spinner.component';

describe('CepaSpinnerComponent', () => {
  let component: CepaSpinnerComponent;
  let fixture: ComponentFixture<CepaSpinnerComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CepaSpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
