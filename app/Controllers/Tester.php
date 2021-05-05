<?php

namespace App\Controllers;

class Tester extends BaseController
{

    public function index()
    {

        $request = \Config\Services::request();

        $site = new \App\Entities\Rate();
        $site->url = $request->getPostGet("site");
        $site->enabled = true;
        $site->status = false;

        $site->get_html_contents();

        if (empty($site->site)) {
            echo "Failed to scan site";
        } else {
            echo $site->site;
        }
    }
}
