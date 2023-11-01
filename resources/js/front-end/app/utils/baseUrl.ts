export default function (path: string): URL {
    const metaElement: HTMLBaseElement = document.querySelector('base[href]')!!;
    return new URL(path, metaElement.href);
}
