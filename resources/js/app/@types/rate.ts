export default interface Rate {
    rate: number,
    last_rate: number,
    domain: string,
    currency: string,
    currency_base: string,
    last_checked: number,
    last_updated: number,
    url: string
}
