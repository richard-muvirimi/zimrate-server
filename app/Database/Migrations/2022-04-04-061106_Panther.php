<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Panther extends Migration
{
	public function up()
	{
		$fields = array(
			'javascript' => array(
				'type' => 'BOOLEAN',
			),
		);

		$this->forge->addColumn("zimrate", $fields);
	}

	public function down()
	{
		$this->forge->dropColumn('zimrate', "javascript");
	}
}