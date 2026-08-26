import { StatusCodes } from 'http-status-codes';
import { logger } from 'firebase-functions';
import { RateService } from '../services/RateService.js';
import { rateQuerySchema, v2QuerySchema } from '../validation/schemas.js';
import Option from '../models/Option.js';
import Rate from '../models/Rate.js';
import _ from 'lodash';

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
     * Algorithm (cross-multiplication):
     *   All stored rates are expressed as units of foreign currency per 1 USD.
     *   To express currency X relative to base B:
     *     rate_X_per_B = rate_X_per_USD / rate_B_per_USD
     *
     * Example: ZWG/USD=26, ZAR/USD=18.5
     *   ZWG per ZAR = 26 / 18.5 = 1.405  (1 ZAR buys 1.405 ZWG)
     *
     * Query params: base (required), prefer, currency, callback, info
     */
    static async version2(req, res) {
        try {
            const { error, value } = v2QuerySchema.validate({ ...req.query, ...req.body });
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: error.details.map(d => d.message).join(', ')
                });
            }

            const { base, prefer, currency, callback, info: includeInfo } = value;

            // Fetch all enabled rates (no updated scope so we have a full picture for cross-rates)
            const filters = { enabled: true, applyUpdatedScope: false };
            if (currency) filters.currency = currency;

            let allRates;
            if (prefer) {
                allRates = await Rate.getAggregatedRates(prefer, filters);
            } else {
                allRates = await Rate.findAll(filters);
            }

            // Short-circuit: if base is USD, return rates as-is (USD is the native base)
            if (base === 'USD') {
                const rates = allRates.map(r => r.toAPI());

                const response = { base: 'USD', rates };
                if (includeInfo !== false) {
                    response.info = await Option.getValue('info', 'ZimRate API - Real-time Zimbabwe exchange rates');
                }

                return RatesController._sendV2Response(res, response, callback);
            }

            // Find rate(s) for the requested base currency
            const baseRates = allRates.filter(r => r.rate_currency === base);

            if (baseRates.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: `No rates found for base currency: ${base}`
                });
            }

            // Use mean of base rates if multiple (normalises across different sources)
            const rateUSDPerBase = _.meanBy(baseRates, 'rate');

            if (!rateUSDPerBase || rateUSDPerBase === 0) {
                return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
                    status: false,
                    message: `Base currency rate for ${base} is zero or unavailable`
                });
            }

            // Cross-multiply all rates (exclude the base currency itself from results)
            const rates = allRates
                .filter(r => r.rate_currency !== base)
                .map(r => {
                    if (!r.rate || r.rate === 0) return null;
                    const crossRate = r.rate / rateUSDPerBase;
                    const crossLastRate = r.last_rate ? r.last_rate / rateUSDPerBase : crossRate;
                    const api = r.toAPI();
                    return {
                        ...api,
                        rate: crossRate,
                        last_rate: crossLastRate
                    };
                })
                .filter(Boolean);

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
