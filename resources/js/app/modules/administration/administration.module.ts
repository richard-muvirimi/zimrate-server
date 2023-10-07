import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {AdministrationRoutingModule} from './administration-routing.module';
import {HttpClientModule} from "@angular/common/http";
import {MainComponent} from "../../pages/admin/main/main.component";


@NgModule({
    declarations: [
        MainComponent
    ],
    imports: [
        CommonModule,
        AdministrationRoutingModule,
        HttpClientModule,
        NgOptimizedImage,
    ]
})
export class AdministrationModule {
}
