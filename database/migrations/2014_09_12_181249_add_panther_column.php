<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('zimrate', 'javascript')) {
            Schema::table('zimrate', function (Blueprint $table) {
                $table->boolean('javascript')->default(false);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('zimrate', function (Blueprint $table) {
            $table->dropColumn('javascript');
        });
    }
};
