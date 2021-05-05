<?php

namespace App\Entities;

use CodeIgniter\Entity;
use voku\helper\HtmlDomParser;

class Rate extends Entity
{

    /**
     * crawl given site for values
     *
     * @return bool
     */
    public function crawl_site()
    {

        $status = false;

        //if enabled and half an hour has passed since last check
        if (intval($this->enabled) === 1 && (abs(time() - $this->last_checked) > (60 * 30) || intval($this->status) !== 1)) {

            /**
             * Get site html file and scan for required fields
             */
            if (empty($this->site)) {
                $this->get_html_contents();
            }

            if ($this->site !== false) {
                $this->__parse_html($this->site);

                //last checked
                $this->last_checked = time();

                //status
                $status = is_numeric($this->rate) ? 1 : 0;
            }
        }

        $this->status = $status;
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
        $this->rate = $this->__clean_rate($dom->findOneOrFalse($this->selector));

        $date = $this->__clean_date($dom->findOneOrFalse($this->last_updated_selector)) ?: ($this->rate ? time() : 0);

        //date
        $this->last_updated = $this->__fixDateOffset($date);
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

        if (is_a($value, "HtmlDomParser")) {
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

        $client = \Config\Services::curlrequest();

        $headers = array(
            "Accept" => "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language" => "en-us,en;q=0.5",
            "Accept-Charset" => "ISO-8859-1,utf-8;q=0.7,*;q=0.7",
            "Keep-Alive" => "115",
            "Connection" => "keep-alive",
            "Cache-Control" => "max-age=0",
        );

        $response  = $client->get($this->url, array(
            'headers' => $headers,
            'user_agent' => "Zimrate/1.0",
            'verify' => false
        ));

        $this->site = ($response->getStatusCode() < 400) ? $this->site = $response->getBody() : false;
    }
}
