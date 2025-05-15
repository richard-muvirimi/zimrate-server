import Rate from './rate';

export default interface RateAggregate {
    currency: string;
    currency_base: string;
    rates: Rate[];
    minRate: Rate;
    maxRate: Rate;
    urls: URL[];
    last_checked: number;
    last_updated: number;
    aggregated: {
        max: string;
        mean: string;
        min: string;
        median: string;
        mode: string;
        random: string;
    };
    expanded: boolean;
}
