import {Component, OnInit} from '@angular/core';
import {AnimeService} from '../../../../services/anime.service';
import {environment} from "../../../../../environments/environment";

@Component({
    selector: 'app-faq',
    templateUrl: './faq.component.html',
    styleUrls: ['./faq.component.scss']
})
export class FaqComponent implements OnInit {

    site$: string;

    constructor(private animeService: AnimeService) {
        this.ngOnInit = this.ngOnInit.bind(this);

        this.site$ = environment.author.url;
    }

    ngOnInit(): void {
        setTimeout((): void => {
            this.animeService.reviewComponents();
        }, 0);
    }

}
