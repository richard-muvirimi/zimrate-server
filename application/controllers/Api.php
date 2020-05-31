<?php

defined('BASEPATH') or exit('No direct script access allowed');

class Api extends CI_Controller
{

    public function index()
    {

        $this->load->helper('url');
        $this->load->model("Rate_model", "rate");

        $this->__logVisit();

        $source = $this->__normaliseName();
        $currency = $this->__normaliseCurrency();
        $date = $this->__normaliseDate();
        $prefer = $this->__normalisePrefer();

        $sites = $this->rate->getByFilter($source, $currency, $date, $prefer);

        header('Content-type: application/json');

        echo json_encode($sites->result());

    }

    private function __logVisit()
    {

        ob_start();

        $data = array(
            "v" => 1, // Version.
             "tid" => "UA-67829308-8", // Tracking ID / Property ID.
             "dh" => base_url(), // Document hostname.
             "cid" => $this->input->ip_address(), // Anonymous Client ID.
             "t" => "pageview", // Hit Type.
             "dp" => "api", // Page.
        );

        $headers[] = $this->input->user_agent() ?: "User-Agent:Zimrate/1.0";

        // create curl resource
        $ch = curl_init();

        // set url
        curl_setopt($ch, CURLOPT_URL, "https://www.google-analytics.com/collect");
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        // $output contains the output string
        curl_exec($ch);

        // close curl resource to free up system resources
        curl_close($ch);

        ob_clean();
    }

    private function __normaliseName()
    {

        $source = $this->input->get_post("source");
        $name = $this->input->get_post("name");

        //if source fails try name
        return strip_tags($source ?: ($name ?: ""));
    }

    /**
     * Normalise currency
     */
    private function __normaliseCurrency()
    {
        $currency = strtoupper($this->input->get_post("currency"));

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

        $date = $this->input->get_post("date");
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

        $prefer = strtolower($this->input->get_post("prefer"));

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