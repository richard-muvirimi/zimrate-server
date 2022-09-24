import { Component, OnInit } from '@angular/core';
import * as base64 from 'base-64';

@Component({
	selector: 'app-privacy',
	templateUrl: './privacy.component.html',
	styleUrls: ['./privacy.component.scss']
})
export class PrivacyComponent implements OnInit {

	email: string;
	title: string;

	constructor() {
		this.email = base64.encode("rich4rdmuvirimi@gmail.com")
		this.title = "ZimRate";
	}

	ngOnInit(): void {
	}

}
