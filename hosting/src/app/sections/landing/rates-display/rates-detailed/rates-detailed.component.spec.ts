import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RatesDetailedComponent } from './rates-detailed.component';

describe('RatesDisplayComponent', () => {
    let component: RatesDetailedComponent;
    let fixture: ComponentFixture<RatesDetailedComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [RatesDetailedComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RatesDetailedComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
