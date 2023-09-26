import {Component, OnInit} from '@angular/core';
import {uniqBy} from 'lodash';
import {sprintf} from 'sprintf-js';
import {AnimeService} from '../services/anime.service';
import {RatesService} from '../services/rates.service';
import {Currency} from "../../@types/app";

@Component({
    selector: 'app-developers',
    templateUrl: './developers.component.html',
    styleUrls: ['./developers.component.scss']
})
export class DevelopersComponent implements OnInit {

    currencies$: string;
    prefer$: string;

    exampleCallback$: string;
    exampleGraphql$: string;

    baseUrl$: string;

    constructor(private ratesService: RatesService, private animeService: AnimeService) {
        this.ngOnInit = this.ngOnInit.bind(this);

        this.currencies$ = "";
        this.prefer$ = ["MAX", "MIN", "MEAN", "MEDIAN", "RANDOM", "MODE"].join(", ");

        this.exampleCallback$ = "";
        this.exampleGraphql$ = "";

        this.baseUrl$ = window.location.href.replace("/developers", "");
    }

    ngOnInit(): void {
        setTimeout(async (): Promise<void> => {
            const data: { rates: Currency[] } = await this.ratesService.getCurrencies();

            this.currencies$ = uniqBy(data["rates"].map((item: Currency) => item.currency), (currency: string) => currency).join(", ");
        }, 0);

        this.ratesService.getCallBackExample().subscribe((data: string): void => {
            this.exampleCallback$ = sprintf(data, this.baseUrl$ + '/api/graphql')
        });

        this.ratesService.getGraphqlExample().subscribe((data: string): void => {
            this.exampleGraphql$ = data
        });

        setTimeout((): void => {
            this.animeService.reviewComponents();
        }, 0);
    }

}
