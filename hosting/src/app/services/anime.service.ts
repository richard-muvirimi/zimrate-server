import { Injectable } from '@angular/core';
import anime from 'animejs/lib/anime.es.js';

import ScrollReveal from 'scrollreveal';

declare global {
    interface Window {
        sr: any;
    }
}

@Injectable({
    providedIn: 'root',
})
export class AnimeService {
    constructor() {
        this.reviewComponents = this.reviewComponents.bind(this);

        window.sr = ScrollReveal();
        window.anime = anime;
    }

    reviewComponents(): void {
        const doc: HTMLElement = document.documentElement;

        doc.classList.remove('no-js');
        doc.classList.add('js');

        // Reveal animations
        if (document.body.classList.contains('has-animations')) {
            /* global ScrollReveal */
            const sr = window.sr;

            sr.reveal('.feature, .pricing-table-inner', {
                duration: 600,
                distance: '20px',
                easing: 'cubic-bezier(0.5, -0.01, 0, 1.005)',
                origin: 'bottom',
                interval: 100,
            });

            doc.classList.add('anime-ready');
            /* global anime */
            window.anime
                .timeline({
                    targets: '.hero-figure-box-05',
                })
                .add({
                    duration: 400,
                    easing: 'easeInOutExpo',
                    scaleX: [0.05, 0.05],
                    scaleY: [0, 1],
                    perspective: '500px',
                    delay: window.anime.random(0, 400),
                })
                .add({
                    duration: 400,
                    easing: 'easeInOutExpo',
                    scaleX: 1,
                })
                .add({
                    duration: 800,
                    rotateY: '-15deg',
                    rotateX: '8deg',
                    rotateZ: '-1deg',
                });

            window.anime
                .timeline({
                    targets: '.hero-figure-box-06, .hero-figure-box-07',
                })
                .add({
                    duration: 400,
                    easing: 'easeInOutExpo',
                    scaleX: [0.05, 0.05],
                    scaleY: [0, 1],
                    perspective: '500px',
                    delay: window.anime.random(0, 400),
                })
                .add({
                    duration: 400,
                    easing: 'easeInOutExpo',
                    scaleX: 1,
                })
                .add({
                    duration: 800,
                    rotateZ: '20deg',
                });

            window.anime({
                targets:
                    '.hero-figure-box-01, .hero-figure-box-02, .hero-figure-box-03, .hero-figure-box-04, .hero-figure-box-08, .hero-figure-box-09, .hero-figure-box-10',
                duration: window.anime.random(600, 800),
                delay: window.anime.random(600, 800),
                rotate: [
                    window.anime.random(-360, 360),
                    function (el: HTMLElement) {
                        return el.getAttribute('data-rotation');
                    },
                ],
                scale: [0.7, 1],
                opacity: [0, 1],
                easing: 'easeInOutExpo',
            });
        }
    }
}
