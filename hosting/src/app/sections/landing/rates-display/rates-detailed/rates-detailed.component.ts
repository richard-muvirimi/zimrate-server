import { Component, Input, OnInit } from '@angular/core';
import RateAggregate from '../../../../@types/rate-aggregate';

@Component({
    selector: 'app-rates-detailed',
    templateUrl: './rates-detailed.component.html',
    styleUrls: ['./rates-detailed.component.scss'],
})
export class RatesDetailedComponent implements OnInit {
    @Input('currencies') currencies$: RateAggregate[] = [];

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
        this.onToggleExpanded = this.onToggleExpanded.bind(this);
    }

    ngOnInit(): void {}

    onToggleExpanded(event: Event, rate: RateAggregate): void {
        this.currencies$ = this.currencies$.map((item: RateAggregate): RateAggregate => {
            if (rate === item) {
                item.expanded = !item.expanded;
            }
            return item;
        });
    }
}
