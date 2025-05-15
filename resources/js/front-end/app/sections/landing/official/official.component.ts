import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-official',
    templateUrl: './official.component.html',
    styleUrls: ['./official.component.scss'],
})
export class OfficialComponent implements OnInit {
    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
    }

    ngOnInit(): void {}
}
