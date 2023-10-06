import {Component, ViewEncapsulation} from '@angular/core';
import {install} from "ga-gtag";

@Component({
    selector: 'app-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class MainComponent {

    constructor() {
        const measurementId: string = document.querySelector("meta[name='gtag-id']")!.getAttribute('content')!!;

        install(measurementId);
    }

}
