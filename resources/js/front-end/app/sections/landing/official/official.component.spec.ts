import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfficialComponent } from './official.component';

describe('OfficialComponent', () => {
    let component: OfficialComponent;
    let fixture: ComponentFixture<OfficialComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [OfficialComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(OfficialComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
