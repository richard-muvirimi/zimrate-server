<?php
use TheIconic\Tracking\GoogleAnalytics\Analytics;

defined('BASEPATH') or exit('No direct script access allowed');

class Api extends CI_Controller
{

    public function index()
    {

        $this->load->library("PhpGoogleAnalytics");
        $this->load->model("Rate_model", "rate");

        $source = $this->__normaliseName();
        $currency = $this->__normaliseCurrency();
        $date = $this->__normaliseDate();
        $prefer = $this->__normalisePrefer();

        $sites = $this->rate->getByFilter($source, $currency, $date, $prefer);

        echo json_encode($sites->result());

        $this->__logVisit();
    }

    private function __getIpAddress()
    {
        return filter_var($_SERVER['REMOTE_ADDR'], FILTER_VALIDATE_IP);
    }

    private function __logVisit()
    {

        // Instantiate the Analytics object
        // optionally pass TRUE in the constructor if you want to connect using HTTPS
        $analytics = new Analytics(true);

        // Build the GA hit using the Analytics class methods
        // they should Autocomplete if you use a PHP IDE
        $analytics
            ->setProtocolVersion('1')
            ->setTrackingId('UA-67829308-8')
            ->setClientId('12')
            ->setDocumentPath('/api')
            ->setIpOverride($this->__getIpAddress());

        // When you finish bulding the payload send a hit (such as an pageview or event)
        $analytics
            ->setAsyncRequest(true)
            ->sendPageview();
    }

    private function __normaliseName()
    {

        $source = $this->input->get("source");
        $name = $this->input->get("name");

        //if source fails try name
        return strip_tags($source ?: ($name ?: ""));
    }

    /**
     * Normalise currency
     */
    private function __normaliseCurrency()
    {
        $currency = strtoupper($this->input->get("currency"));

        $currencies = $this->rate->getCurrencies();

        return in_array($currency, array_column($currencies->result_array(), "currency")) ? $currency : "";

    }

    /**
     * Normalise given date
     *
     * @return string
     */
    private function __normaliseDate()
    {

        $date = $this->input->get("date");
        if (!is_numeric($date)) {
            $date = "";
        }

        return $date;
    }

    /**
     * Normalise preferred return value
     *
     * @return string
     */
    private function __normalisePrefer()
    {

        $prefer = strtolower($this->input->get("prefer"));

        //value to get
        switch ($prefer) {
            case "max":
            case "min";
            case "mean":
                break;
            default:
                $prefer = "";
        }

        return $prefer;
    }
}