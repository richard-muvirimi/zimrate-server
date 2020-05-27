<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
    <?php $this->load->view('solid/head.php'); ?>

    <title><?php echo $this->lang->line('developers'); ?></title>
    <meta property="og:title" content="<?php echo $this->lang->line('developers'); ?>">

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
	                        <h1 class="hero-title mt-0"><?php echo $this->lang->line('developers'); ?></h1>
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

                    <p class="text-sm mb-0"><?php printf($this->lang->line('api_access'), anchor(base_url() . "api")); ?></p>

                    <dl>
                        <dt><?php echo $this->lang->line('param_name_title'); ?></dt>
                        <dd>- <?php echo $this->lang->line('param_name'); ?></dd>

                        <dt><?php echo $this->lang->line('param_currency_title'); ?></dt>
                        <dd>- <?php printf($this->lang->line('param_currency'), implode(", ", $currencies)); ?></dd>

                        <dt><?php echo $this->lang->line('param_date_title'); ?></dt>
                        <dd>- <?php echo $this->lang->line('param_date'); ?></dd>

                        <dt><?php echo $this->lang->line('param_prefer_title'); ?></dt>
                        <dd>- <?php echo $this->lang->line('param_prefer'); ?></dd>
                    </dl>

                    <p class="text-sm mb-0"><?php echo $this->lang->line('param_emphasis'); ?></p>
                    <br>
                    <p class="text-sm mb-0"><?php echo $this->lang->line('disclaimer'); ?></p>
                   <p class="text-sm mb-0"><?php echo $this->lang->line('documentation_disclaimer'); ?></p>

                    </div>
                </div>
            </section>

        </main>

       <?php $this->load->view('solid/footer.php'); ?>

    </div>

    <script src="dist/js/main.min.js"></script>
</body>
</html>
