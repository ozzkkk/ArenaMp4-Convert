'use strict';
/* MP4 Dönüştürücü — toplu, üzerine yazan, format tespitli sürüm (FFmpeg.wasm 0.11) */
const CORE='https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js'; // tek çekirdek: SharedArrayBuffer gerektirmez (GitHub Pages uyumlu)
const $=id=>document.getElementById(id);
const drop=$('drop'),input=$('fileInput'),list=$('list'),statusEl=$('status');
const convertBtn=$('convertBtn'),clearBtn=$('clearBtn'),dlAll=$('dlAll');
const barWrap=$('barWrap'),bar=$('bar');
let queue=[],ff=null,loadP=null,busy=false,curRatio=0,curIdx=0,chain=Promise.resolve();

if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* --- FFmpeg işleri sıralı çalışsın (run eşzamanlı olamaz) --- */
const job=fn=>{const p=chain.then(fn,fn);chain=p.then(()=>{},()=>{});return p};

/* --- dosya ekleme --- */
const ok=f=>f.type.startsWith('video/')||/\.(mp4|mkv|avi|mov|webm|flv|wmv|3gp|m4v)$/i.test(f.name);
const sz=b=>{const u=['B','KB','MB','GB'];let i=0;while(b>=1024&&i<3){b/=1024;i++}return b.toFixed(i?1:0)+' '+u[i]};
const CN={h264:'H.264',hevc:'H.265',mpeg4:'MPEG-4',mpeg2video:'MPEG-2',mpeg1video:'MPEG-1',vp9:'VP9',vp8:'VP8',mjpeg:'MJPEG',wmv3:'WMV3',wmv2:'WMV2',theora:'Theora',av1:'AV1',flv1:'FLV',h263:'H.263',vc1:'VC-1',
aac:'AAC',mp3:'MP3',opus:'Opus',vorbis:'Vorbis',ac3:'AC3',eac3:'E-AC3',mp2:'MP2',wmav2:'WMA',wmav1:'WMA',pcm_s16le:'PCM',pcm_s24le:'PCM',flac:'FLAC',alac:'ALAC',amr_nb:'AMR',amr_wb:'AMR'};
const metaText=it=>sz(it.file.size)+(it.srcFmt?' • '+it.srcFmt:'')+(it.doneFmt?' → '+it.doneFmt:'');

function addFile(file,handle){
  if(!ok(file))return;
  if(queue.some(q=>q.file.name===file.name&&q.file.size===file.size))return;
  const item={file,handle:handle||null,url:null,state:'Bekliyor'};
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
  dlAll.hidden=!queue.some(q=>q.url);
}
async function pick(){
  if(busy)return;
  if(window.showOpenFilePicker){
    try{
      const hs=await showOpenFilePicker({multiple:true,types:[{description:'Videolar',accept:{'video/*':['.mp4','.mkv','.avi','.mov','.webm','.flv','.wmv','.3gp','.m4v']}}]});
      for(const h of hs)addFile(await h.getFile(),h);
      return;
    }catch(e){if(e.name==='AbortError')return}
  }
  input.click();
}
$('addBtn').onclick=pick;drop.onclick=pick;
drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')pick()};
input.onchange=()=>{[...input.files].forEach(f=>addFile(f));input.value=''};
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,v=>{v.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,v=>{v.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>[...e.dataTransfer.files].forEach(f=>addFile(f)));
clearBtn.onclick=()=>{if(busy)return;queue.forEach(q=>q.url&&URL.revokeObjectURL(q.url));queue=[];list.innerHTML='';updateBtns();statusEl.textContent=''};

/* --- FFmpeg --- */
function reset(){try{ff&&ff.exit()}catch(_){}ff=null;loadP=null} // bozuk örneği at, tazesini yükle
function ensure(){
  if(ff&&loadP===null)return Promise.resolve(ff);
  if(loadP)return loadP;
  if(typeof FFmpeg==='undefined')return Promise.reject(new Error('FFmpeg yüklenemedi, interneti kontrol edin.'));
  if(!busy)statusEl.textContent='Motor indiriliyor (~30 MB, bir kez)…';
  barWrap.hidden=false;
  ff=FFmpeg.createFFmpeg({log:false,corePath:CORE,mainName:'main'}); // core-st: giriş _main
  ff.setProgress(({ratio})=>{curRatio=ratio;if(busy)drawBar()});
  loadP=ff.load().then(()=>{if(!busy)statusEl.textContent='';return ff},e=>{loadP=null;throw e});
  return loadP;
}
function drawBar(){
  const total=queue.length||1,pct=Math.round(((curIdx+curRatio)/total)*100);
  bar.style.width=pct+'%';
}
/* --- format tespiti (seçimde, arka planda) --- */
async function probe(it){
  if(it.srcFmt)return;
  if(!busy)statusEl.textContent='Format tespit ediliyor…';
  try{
    let info='';
    try{
      const f=await ensure();
      await f.FS('writeFile','probe_in',await FFmpeg.fetchFile(it.file));
      f.setLogger(({message})=>info+=message+'\n');
      await f.run('-hide_banner','-i','probe_in','-t','1','-f','null','-');
    }finally{reset()} // çekirdek tek komuttan sonra ölür; her işten sonra tazele
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
  if(f==='gif'){
    const h=r==='original'?480:r,fps={fast:'8',balanced:'10',high:'15'}[q];
    return a.concat('-filter_complex',`[0:v]fps=${fps},scale=-2:${h}:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`,'-loop','0','-y','output.gif');
  }
  if(f==='mp3'){
    let br={fast:'160k',balanced:'192k',high:'320k'}[q];
    if(T>0&&it.duration>0)br=Math.min(320,Math.max(48,Math.floor(T*1024*8/it.duration)-8))+'k';
    return a.concat('-vn','-c:a','libmp3lame','-b:a',br,'-y','output.mp3');
  }
  if(r!=='original')a.push('-vf',`scale=-2:${r}`);
  // Hedef boyut verildiyse bitrate hesapla (süre bilgisi gerekir)
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
  return a.concat('-y','output.'+FMT[f].ext);
}
async function overwrite(handle,blob){
  if((await handle.requestPermission({mode:'readwrite'}))!=='granted')throw new Error('Yazma izni yok');
  const w=await handle.createWritable();await w.write(blob);await w.close();
}

convertBtn.onclick=async()=>{
  if(busy||!queue.length)return;
  busy=true;updateBtns();statusEl.className='status';barWrap.hidden=false;curIdx=0;curRatio=0;
  try{
    for(let i=0;i<queue.length;i++){
      const it=queue[i];curIdx=i;curRatio=0;drawBar();
      if(it.state==='Hazır ✅'||it.state.startsWith('Yazıldı'))continue;
      setState(it,'Dönüştürülüyor…');statusEl.textContent=`${i+1}/${queue.length}: ${it.file.name}`;
      try{
        const fd=FMT[$('format').value],ext=fd.ext,out='output.'+ext;
        const data=await job(async()=>{ // tek sıradaki bütün iş: probe ile çakışmasın
          try{
            const f=await ensure();
            await f.FS('writeFile','input',await FFmpeg.fetchFile(it.file));
            await f.run(...args(it));
            return new Uint8Array(f.FS('readFile',out));
          }finally{reset()} // çekirdek tek komuttan sonra ölür
        });
        const blob=new Blob([data],{type:fd.mime});
        // Önce orijinalin üzerine yazmayı dene (uzantı eşleşiyorsa)
        let done=false;
        if($('overwrite').checked&&it.handle&&it.file.name.toLowerCase().endsWith('.'+ext)){
          try{await overwrite(it.handle,blob);done=true}catch(e){console.warn(e)}
        }
        it.doneFmt=fd.label;it.metaEl.textContent=metaText(it);
        if(done){setState(it,'Yazıldı ✅')}
        else{
          if(it.url)URL.revokeObjectURL(it.url);
          it.url=URL.createObjectURL(blob);
          const a=document.createElement('a');a.href=it.url;a.download=outName(it.file.name);a.textContent='⬇️ '+ext.toUpperCase();
          it.stEl.replaceWith(a);it.stEl=a;it.state='Hazır ✅';
        }
      }catch(e){console.error(e);reset();setState(it,'Hata ❌')}
      curRatio=1;drawBar();
    }
    statusEl.textContent='Bitti!';statusEl.className='status ok';
  }catch(e){reset();statusEl.textContent=e.message;statusEl.className='status err'}
  busy=false;updateBtns();
};

/* --- toplu indirme (üzerine yazılamayanlar için) --- */
dlAll.onclick=async()=>{
  const items=queue.filter(q=>q.url);
  for(const it of items){
    const a=document.createElement('a');a.href=it.url;a.download=outName(it.file.name);
    document.body.append(a);a.click();a.remove();
    await new Promise(r=>setTimeout(r,600));
  }
};
