import {readdir,readFile} from 'node:fs/promises';
const forbidden=['127.0.0.1:18080','127.0.0.1:19099','127.0.0.1:18081','demo-miagenda-mirror','synthetic-emulator-only','mirrorEmulator','Ideas para clase'];
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())await check(path);else if(/\.(js|html|json)$/.test(path)){const bytes=await readFile(path,'utf8');for(const marker of forbidden)if(bytes.includes(marker))throw Error('DEV_CODE_IN_BUILD: '+path+' '+marker);}}}
await check('dist');process.stdout.write('PASS normal build: emulator code/config and synthetic fixtures absent\n');
