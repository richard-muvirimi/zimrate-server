import {Injectable} from '@angular/core';
import {Apollo, MutationResult, TypedDocumentNode} from "apollo-angular";
import {EmptyObject} from "apollo-angular/types";
import {Subscription} from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class GraphQlService {

    constructor(
        private apollo: Apollo,
    ) {
    }

    query<T>(query: TypedDocumentNode, variables: EmptyObject = {}): Promise<T> {
        return new Promise<T>((resolve: Function, reject: Function): void => {

            const options: any = {variables, query};

            const subscription: Subscription = this.apollo.query<T>(options).subscribe({
                next: async (result: MutationResult<T>): Promise<void> => {
                    resolve(result.data!!);
                },
                error: (error: Error): void => {
                    reject(error);
                    setTimeout((): void => {
                        subscription?.unsubscribe();
                    }, 0);
                },
                complete: (): void => {
                    setTimeout((): void => {
                        subscription?.unsubscribe();
                    }, 0);
                }
            });
        });
    }
}
