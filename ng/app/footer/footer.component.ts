import { Component, OnInit } from '@angular/core';
import * as base64 from 'base-64';

@Component({
	selector: 'app-footer',
	templateUrl: './footer.component.html',
	styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

	email: string;

	constructor() {
		this.email = base64.encode("rich4rdmuvirimi@gmail.com")
	}

	ngOnInit(): void {
	}

}
