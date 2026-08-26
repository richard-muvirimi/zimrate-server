import { ApolloServer } from '@apollo/server';
import { logger } from 'firebase-functions';
import { createTypeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

export async function handleGraphQLRequest(req, res) {
    // Schema construction must stay inside the try: it is built per request from
    // live data, so a bad schema used to escape as an unhandled rejection and
    // take down the whole function worker instead of returning an error.
    let server;

    try {
        // Create a new Apollo Server instance for each request (serverless)
        // Get dynamic schema with current currencies
        const typeDefs = await createTypeDefs();

        server = new ApolloServer({
            typeDefs,
            resolvers,
            introspection: true,
        });

        await server.start();

        // Handle the GraphQL request
        const response = await server.executeOperation({
            query: req.body.query,
            variables: req.body.variables,
            operationName: req.body.operationName,
        }, {
            contextValue: {
                req
            }
        });

        // Apollo Server v4 wraps the result in { kind: 'single', singleResult: {...} }.
        // Unwrap it so the client receives a standard { data, errors } GraphQL response.
        const body = response.body;
        const result = body.kind === 'single' ? body.singleResult : { errors: [{ message: 'Unexpected response kind' }] };
        res.status(200).json(result);
    } catch (error) {
        logger.error('GraphQL execution error:', error);
        res.status(500).json({
            errors: [{ message: 'Internal server error' }]
        });
    } finally {
        // Stop the server after handling the request (serverless).
        // Guarded: construction itself may have failed above.
        if (server) await server.stop();
    }
}
