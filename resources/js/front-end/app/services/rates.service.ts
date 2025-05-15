import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { gql, TypedDocumentNode } from 'apollo-angular';
import { Observable } from 'rxjs';
import { Currency } from '../../@types/app';
import assetUrl from '../utils/assetUrl';
import { GraphQlService } from './graph-ql.service';

@Injectable({
    providedIn: 'root',
})
export class RatesService {
    constructor(
        private http: HttpClient,
        private graphqlService: GraphQlService,
    ) {
        this.getRates = this.getRates.bind(this);
        this.getCurrencies = this.getCurrencies.bind(this);
        this.getCallBackExample = this.getCallBackExample.bind(this);
        this.getGraphqlExample = this.getGraphqlExample.bind(this);
    }

    async getRates(): Promise<Object> {
        const query: TypedDocumentNode = gql`
            query {
                min: rate(prefer: MIN) {
                    rate
                    currency
                }
                max: rate(prefer: MAX) {
                    rate
                    currency
                }
                mean: rate(prefer: MEAN) {
                    rate
                    currency
                }
                median: rate(prefer: MEDIAN) {
                    rate
                    currency
                }
                random: rate(prefer: RANDOM) {
                    rate
                    currency
                }
                mode: rate(prefer: MODE) {
                    rate
                    currency
                }
                rates: rate(cors: true) {
                    rate
                    last_rate
                    last_checked
                    last_updated
                    currency
                    currency_base
                    url
                }
                notice: info
            }
        `;

        return this.graphqlService.query(query);
    }

    async getCurrencies(): Promise<{ rates: Currency[] }> {
        const query: TypedDocumentNode = gql`
            query {
                rates: rate(cors: true, prefer: MIN) {
                    currency
                }
            }
        `;

        return this.graphqlService.query<{ rates: Currency[] }>(query);
    }

    getCallBackExample(): Observable<string> {
        const url: URL = assetUrl('assets/misc/example.js');
        return this.http.get(url.toString(), { responseType: 'text' });
    }

    getGraphqlExample(): Observable<string> {
        const url: URL = assetUrl('assets/misc/example.graphql');
        return this.http.get(url.toString(), { responseType: 'text' });
    }
}
