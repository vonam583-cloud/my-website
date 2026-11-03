(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KeneRuntime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function createCameraPreview(options){let stream=null,disposed=false,version=0;const stopTracks=s=>s?.getTracks?.().forEach(t=>t.stop());
function stop(){version++;stopTracks(stream);stream=null;if(!disposed)options.onBusy?.(false);}
async function start(){if(disposed)return;stop();const current=version;options.onBusy?.(true);try{const acquired=await options.requestMedia();if(disposed||current!==version||options.isCurrent?.()===false){stopTracks(acquired);return;}stream=acquired;options.onReady?.(stream);}catch(error){if(!disposed&&current===version&&options.isCurrent?.()!==false)options.onError?.(error);}finally{if(!disposed&&current===version)options.onBusy?.(false);}}
function dispose(){if(disposed)return;stop();disposed=true;}return {start,stop,dispose,isDisposed:()=>disposed};}
return {createCameraPreview};});
