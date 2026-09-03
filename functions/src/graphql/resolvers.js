import Rate from '../models/Rate.js';
import Option from '../models/Option.js';
import { RateService } from '../services/RateService.js';
import { graphqlRateQuerySchema } from '../validation/schemas.js';
export const resolvers = {
  Query: {
    async rate(_parent, args) {
      // Normalise prefer to lowercase before validation (enum arrives uppercase from client)
      const normalisedArgs = args.prefer
        ? { ...args, prefer: args.prefer.toLowerCase() }
        : args;

      // Validate arguments
      const { error, value } = graphqlRateQuerySchema.validate(normalisedArgs);
      if (error) {
        throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
      }

      // base is the only argument that changes what a rate *means*, so it takes
      // its own path: the same cross-rate maths REST v2 serves. Without it the
      // query answers exactly as it always has, in rates per 1 USD.
      if (value.base) {
        return await RateService.getRatesForBase({
          base: value.base,
          prefer: value.prefer,
          currency: value.currency,
          search: value.search,
          date: value.date
        });
      }

      const filters = {
        enabled: true,
        ...value
      };

      // Handle date filter
      if (value.date) {
        filters.dateAfter = value.date;
      }

      let rates;
      if (value.prefer) {
        rates = await Rate.getAggregatedRates(value.prefer, filters);
      } else {
        rates = await Rate.findAll(filters);
      }

      return rates.map(rate => rate.toAPI());
    },

    async info() {
      // Read info from options collection with fallback
      return await Option.getValue('info', 'ZimRate API - Real-time Zimbabwe exchange rates');
    }
  }
};
