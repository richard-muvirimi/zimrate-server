<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Crawl extends BaseController
{

    public function index()
    {

        $rateModel = new RateModel();

        $sites = $rateModel->getAll();

        $cache = array(
            "url" => "",
            "site" => "",
        );

        foreach ($sites as $site) {

            if (intval($site->enabled) === 1) {

                //set cache if same site
                $site->site = $site->url === $cache["url"] ? $cache['site'] : "";

                $site->crawl_site();

                //check if successful
                if (intval($site->status) === 1) {

                    //set cache
                    $cache["url"] = $site->url;
                    $cache['site'] = $site->site;

                    try {
                        $rateModel->save($site);
                    } catch (\CodeIgniter\Database\Exceptions\DataException $e) {
                    }
                } else {
                    $cache["url"] = "";
                }
            }
        }
    }
}
