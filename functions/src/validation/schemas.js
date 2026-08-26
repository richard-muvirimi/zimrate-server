import Joi from 'joi';
import { DateTime } from 'luxon';

// Custom boolean validation
const booleanString = Joi.string().custom((value, helpers) => {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1') return true;
    if (lowerValue === 'false' || lowerValue === '0') return false;
    return helpers.error('any.invalid');
});

const isBoolean = Joi.alternatives().try(
    Joi.boolean(),
    booleanString
);

export const rateQuerySchema = Joi.object({
    search: Joi.string().optional(),
    name: Joi.string().optional(),
    source: Joi.string().optional(), // deprecated
    date: Joi.number().integer().max(DateTime.now().toUnixInteger()).optional(),
    currency: Joi.string().uppercase().optional(),
    prefer: Joi.string().valid('min', 'max', 'mean', 'median', 'random', 'mode', 'MIN', 'MAX', 'MEAN', 'MEDIAN', 'RANDOM', 'MODE').optional(),
    callback: Joi.string().optional(),
    extra: isBoolean.optional(),
    info: isBoolean.optional()
}).custom((value, helpers) => {
    // Ensure search, name, and source are mutually exclusive
    const exclusiveFields = ['search', 'name', 'source'].filter(field => value[field] !== undefined);
    if (exclusiveFields.length > 1) {
        return helpers.error('object.conflict', {
            message: 'search, name, and source fields are mutually exclusive'
        });
    }
    return value;
});

export const graphqlRateQuerySchema = Joi.object({
    search: Joi.string().optional(),
    date: Joi.number().integer().max(DateTime.now().toUnixInteger()).optional(),
    currency: Joi.string().uppercase().optional(),
    prefer: Joi.string().valid('min', 'max', 'mean', 'median', 'random', 'mode').optional()
});

export const v2QuerySchema = Joi.object({
    base: Joi.string().uppercase().required(),
    prefer: Joi.string().valid('min', 'max', 'mean', 'median', 'random', 'mode', 'MIN', 'MAX', 'MEAN', 'MEDIAN', 'RANDOM', 'MODE').optional(),
    currency: Joi.string().uppercase().optional(),
    callback: Joi.string().optional(),
    info: isBoolean.optional()
});

// ── Contact form + SMTP settings ──────────────────────────────────────────────

export const contactMessageSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().email({ minDomainSegments: 2 }).max(254).required(),
    subject: Joi.string().trim().min(3).max(150).required(),
    message: Joi.string().trim().min(10).max(5000).required(),
    // Honeypot — must stay empty. Named innocuously so bots fill it in.
    website: Joi.string().allow('').optional()
});

export const smtpConfigSchema = Joi.object({
    host: Joi.string().trim().hostname().allow('').optional(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    secure: Joi.boolean().optional(),
    username: Joi.string().trim().allow('').max(254).optional(),
    // Omitted or empty means "keep the stored password".
    password: Joi.string().allow('').max(512).optional(),
    from_name: Joi.string().trim().allow('').max(100).optional(),
    from_email: Joi.string().trim().email({ minDomainSegments: 2 }).allow('').optional(),
    recipient: Joi.string().trim().email({ minDomainSegments: 2 }).allow('').optional(),
    enabled: Joi.boolean().optional()
});

export const smtpTestSchema = Joi.object({
    send_to: Joi.string().trim().email({ minDomainSegments: 2 }).optional()
});

// ── Branding ──────────────────────────────────────────────────────────────────

export const brandingSchema = Joi.object({
    app_name: Joi.string().trim().min(1).max(60).optional(),
    tagline: Joi.string().trim().allow('').max(160).optional(),
    author_name: Joi.string().trim().allow('').max(80).optional(),
    author_email: Joi.string().trim().email({ minDomainSegments: 2 }).allow('').optional(),
    author_url: Joi.string().trim().uri({ scheme: ['http', 'https'] }).allow('').optional(),
    // Version counters are owned server-side; the client only asks for a bump.
    bump_icon: Joi.boolean().optional(),
    bump_og: Joi.boolean().optional()
});
