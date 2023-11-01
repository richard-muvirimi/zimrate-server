import {Component, OnInit} from '@angular/core';
import * as base64 from 'base-64';
import {environment} from "../../../../environments/environment";
import assetUrl from "../../../utils/assetUrl";

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

    email$: string;
    url$: string;

    protected readonly assetUrl: Function = assetUrl

    constructor() {
        this.ngOnInit = this.ngOnInit.bind(this);

        this.email$ = base64.encode(environment.author.email);
        this.url$ = environment.author.url;
    }

    ngOnInit(): void {
    }

}
