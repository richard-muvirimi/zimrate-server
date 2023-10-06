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
        if (! Schema::hasTable('zimrate')) {
            Schema::create('zimrate', function (Blueprint $table) {
                $table->id();
                $table->boolean('status')->default(false);
                $table->boolean('enabled')->default(false);
                $table->string('name');
                $table->string('currency');
                $table->string('url');
                $table->string('selector');
                $table->float('rate', null, null);
                $table->integer('last_checked');
                $table->string('last_updated_selector');
                $table->integer('last_updated');
                $table->string('timezone');
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('zimrate');
    }
};
