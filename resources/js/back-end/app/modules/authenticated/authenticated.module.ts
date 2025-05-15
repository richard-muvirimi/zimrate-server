import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NgModule } from '@angular/core';

import { DashboardComponent } from '../../pages/panel/dashboard/dashboard.component';
import { AuthenticatedRoutingModule } from './authenticated-routing.module';

@NgModule({
    declarations: [DashboardComponent],
    imports: [CommonModule, AuthenticatedRoutingModule, NgOptimizedImage],
})
export class AuthenticatedModule {}
