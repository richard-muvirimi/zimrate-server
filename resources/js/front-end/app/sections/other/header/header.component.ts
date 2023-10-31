import {Component, OnInit} from '@angular/core';
import assetUrl from "../../../utils/assetUrl";

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

    protected readonly assetUrl: Function = assetUrl

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
    }

    ngOnInit(): void {
    }

}
