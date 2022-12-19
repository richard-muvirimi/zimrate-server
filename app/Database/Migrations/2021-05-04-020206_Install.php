<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Install extends Migration
{

	/**
	 * Create system fields
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	public function up()
	{
		$fields = [
			'id'                    => [
				'type'           => 'INT',
				'null'           => false,
				'auto_increment' => true,
			],
			'status'                => [
				'type' => 'BOOLEAN',
			],
			'enabled'               => [
				'type' => 'BOOLEAN',
			],
			'name'                  => [
				'type' => 'TEXT',
			],
			'currency'              => [
				'type' => 'TEXT',
			],
			'url'                   => [
				'type' => 'TEXT',
			],
			'selector'              => [
				'type' => 'TEXT',
			],
			'rate'                  => [
				'type' => 'FLOAT',
			],
			'last_checked'          => [
				'type' => 'INT',
			],
			'last_updated_selector' => [
				'type' => 'TEXT',
			],
			'last_updated'          => [
				'type' => 'INT',
			],
			'timezone'              => [
				'type' => 'TEXT',
			],
		];

		$this->forge->addKey('id', true);
		$this->forge->addField($fields);

		$this->forge->createTable('zimrate', true, ['ENGINE' => 'InnoDB']);
	}

	/**
	 * Drop fields
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	public function down()
	{
		$this->forge->dropTable('zimrate');
	}
}
