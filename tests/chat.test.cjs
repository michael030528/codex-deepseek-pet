'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http');const {endpoint,complete}=require('../src/main/chat.cjs');
test('endpoint allows TLS and loopback, rejects credential URLs and remote HTTP',()=>{
 assert.equal(endpoint('http://127.0.0.1:1234/v1/'),'http://127.0.0.1:1234/v1/chat/completions');
 assert.equal(endpoint('https://api.deepseek.com/v1/chat/completions'),'https://api.deepseek.com/v1/chat/completions');
 for(const url of ['http://example.com/v1','file:///etc/passwd','https://user:secret@example.com','https://example.com?key=123'])assert.throws(()=>endpoint(url));
});
test('request only includes bounded user history and explicit image, returns actual text',async()=>{
 let received;const server=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{received=JSON.parse(b);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'我想明白了。'}}]}));});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const answer=await complete({baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'test',messages:[{role:'user',content:'你好'}],image:'data:image/png;base64,AA==',memory:'称呼我小林'});
 assert.equal(answer,'我想明白了。');assert.equal(received.messages[0].role,'system');assert.equal(received.messages.at(-1).content[1].type,'image_url');assert.equal(received.stream,false);assert.equal(received.max_tokens,1200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('official DeepSeek V4 requests disable thinking without changing the selected model or chat limits',async()=>{
 for(const [baseUrl,model,onDelta] of [
  ['https://api.deepseek.com',' deepseek-v4-pro ',undefined],
  ['https://api.deepseek.com/v1/','deepseek-v4-flash',()=>{}],
 ]){
  let request,requestUrl,requests=0;
  const answer=await complete({baseUrl,model,messages:[{role:'user',content:'你好'}],onDelta,fetchImpl:async(url,options)=>{
   requests++;requestUrl=url;request=JSON.parse(options.body);
   return new Response(JSON.stringify({choices:[{message:{content:'你好。'}}]}));
  }});
  assert.equal(requests,1);assert.equal(answer,'你好。');
  assert.equal(requestUrl,baseUrl==='https://api.deepseek.com'?'https://api.deepseek.com/chat/completions':'https://api.deepseek.com/v1/chat/completions');
  assert.equal(request.model,model.trim());assert.deepEqual(request.thinking,{type:'disabled'});
  assert.equal(request.max_tokens,1200);assert.equal(request.stream,Boolean(onDelta));
  assert.deepEqual(request.messages.at(-1),{role:'user',content:'你好'});
 }
});
test('DeepSeek V4 options and image restrictions do not affect other providers or model names',async()=>{
 const image='data:image/png;base64,AA==';
 for(const [baseUrl,model] of [
  ['https://example.com/v1','deepseek-v4-pro'],
  ['https://api.deepseek.com.example.com','deepseek-v4-flash'],
  ['http://127.0.0.1:1234','deepseek-v4-pro'],
  ['https://api.deepseek.com','deepseek-flash'],
  ['https://api.deepseek.com','deepseek-v4-pro-custom'],
 ]){
  let request,requests=0;
  const answer=await complete({baseUrl,model,messages:[{role:'user',content:'看看这张图'}],image,fetchImpl:async(_url,options)=>{
   requests++;request=JSON.parse(options.body);
   return new Response(JSON.stringify({choices:[{message:{content:'收到图片。'}}]}));
  }});
  assert.equal(requests,1);assert.equal(answer,'收到图片。');assert.equal(request.model,model);
  assert.equal(Object.hasOwn(request,'thinking'),false);
  assert.deepEqual(request.messages.at(-1).content,[{type:'text',text:'看看这张图'},{type:'image_url',image_url:{url:image}}]);
 }
});
test('official DeepSeek V4 rejects explicit images before sending any request',async()=>{
 for(const model of ['deepseek-v4-pro',' deepseek-v4-flash ']){
  for(const messages of [[],[{role:'user',content:'看看这张图'}]]){
   let requests=0;
   await assert.rejects(()=>complete({baseUrl:'https://api.deepseek.com/v1',model,messages,image:'data:image/png;base64,AA==',fetchImpl:async()=>{
    requests++;return new Response(JSON.stringify({choices:[{message:{content:'不应发送'}}]}));
   }}),/仅支持文字.*取消附加截图/);
   assert.equal(requests,0);
  }
 }
});
test('provider errors do not expose response body',async()=>{await assert.rejects(()=>complete({baseUrl:'https://example.com',model:'test',messages:[],fetchImpl:async()=>new Response('secret-provider-body',{status:401})}),e=>!e.message.includes('secret')&&e.message.includes('密钥'));});
test('cancellation stops request',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(()=>complete({baseUrl:'http://127.0.0.1:1234',model:'test',messages:[],signal:controller.signal}),e=>e.name==='AbortError');});
test('malformed successful response and empty choices are rejected',async()=>{
 for(const body of ['not-json','{"choices":[]}'])await assert.rejects(()=>complete({baseUrl:'https://example.com',model:'test',messages:[],fetchImpl:async()=>new Response(body)}));
});

const streamEvent=value=>`data: ${JSON.stringify(value)}\r\n\r\n`;
const delta=text=>({choices:[{delta:{content:text}}]});
function streamed(text){
 const bytes=new TextEncoder().encode(text);let index=0;
 return new Response(new ReadableStream({pull(c){if(index===bytes.length)c.close();else c.enqueue(bytes.slice(index,index+=1));}}),{headers:{'Content-Type':'text/event-stream'}});
}
test('SSE preserves split UTF-8, ignores reasoning, and delivers incremental content',async()=>{
 const updates=[];let request;
 const answer=await complete({baseUrl:'https://example.com',model:'test',messages:[],onDelta:text=>updates.push(text),fetchImpl:async(_url,options)=>{
  request=JSON.parse(options.body);
  return streamed(': keepalive\r\n\r\n'+streamEvent({choices:[{delta:{reasoning_content:'hidden'}}]})+streamEvent(delta('你好'))+streamEvent(delta('，大肥鱼。'))+'data: [DONE]\r\n\r\n');
 }});
 assert.equal(request.stream,true);assert.deepEqual(updates,['你好','你好，大肥鱼。']);assert.equal(answer,updates.at(-1));
});
test('stream request accepts a provider that returns ordinary JSON without retrying',async()=>{
 let requests=0;
 const answer=await complete({baseUrl:'https://example.com',model:'test',messages:[],onDelta:()=>{},fetchImpl:async()=>{requests++;return new Response(JSON.stringify({choices:[{message:{content:'兼容回复'}}]}));}});
 assert.equal(answer,'兼容回复');assert.equal(requests,1);
});
test('truncated, malformed, empty and oversized streams fail without exposing provider errors',async()=>{
 for(const body of [streamEvent(delta('未完')), 'data: bad\n\n',streamEvent({error:{message:'secret'}}),'data: [DONE]\n\n',streamEvent(delta('字'.repeat(12001)))]){
  await assert.rejects(()=>complete({baseUrl:'https://example.com',model:'test',messages:[],onDelta:()=>{},fetchImpl:async()=>streamed(body)}),e=>!e.message.includes('secret'));
 }
});
test('cancellation during a real SSE response stops reading after partial text',async()=>{
 const controller=new AbortController();let partial='';
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/event-stream');res.write(streamEvent(delta('已收到')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await assert.rejects(()=>complete({baseUrl:`http://127.0.0.1:${server.address().port}`,model:'test',messages:[],signal:controller.signal,onDelta:text=>{partial=text;controller.abort();}}),e=>e.name==='AbortError');assert.equal(partial,'已收到');}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
