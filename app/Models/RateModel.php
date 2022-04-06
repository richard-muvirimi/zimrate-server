<?php

namespace App\Models;

use App\Entities\Rate;
use CodeIgniter\Model;
use Exception;

class RateModel extends Model
{
    protected $table         = 'zimrate';
    protected $allowedFields = [
        'status', 'enabled', 'javascript','name', 'currency', 'url', 'selector', 'rate', "last_checked", "last_updated_selector", "last_updated", "timezone"
    ];
    protected $returnType    = 'App\Entities\Rate';
    protected $useTimestamps = false;
    protected $dateFormat = 'int';

    /**
     * get all records
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return array
     */
    public function getAll()
    {
        $this->orderBy('url');
        return $this->findAll();
    }

    /**
     * Get rows matching provided filters
     *
     * @since 1.0.0
     * @version 1.0.0
     * @param string $source
     * @param string $currency
     * @param integer $date
     * @param string $prefer
     * @param bool $enabled
     * @return array
     */
    public function getByFilter(string $source, string $currency, string $date, string $prefer, bool $enabled = false)
    {
        $columns = array(
            "currency",
            "rate",
            "last_checked",
            "last_updated",
        );

        if (in_array($prefer, array("min", "max", "mean"))) {
            $this->groupBy("currency");
        } else {
            $columns[] = "name";
            $columns[] = "url";
        }

        sort($columns);

        $this->select($columns);

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

        if ($enabled) {
            $this->where('enabled', 1);
        }

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere(array(
            "status" => 0,
            "last_updated >" => time() - WEEK
        ));

        $this->groupEnd();

        $this->orderBy('currency', 'ASC');

        $rates = array();

        switch ($prefer) {
            case "max":
                $this->selectMax('rate');
                $rates =    $this->findAll();
                break;
            case "min":
                $this->selectMin('rate');
                $rates =   $this->findAll();
                break;
            case "mean":
                $this->selectAvg('rate');
                $rates =   $this->findAll();
                break;
            default:
                $rates = $this->groupRates($prefer);
        }

        return   $rates;
    }

    /**
     * Get list of supported prefers
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return array
     */
    public function supportedPrefers()
    {
        return array("min", "max", "mean", "median", "random", "mode");
    }

    /**
     * Apply addtional grouping on rates not natively supported by the database
     *
     * @since 1.0.0
     * @version 1.0.0
     * @param string $prefer
     * @return array
     */
    private function groupRates(string $prefer)
    {
        $__rates = $this->findAll();

        $_rates = array();

        //group by currency
        foreach ($__rates as $rate) {
            $currency = $rate->currency;

            $_rates[$currency]["rate"][] = $rate->rate;
            $_rates[$currency]["last_checked"][] = $rate->last_checked;
            $_rates[$currency]["last_updated"][] = $rate->last_updated;
        }

        $rates = array();

        //compile groupings
        foreach ($_rates as $currency => $rate) {
            switch ($prefer) {
                case "median":
                    sort($rate["rate"]);

                    $count = count($rate["rate"]);

                    if ($count % 2 == 0) {
                        //even get central average

                        $lower = ($count / 2);
                        $upper = $lower + 1;

                        $_rate = ($rate["rate"][$upper - 1] + $rate["rate"][$lower - 1]) / 2;
                    } else {
                        //odd get central
                        $_rate = $rate["rate"][ceil($count / 2) - 1];
                    }

                    $rates[] = array(
                        "currency" => $currency,
                        "last_checked" => max($rate["last_checked"]),
                        "last_updated" => min($rate["last_updated"]),
                        "rate" => $_rate,
                    );
                    break;
                case "mode":
                    $occurs = array();

                    foreach ($rate["rate"] as $_rate) {
                        $occurs[strval($_rate)] = (isset($occurs[$_rate]) ? $occurs[$_rate] : 0)  + 1;
                    }

                    $_rate = floatval(array_search(max($occurs), $occurs));

                    $position = array_search($_rate, $rate["rate"]);

                    $rates[] = array(
                        "currency" => $currency,
                        "last_checked" => $rate["last_checked"][$position],
                        "last_updated" => $rate["last_updated"][$position],
                        "rate" => $_rate,
                    );
                    break;
                case "random":
                    $position = array_rand($rate["rate"]);

                    $_rate = $rate["rate"][$position];

                    $rates[] = array(
                        "currency" => $currency,
                        "last_checked" => $rate["last_checked"][$position],
                        "last_updated" => $rate["last_updated"][$position],
                        "rate" => $_rate,
                    );
                    break;
                default:
                    //all
                    $rates = $__rates;
                    break;
            }
        }

        return $rates;
    }

    /**
     * get list of all available currencies
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return array
     */
    public function getCurrencies()
    {
        $this->distinct();
        $this->select("currency");
        $this->where('enabled', 1);

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere(array(
            "status" => 0,
            "last_updated >" => time() - WEEK
        ));

        $this->groupEnd();

        return $this->findAll();
    }

    /**
     * Get last modified date
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return string
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
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return array
     */
    public function getDisplayCurrencies()
    {
        $this->select("currency");
        $this->selectAvg('rate', "mean");
        $this->selectMax('rate', "max");
        $this->selectMin('rate', "min");
        $this->select("last_checked");

        $this->where('enabled', 1);

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere(array(
            "status" => 0,
            "last_updated >" => time() - WEEK
        ));

        $this->groupEnd();

        $this->groupBy("currency");
        $this->orderBy('COUNT(DISTINCT url)', 'DESC');

        return $this->findAll();
    }

    /**
     * Get the sources of currency
     *
     * @since 1.0.0
     * @version 1.0.0
     * @param string $currency
     * @return array
     */
    public function getCurrencySources(string $currency)
    {
        $this->distinct();
        $this->select("url");

        $this->where('currency', $currency);
        $this->where('enabled', 1);

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere(array(
            "status" => 0,
            "last_updated >" => time() - WEEK
        ));

        $this->groupEnd();

        return $this->findAll();
    }
}