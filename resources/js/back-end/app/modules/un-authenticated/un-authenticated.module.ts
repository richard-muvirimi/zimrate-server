import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {UnAuthenticatedRoutingModule} from './un-authenticated-routing.module';
import {LoginComponent} from "../../pages/authentication/login/login.component";


@NgModule({
    declarations: [
        LoginComponent
    ],
    imports: [
        CommonModule,
        UnAuthenticatedRoutingModule,
        NgOptimizedImage,
    ]
})
export class UnAuthenticatedModule {
}
