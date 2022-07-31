interface Redirects {
    [from: string]: string;
}
interface RedirectOptions {
    outputDirectory: string;
    redirects: Redirects;
}
export default function getRedirectsFromMap(options: RedirectOptions): Page[];
export {};
