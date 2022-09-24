import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'app-faq',
	templateUrl: './faq.component.html',
	styleUrls: ['./faq.component.scss']
})
export class FaqComponent implements OnInit {

	site$: string;

	constructor() {
		this.site$ = "http://richard.co.zw";
	}

	ngOnInit(): void {
	}

}
