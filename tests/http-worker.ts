import { createServer } from 'node:http';
import { toolHandler } from '../packages/core/src/tools.js';
const handler=toolHandler('bound.preview.v1');
const server=createServer((request,response)=>{void handler(request,response);});
server.listen(0,'127.0.0.1',()=>{
  const address=server.address();if(address&&typeof address!=='string')process.stdout.write(JSON.stringify({url:`http://127.0.0.1:${address.port}/api/preview`})+'\n');
});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
