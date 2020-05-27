<!DOCTYPE html>
<html lang="en" class="no-js">
<head>

    <?php $this->load->view('solid/head.php'); ?>

    <title><?php echo $this->lang->line('faq'); ?></title>
    <meta property="og:title" content="<?php echo $this->lang->line('faq'); ?>">

</head>
<body class="is-boxed has-animations">
    <div class="body-wrap">
        <header class="site-header">
            <div class="container">
                <div class="site-header-inner">
                    <div class="brand header-brand">
                        <h1 class="m-0">
							<a href="<?php echo base_url(); ?>">
								<img class="header-logo-image" src="dist/images/logo.svg" alt="Logo">
                            </a>
                        </h1>
                    </div>
                </div>
            </div>
        </header>

        <main>
            <section class="hero">
                <div class="container">
                    <div class="hero-inner">
						<div class="hero-copy">
	                        <h1 class="hero-title mt-0"><?php echo $this->lang->line('faq'); ?></h1>
	                    </div>
						<div class="hero-figure anime-element">
							<svg class="placeholder" width="528" height="396" viewBox="0 0 528 396">
								<rect width="528" height="396" style="fill:transparent;" />
							</svg>
							<div class="hero-figure-box hero-figure-box-01" data-rotation="45deg"></div>
							<div class="hero-figure-box hero-figure-box-02" data-rotation="-45deg"></div>
							<div class="hero-figure-box hero-figure-box-03" data-rotation="0deg"></div>
							<div class="hero-figure-box hero-figure-box-04" data-rotation="-135deg"></div>
							<div class="hero-figure-box hero-figure-box-05"></div>
							<div class="hero-figure-box hero-figure-box-06"></div>
							<div class="hero-figure-box hero-figure-box-07"></div>
							<div class="hero-figure-box hero-figure-box-08" data-rotation="-22deg"></div>
							<div class="hero-figure-box hero-figure-box-09" data-rotation="-52deg"></div>
							<div class="hero-figure-box hero-figure-box-10" data-rotation="-50deg"></div>
						</div>
                    </div>
                </div>
            </section>

            <section class="features section">
                <div class="container">
					<div class="features-inner has-bottom-divider">
                        <dl class="">
                            <?php for ($i = 1; $i <= 7; $i++): ?>
                                <dt><?php echo $this->lang->line('q' . $i); ?></dt>
                                <dd>- <?php printf($this->lang->line('qa' . $i), anchor("https://tyganeutronics.com")); ?></dd>
                            <?php endfor; ?>
                        </dl>
                    </div>
                </div>
            </section>

        </main>

       <?php $this->load->view('solid/footer.php'); ?>

    </div>

    <script src="dist/js/main.min.js"></script>
</body>
</html>
