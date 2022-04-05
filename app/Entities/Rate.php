<?php

namespace App\Entities;

use App\Models\RateModel;
use CodeIgniter\Entity;
use Exception;
use voku\helper\HtmlDomParser;
use Symfony\Component\Panther\Client;
use PhpCss\Ast\Visitor\Xpath;

class Rate extends Entity
{

    /**
     * crawl given site for values
     *
     * @return bool
     */
    public function crawl_site()
    {

        //if enabled and half an hour has passed since last check
        if (intval($this->enabled) === 1 && (abs(time() - $this->last_checked) > (MINUTE * 30) || intval($this->status) !== 1)) {

            /**
             * Get site html file and scan for required fields
             */
            if (!$this->site) {
                $this->get_html_contents();
            }

            if ($this->site) {
                $this->status =  $this->__parse_html($this->site) == true ? 1 : 0;

                //last checked
                $this->last_checked = time();
            } else {
                $this->status = 0;
            }
        }
    }

    /**
     * parse given html for required values
     *
     * @param string $html
     */
    private function __parse_html($html)
    {
        //get html dom
        $dom = HtmlDomParser::str_get_html($html);

        //rate
        $rate = $this->__clean_rate($dom->findOneOrFalse($this->selector));
        if ($rate) {
            $this->rate = $rate;

            $date = $this->__clean_date($dom->findOneOrFalse($this->last_updated_selector)) ?: ($this->rate ? time() : 0);

            //date
            $this->last_updated = $this->__fixDateOffset($date);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Fix date offset
     *
     * @param int $date
     */
    private function __fixDateOffset($date)
    {

        $timezone = $this->timezone;

        return $date - date_offset_get(date_create("now", timezone_open($timezone)));
    }

    /**
     * Convert number to an int
     *
     * @param string $value
     * @return int
     */
    private function __clean_rate($value)
    {

        $amount = $this->__clean($value);

        if (!is_numeric($amount)) {

            $words = explode(" ", $amount);

            //remove non numeric words
            $numbered = array_filter($words, function ($word) {
                preg_match("/[0-9]/", $word, $matches);

                return count($matches) > 0;
            });

            //join to allow removing non numeric characters
            $numbers = implode(" ", $numbered);

            //split by non numeric
            $figures = preg_split("/[^0-9,.]/", $numbers, -1, PREG_SPLIT_NO_EMPTY);

            $amount = count($figures) > 0 ? max($figures) : 0;
        }

        /**
         * Normalize the value
         * 
         * There could be better ways but the premise here is
         * 
         * if value is not within a ten percentaile range then it is invalid
         * Handles cases where it may be in cents
         */
        $rateModel = new RateModel();
        $max =  array_column($rateModel->getByFilter("", $this->currency, "", "MAX", true), "rate");
        $min =  array_column($rateModel->getByFilter("", $this->currency, "", "MIN", true), "rate");

        if ($min && $max) {
            $amount = floatval($amount);

            if ($amount > ($max[0] * 1.3) || $amount < ($min[0] * 0.7)) {

                $amount /= 100;

                if ($amount > ($max[0] * 1.3) || $amount < ($min[0] * 0.7)) {
                    $amount = 0;
                }
            }
        }

        return $amount;
    }

    /**
     * Convert date to a unix time stamp
     *
     * @param string $value
     * @return int
     */
    private function __clean_date($value)
    {

        $raw_date = $this->__clean($value);

        /**
         * bug: php_parse fails when there is no year but time right after month e.g => "19 January 11:22"
         * 
         * hack: wrap time in brackets or some other non alpha-numeric characters :)
         */
        $raw_date = preg_replace("/[0-9]{1,2}:[0-9]{1,2}/", "($0)", $raw_date);

        /**
         * Change back and forward strokes to dashes
         */
        $raw_date = preg_replace("/[\\/]/", "-", $raw_date);

        /**
         * filter all text not related to dates
         * 
         * Method: will only leave text (months) in the form jan or january
         * 
         */
        $months = array();
        for ($i = 1; $i <= 12; $i++) {
            $months[] = strtolower(\DateTime::createFromFormat('n', $i)->format('M'));
            $months[] = strtolower(\DateTime::createFromFormat('n', $i)->format('F'));
        }

        $raw_date = preg_replace("/\b(?!(" . implode("|", $months) . "|(\w[0-9][a-z])))(\w*[a-z]+[^\s]*|(\w[^\D\d\w]))/i", "", $raw_date);

        /**
         * Parse the date
         */
        $date = date_parse($raw_date);

        /**
         * Return parsed date substituting with defaults on none existant parts
         */
        return mktime($date["hour"] ?: 0, $date["minute"] ?: 0, $date["second"] ?: 0, $date["month"] ?: date("n"), $date["day"] ?: date("j"), $date["year"] ?: date("Y"));
    }

    /**
     * Remove all html and php tags from given string
     *
     * @param string|HtmlDomParser $value
     * @return string
     */
    private function __clean($value)
    {

        while (is_a($value, "HtmlDomParser")) {
            $value = $value->innerhtml();
        }

        $value = utf8_decode($value);
        $value = strip_tags($value);
        $value = str_replace("&nbsp;", " ", $value);
        $value = preg_replace('/\s+/', ' ', $value);
        $value = trim($value);

        // $value = strip_tags(trim(html_entity_decode($value), " \t\n\r\0\x0B\xC2\xA0"));

        return implode(" ", array_map(function ($word) {

            return trim($word, "-,");
        }, explode(" ", $value)));
    }

    /**
     * get content of given url
     *
     * @param string $url
     */
    public function get_html_contents()
    {

        if (intval($this->javascript) == 1) {
            if (filter_var(getenv("app.panther"), FILTER_VALIDATE_BOOL)) {
                $this->get_html_content_browser();
            } else {
                #skip

                $this->site = "";
            }
        } else {
            $this->get_html_contents_text();
        }
    }

    /**
     * Parse a site using curl
     * 
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function get_html_contents_text()
    {
        $client = \Config\Services::curlrequest();

        $headers = array(
            "Accept" => "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Charset" => "ISO-8859-1,utf-8;q=0.7,*;q=0.7",
            "Cache-Control" => "max-age=0",
        );

        $tries = 0;

        try {

            do {

                try {

                    $response  = $client->get($this->url, array(
                        'headers' => $headers,
                        'user_agent' => "Zimrate/1.0",
                        'verify' => false,
                        "timeout" => MINUTE * 3
                    ));

                    if ($response->getStatusCode() == 200) {
                        $this->site =  $response->getBody();

                        break;
                    }
                } catch (Exception $e) {
                    //echo $e->getMessage();

                    $this->site = "";
                } finally {
                    $tries++;

                    if ($tries >= 5) {
                        throw $e;
                    }
                }
            } while ($tries < 5);
        } catch (Exception $e) {
            //failed to parse site

            if (filter_var(getenv("app.panther"), FILTER_VALIDATE_BOOL)) {
                //try with panther

                $this->get_html_content_browser();
            } else {
                if ($this->status) { //first time only
                    $this->mail($e->getMessage());
                }
            }
        }
    }

    /**
     * Parse a site using selenium
     * 
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    private function get_html_content_browser()
    {

        //$_SERVER["PANTHER_FIREFOX_BINARY"] = ROOTPATH . "drivers/firefox/firefox-bin";
        //$_SERVER["PANTHER_CHROME_BINARY"] = ROOTPATH . "drivers/chrome-linux/chrome";

        /**
         * @see https://peter.sh/experiments/chromium-command-line-switches/
         */
        $args = array(
            "--no-sandbox", "--disable-gpu", "--incognito", "--window-size=1920,1080", "start-maximized", "--user-agent=" . $this->getUserAgent(), "--headless"
        );

        $options = array(
            "connection_timeout_in_ms" => MINUTE * 1000 * 3,
            "request_timeout_in_ms" => MINUTE * 1000 * 3
        );

        $tries = 0;

        try {

            $client = Client::createChromeClient(null, $args, $options);

            if (str_starts_with($this->selector, "//")) {
                $xpath = $this->selector;
            } else {
                $xpath = \PhpCss::toXpath($this->selector, Xpath::OPTION_USE_CONTEXT_DOCUMENT);
            }

            $crawler = $client->request('GET', $this->url);

            do {

                try {

                    $client->wait(MINUTE);
                    $client->waitForVisibility($xpath, MINUTE * 3);

                    $this->site = $crawler->html();

                    break;
                } catch (\Exception $e) {
                    //echo $e->getMessage();

                    $client->reload();
                } finally {
                    $tries++;
                }
            } while ($tries < 5);
        } catch (\Exception $e) {
            #driver does not exist

            if ($this->status) { //first time only
                $this->mail($e->getMessage());
            }
        } finally {
            if ($client) {
                $client->quit();
            }
        }
    }

    /**
     * Send mail when there is an error parsing a site
     *
     * @since 1.0.0
     * @version 1.0.0
     * @param string $message
     * @return void
     */
    private function mail($message)
    {
        $email = \Config\Services::email();

        $email->setFrom(getenv("email.from"), 'Zimrate Crawler');

        $email->setTo(getenv("email.to"));
        $email->setSubject('Failed to parse site');
        $email->setMessage('Failed to parse ' . $this->url . ' with error message ' . $message);

        $email->send();
    }

    /**
     * Get user agent string and cache if possible
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return string
     */
    private function getUserAgent()
    {

        $agent = cache("user-agent");

        if (!$agent) {
            try {
                $client = Client::createChromeClient();
                $client->request('GET', "chrome://version");

                $agent =  $client->executeScript("return navigator.userAgent;");
            } catch (\Exception $e) {
            } finally {
                if ($client) {
                    $client->quit();
                }
            }

            if (!$agent) {
                $agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36";
            }

            $agent = preg_replace("/headless/i", "", $agent);

            cache()->save("user-agent", $agent);
        }

        return $agent;
    }
}