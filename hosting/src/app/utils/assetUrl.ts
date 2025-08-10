import { trimStart } from 'lodash';
import baseUrl from './baseUrl';

export default function (path: string): URL {
    return baseUrl(trimStart(path, '/'));
}
