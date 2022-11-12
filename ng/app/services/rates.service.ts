import { Injectable } from '@angular/core';
import { request, gql } from 'graphql-request';
import { from } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
	providedIn: 'root',
})
export class RatesService {
	constructor(private http: HttpClient) { }

	getRates() {

		const query = gql`query {
		   	min : rate (prefer : MIN) {
				rate
				currency
			}
			max : rate (prefer : MAX) {
				rate
				currency
			}
			mean : rate (prefer : MEAN) {
				rate
				currency
			}
			median : rate (prefer : MEDIAN) {
				rate
				currency
			}
			random : rate (prefer : RANDOM) {
				rate
				currency
			}
			mode : rate (prefer : MODE) {
				rate
				currency
			}
			rates : rate (cors : true) {
				last_checked
				currency
				url
			}
			notice : info
		}`;

		const rates = from(request(
			'api/graphql',
			query
		));

		return rates;
	}

	getCurrencies() {

		const query = gql`query {
			rates : rate (cors : true, prefer : MIN) {
				currency
			}
		}`;

		const currencies = from(request(
			'api/graphql',
			query
		));

		return currencies;
	}

	getCallBackExample() {
		return this.http.get("app/Views/dist/assets/misc/example.js", { responseType: 'text' });
	}

	getGraphqlExample() {
		return this.http.get("app/Views/dist/assets/misc/example.graphql", { responseType: 'text' });
	}
}
