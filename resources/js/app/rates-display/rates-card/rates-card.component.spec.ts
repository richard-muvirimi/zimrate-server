import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RatesCardComponent } from './rates-card.component';

describe('RatesCardComponent', () => {
  let component: RatesCardComponent;
  let fixture: ComponentFixture<RatesCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RatesCardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RatesCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
