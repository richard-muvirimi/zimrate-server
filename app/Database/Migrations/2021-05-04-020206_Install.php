<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Install extends Migration
{
	public function up()
	{
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

		$this->forge->addKey('id', true);
		$this->forge->addField($fields);

		$this->forge->createTable("zimrate", true, array('ENGINE' => 'InnoDB'));
	}

	public function down()
	{
		$this->forge->dropTable('zimrate');
	}
}
