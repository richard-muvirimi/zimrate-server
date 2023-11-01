import baseUrl from "./baseUrl";
import {trimStart} from "lodash";

export default function (path: string): URL {
    return baseUrl("build/front-end/" + trimStart(path, "/"));
}
