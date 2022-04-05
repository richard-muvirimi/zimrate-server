<?php

namespace App\Controllers;

class Tester extends BaseController
{

    /**
     * Page testing endpoint
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function index()
    {
        $request = \Config\Services::request();

        $site = new \App\Entities\Rate();
        $site->url = $request->getPostGet("site");
        $site->enabled = true;
        $site->status = false; //also prevents mail
        $site->site = false;
        $site->javascript = filter_var(getenv("app.panther"), FILTER_VALIDATE_BOOL);
        $site->selector  = $request->getPostGet("css") ?? "*";

        $site->getHtmlContent();

        if (empty($site->site)) {
            echo "Failed to scan site";
        } else {
            echo $site->site;
        }
    }
}
