<?php

defined('BASEPATH') or exit('No direct script access allowed');

class Crawler extends CI_Controller
{

    public function index()
    {
        $this->load->library("HtmlParser");
        $this->load->model("Rate_model", "rate");
        $this->load->model("Rate_crawler", "crawler");

        $sites = $this->rate->getAll();

        foreach ($sites->result() as $site) {

            if ($site->enabled) {

                $crawler = new Rate_crawler();
                $crawler->set__id($site->id);
                $crawler->set__status($site->status);
                $crawler->set__enabled($site->enabled);
                $crawler->set__name($site->name);
                $crawler->set__url($site->url);
                $crawler->set__selector($site->selector);
                $crawler->set__rate($site->rate);
                $crawler->set__last_checked($site->last_checked);
                $crawler->set__last_updated_selector($site->last_updated_selector);
                $crawler->set__last_updated($site->last_updated);

                $crawler->crawl_site();

                //checl if successful
                if ($crawler->get__status()) {

                    $this->rate->update_rate($crawler->get__id(), $crawler->get__rate(), $crawler->get__last_updated(), $crawler->get__last_checked(), $crawler->get__status());

                }
            }
        }

    }
}
