<?php

defined('BASEPATH') or exit('No direct script access allowed');

class Rate_model extends CI_Model
{

    public function __construct()
    {
        $this->load->database();

        $this->install();
    }

    /**
     * create table for storing rates
     */
    public function install()
    {
        $this->load->dbforge();

        $fields = array(
            'id' => array(
                'type' => 'INT',
                'null' => false,
                'auto_increment' => true,
            ),
            'status' => array(
                'type' => 'BOOLEAN',
            ),
            'enabled' => array(
                'type' => 'BOOLEAN',
            ),
            'name' => array(
                'type' => 'TEXT',
            ),
            'currency' => array(
                'type' => 'TEXT',
            ),
            'url' => array(
                'type' => 'TEXT',
            ),
            'selector' => array(
                'type' => 'TEXT',
            ),
            'rate' => array(
                'type' => 'FLOAT',
            ),
            'last_checked' => array(
                'type' => 'INT',
            ),
            'last_updated_selector' => array(
                'type' => 'TEXT',
            ),
            'last_updated' => array(
                'type' => 'INT',
            ),
            'timezone' => array(
                'type' => 'TEXT',
            ),
        );
        $this->dbforge->add_field($fields);
        $this->dbforge->add_key('id', true);
        $this->dbforge->create_table("zimrate", true);
    }

    /**
     * get all records
     */
    public function getAll()
    {
        $this->db->select("*");

        return $this->db->get("zimrate");
    }

    /**
     * get specific record
     *
     * @param int $id
     */
    public function get($id)
    {
        $this->db->select("*");
        $this->db->where("`zimrate`.`id`", $id);

        return $this->db->get("zimrate");
    }

    /**
     * Set found rate
     *
     * @param int $id
     * @param float $rate
     * @param int $date
     * @param int $checked
     */
    public function update_rate($id, $rate, $date, $checked, $status)
    {

        $data = array(
            'rate' => $rate,
            'last_updated' => $date,
            'last_checked' => $checked,
            "status" => $status,
        );

        $this->db->where('id', $id);
        $this->db->update("zimrate", $data);
    }

    /**
     * update specified record
     *
     * @param int $id
     * @param array $data
     */
    public function update($id, $data)
    {

        $this->db->where('id', $id);
        $this->db->update("zimrate", $data);
    }

    /**
     * Get rows matching provided filters
     *
     * @param string $source
     * @param string $currency
     * @param integer $date
     * @param string $prefer
     */
    public function getByFilter($source, $currency, $date, $prefer)
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
            $this->db->group_by("currency");
        }

        sort($columns);

        $this->db->select($columns);

        //value to get
        switch ($prefer) {
            case "max":
                $this->db->select_max('rate');
                break;
            case "min";
                $this->db->select_min('rate');
                break;
            case "mean":
                $this->db->select_avg('rate');
                break;
            default:
                //all
                break;
        }

        //source name
        if (strlen($source) != 0) {
            $this->db->like('name', $source);
        }

        //currency name
        if (strlen($currency) != 0) {
            $this->db->where('currency', $currency);
        }

        //
        if (strlen($date) != 0) {
            $this->db->where('last_updated >', $date);
        }

        $this->db->where('status', 1);

        $this->db->order_by('currency', 'ASC');

        return $this->db->get("zimrate");
    }

    /**
     * delete specified record
     *
     * @param int $id
     */
    public function delete($id)
    {
        $this->db->where('id', $id);
        $this->db->delete("zimrate");
    }

    /**
     * get list of all available currencies
     */
    public function getCurrencies()
    {

        $this->db->distinct();
        $this->db->select("currency");

        return $this->db->get("zimrate");

    }

    /**
     * Get last modified date
     */
    public function getLastChecked()
    {
        $this->db->select("last_checked");
        $this->db->limit(1);
        $this->db->order_by('last_checked', 'DESC');

        return $this->db->get("zimrate");
    }

    /**
     * get list of all available currencies
     */
    public function getDisplayCurrencies()
    {

        $this->db->select("currency");
        $this->db->select_avg('rate', "mean");
        $this->db->select_max('rate', "max");
        $this->db->select_min('rate', "min");

        $this->db->where('status', 1);

        $this->db->group_by("currency");
        $this->db->order_by('COUNT(url)', 'DESC');

        return $this->db->get("zimrate");

    }

    /**
     * Get the sources of currency
     *
     * @param string $currency
     */
    public function getCurrencySources($currency)
    {
        $this->db->distinct();
        $this->db->select("url");
        $this->db->where('currency', $currency);
        $this->db->where('status', 1);

        return $this->db->get("zimrate");
    }

}