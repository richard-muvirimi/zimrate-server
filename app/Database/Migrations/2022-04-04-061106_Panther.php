<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Panther extends Migration
{

    /**
     * Add javascript support field
     *
     * @since   1.0.0
     * @version 1.0.0
     * @return  void
     */
    public function up(): void
    {
        $fields = [
            'javascript' => [
                'type' => 'BOOLEAN',
            ],
        ];

        $this->forge->addColumn('zimrate', $fields);
    }

    /**
     * Dropp field
     *
     * @since   1.0.0
     * @version 1.0.0
     * @return  void
     */
    public function down(): void
    {
        $this->forge->dropColumn('zimrate', 'javascript');
    }
}
