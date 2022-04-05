<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Panther extends Migration
{

    /**
     * Add panther support field
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function up()
    {
        $fields = array(
            'javascript' => array(
                'type' => 'BOOLEAN',
            ),
        );

        $this->forge->addColumn("zimrate", $fields);
    }

    /**
     * Dropp field
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function down()
    {
        $this->forge->dropColumn('zimrate', "javascript");
    }
}
