<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Crawl extends BaseController
{

    public function index()
    {

        $rateModel = new RateModel();

        $sites = $rateModel->getAll();

        $cache = array();

        foreach ($sites as $site) {

            if (intval($site->enabled) == 1) {

                //set cache if same site
                $site->site = isset($cache[$site->url]) ? $cache[$site->url] : "";

                $site->crawl_site();

                //set cache
                $cache[$site->url] =  $site->site;

                try {
                    $rateModel->save($site);
                } catch (\CodeIgniter\Database\Exceptions\DataException $e) {
                }
            }
        }
    }
}