<?php
namespace App\Controllers;

class Install extends BaseController
{

    /**
     * @return mixed
     */
    public function index()
    {

        $migrate = \Config\Services::migrations();

        try
        {
            $migrate->latest();

            echo 'success';
        } catch (\Throwable $e) {
            // Do something with the error here...

            echo $e->getMessage();
        }

    }

}