<!DOCTYPE html>
<html lang="en" class="no-js">

<head>

	<?php echo view('solid/partials/head'); ?>

	<title><?php echo lang('Site.page.faq.title'); ?>
	</title>
	<meta property="og:title"
		content="<?php echo lang('Site.page.faq.title'); ?>">

</head>

<body class="is-boxed has-animations">
	<div class="body-wrap">

		<?php echo view('solid/partials/header') ?>

		<main>
			<section class="hero">
				<div class="container">
					<div class="hero-inner">
						<div class="hero-copy">
							<h1 class="hero-title mt-0"><?php echo lang('Site.page.faq.title'); ?>
							</h1>
						</div>
						<?php echo view('solid/partials/animation') ?>
					</div>
				</div>
			</section>

			<section class="features section">
				<div class="container">
					<div class="features-inner has-bottom-divider">
						<dl class="">
							<?php for ($i = 1; $i <= 7; $i++) : ?>
							<dt><?php echo lang('Site.page.faq.q' . $i); ?>
							</dt>
							<dd>- <?php echo lang('Site.page.faq.qa' . $i, [anchor('https://tyganeutronics.com')]); ?>
							</dd>
							<?php endfor; ?>
						</dl>
					</div>
				</div>
			</section>

		</main>

		<?php echo view('solid/partials/footer'); ?>

	</div>

	<script src="public/js/main.min.js"></script>
</body>

</html>
