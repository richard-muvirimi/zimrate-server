import { StatusCodes } from 'http-status-codes';
import { logger } from 'firebase-functions';
import { RateService, BaseRateError } from '../services/RateService.js';
import { rateQuerySchema, v2QuerySchema } from '../validation/schemas.js';
import Option from '../models/Option.js';

export class RatesController {
    static async version0(req, res) {
        try {
            const { error, value } = rateQuerySchema.validate({ ...req.query, ...req.body });
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: error.details.map(d => d.message).join(', ')
                });
            }

            if (await RatesController._rejectUnknownCurrency(value.currency, res)) return;

            const rates = await RateService.getRates(value);
            return res.status(StatusCodes.OK).json(rates);

        } catch (error) {
            logger.error('Error in version0:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: error.message
            });
        }
    }

    static async version1(req, res) {
        try {
            const { error, value } = rateQuerySchema.validate({ ...req.query, ...req.body });
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: error.details.map(d => d.message).join(', ')
                });
            }

            if (await RatesController._rejectUnknownCurrency(value.currency, res)) return;

            const response = {};
            response.USD = await RateService.getRates(value);

            // Include info if requested (default true)
            const includeInfo = value.info !== false;
            if (includeInfo) {
                response.info = await Option.getValue('info', 'ZimRate API - Real-time Zimbabwe exchange rates');
            }

            // Handle JSONP callback
            if (value.callback) {
                const callbackName = value.callback;
                const jsonpResponse = `${callbackName}(${JSON.stringify(response)})`;
                return res.status(StatusCodes.OK)
                    .type('application/javascript')
                    .send(jsonpResponse);
            }

            return res.status(StatusCodes.OK).json(response);

        } catch (error) {
            logger.error('Error in version1:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: error.message
            });
        }
    }

    /**
     * API v2: Returns rates expressed relative to a user-specified base currency.
     *
     * The cross-rate maths lives in RateService.getRatesForBase, shared with the
     * GraphQL `base` argument.
     *
     * Query params: base (required), prefer, currency, callback, info
     */
    static async version2(req, res) {
        try {
            // base comes from the path (/api/v2/ZAR), never the query string.
            // Joi uppercases it, so the url segment is case insensitive.
            const { error, value } = v2QuerySchema.validate({
                ...req.query,
                ...req.body,
                base: req.params.base,
            });
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: error.details.map(d => d.message).join(', ')
                });
            }

            const { base, prefer, currency, search, name, date, callback, info: includeInfo } = value;

            let rates;
            try {
                rates = await RateService.getRatesForBase({ base, prefer, currency, search, name, date });
            } catch (err) {
                // An unusable base is the caller's problem, not a server fault, so
                // it keeps its own status rather than falling through to the 500.
                if (!(err instanceof BaseRateError)) throw err;
                return res.status(err.status).json({ status: false, message: err.message });
            }

            const response = { base, rates };
            if (includeInfo !== false) {
                response.info = await Option.getValue('info', 'ZimRate API - Real-time Zimbabwe exchange rates');
            }

            return RatesController._sendV2Response(res, response, callback);

        } catch (error) {
            logger.error('Error in version2:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: error.message
            });
        }
    }

    /**
     * Answers an unrecognised `currency` with a 422, as Laravel's
     * `exists:rates,rate_currency` rule did. An empty 200 left a client no way to
     * tell a typo from a currency that genuinely has no rates at the moment.
     *
     * Joi has already uppercased the value by the time this runs.
     *
     * @returns {Promise<boolean>} true when a response has been sent
     */
    static async _rejectUnknownCurrency(currency, res) {
        if (!currency) return false;

        const known = await RateService.getKnownCurrencies();
        if (known.includes(currency)) return false;

        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: false,
            message: 'The selected currency is invalid.'
        });
        return true;
    }

    static _sendV2Response(res, response, callback) {
        if (callback) {
            const jsonpResponse = `${callback}(${JSON.stringify(response)})`;
            return res.status(StatusCodes.OK)
                .type('application/javascript')
                .send(jsonpResponse);
        }
        return res.status(StatusCodes.OK).json(response);
    }
}
