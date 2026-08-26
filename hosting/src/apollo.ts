import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { API_BASE_URL } from './config';

const httpLink = createHttpLink({
  uri: `${API_BASE_URL}/api/graphql`,
});

const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'network-only' },
    query: { fetchPolicy: 'network-only' },
  },
});

export default apolloClient;
