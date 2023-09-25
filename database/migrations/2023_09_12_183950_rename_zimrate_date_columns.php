<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('rates', function (Blueprint $table) {
            $table->timestamp('rate_updated_at')->nullable();
            $table->timestamps();
        });

        DB::table('rates')->update([
            'rate_updated_at' => DB::raw('FROM_UNIXTIME(last_updated)'),
            'updated_at' => DB::raw('FROM_UNIXTIME(last_checked)'),
            'created_at' => DB::raw('FROM_UNIXTIME(last_updated)'),
        ]);

        Schema::table('rates', function (Blueprint $table) {
            $table->dropColumn('last_checked');
            $table->dropColumn('last_updated');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

        Schema::table('rates', function (Blueprint $table) {
            $table->integer('last_checked');
            $table->integer('last_updated');
        });

        DB::table('rates')->update([
            'last_checked' => DB::raw('UNIX_TIMESTAMP(updated_at)'),
            'last_updated' => DB::raw('UNIX_TIMESTAMP(rate_updated_at)'),
        ]);

        Schema::table('rates', function (Blueprint $table) {
            $table->dropColumn('checked_at');
            $table->dropTimestamps();
        });
    }
};
