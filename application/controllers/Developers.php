<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Developers extends CI_Controller
{

    public function index()
    {
        $this->load->helper("url");

        $this->lang->load('developers', 'english');
        $this->lang->load('footer', 'english');

        $this->load->model("Rate_model", "rate");

        $currencies = $this->rate->getDisplayCurrencies()->result();

        $data = array(
            "currencies" => array_column($currencies, "currency"),
        );

        $this->load->view('solid/developers.php', $data);
    }
}
