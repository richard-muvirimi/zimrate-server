import Option from '../models/Option.js';

/**
 * A positive number from settings. Options are stored as strings and edited by
 * hand, so a missing, non-numeric or non-positive value falls back to the
 * default: a typo in settings must not refuse every page or unpublish a rate.
 */
export async function numberSetting(key, fallback) {
    const stored = Number(await Option.getValue(key, fallback));
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
}
