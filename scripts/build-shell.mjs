import {readdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {generateWorker} from './service-worker.ts';
import {shellVersion} from './shell-version.ts';
const assets=(await readdir('dist/assets')).sort().map(n=>'./assets/'+n);
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
const icons=[...new Set([...manifest.icons.map(icon=>'./'+icon.src),'./icons/miagenda-touch-1.1.0.png'])];
const shell=['./','./index.html','./manifest.webmanifest',...icons,...assets];
const files=await Promise.all(shell.filter(path=>path!=='./').map(path=>readFile('dist/'+path.slice(2))));
const version=shellVersion(files,generateWorker([],''));
await writeFile('dist/service-worker.js',generateWorker(shell,version));

const app=JSON.parse(await readFile('package.json','utf8'));
await writeFile('dist/version.json',JSON.stringify({version:app.version,sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()})+'\n');
