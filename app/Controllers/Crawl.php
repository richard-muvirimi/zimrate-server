<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Crawl extends BaseController
{

    /**
     * Initiate site crawling to get rates
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function index()
    {
        $rateModel = new RateModel();

        if (!filter_var(getenv("app.panther"), FILTER_VALIDATE_BOOL)) {
            $rateModel->where('javascript', 0);
        }

        $sites = $rateModel->getAll();

        $cache = array();

        foreach ($sites as $site) {
            if (intval($site->enabled) == 1) {

                //set cache if same site
                $site->site = isset($cache[$site->url]) ? $cache[$site->url] : "";

                $site->crawlSite();

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
