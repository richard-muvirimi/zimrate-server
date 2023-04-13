import {Injectable} from '@angular/core';
import {gql, request} from 'graphql-request';
import {from, Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {Currency} from "../../@types/app";

@Injectable({
	providedIn: 'root',
})
export class RatesService {
	constructor(private http: HttpClient) { }

	getRates() :Observable<Object> {

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

		return from(request(
			'api/graphql',
			query
		)) as Observable<Object>;
	}

	getCurrencies():Observable<{rates : Currency[]}> {

		const query = gql`query {
			rates : rate (cors : true, prefer : MIN) {
				currency
			}
		}`;

		return from(request(
			'api/graphql',
			query
		)) as Observable<{rates : Currency[]}>;
	}

	getCallBackExample() {
		return this.http.get("app/Views/dist/assets/misc/example.js", { responseType: 'text' });
	}

	getGraphqlExample() {
		return this.http.get("app/Views/dist/assets/misc/example.graphql", { responseType: 'text' });
	}
}
