<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1">

<link rel="icon" type="image/png" href="public/images/logo.svg">

<meta property="og:image"
	content="<?php echo base_url('public/images/zimrate_screenshot.png'); ?>">
<meta property="og:url" content="<?php echo base_url(); ?>">

<link href="https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600" rel="stylesheet">
<link rel="stylesheet" href="public/css/style.css">
<script src="https://unpkg.com/animejs@3.0.1/lib/anime.min.js"></script>
<script src="https://unpkg.com/scrollreveal@4.0.0/dist/scrollreveal.min.js"></script>

<!-- Global site tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id="
	<?php echo getenv('app.google.analytics') ?>%pcs-comment-end#* />
</script>
<script>
	window.dataLayer = window.dataLayer || [];

	function gtag() {
		dataLayer.push(arguments);
	}
	gtag('js', new Date());

	gtag('config', getenv("app.google.analytics"));
</script>

<link rel="stylesheet"
	href="<?php echo base_url('public/css/gh-fork-ribbon.min.css') ?>">
