import {Component, OnInit} from '@angular/core';
import assetUrl from "../../../utils/assetUrl";

@Component({
    selector: 'app-features',
    templateUrl: './features.component.html',
    styleUrls: ['./features.component.scss']
})
export class FeaturesComponent implements OnInit {

    protected readonly assetUrl: Function = assetUrl

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);
    }

    ngOnInit(): void {
    }

}
