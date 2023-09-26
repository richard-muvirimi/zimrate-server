import {Injectable} from '@angular/core';
import {gql, TypedDocumentNode} from "apollo-angular";
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {Currency} from "../../@types/app";
import {GraphQlService} from "./graph-ql.service";

@Injectable({
    providedIn: 'root',
})
export class RatesService {
    constructor(
        private http: HttpClient,
        private graphqlService: GraphQlService,
    ) {
    }

    async getRates(): Promise<Object> {

        const query: TypedDocumentNode = gql`
            query {
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
            }
        `;

        return this.graphqlService.query(query);
    }

    async getCurrencies(): Promise<{ rates: Currency[] }> {

        const query: TypedDocumentNode = gql`
            query {
                rates : rate (cors : true, prefer : MIN) {
                    currency
                }
            }
        `;

        return this.graphqlService.query<{ rates: Currency[] }>(query);
    }

    getCallBackExample(): Observable<string> {
        return this.http.get("build/assets/misc/example.js", {responseType: 'text'});
    }

    getGraphqlExample(): Observable<string> {
        return this.http.get("build/assets/misc/example.graphql", {responseType: 'text'});
    }
}
