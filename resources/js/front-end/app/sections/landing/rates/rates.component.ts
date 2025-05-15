import { Component, OnInit } from '@angular/core';
import { Dictionary, groupBy, map, mapValues, maxBy, minBy, pick, uniqBy } from 'lodash';
import { DateTime } from 'luxon';
import { environment } from '../../../../environments/environment';
import Rate from '../../../@types/rate';
import RateAggregate from '../../../@types/rate-aggregate';
import { AnimeService } from '../../../services/anime.service';
import { RatesService } from '../../../services/rates.service';

@Component({
    selector: 'app-rates',
    templateUrl: './rates.component.html',
    styleUrls: ['./rates.component.scss'],
})
export class RatesComponent implements OnInit {
    lastChecked$: number | undefined;
    currencies$: RateAggregate[];
    notice$: String;

    ratesDisplay: string = '';

    constructor(
        private rateService: RatesService,
        private animeService: AnimeService,
    ) {
        this.ngOnInit = this.ngOnInit.bind(this);

        this.currencies$ = [];
        this.lastChecked$ = undefined;
        this.notice$ = '';

        this.ratesDisplay = environment.ratesDisplay;
    }

    ngOnInit(): void {
        setTimeout(async (): Promise<void> => {
            const data: Dictionary<any> = await this.rateService.getRates();

            // Notice
            this.notice$ = data['notice'];

            const { max, min, mean, median, random, mode } = data;
            const aggregated: Dictionary<any> = mapValues({ max, min, mean, median, random, mode }, (items) => {
                return groupBy(items, (item) => item.currency);
            });

            // Rates
            this.currencies$ = uniqBy<Rate>(data['rates'], 'currency').map((rate: Rate): RateAggregate => {
                const rates = data['rates']
                    .filter((item: Rate): boolean => rate.currency === item.currency)
                    .sort((rate1: Rate, rate2: Rate) => {
                        return rate1.rate - rate2.rate;
                    });

                return {
                    currency: rate.currency,
                    currency_base: rate.currency_base,
                    last_checked: maxBy<Rate>(rates, 'last_checked')!!.last_checked,
                    last_updated: maxBy<Rate>(rates, 'last_updated')!!.last_updated,
                    rates: uniqBy<Rate>(rates, (item: Rate) => {
                        return JSON.stringify(pick(item, ['rate', 'last_rate']));
                    }),
                    minRate: minBy<Rate>(rates, 'rate')!!,
                    maxRate: maxBy<Rate>(rates, 'rate')!!,
                    urls: map(uniqBy<Rate>(rates, 'url'), (item: Rate): URL => new URL(item.url)),
                    aggregated: {
                        max: aggregated['max'][rate.currency][0].rate,
                        mean: aggregated['mean'][rate.currency][0].rate,
                        min: aggregated['min'][rate.currency][0].rate,
                        mode: aggregated['mode'][rate.currency][0].rate,
                        median: aggregated['median'][rate.currency][0].rate,
                        random: aggregated['random'][rate.currency][0].rate,
                    },
                    expanded: false,
                };
            });

            // Last Checked
            this.lastChecked$ = maxBy<Rate>(data['rates'], 'last_checked')?.last_checked || DateTime.utc().toSeconds();

            setTimeout((): void => {
                this.animeService.reviewComponents();
            }, 0);
        }, 0);
    }
}
