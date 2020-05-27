<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Welcome extends CI_Controller
{

    public function index()
    {
        $this->load->helper("url");
        $this->load->model("Rate_model", "rate");

        $this->lang->load('site', 'english');
        $this->lang->load('footer', 'english');

        $last_checked = $this->rate->getLastChecked()->result();
        $currencies = $this->rate->getDisplayCurrencies()->result();

        $data = array(
            "last_checked" => gmdate("r", $last_checked[0]->last_checked),
            "currencies" => $currencies,
        );

        //https://cruip.com/demos/solid/
        $this->load->view('solid/index.php', $data);
    }
}
