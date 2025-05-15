import { trimStart } from 'lodash';
import baseUrl from './baseUrl';

export default function (path: string): URL {
    return baseUrl('build/front-end/' + trimStart(path, '/'));
}
