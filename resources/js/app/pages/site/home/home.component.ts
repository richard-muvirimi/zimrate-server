import {Component, ViewEncapsulation} from '@angular/core';
import {install} from "ga-gtag";

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class HomeComponent {

    constructor() {
        const measurementId: string = document.querySelector("meta[name='gtag-id']")!.getAttribute('content')!!;

        install(measurementId);
    }

}
