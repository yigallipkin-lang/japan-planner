// Tiny static server: serves ./src at / and three.js + fonts from NODE_MODULES at /nm/
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'src');
const nm = process.env.NODE_MODULES;
const types = {'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.woff2':'font/woff2','.json':'application/json'};
export function start(port=8765){
  return new Promise(res=>{
    const s = http.createServer((req,resp)=>{
      let u = decodeURIComponent(req.url.split('?')[0]);
      let f = u.startsWith('/nm/') ? path.join(nm, u.slice(4)) : path.join(root, u==='/'?'index.html':u);
      fs.readFile(f,(e,d)=>{ if(e){resp.writeHead(404);resp.end();return;}
        resp.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'}); resp.end(d);});
    }).listen(port,()=>res(s));
  });
}
if (process.argv[1] && process.argv[1].endsWith('server.mjs')) start().then(()=>console.log('serving'));
