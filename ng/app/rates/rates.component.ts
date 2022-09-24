import { Component, OnInit } from '@angular/core';
import { RatesService } from '../rates.service';
import { DateTime } from "luxon";
import { Dictionary, groupBy, map, mapValues, maxBy, uniqBy } from "lodash";

type Rate = {
	domain: string,
	currency: string,
	last_checked: number,
	url: string
}

@Component({
	selector: 'app-rates',
	templateUrl: './rates.component.html',
	styleUrls: ['./rates.component.scss']
})
export class RatesComponent implements OnInit {

	lastChecked$: String;
	urls$: Dictionary<any>;
	currencies$: string[];
	data$: Dictionary<any>;
	notice$: String;

	constructor(private data: RatesService) {
		this.currencies$ = [];
		this.urls$ = {};
		this.data$ = {};
		this.lastChecked$ = "...";
		this.notice$ = "";

		this.onData = this.onData.bind(this);
	}

	ngOnInit() {
		this.data.getRates().subscribe(this.onData);
	}

	onData(data: Dictionary<any>) {

		// Notice
		this.notice$ = data["notice"];

		const { max, min, mean, median, random, mode } = data;
		this.data$ = mapValues({ max, min, mean, median, random, mode }, items => {
			items = map(items, item => {
				item.rate = item.rate.toFixed(2);
				return item;
			});
			return groupBy(items, item => item.currency);
		});

		// Rates
		this.currencies$ = uniqBy(data["rates"].map((item: Rate) => item.currency), currency => currency);

		// Urls
		this.urls$ = mapValues(groupBy(data["rates"], (rate: Rate) => rate.currency), (items: Rate[]) => uniqBy(items.map(item => {
			item.domain = (new URL(item.url)).hostname;
			return item;
		}), (item: Rate) => item.url));

		// Last Checked
		const date = maxBy(data["rates"], (rate: Rate) => rate.last_checked)?.last_checked || DateTime.now().toSeconds();

		this.lastChecked$ = DateTime.fromSeconds(date).toLocaleString(DateTime.DATETIME_MED)

	}

}
