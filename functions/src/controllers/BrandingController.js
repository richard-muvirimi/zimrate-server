import { StatusCodes } from 'http-status-codes';
import { brandingSchema } from '../validation/schemas.js';
import { getBranding, saveBranding, publicBranding } from '../services/BrandingService.js';

function bucketName() {
    // Set automatically in the Cloud Functions runtime; falls back to the
    // conventional bucket for local runs.
    return process.env.STORAGE_BUCKET
        || `${process.env.GCLOUD_PROJECT || 'my-rate-calculator'}.firebasestorage.app`;
}

export class BrandingController {
    /** Public: app name and asset URLs for the site header, title and favicon. */
    static async publicGet(_req, res, next) {
        try {
            const branding = await getBranding();
            // Small and rarely changing — let the CDN and browser hold it.
            res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
            res.json(publicBranding(branding, bucketName()));
        } catch (err) {
            next(err);
        }
    }

    /** Admin: full record plus the bucket the images live in. */
    static async get(_req, res, next) {
        try {
            const branding = await getBranding();
            res.json({ ...branding, bucket: bucketName() });
        } catch (err) {
            next(err);
        }
    }

    /** Admin: update name, tagline and contact details. */
    static async update(req, res, next) {
        try {
            const { error, value } = brandingSchema.validate(req.body);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: error.details.map(d => d.message).join(', '),
                });
            }

            await saveBranding(value);
            const branding = await getBranding();
            res.json({ ...branding, bucket: bucketName() });
        } catch (err) {
            next(err);
        }
    }
}
