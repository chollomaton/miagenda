import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateWorker} from './service-worker.ts';
const assets=(await readdir('dist/assets')).map(n=>'./assets/'+n);
const index=await readFile('dist/index.html','utf8');
const version=createHash('sha256').update(index).update(generateWorker([], '')).digest('hex').slice(0,12);
await writeFile('dist/service-worker.js',generateWorker(['./','./index.html','./manifest.webmanifest','./icons/agenda.svg','./icons/agenda-192.png','./icons/agenda-512.png',...assets],version));
