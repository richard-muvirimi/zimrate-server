import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-hero',
    templateUrl: './hero.component.html',
    styleUrls: ['./hero.component.scss'],
})
export class HeroComponent implements OnInit {
    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
    }

    ngOnInit(): void {}
}
