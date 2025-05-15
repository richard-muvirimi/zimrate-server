import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NgModule } from '@angular/core';

import { LoginComponent } from '../../pages/authentication/login/login.component';
import { UnAuthenticatedRoutingModule } from './un-authenticated-routing.module';

@NgModule({
    declarations: [LoginComponent],
    imports: [CommonModule, UnAuthenticatedRoutingModule, NgOptimizedImage],
})
export class UnAuthenticatedModule {}
