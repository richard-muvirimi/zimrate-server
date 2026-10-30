/**
 * Converts public/docs/documentation.yaml into the Postman collection offered
 * for download on /developers.
 *
 * Runs before every dev and build, so the collection can never drift from the
 * spec, and is gitignored for the same reason:
 *
 *   npm run postman
 */
import Converter from 'openapi-to-postmanv2';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../public/docs/documentation.yaml'), 'utf8');
const target = resolve(here, '../public/docs/zimrate.postman_collection.json');

Converter.convert(
  { type: 'string', data: source },
  {
    // The spec's example values rather than "<string>" placeholders, so v2's
    // {base} arrives as ZAR and every request works as imported.
    requestParametersResolution: 'Example',
    // Optional parameters arrive unticked. Ticked, search and name would be
    // sent together, which the api rejects.
    enableOptionalParameters: false,
  },
  (err, result) => {
    if (err || !result.result) {
      console.error('Postman conversion failed:', err?.message ?? result.reason);
      process.exit(1);
    }
    writeFileSync(target, JSON.stringify(result.output[0].data, null, 2) + '\n');
    console.log(`Wrote ${target}`);
  },
);
