import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {AuthenticatedRoutingModule} from './authenticated-routing.module';
import {DashboardComponent} from "../../pages/admin/panel/dashboard/dashboard.component";


@NgModule({
    declarations: [
        DashboardComponent
    ],
    imports: [
        CommonModule,
        AuthenticatedRoutingModule,
        NgOptimizedImage,
    ]
})
export class AuthenticatedModule {
}
