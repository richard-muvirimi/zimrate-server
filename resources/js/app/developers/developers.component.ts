import { Component, OnInit } from '@angular/core';
import { uniqBy } from 'lodash';
import { sprintf } from 'sprintf-js';
import { AnimeService } from '../services/anime.service';
import { RatesService } from '../services/rates.service';
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
		this.currencies$ = "";
		this.prefer$ = ["MAX", "MIN", "MEAN", "MEDIAN", "RANDOM", "MODE"].join(", ");

		this.exampleCallback$ = "";
		this.exampleGraphql$ = "";

		this.baseUrl$ = window.location.href.replace("/developers", "");
	}

	ngOnInit(): void {
		this.ratesService.getCurrencies().subscribe((data : {rates : Currency[]}) => {
			this.currencies$ = uniqBy(data["rates"].map((item: Currency) => item.currency), currency => currency).join(", ");
		});

		this.ratesService.getCallBackExample().subscribe((data: string) => {
			this.exampleCallback$ = sprintf(data, this.baseUrl$)
		});

		this.ratesService.getGraphqlExample().subscribe((data: string) => {
			this.exampleGraphql$ = data
		});

		setTimeout(() => {
			this.animeService.reviewComponents();
		}, 0);
	}

}
