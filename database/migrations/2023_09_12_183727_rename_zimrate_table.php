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
        Schema::table('zimrate', function (Blueprint $table) {
            $table->renameColumn('last_updated_selector', 'rate_updated_at_selector');
            $table->renameColumn('timezone', 'source_timezone');
            $table->renameColumn('selector', 'rate_selector');
            $table->renameColumn('name', 'rate_name');
            $table->renameColumn('currency', 'rate_currency');
            $table->renameColumn('url', 'source_url');
            $table->rename('rates');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rates', function (Blueprint $table) {
            $table->renameColumn('rate_updated_at_selector', 'last_updated_selector');
            $table->renameColumn('source_timezone', 'timezone');
            $table->renameColumn('rate_selector', 'selector');
            $table->renameColumn('rate_name', 'name');
            $table->renameColumn('rate_currency', 'currency');
            $table->renameColumn('source_url', 'url');
            $table->rename('zimrate');
        });
    }
};
