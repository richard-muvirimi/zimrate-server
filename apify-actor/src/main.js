import { Actor } from 'apify';
import { chromium } from 'playwright';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const { url, javascript = false } = input ?? {};

if (!url) {
    console.error('No URL provided in input');
    await Actor.exit({ exit: Actor.ExitCodes.ERROR_USER_FUNCTION_THREW });
}

console.log(`Fetching: ${url} (javascript=${javascript})`);

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'DNT': '1',
};

let text = '';

if (javascript) {
    // ── Raw Playwright (no crawlee overhead — much lighter on memory) ──────────
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
            ],
        });

        const context = await browser.newContext({ extraHTTPHeaders: HEADERS });
        const page = await context.newPage();
        page.setDefaultTimeout(45_000);
        page.setDefaultNavigationTimeout(45_000);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

        // Give JS a moment to render, but don't wait forever
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Remove noise elements
        await page.evaluate(() => {
            ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe', 'svg']
                .forEach(tag => document.querySelectorAll(tag).forEach(el => el.remove()));
        });

        text = await page.evaluate(() =>
            (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim()
        );

        await context.close();
    } finally {
        if (browser) await browser.close().catch(() => {});
    }

} else {
    // ── Cheerio (static pages — fast and cheap) ──────────────────────────────
    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: 1,
        navigationTimeoutSecs: 30,
        requestHandlerTimeoutSecs: 55,
        additionalMimeTypes: ['application/xhtml+xml'],
        requestHandler: async ({ $ }) => {
            $('script, style, noscript, nav, footer, header, aside, iframe, svg').remove();

            const lines = [];
            $('body *').each((_, el) => {
                const node = $(el);
                if (node.children().length === 0 || node.children('br').length > 0) {
                    const t = node.text().trim();
                    if (t.length > 0) lines.push(t);
                }
            });

            text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            if (!text) text = $('body').text().replace(/\s+/g, ' ').trim();
        }
    });

    await crawler.run([url]);
}

if (!text) console.warn('No text extracted from page');
console.log(`Extracted ${text.length} characters`);

await Actor.pushData({ url, markdown: text, text, javascript });
await Actor.exit();
