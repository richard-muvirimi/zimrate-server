import {Component, Input, OnInit} from '@angular/core';
import RateAggregate from "../../../../../../@types/rate-aggregate";

@Component({
    selector: 'app-rates-card',
    templateUrl: './rates-card.component.html',
    styleUrls: ['./rates-card.component.scss']
})
export class RatesCardComponent implements OnInit {

    @Input("currencies") currencies$: RateAggregate[] = [];

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
    }

    ngOnInit(): void {
    }
}
