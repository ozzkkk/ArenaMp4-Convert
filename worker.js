'use strict';
/* MP4 Dönüştürücü — FFmpeg worker: tüm ağır iş burada, arayüz hiç kilitlenmez */
const CORE_JS='https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js';
const CORE_DIR='https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.0/dist/';
let coreLoaded=false;

function loadCoreScript(){
  if(coreLoaded)return;
  try{importScripts(CORE_JS)}
  catch(e){throw new Error('Motor betiği indirilemedi (internet bağlantısını kontrol edin)')}
  if(typeof self.createFFmpegCore!=='function')throw new Error('Motor bulunamadı (createFFmpegCore)');
  coreLoaded=true;
}
const ts2sec=ts=>{const p=ts.split(':');return (+p[0])*3600+(+p[1])*60+parseFloat(p[2])};

function parseArgs(m,args){
  const argv=m._malloc(args.length*4);
  args.forEach((s,i)=>{
    const sz=m.lengthBytesUTF8(s)+1,b=m._malloc(sz);
    m.stringToUTF8(s,b,sz);
    m.setValue(argv+4*i,b,'i32');
  });
  return [args.length,argv];
}

/* Tek komut = taze çekirdek (çekirdek komut bitince ölür) */
async function runCommand(o){
  loadCoreScript();
  let logText='',dur=0;
  const mod=await self.createFFmpegCore({
    print:s=>{logText+=s+'\n'},
    printErr:s=>{
      logText+=s+'\n';
      const d=/Duration:\s*(\d+):(\d+):([\d.]+)/.exec(s);
      if(d)dur=(+d[1])*3600+(+d[2])*60+parseFloat(d[3]);
      if(dur>0){
        let t=-1;
        for(const c of s.split('\r')){
          const m=/time=(\d+):(\d+):([\d.]+)/.exec(c);
          if(m)t=ts2sec(m[1]+':'+m[2]+':'+m[3]);
        }
        if(t>=0)postMessage({type:'progress',id:o.id,ratio:Math.min(t/dur,1)});
      }
    },
    locateFile:p=>p.endsWith('.wasm')?CORE_DIR+p:p
  });
  mod.FS.writeFile(o.inputName,new Uint8Array(o.inputBuf));
  const main=mod.cwrap('main','number',['number','number']);
  let err='';
  try{main(...parseArgs(mod,['./ffmpeg','-nostdin','-y',...o.args]))}
  catch(e){if(!(e&&e.name==='ExitStatus'))err=String(e&&e.message||e)}
  let outBuf=null;
  if(o.outName){
    try{outBuf=new Uint8Array(mod.FS.readFile(o.outName))}
    catch(_){err=err||('Çıktı oluşmadı: '+logText.trim().split('\n').slice(-2).join(' ').slice(0,120))}
  }
  return {logText,outBuf,error:err};
}

self.onmessage=async(e)=>{
  const{id,type}=e.data;
  try{
    if(type==='probe'){
      const r=await runCommand({id,inputName:'probe_in',inputBuf:e.data.buffer,args:['-hide_banner','-i','probe_in','-t','1','-f','null','-']});
      postMessage({id,type:'probeResult',info:r.logText});
    }else{
      const outName=e.data.outName;
      const r=await runCommand({id,inputName:'input',inputBuf:e.data.buffer,args:e.data.args,outName});
      if(r.error)postMessage({id,type:'error',message:r.error});
      else postMessage({id,type:'done',buffer:r.outBuf.buffer},[r.outBuf.buffer]);
    }
  }catch(err){
    postMessage({id,type:'error',message:String(err&&err.message||err)});
  }
};
