import { NgModule } from '@angular/core';
import { ApolloClientOptions, DefaultOptions, InMemoryCache } from '@apollo/client/core';
import { ApolloModule, APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';

const uri: string = 'api/graphql'; // <-- add the URL of the GraphQL server here

const defaultOptions: DefaultOptions = {
    query: {
        fetchPolicy: 'no-cache',
    },
    mutate: {
        fetchPolicy: 'no-cache',
    },
};

export function createApollo(httpLink: HttpLink): ApolloClientOptions<any> {
    return {
        link: httpLink.create({ uri }),
        cache: new InMemoryCache(),
        defaultOptions,
    };
}

@NgModule({
    exports: [ApolloModule],
    providers: [
        {
            provide: APOLLO_OPTIONS,
            useFactory: createApollo,
            deps: [HttpLink],
        },
    ],
})
export class GraphQLModule {}
