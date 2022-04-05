<?php

namespace App\Controllers;

class Install extends BaseController
{

    /**
     * Install application endpoint
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function index()
    {
        $migrate = \Config\Services::migrations();

        try {
            $migrate->latest();

            echo 'success';
        } catch (\Throwable $e) {
            // Do something with the error here...

            echo $e->getMessage();
        }
    }
}
