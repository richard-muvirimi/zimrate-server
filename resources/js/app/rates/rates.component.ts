import {Component, OnInit} from '@angular/core';
import {RatesService} from '../services/rates.service';
import {DateTime} from "luxon";
import {Dictionary, groupBy, mapValues, maxBy, uniqBy} from "lodash";
import {AnimeService} from '../services/anime.service';


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

    constructor(private rateService: RatesService, private animeService: AnimeService) {
        this.ngOnInit = this.ngOnInit.bind(this);

        this.currencies$ = [];
        this.urls$ = {};
        this.data$ = {};
        this.lastChecked$ = "...";
        this.notice$ = "";
    }

    ngOnInit(): void {

        setTimeout(async (): Promise<void> => {

            const data: Dictionary<any> = await this.rateService.getRates();

            // Notice
            this.notice$ = data["notice"];

            const {max, min, mean, median, random, mode} = data;
            this.data$ = mapValues({max, min, mean, median, random, mode}, items => {
                return groupBy(items, item => item.currency);
            });

            // Rates
            this.currencies$ = uniqBy(data["rates"].map((item: Rate) => item.currency), (currency: string) => currency);

            // Urls
            this.urls$ = mapValues(groupBy(data["rates"], (rate: Rate) => rate.currency), (items: Rate[]) => uniqBy(items.map((item: Rate): Rate => {
                item.domain = (new URL(item.url)).hostname;
                return item;
            }), (item: Rate) => item.url));

            // Last Checked
            const date: number = maxBy(data["rates"], (rate: Rate) => rate.last_checked)?.last_checked || DateTime.now().toSeconds();

            this.lastChecked$ = DateTime.fromSeconds(date).toLocaleString(DateTime.DATETIME_MED);

            setTimeout((): void => {
                this.animeService.reviewComponents();
            }, 0);

        }, 0);
    }

}
