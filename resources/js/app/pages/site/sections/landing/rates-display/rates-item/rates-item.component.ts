import {Component, Input, OnInit} from '@angular/core';
import RateAggregate from "../../../../../../@types/rate-aggregate";
import {DateTime} from "luxon";

@Component({
    selector: 'app-rates-item',
    templateUrl: './rates-item.component.html',
    styleUrls: ['./rates-item.component.scss']
})
export class RatesItemComponent implements OnInit {

    @Input("currency") currency!: RateAggregate;

    protected readonly DateTime = DateTime;

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
    }

    ngOnInit(): void {
    }


}
