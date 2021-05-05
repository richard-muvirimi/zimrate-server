<?php

namespace App\Models;

use App\Entities\Rate;
use CodeIgniter\Model;

class RateModel extends Model
{
    protected $table         = 'zimrate';
    protected $allowedFields = [
        'status', 'enabled', 'name', 'currency', 'url', 'selector', 'rate', "last_checked", "last_updated_selector", "last_updated", "timezone"
    ];
    protected $returnType    = 'App\Entities\Rate';
    protected $useTimestamps = false;
    protected $dateFormat = 'int';

    /**
     * get all records
     */
    public function getAll()
    {
        $this->orderBy('url');
        return $this->findAll();
    }

    /**
     * Get rows matching provided filters
     *
     * @param string $source
     * @param string $currency
     * @param integer $date
     * @param string $prefer
     */
    public function getByFilter($source, $currency, $date, $prefer, $enabled = false)
    {

        $columns = array(
            "currency",
            "rate",
            "last_checked",
            "last_updated",
        );

        if (strlen($prefer) == 0) {
            $columns[] = "name";
            $columns[] = "url";
        } else {
            $this->groupBy("currency");
        }

        sort($columns);

        $this->select($columns);

        //value to get
        switch ($prefer) {
            case "max":
                $this->selectMax('rate');
                break;
            case "min";
                $this->selectMin('rate');
                break;
            case "mean":
                $this->selectAvg('rate');
                break;
            default:
                //all
                break;
        }

        //source name
        if (strlen($source) != 0) {
            $this->like('name', $source);
        }

        //currency name
        if (strlen($currency) != 0) {
            $this->where('currency', $currency);
        }

        //
        if (strlen($date) != 0) {
            $this->where('last_updated >', $date);
        }

        $this->where('status', 1);

        if ($enabled) {
            $this->where('enabled', 1);
        }

        $this->orderBy('currency', 'ASC');

        return $this->findAll();
    }

    /**
     * get list of all available currencies
     */
    public function getCurrencies()
    {

        $this->distinct();
        $this->select("currency");
        $this->where('enabled', 1);
        $this->where('status', 1);

        return $this->findAll();
    }

    /**
     * Get last modified date
     */
    public function getLastChecked()
    {

        $this->select("last_checked");
        $this->limit(1);
        $this->orderBy('last_checked', 'DESC');

        return $this->first()->{"last_checked"};
    }

    /**
     * get list of all available currencies
     */
    public function getDisplayCurrencies()
    {

        $this->select("currency");
        $this->selectAvg('rate', "mean");
        $this->selectMax('rate', "max");
        $this->selectMin('rate', "min");

        $this->where('status', 1);
        $this->where('enabled', 1);

        $this->groupBy("currency");
        $this->orderBy('COUNT(DISTINCT url)', 'DESC');

        return $this->findAll();
    }

    /**
     * Get the sources of currency
     *
     * @param string $currency
     */
    public function getCurrencySources($currency)
    {
        $this->distinct();
        $this->select("url");

        $this->where('currency', $currency);
        $this->where('status', 1);
        $this->where('enabled', 1);

        return $this->findAll();
    }
}
