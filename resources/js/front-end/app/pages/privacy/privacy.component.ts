import {Component, OnInit} from '@angular/core';
import * as base64 from 'base-64';
import {AnimeService} from '../../services/anime.service';
import {environment} from "../../../environments/environment";

@Component({
    selector: 'app-privacy',
    templateUrl: './privacy.component.html',
    styleUrls: ['./privacy.component.scss']
})
export class PrivacyComponent implements OnInit {

    email$: string;
    title$: string;

    constructor(private animeService: AnimeService) {
        this.ngOnInit = this.ngOnInit.bind(this);

        this.email$ = base64.encode(environment.author.email)
        this.title$ = environment.appTitle;
    }

    ngOnInit(): void {
        setTimeout((): void => {
            this.animeService.reviewComponents();
        }, 0);
    }

}
