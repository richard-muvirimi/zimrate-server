<!DOCTYPE html>
@php use Illuminate\Support\Str; @endphp
<html lang="{{ Str::kebab(app()->getLocale()) }}">

<head>
    <meta charset="utf-8">

    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <link href="https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600" rel="stylesheet">

    <base href="{{ url('/') }}/">

    <link rel="icon" type="image/x-icon" href="{{ url('build/back-end/assets/images/logo.svg') }}"/>

    <meta name="gtag-id" content="{{ config('analytics.measurement_id') }}"/>

    <title inertia>{{ config('app.name', 'Laravel') }}</title>

    <meta name="author" content="{{ config('app.author', '') }}">
    <meta name="description" content="{{ config('app.description', '') }}">
    <meta name="keywords" content="{{ config('app.keywords', '') }}">
    <meta name="version" content="{{ config('app.version', '') }}">

    <meta property="og:title" content="{{ config('app.name') }}">
    <meta property="og:description" content="{{ config('app.description', '') }}">
    <meta property="og:image" content="{{ url('build/back-end/assets/images/zimrate_screenshot.png') }}">
    <meta property="og:url" content="{{ url('') }}">

    <meta name="csrf-token" content="{{ csrf_token() }}">

</head>

<body class="is-boxed has-animations">
<app-root></app-root>

<noscript>
    You need to enable JavaScript to run this site.
</noscript>

</body>

</html>
