import { trimStart } from 'lodash';

export default function (path: string): URL {
    return new URL('/' + trimStart(path, '/'), window.location.origin);
}
