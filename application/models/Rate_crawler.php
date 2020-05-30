<?php
use voku\helper\HtmlDomParser;

defined('BASEPATH') or exit('No direct script access allowed');

class Rate_crawler extends CI_Model
{

    /**
     * Unique currency source identifier
     *
     * @var integer
     */
    private $__id;

    /**
     * Last connection status
     *
     * @var boolean
     */
    private $__status;

    /**
     * Enabled state
     *
     * @var boolean
     */
    private $__enabled;

    /**
     * Name of currency source
     *
     * @var string
     */
    private $__name;

    /**
     * The url of the site to parse
     *
     * @var string
     */
    private $__url = "";

    /**
     * The page jquery style selector
     *
     * @var string
     */
    private $__selector = "";

    /**
     * The index exchange rate
     *
     * @var integer
     */
    private $__rate = 1;

    /**
     * The date the index was last checked
     *
     * @var integer
     */
    private $__last_checked;

    /**
     * The selector for last updated date
     *
     * @var string
     */
    private $__last_updated_selector = "";

    /**
     * The date the index was last updated
     *
     * @var integer
     */
    private $__last_updated;

    /**
     * The date time zone
     *
     * @var string
     */
    private $__time_zone;

    /**
     * crawl given site for values
     *
     * @return bool
     */
    public function crawl_site()
    {

        $status = false;

        //if enabled and half an hour has passed since last check
        if ($this->get__enabled() && (abs(time() - $this->get__last_checked()) > (60 * 30) || !$this->get__status())) {

            /**
             * Get site html file and scan for required fields
             */
            $site = $this->__get_html_contents($this->get__url());

            if ($site !== false) {
                $this->__parse_html($site);

                //last checked
                $this->set__last_checked(time());

                //status
                $status = $this->get__rate() ? true : false;

            }

        }

        $this->set__status($status);
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
        $this->set__rate($this->__clean_rate($dom->findOneOrFalse($this->get__selector())));

        $date = $this->__clean_date($dom->findOneOrFalse($this->get__last_updated_selector())) ?: ($this->get__rate() ? time() : 0);

        //date
        $this->set__last_updated($this->__fixDateOffset($date));
    }

    /**
     * Fix date offset
     *
     * @param Integer $date
     */
    private function __fixDateOffset($date)
    {

        $timezone = $this->get__time_zone();

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

            $amount = max($figures);
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

        //first trim words by month
        $raw_date = $this->__clean($value);

        $date = strtotime($raw_date, mktime(0, 0, 0));

        if ($date === false) {

            $date = array_filter(explode(" ", $raw_date), function ($value) {

                if (is_numeric($value)) {
                    return true;
                } else {

                    $months = array();
                    for ($i = 1; $i < 13; $i++) {
                        $months[] = strtolower(DateTime::createFromFormat('m', $i)->format('F'));
                    }

                    if (in_array(strtolower($value), $months)) {
                        return true;
                    } else {
                        $months = array_map(function ($value) {
                            return substr($value, 0, 3);
                        }, $months);

                        return in_array($value, $months);
                    }
                }

                return false;
            });

            $date = strtotime(implode(" ", $date), mktime(0, 0, 0));
        }

        return $date;

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
     * @return string|bool
     */
    private function __get_html_contents($url)
    {

        $headers[] = "User-Agent:Zimrate/1.0"; // <-- this is user agent
        $headers[] = "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
        $headers[] = "Accept-Language:en-us,en;q=0.5";
        $headers[] = "Accept-Encoding:gzip,deflate";
        $headers[] = "Accept-Charset:ISO-8859-1,utf-8;q=0.7,*;q=0.7";
        $headers[] = "Keep-Alive:115";
        $headers[] = "Connection:keep-alive";
        $headers[] = "Cache-Control:max-age=0";

        // create curl resource
        $ch = curl_init();

        // set url
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_ENCODING, "gzip");
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

        // $output contains the output string
        $output = curl_exec($ch);

        if (curl_error($ch)) {
            $output = false;
        }

        // close curl resource to free up system resources
        curl_close($ch);

        return $output;
    }

    /**
     * Get unique currency source identifier
     *
     * @return  integer
     */
    public function get__id()
    {
        return $this->__id;
    }

    /**
     * Get last connection status
     *
     * @return  boolean
     */
    public function get__status()
    {
        return $this->__status;
    }

    /**
     * Set last connection status
     *
     * @param  boolean  $__status  Last connection status
     *
     * @return  self
     */
    public function set__status($__status)
    {
        $this->__status = $__status;

        return $this;
    }

    /**
     * Get enabled state
     *
     * @return  boolean
     */
    public function get__enabled()
    {
        return $this->__enabled;
    }

    /**
     * Set enabled state
     *
     * @param  boolean  $__enabled  Enabled state
     *
     * @return  self
     */
    public function set__enabled($__enabled)
    {
        $this->__enabled = $__enabled;

        return $this;
    }

    /**
     * Get name of currency source
     *
     * @return  string
     */
    public function get__name()
    {
        return $this->__name;
    }

    /**
     * Set name of currency source
     *
     * @param  string  $__name  Name of currency source
     *
     * @return  self
     */
    public function set__name(string $__name)
    {
        $this->__name = $__name;

        return $this;
    }

    /**
     * Get the url of the site to parse
     *
     * @return  string
     */
    public function get__url()
    {
        return $this->__url;
    }

    /**
     * Set the url of the site to parse
     *
     * @param  string  $__url  The url of the site to parse
     *
     * @return  self
     */
    public function set__url(string $__url)
    {
        $this->__url = $__url;

        return $this;
    }

    /**
     * Get the page jquery style selector
     *
     * @return  string
     */
    public function get__selector()
    {
        return $this->__selector;
    }

    /**
     * Set the page jquery style selector
     *
     * @param  string  $__selector  The page jquery style selector
     *
     * @return  self
     */
    public function set__selector(string $__selector)
    {
        $this->__selector = $__selector;

        return $this;
    }

    /**
     * Get the index exchange rate
     *
     * @return  integer
     */
    public function get__rate()
    {
        return $this->__rate;
    }

    /**
     * Set the index exchange rate
     *
     * @param  integer  $__rate  The index exchange rate
     *
     * @return  self
     */
    public function set__rate($__rate)
    {
        $this->__rate = $__rate;

        return $this;
    }

    /**
     * Get the date the index was last checked
     *
     * @return  integer
     */
    public function get__last_checked()
    {
        return $this->__last_checked;
    }

    /**
     * Set the date the index was last checked
     *
     * @param  integer  $__last_checked  The date the index was last checked
     *
     * @return  self
     */
    public function set__last_checked($__last_checked)
    {
        $this->__last_checked = $__last_checked;

        return $this;
    }

    /**
     * Get the selector for last updated date
     *
     * @return  string
     */
    public function get__last_updated_selector()
    {
        return $this->__last_updated_selector;
    }

    /**
     * Set the selector for last updated date
     *
     * @param  string  $__last_updated_selector  The selector for last updated date
     *
     * @return  self
     */
    public function set__last_updated_selector(string $__last_updated_selector)
    {
        $this->__last_updated_selector = $__last_updated_selector;

        return $this;
    }

    /**
     * Get the date the index was last updated
     *
     * @return  integer
     */
    public function get__last_updated()
    {
        return $this->__last_updated;
    }

    /**
     * Set the date the index was last updated
     *
     * @param  integer  $__last_updated  The date the index was last updated
     *
     * @return  self
     */
    public function set__last_updated($__last_updated)
    {

        $this->__last_updated = $__last_updated;

        return $this;
    }

    /**
     * Set unique currency source identifier
     *
     * @param  integer  $__id  Unique currency source identifier
     *
     * @return  self
     */
    public function set__id($__id)
    {
        $this->__id = $__id;

        return $this;
    }

    /**
     * Get the date time zone
     *
     * @return  string
     */
    public function get__time_zone()
    {
        return $this->__time_zone;
    }

    /**
     * Set the date time zone
     *
     * @param  string  $__time_zone  The date time zone
     *
     * @return  self
     */
    public function set__time_zone(string $__time_zone)
    {
        $this->__time_zone = $__time_zone;

        return $this;
    }
}
