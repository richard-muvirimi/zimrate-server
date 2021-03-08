<?php

defined('BASEPATH') or exit('No direct script access allowed');

class Tester extends CI_Controller
{

    public function index()
    {
        $this->load->model("Rate_crawler", "crawler");

        $site = $this->crawler->get_html_contents($this->input->get_post("site"));

        if ($site === false) {
            echo "Failed to scan site";
        } else {
            echo $site;
        }
    }
}