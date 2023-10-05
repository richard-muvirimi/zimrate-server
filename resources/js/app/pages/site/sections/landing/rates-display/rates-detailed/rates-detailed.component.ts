import {Component, Input, OnInit} from '@angular/core';
import {Dictionary} from "lodash";
import RateAggregate from "../../../../../../@types/rate-aggregate";
import {DateTime} from "luxon";

@Component({
    selector: 'app-rates-detailed',
    templateUrl: './rates-detailed.component.html',
    styleUrls: ['./rates-detailed.component.scss']
})
export class RatesDetailedComponent implements OnInit {

    @Input("currencies") currencies$: RateAggregate[] = [];
    @Input("data") data$: Dictionary<any> = {};
    protected readonly DateTime = DateTime;

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
        this.onToggleExpanded = this.onToggleExpanded.bind(this);
    }

    ngOnInit(): void {
    }

    onToggleExpanded(event: Event, rate: RateAggregate): void {
        this.currencies$ = this.currencies$.map((item: RateAggregate) => {
            if (rate === item) {
                item.expanded = !item.expanded;
            }
            return item;
        });
    }
}
