import {Component} from '@angular/core';
import {install} from 'ga-gtag';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {

    constructor() {
        const measurementId: string = document.querySelector("meta[name='gtag-id']")!.getAttribute('content')!!;

        install(measurementId);
    }

}
