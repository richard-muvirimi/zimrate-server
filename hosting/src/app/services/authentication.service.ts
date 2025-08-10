import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class AuthenticationService {
    constructor(private client: HttpClient) {}

    get authToken(): string {
        return localStorage.getItem('zimrate:token') || '';
    }

    set authToken(token: string) {
        localStorage.setItem('zimrate:token', token);
    }

    get hasToken(): boolean {
        return this.authToken.length !== 0;
    }

    get isLoggedIn(): boolean {
        return this.hasToken;
    }

    // csrfToken(): string {
    //     this.client.get("").pipe().
    // }

    // get defaultUser(): UserInterface {
    //     return {
    //         id: this.defaultId,
    //     };
    // }
}
