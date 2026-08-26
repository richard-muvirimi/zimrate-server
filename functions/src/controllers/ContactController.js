import { StatusCodes } from 'http-status-codes';
import { logger } from 'firebase-functions';
import { contactMessageSchema, smtpConfigSchema, smtpTestSchema } from '../validation/schemas.js';
import {
    getSmtpConfigForClient,
    saveSmtpConfig,
    testSmtpConnection,
    sendContactMessage,
    isContactEnabled,
} from '../services/MailService.js';

export class ContactController {
    /** Public: whether the contact form should be offered at all. */
    static async status(_req, res, next) {
        try {
            res.json({ enabled: await isContactEnabled() });
        } catch (err) {
            next(err);
        }
    }

    /** Public: accept a contact form submission. */
    static async submit(req, res, next) {
        try {
            const { error, value } = contactMessageSchema.validate(req.body);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: error.details.map(d => d.message).join(', '),
                });
            }

            // Honeypot: bots fill hidden fields, humans never see them.
            if (value.website) {
                logger.info('Contact submission rejected by honeypot');
                return res.json({ success: true });
            }

            await sendContactMessage(value);
            res.json({ success: true });
        } catch (err) {
            if (/disabled|recipient|not configured/i.test(err.message)) {
                return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: err.message });
            }
            next(err);
        }
    }

    /** Admin: current SMTP settings, password never included. */
    static async getSettings(_req, res, next) {
        try {
            res.json(await getSmtpConfigForClient());
        } catch (err) {
            next(err);
        }
    }

    /** Admin: update SMTP settings. */
    static async updateSettings(req, res, next) {
        try {
            const { error, value } = smtpConfigSchema.validate(req.body);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: error.details.map(d => d.message).join(', '),
                });
            }

            await saveSmtpConfig(value);
            res.json(await getSmtpConfigForClient());
        } catch (err) {
            next(err);
        }
    }

    /** Admin: verify the SMTP connection, optionally sending a test message. */
    static async testSettings(req, res, _next) {
        try {
            const { error, value } = smtpTestSchema.validate(req.body ?? {});
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: error.details.map(d => d.message).join(', '),
                });
            }

            const result = await testSmtpConnection({ sendTo: value.send_to });
            res.json({ success: true, ...result });
        } catch (err) {
            // A failed connection is a reportable result, not a server fault —
            // the admin needs the SMTP error text to fix their settings.
            logger.warn('SMTP test failed', { message: err.message });
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: err.message,
            });
        }
    }
}
