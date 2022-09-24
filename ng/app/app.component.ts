import { Component } from '@angular/core';
import { install } from 'ga-gtag';
import { Location } from '@angular/common';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {

	constructor(private location: Location) {
		install('UA-67829308-8');

		this.location.onUrlChange(x => {

			document.documentElement.classList.remove("sr", "anime-ready", "js");
			document.documentElement.classList.add("no-js");

			this.ngAfterViewInit();
		});
	}

	ngAfterViewInit() {

		let elements = document.getElementsByClassName("animation-loader");
		for (let index = 0; index < elements.length; index++) {
			elements[index].remove();
		}

		setTimeout(() => {

			// Load animation script
			const script = document.createElement('script');
			script.className = "animation-loader";
			script.type = 'text/javascript';
			script.src = "app/Views/dist/assets/js/main.min.js";
			document.body.appendChild(script);
		}, 1000);
	}

}
