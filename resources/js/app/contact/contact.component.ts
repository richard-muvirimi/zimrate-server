import { Component, OnInit } from '@angular/core';
import {environment} from "../../environments/environment";

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit {

	url$ : string;

  constructor() {
	  this.url$ = environment.author.url;
  }

  ngOnInit(): void {
  }

}
