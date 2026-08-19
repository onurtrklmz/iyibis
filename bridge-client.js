(function() {
"use strict";
var BRIDGE_URL="https://script.google.com/macros/s/AKfycbxYnHCbRzujgrGj9Mx5Z3pGBse3Udn8rMDadb28CLoSEwcS5h3WcSsIUexBCXnqHw/exec?app=bridge";
var frame=null, ready=false, waiters=[], pending=new Map(), seq=1;

function ensureFrame(){
  if(frame) return frame;
  frame=document.createElement("iframe");
  frame.id="iyibis-rpc-bridge";
  frame.src=BRIDGE_URL;
  frame.setAttribute("aria-hidden","true");
  frame.tabIndex=-1;
  Object.assign(frame.style,{position:"fixed",width:"1px",height:"1px",opacity:"0",pointerEvents:"none",border:"0",left:"-9999px",top:"-9999px"});
  (document.body||document.documentElement).appendChild(frame);
  return frame;
}
function waitReady(){
  ensureFrame();
  if(ready) return Promise.resolve();
  return new Promise(function(resolve,reject){
    var t=setTimeout(function(){reject(new Error("İYİBİS backend köprüsüne bağlanılamadı."));},20000);
    waiters.push(function(){clearTimeout(t);resolve();});
  });
}
window.addEventListener("message",function(event){
  if(!frame || event.source!==frame.contentWindow) return;
  var msg=event.data||{};
  if(msg.channel!=="IYIBIS_RPC") return;
  if(msg.type==="READY"){
    ready=true;
    waiters.splice(0).forEach(function(fn){fn();});
    return;
  }
  if(msg.type==="RESULT" || msg.type==="ERROR"){
    var item=pending.get(msg.id);
    if(!item) return;
    pending.delete(msg.id);
    if(msg.type==="RESULT"){
      if(item.success) item.success(msg.value);
    } else {
      var err=new Error(msg.message||"Apps Script işlemi başarısız.");
      if(item.failure) item.failure(err); else console.error(err);
    }
  }
});
function call(method,args,success,failure){
  var id="rpc_"+Date.now()+"_"+(seq++);
  pending.set(id,{success:success,failure:failure});
  waitReady().then(function(){
    frame.contentWindow.postMessage({channel:"IYIBIS_RPC",type:"CALL",id:id,method:method,args:args||[]},"*");
  }).catch(function(err){
    pending.delete(id);
    if(failure) failure(err); else console.error(err);
  });
}
function runner(success,failure){
  var base={
    withSuccessHandler:function(fn){return runner(fn,failure);},
    withFailureHandler:function(fn){return runner(success,fn);}
  };
  return new Proxy(base,{
    get:function(target,prop){
      if(prop in target) return target[prop];
      if(prop==="then") return undefined;
      return function(){call(String(prop),Array.prototype.slice.call(arguments),success,failure);};
    }
  });
}
window.google=window.google||{};
window.google.script=window.google.script||{};
window.google.script.run=runner(null,null);
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",ensureFrame,{once:true});
else ensureFrame();
})();
