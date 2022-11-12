import { Component } from '@angular/core';
import { install } from 'ga-gtag';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {

	constructor() {
		install('UA-67829308-8');
	}

}
