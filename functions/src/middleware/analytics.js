import crypto from 'crypto';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/**
 * Express middleware that logs each API request to GA4 via the Measurement Protocol.
 * Mirrors the legacy Laravel LogApiAnalytics middleware.
 * Fires and forgets — never delays or fails the request.
 */
export const logAnalytics = (req, res, next) => {
    const measurementId = process.env.MEASUREMENT_ID;
    const apiSecret = process.env.MEASUREMENT_PROTOCOL_API_SECRET;

    if (measurementId && apiSecret) {
        const ip = req.ip || req.headers['x-forwarded-for'] || '';
        const userAgent = req.headers['user-agent'] || 'Zimrate/1.0';
        const sessionId = crypto.createHash('md5').update(ip + userAgent).digest('hex');

        const payload = {
            client_id: ip || sessionId,
            user_id: sessionId,
            events: [
                {
                    name: 'api_request',
                    params: {
                        session_id: sessionId,
                        engagement_time_msec: '100',
                    }
                },
                {
                    name: 'page_view',
                    params: {
                        page_location: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
                        page_title: req.path,
                        language: req.acceptsLanguages()[0] || 'en',
                    }
                }
            ]
        };

        fetch(`${GA4_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }).catch(() => {}); // fire and forget — never block the request
    }

    next();
};
