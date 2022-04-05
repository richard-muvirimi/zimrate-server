<?php

namespace App\Controllers;

use \App\Models\RateModel;
use CodeIgniter\API\ResponseTrait;
use CodeIgniter\HTTP\Exceptions\HTTPException;

class Api extends BaseController
{

    use ResponseTrait;

    public function index()
    {
        return $this->response->setJSON($this->_getData());
    }

    public function v1()
    {

        $response["USD"] = $this->_getData();

        $request = \Config\Services::request();

        if (filter_var($request->getPostGet("info") ?: true, FILTER_VALIDATE_BOOLEAN)) {
            $response["info"] = strip_tags(file_get_contents(FCPATH . "public" . DIRECTORY_SEPARATOR . "misc" . DIRECTORY_SEPARATOR . "notice.txt"));
        }

        $json = json_encode($response);

        $callback = $request->getPostGet("callback");
        if ($callback) {
            $this->response->setContentType("application/javascript");

            return $this->respond($callback . "(" . $json . ");");
        } else {

            if (filter_var($request->getPostGet("cors"), FILTER_VALIDATE_BOOLEAN)) {
                $this->response->setHeader('Access-Control-Allow-Origin', '*');
            }

            return $this->response->setJSON($json);
        }
    }

    private function _getData()
    {

        $rateModel = new RateModel();

        $this->__logVisit();

        $source = $this->__normaliseName();
        $currency = $this->__normaliseCurrency();
        $date = $this->__normaliseDate();
        $prefer = $this->__normalisePrefer();

        return $rateModel->getByFilter($source, $currency, $date, $prefer, true);
    }

    private function __logVisit()
    {

        if (getenv("app.google.analytics")) {

            ob_start();

            try {

                $request = \Config\Services::request();

                $client = \Config\Services::curlrequest();

                $data = array(
                    "v" => 1, // Version.
                    "tid" => getenv("app.google.analytics"), // Tracking ID / Property ID.
                    "dh" => base_url(), // Document hostname.
                    "cid" => $request->getIPAddress(), // Anonymous Client ID.
                    "t" => "pageview", // Hit Type.
                    "dp" => "api", // Page.
                );

                $client->post("https://www.google-analytics.com/collect", array(
                    'user_agent' => $request->getUserAgent()->getAgentString() ?: "Zimrate/1.0",
                    "form_params" => $data,
                    'verify' => false
                ));
            } catch (HTTPException $e) {
            }

            ob_clean();
        }
    }

    /**
     * Normalise search term
     *
     * @return string
     */
    private function __normaliseName()
    {

        $request = \Config\Services::request();

        //if source fails try name
        $name = $request->getPostGet("source") ?: $request->getPostGet("name");

        //allow only alpha numeric text
        return preg_match('/^[a-zA-Z0-9 ]+$/', $name) == 1 ? $name : "";
    }

    /**
     * Normalise currency
     * 
     * @return string
     */
    private function __normaliseCurrency()
    {

        $request = \Config\Services::request();
        $rateModel = new RateModel();

        $currency = strtoupper($request->getPostGet("currency"));

        $currencies = $rateModel->getCurrencies();

        return in_array($currency, array_column($currencies, "currency")) ? $currency : "";
    }

    /**
     * Normalise given date
     *
     * @return string
     */
    private function __normaliseDate()
    {

        $request = \Config\Services::request();

        $date = $request->getPostGet("date");
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

        $request = \Config\Services::request();
        $rateModel = new RateModel();

        $prefer = strtolower($request->getPostGet("prefer"));

        //value to get
        if (!in_array(strtolower($prefer), $rateModel->supportedPrefers())) {
            $prefer = "";
        }

        return $prefer;
    }
}