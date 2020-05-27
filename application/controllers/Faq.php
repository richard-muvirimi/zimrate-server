<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Faq extends CI_Controller
{

    public function index()
    {
        $this->load->helper("url");
        $this->lang->load('faq', 'english');
        $this->lang->load('footer', 'english');

        $this->load->view('solid/faq.php');
    }
}
