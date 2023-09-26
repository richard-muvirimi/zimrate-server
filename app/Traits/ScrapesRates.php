<?php

namespace App\Traits;

use App\Models\Rate;
use Carbon\CarbonInterval;
use DateTime;
use Exception;
use GuzzleHttp\Client;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use NumberFormatter;
use Symfony\Component\CssSelector\CssSelectorConverter;
use Symfony\Component\DomCrawler\Crawler;
use wapmorgan\TimeParser\TimeParser;

trait ScrapesRates
{
    use ConsultsReplicate;

    /**
     * Scrape the rate.
     */
    public function scrape(): void
    {
        $site = Cache::get($this->source_url, '');

        if (empty($site)) {
            $site = $this->getHtmlContent($this);

            Cache::set($this->source_url, $site, CarbonInterval::minutes(30));
        }

        if (Str::of($site)->isNotEmpty()) {
            $this->parseHtml($site, $this);
        }
    }

    /**
     * Get content of given url
     */
    private function getHtmlContent(Rate $theRate): string
    {

        $headers = [
            'Authorization' => 'Bearer ' . env('SCRAPPY_TOKEN'),
        ];

        $body = [
            'url' => $theRate->source_url,
            'format' => 'html',
            'timeout' => env('SCRAPPY_TIMEOUT'),
            'user_agent' => $this->getUserAgent(),
            'css' => 'body',
            'javascript' => $theRate->javascript ? 'true' : 'false',
        ];

        $options = [
            'verify' => false,
        ];

        $client = new Client($options);

        $response = $client->post(env('SCRAPPY_SERVER') . '/scrape', [
            'headers' => $headers,
            'form_params' => $body,
        ]);

        if ($response->getStatusCode() === 200) {

            $content = json_decode($response->getBody(), true);

            if ($content['data'] !== 'false') {
                return "<html lang=\"en-US\"><body>" . $content['data'] . "</body></html>";
            }
        }

        return '';
    }

    /**
     * Get user agent string and cache if possible
     */
    private function getUserAgent(): string
    {
        $agent = Cache::get('user-agent');

        if (!$agent) {
            $agent = env('USER_AGENT');

            $agent = preg_replace('/headless/i', '', $agent);

            Cache::set('user-agent', $agent, CarbonInterval::day());
        }

        return $agent;
    }

    /**
     * Parse given html for required values
     */
    private function parseHtml(string $html, Rate $theRate): void
    {
        try {
            //get html dom
            $crawler = new Crawler();
            $crawler->addHtmlContent($html);

            $converter = new CssSelectorConverter();

            $selector = $theRate->rate_selector;
            if (!$this->isXpath($selector)) {
                $selector = $converter->toXPath($selector);
            }

            $locale = 'en_EN';

            //rate
            $rate = $this->cleanRate($crawler->filterXPath($selector)->text(), $locale);

            if ($rate) {
                $theRate->rate = $rate;

                $selector = $this->rate_updated_at_selector;
                if (!$this->isXpath($selector)) {
                    $selector = $converter->toXPath($selector);
                }

                //date
                $theRate->rate_updated_at = $this->cleanDate($crawler->filterXPath($selector)->text(), $theRate->source_timezone);
                $theRate->status = true;

            } else {
                $theRate->status = false;
            }
        } catch (Exception) {
            $theRate->status = false;
        } finally {
            $theRate->save();
        }
    }

    /**
     * Check if a given text is an xpath
     */
    private function isXpath(string $selector): bool
    {
        return match ($selector) {
            'text', 'comment' => true,
            default => str_starts_with($selector, '//'),
        };
    }

    /**
     * Convert number to an int
     *
     * @throws  Exception
     */
    private function cleanRate(string $value, string $locale): float
    {
        $amount = $this->clean($value);

        /**
         * Remove spaces between numbers
         */
        $amount = preg_replace('/(\d)\s+(\d)/', '$1$2', $amount);

        if (!is_numeric($amount)) {
            $words = explode(' ', $amount);

            //remove non-numeric words
            $numbered = array_filter($words, function ($word) {
                preg_match('/[0-9]/', $word, $matches);

                return count($matches) > 0;
            });

            //join to allow removing non-numeric characters
            $numbers = implode(' ', $numbered);

            $fmt = new NumberFormatter($locale, NumberFormatter::DECIMAL);
            $numbers = $fmt->parse($numbers);

            //split by non-numeric
            $figures = preg_split('/[^0-9,.]/', $numbers, -1, PREG_SPLIT_NO_EMPTY);

            $amount = count($figures) > 0 ? max($figures) : 0;
        }

        /**
         * Normalize the value
         *
         * There could be better ways but the premise here is
         *
         * if value is not within a 30 percentile range then it is invalid
         * Handles cases where it may be in cents
         */
        $max = Rate::query()->where('rate_currency', $this->rate_currency)->enabled()->updated()->max('rate');
        $min = Rate::query()->where('rate_currency', $this->rate_currency)->enabled()->updated()->min('rate');

        if ($min && $max) {
            $amount = floatval($amount);

            if ($amount > ($max * 1.3) || $amount < ($min * 0.7)) {
                $amount /= 100;

                if ($amount > ($max * 1.3) || $amount < ($min * 0.7)) {
                    $amount = 0;
                }
            }
        }

        return $amount;
    }

    /**
     * Remove all html and php tags from given string
     */
    private function clean(string $value): string
    {
        $value = utf8_decode($value);
        $value = strip_tags($value);
        $value = str_replace('&nbsp;', ' ', $value);
        $value = preg_replace('/\s+/', ' ', $value);
        $value = trim($value);

        // $value = strip_tags(trim(html_entity_decode($value), " \t\n\r\0\x0B\xC2\xA0"));

        /**
         * Remove all non-alphanumeric characters except spaces
         */
        $value = implode(' ', array_map(function (string $word): string {
            return trim($word, '-,:;\'"()[]{}<>!?*');
        }, explode(' ', $value)));

        return Str::squish($value);
    }

    /**
     * Parse a date from raw text
     *
     * @throws  Exception
     */
    private function cleanDate(string $value, string $timezone): Carbon
    {
        $rawDate = $this->clean($value);

        /**
         * Try to natural parse the date
         */
        $parser = new TimeParser("english");

        $parsed = $parser->parse($rawDate, true);

        if ($parsed !== false) {
            return Carbon::parse($parsed)->shiftTimezone($timezone);
        }

        /**
         * Bug: php_parse fails when there is no year but time right after month e.g => "19 January 11:22"
         *
         * Hack: wrap time in brackets or some other non-alphanumeric characters :)
         */
        $rawDate = preg_replace('/[0-9]{1,2}:[0-9]{1,2}/', '($0)', $rawDate);

        /**
         * Change back and forward strokes to dashes
         */
        $rawDate = preg_replace('/[\\/]/', '-', $rawDate);

        /**
         * Filter all text not related to dates
         *
         * Method: will only leave text (months) in the form jan or january
         */
        $months = [];
        for ($i = 1; $i <= 12; $i++) {
            $months[] = strtolower(DateTime::createFromFormat('n', $i)->format('M'));
            $months[] = strtolower(DateTime::createFromFormat('n', $i)->format('F'));
        }

        $regex = "/\b(?!(" . implode('|', $months) . '|(\w[0-9][a-z])))(\w*[a-z]+[^\s]*|(\w[^\D\d\w]))/i';

        $rawDate = preg_replace($regex, '', $rawDate);

        /**
         * Remove extra spaces
         */
        $rawDate = Str::squish($rawDate);

        /**
         * Parse the date
         */
        return Carbon::parse($rawDate)->shiftTimezone($timezone);
    }
}
