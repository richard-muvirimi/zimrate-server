import Decimal from 'decimal.js';
import _ from 'lodash';

/**
 * Every rate calculation the API performs runs through decimal.js rather than
 * JavaScript's binary floats, so a published rate is the figure the arithmetic
 * says it is and not the nearest double to it. Cross-rates are divisions that do
 * not terminate, so a precision still has to be chosen — decimal.js keeps 20
 * significant digits by default and rounds half away from zero, which is what
 * these figures are rounded by everywhere else.
 *
 * Values cross back to plain numbers at the edges only: Firestore, the GraphQL
 * Float, and the React tree all want a number.
 */

/** The arithmetic mean, as a Decimal. NaN on an empty set, as _.meanBy was. */
export const mean = (values) =>
    values.reduce((total, value) => total.plus(value), new Decimal(0)).div(values.length);

/**
 * The middle value, averaging the two middle ones on an even-sized set — what the
 * Laravel `preferred('median')` scope did by feeding an even split back through
 * its MEAN aggregate. Taking the upper-middle value instead skews every even
 * group upward.
 */
export const median = (values) => {
    const sorted = _.sortBy(values);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? mean([sorted[middle - 1], sorted[middle]])
        : new Decimal(sorted[middle]);
};
