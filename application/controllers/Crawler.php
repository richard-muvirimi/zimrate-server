<?php

defined('BASEPATH') or exit('No direct script access allowed');

class Crawler extends CI_Controller
{

    public function index()
    {

        $this->load->model("Rate_model", "rate");
        $this->load->model("Rate_crawler", "crawler");

        $sites = $this->rate->getAll();

        $cache = array(
            "url" => "",
            "site" => "",
        );

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
                $crawler->set__time_zone($site->timezone);

                //set cache if same site
                $crawler->set__site(($crawler->get__url() === $cache["url"]) ? $cache['site'] : "");

                $crawler->crawl_site();

                //check if successful
                if ($crawler->get__status()) {

                    //set cache
                    $cache["url"] = $crawler->get__url();
                    $cache['site'] = $crawler->get__site();

                    $this->rate->update_rate($crawler->get__id(), $crawler->get__rate(), $crawler->get__last_updated(), $crawler->get__last_checked(), $crawler->get__status());
                } else {
                    $cache["url"] = "";
                }
            }
        }
    }
}