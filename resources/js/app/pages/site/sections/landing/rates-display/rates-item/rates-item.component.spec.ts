import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RatesItemComponent} from './rates-item.component';

describe('RatesTableComponent', () => {
    let component: RatesItemComponent;
    let fixture: ComponentFixture<RatesItemComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [RatesItemComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(RatesItemComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
