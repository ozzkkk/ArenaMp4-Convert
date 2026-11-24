'use strict';
/* MP4 Dönüştürücü — toplu, otomatik kaydeden, format tespitli (ağır iş worker.js'te) */
const $=id=>document.getElementById(id);
const drop=$('drop'),input=$('fileInput'),list=$('list'),statusEl=$('status');
const convertBtn=$('convertBtn'),clearBtn=$('clearBtn'),saveInfo=$('saveInfo');
const barWrap=$('barWrap'),bar=$('bar');
let queue=[],busy=false,curRatio=0,curIdx=0,chain=Promise.resolve(),msgId=0,activeId=0;
let worker=null,rootHandle=null,dirHandle=null;
const pending=new Map();

if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* --- FFmpeg worker bağlantısı --- */
function onMsg(m){
  if(m.type==='progress'){if(m.id===activeId){curRatio=m.ratio;drawBar()}return}
  const r=pending.get(m.id);if(!r)return;
  pending.delete(m.id);
  if(m.type==='error')r.reject(new Error(m.message));
  else if(m.type==='done')r.resolve(m.buffer);
  else if(m.type==='probeResult')r.resolve(m.info);
  else r.resolve(null);
}
async function getWorker(){
  if(worker)return worker;
  try{worker=new Worker('worker.js')}
  catch(_){
    const code=await (await fetch('worker.js')).text();
    worker=new Worker(URL.createObjectURL(new Blob([code])));
  }
  worker.onmessage=e=>onMsg(e.data);
  worker.onerror=e=>{
    const err=new Error('Worker başlatılamadı: '+(e.message||"worker.js GitHub'a yüklendi mi?"));
    pending.forEach(r=>r.reject(err));pending.clear();
    try{worker.terminate()}catch(_){}
    worker=null;
  };
  return worker;
}
function ask(type,payload){
  return getWorker().then(w=>new Promise((resolve,reject)=>{
    const id=++msgId;pending.set(id,{resolve,reject});
    if(type==='convert'){activeId=id;curRatio=0;drawBar()}
    w.postMessage({id,type,...payload},payload.buffer?[payload.buffer]:[]);
  }));
}
const job=fn=>{const p=chain.then(fn,fn);chain=p.then(()=>{},()=>{});return p};
/* dosya okuma: FileReader (bazı telefonlarda file.arrayBuffer çalışmaz) */
const readBuf=file=>new Promise((res,rej)=>{
  const r=new FileReader();
  r.onload=()=>res(r.result);
  r.onerror=()=>rej(new Error('Dosya okunamadı'));
  r.readAsArrayBuffer(file);
});

/* --- kayıt yeri: İndirilenler/mp4 --- */
const idbGet=()=>new Promise(r=>{try{const q=indexedDB.open('mp4d',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>{const t=q.result.transaction('kv').objectStore('kv').get('dir');t.onsuccess=()=>r(t.result||null);t.onerror=()=>r(null)};q.onerror=()=>r(null)}catch(_){r(null)}});
const idbSet=h=>new Promise(r=>{try{const q=indexedDB.open('mp4d',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>{const t=q.result.transaction('kv','readwrite').objectStore('kv').put(h,'dir');t.onsuccess=()=>r(true);t.onerror=()=>r(false)};q.onerror=()=>r(false)}catch(_){r(false)}});
async function initSave(){
  if(window.showDirectoryPicker){
    $('pickDirBtn').hidden=false;
    try{
      const h=await idbGet();
      if(h){rootHandle=h;dirHandle=await h.getDirectoryHandle('mp4',{create:true})}
    }catch(_){}
    saveInfo.textContent=dirHandle?'Kayıt: İndirilenler/mp4 ✅':'Kayıt: İndirilenler — mp4 klasörü için bir kez seçin';
  }else{
    saveInfo.textContent='Kayıt: İndirilenler (otomatik indirme)';
  }
}
async function pickDir(){
  try{
    const h=await showDirectoryPicker({mode:'readwrite'});
    if((await h.requestPermission({mode:'readwrite'}))!=='granted')throw new Error('Yazma izni verilmedi');
    rootHandle=h;dirHandle=await h.getDirectoryHandle('mp4',{create:true});
    await idbSet(h);
    saveInfo.textContent='Kayıt: İndirilenler/mp4 ✅ (klasör oluşturuldu)';
  }catch(e){if(e.name!=='AbortError')saveInfo.textContent='Klasör seçilemedi: '+e.message}
}
async function ensurePerm(){
  if(!rootHandle)return;
  try{
    if((await rootHandle.queryPermission({mode:'readwrite'}))!=='granted'
      &&(await rootHandle.requestPermission({mode:'readwrite'}))!=='granted'){dirHandle=null;return}
    dirHandle=await rootHandle.getDirectoryHandle('mp4',{create:true});
  }catch(_){dirHandle=null}
}
async function saveOut(name,blob){
  if(dirHandle){
    try{
      const fh=await dirHandle.getFileHandle(name,{create:true});
      const w=await fh.createWritable();await w.write(blob);await w.close();
      return 'folder';
    }catch(e){console.warn('klasöre yazılamadı',e)}
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  return 'download';
}

/* --- dosya ekleme --- */
const ok=f=>f.type.startsWith('video/')||/\.(mp4|mkv|avi|mov|webm|flv|wmv|3gp|m4v)$/i.test(f.name);
const sz=b=>{const u=['B','KB','MB','GB'];let i=0;while(b>=1024&&i<3){b/=1024;i++}return b.toFixed(i?1:0)+' '+u[i]};
const CN={h264:'H.264',hevc:'H.265',mpeg4:'MPEG-4',mpeg2video:'MPEG-2',mpeg1video:'MPEG-1',vp9:'VP9',vp8:'VP8',mjpeg:'MJPEG',wmv3:'WMV3',wmv2:'WMV2',theora:'Theora',av1:'AV1',flv1:'FLV',h263:'H.263',vc1:'VC-1',
aac:'AAC',mp3:'MP3',opus:'Opus',vorbis:'Vorbis',ac3:'AC3',eac3:'E-AC3',mp2:'MP2',wmav2:'WMA',wmav1:'WMA',pcm_s16le:'PCM',pcm_s24le:'PCM',flac:'FLAC',alac:'ALAC',amr_nb:'AMR',amr_wb:'AMR'};
const metaText=it=>sz(it.file.size)+(it.srcFmt?' • '+it.srcFmt:'')+(it.doneFmt?' → '+it.doneFmt:'');

function addFile(file){
  if(!ok(file))return;
  if(queue.some(q=>q.file.name===file.name&&q.file.size===file.size))return;
  const item={file,url:null,state:'Bekliyor',done:false};
  queue.push(item);renderItem(item);updateBtns();
  job(()=>probe(item));
}
function renderItem(it){
  const li=document.createElement('li');
  li.innerHTML=`<span>📹</span><div class="nm"><div class="t"></div><small class="meta"></small></div><span class="st">Bekliyor</span>`;
  li.querySelector('.t').textContent=it.file.name;
  li.querySelector('.t').title=it.file.name;
  const x=document.createElement('button');x.className='x';x.textContent='✕';x.title='Kaldır';
  x.onclick=()=>{if(busy)return;if(it.url)URL.revokeObjectURL(it.url);queue=queue.filter(q=>q!==it);li.remove();updateBtns()};
  li.append(x);it.li=li;it.stEl=li.querySelector('.st');it.metaEl=li.querySelector('.meta');
  it.metaEl.textContent=metaText(it);list.append(li);
}
function setState(it,s){it.state=s;if(it.stEl)it.stEl.textContent=s}
function updateBtns(){
  convertBtn.disabled=!queue.length||busy;
  clearBtn.hidden=!queue.length;
}
const pick=()=>input.click();
drop.onclick=pick;
drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')pick()};
input.onchange=()=>{[...input.files].forEach(f=>addFile(f));input.value=''};
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,v=>{v.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,v=>{v.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>[...e.dataTransfer.files].forEach(f=>addFile(f)));
clearBtn.onclick=()=>{if(busy)return;queue.forEach(q=>q.url&&URL.revokeObjectURL(q.url));queue=[];list.innerHTML='';updateBtns();statusEl.textContent=''};
$('pickDirBtn').onclick=pickDir;

function drawBar(){
  const total=queue.length||1,pct=Math.round(((curIdx+curRatio)/total)*100);
  bar.style.width=pct+'%';
}

/* --- format tespiti (seçimde, arka planda) --- */
async function probe(it){
  if(it.srcFmt)return;
  if(!busy)statusEl.textContent='Format tespit ediliyor…';
  try{
    const buf=await readBuf(it.file);
    const info=await ask('probe',{buffer:buf}); // NOT: iç içe job() kilitlenir; probe zaten sıranın içinde
    const v=/Video:\s*([\w.]+)/.exec(info),au=/Audio:\s*([\w.]+)/.exec(info);
    const res=/Video:.*?(\d{2,5})x(\d{2,5})/.exec(info);
    const d=/Duration:\s*(\d+):(\d+):([\d.]+)/.exec(info);
    if(d)it.duration=(+d[1])*3600+(+d[2])*60+parseFloat(d[3]);
    const ext=(it.file.name.split('.').pop()||'').toUpperCase();
    it.srcFmt=(v||au)?ext+' · '+(v?(CN[v[1]]||v[1]):'?')+(au?' + '+(CN[au[1]]||au[1]):'')+(res?' • '+res[1]+'x'+res[2]:''):'bilinmiyor';
  }catch(e){it.srcFmt='bilinmiyor'}
  it.metaEl.textContent=metaText(it);
  if(!busy)statusEl.textContent='';
}

/* --- çıktı formatları --- */
const FMT={
  mp4:{ext:'mp4',mime:'video/mp4',label:'MP4 · H.264 + AAC'},
  hevc:{ext:'mp4',mime:'video/mp4',label:'MP4 · H.265 + AAC'},
  mkv:{ext:'mkv',mime:'video/x-matroska',label:'MKV · H.264 + AAC'},
  webm:{ext:'webm',mime:'video/webm',label:'WEBM · VP9 + Opus'},
  avi:{ext:'avi',mime:'video/x-msvideo',label:'AVI · MPEG-4 + MP3'},
  mp3:{ext:'mp3',mime:'audio/mpeg',label:'MP3 (ses)'},
  gif:{ext:'gif',mime:'image/gif',label:'GIF (animasyon)'}
};
const outName=n=>n.replace(/\.[^.]+$/,'')+'.'+FMT[$('format').value].ext;
function args(it){
  const f=$('format').value,q=$('quality').value,r=$('resolution').value;
  const T=parseFloat($('targetMB').value)||0,a=['-i','input'];
  const ext=FMT[f].ext;
  if(f==='gif'){
    const h=r==='original'?480:r,fps={fast:'8',balanced:'10',high:'15'}[q];
    return a.concat('-filter_complex',`[0:v]fps=${fps},scale=-2:${h}:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`,'-loop','0','-y','output.gif');
  }
  if(f==='mp3'){
    let br={fast:'160k',balanced:'192k',high:'320k'}[q];
    if(T>0&&it.duration>0)br=Math.min(320,Math.max(48,Math.floor(T*1024*8/it.duration)-8))+'k';
    return a.concat('-vn','-c:a','libmp3lame','-b:a',br,'-y','output.mp3');
  }
  // Kodekleri koru: sadece yeniden paketle (saniyeler içinde, kayıpsız)
  if($('keepCodecs').checked&&['mp4','mkv','mov'].includes(f)&&r==='original'&&!T){
    a.push('-map','0:v','-map','0:a?','-c','copy');
    if(f!=='mkv')a.push('-movflags','+faststart');
    return a.concat('-y','output.'+ext);
  }
  if(r!=='original')a.push('-vf',`scale=-2:${r}`);
  const useBR=T>0&&it.duration>0;
  const vopt=useBR?(()=>{const vb=Math.max(80,Math.floor(T*1024*8/it.duration)-138);
    return ['-b:v',vb+'k','-maxrate',Math.round(vb*1.5)+'k','-bufsize',(vb*3)+'k']})():null;
  if(f==='webm'){
    a.push('-c:v','libvpx-vp9');
    a.push(...(vopt||['-crf',{fast:'40',balanced:'33',high:'26'}[q],'-b:v','0']));
    a.push('-deadline','good','-cpu-used',{fast:'5',balanced:'4',high:'2'}[q],'-c:a','libopus','-b:a','128k');
  }else if(f==='avi'){
    a.push('-c:v','mpeg4');
    a.push(...(vopt||['-q:v',{fast:'8',balanced:'5',high:'3'}[q]]));
    a.push('-pix_fmt','yuv420p','-c:a','libmp3lame','-b:a','160k');
  }else{
    const hevc=f==='hevc';
    a.push('-c:v',hevc?'libx265':'libx264','-preset',{fast:'ultrafast',balanced:'veryfast',high:'medium'}[q]);
    a.push(...(vopt||['-crf',hevc?{fast:'30',balanced:'26',high:'22'}[q]:{fast:'28',balanced:'23',high:'18'}[q]]));
    a.push('-pix_fmt','yuv420p','-c:a','aac','-b:a','128k');
    if(hevc)a.push('-tag:v','hvc1');
    a.push('-movflags','+faststart');
  }
  return a.concat('-y','output.'+ext);
}

convertBtn.onclick=async()=>{
  if(busy||!queue.length)return;
  busy=true;updateBtns();statusEl.className='status';barWrap.hidden=false;curIdx=0;curRatio=0;
  await ensurePerm(); // kullanıcı hareketi içinde izin tazele
  try{
    for(let i=0;i<queue.length;i++){
      const it=queue[i];curIdx=i;curRatio=0;drawBar();
      if(it.done)continue;
      setState(it,'Dönüştürülüyor…');statusEl.textContent=`${i+1}/${queue.length}: ${it.file.name}`;
      try{
        const fd=FMT[$('format').value],ext=fd.ext,out='output.'+ext;
        const buf=await readBuf(it.file);
        const data=await job(()=>ask('convert',{buffer:buf,args:args(it),outName:out}));
        const blob=new Blob([data],{type:fd.mime});
        const name=outName(it.file.name);
        const where=await saveOut(name,blob);
        it.done=true;it.doneFmt=fd.label;it.metaEl.textContent=metaText(it);
        if(it.url)URL.revokeObjectURL(it.url);
        it.url=URL.createObjectURL(blob);
        it.stEl.textContent='';
        const sp=document.createElement('span');sp.textContent=where==='folder'?'Kaydedildi ✅':'İndirildi ✅';
        const a=document.createElement('a');a.href=it.url;a.download=name;a.textContent=' ⬇️';a.title='Yeniden indir';
        it.stEl.append(sp,a);
        it.state=where==='folder'?'Kaydedildi':'İndirildi';
      }catch(e){
        console.error(e);setState(it,'Hata ❌');
        it.metaEl.textContent=metaText(it)+' — '+String(e&&e.message||e).slice(0,80);
      }
      curRatio=1;drawBar();
    }
    statusEl.textContent='Bitti!';statusEl.className='status ok';
  }catch(e){statusEl.textContent=e.message;statusEl.className='status err'}
  busy=false;updateBtns();
};

initSave();
