import fs from 'node:fs';
import zlib from 'node:zlib';
const root='dist/';
const manifest=JSON.parse(fs.readFileSync(root+'.vite/manifest.json','utf8'));
function collect(key,seen=new Set()) {
 if(seen.has(key))return seen;
 seen.add(key);
 for(const dependency of manifest[key]?.imports??[])collect(dependency,seen);
 return seen;
}
function size(keys) {
 const files=[...new Set(keys.map(key=>manifest[key].file))];
 return {files,bytes:files.reduce((n,file)=>n+fs.statSync(root+file).size,0),
 gzip:files.reduce((n,file)=>n+zlib.gzipSync(fs.readFileSync(root+file)).length,0)};
}
const entry=Object.keys(manifest).find(key=>manifest[key].isEntry);
const overview=[...new Set([...collect(entry),...collect('src/portal/PortalLayout.tsx'),...collect('src/portal/pages/BusinessOverviewPage.tsx')])];
const js=Object.keys(manifest).filter(key=>manifest[key].file.endsWith('.js'));
const fonts=fs.readdirSync(root+'assets').filter(file=>file.endsWith('.woff2'));
const result={entry:size([...collect(entry)]),overview:size(overview),allJavaScript:size(js),
 fontsBytes:fonts.reduce((n,file)=>n+fs.statSync(root+'assets/'+file).size,0)};
console.log(JSON.stringify(result,null,2));
if(result.overview.bytes>500000)throw Error('Overview JavaScript exceeds the 500 kB budget');
