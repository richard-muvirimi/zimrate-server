import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RatesComponent } from './rates.component';

describe('RatesComponent', () => {
  let component: RatesComponent;
  let fixture: ComponentFixture<RatesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RatesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
