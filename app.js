'use strict';
/* MP4 Dönüştürücü — toplu, üzerine yazan, sade sürüm (FFmpeg.wasm 0.11) */
const CORE='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js';
const $=id=>document.getElementById(id);
const drop=$('drop'),input=$('fileInput'),list=$('list'),statusEl=$('status');
const convertBtn=$('convertBtn'),clearBtn=$('clearBtn'),dlAll=$('dlAll');
const barWrap=$('barWrap'),bar=$('bar');
let queue=[],ff=null,loaded=false,busy=false,curRatio=0,curIdx=0;

if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* --- dosya ekleme --- */
const ok=f=>f.type.startsWith('video/')||/\.(mp4|mkv|avi|mov|webm|flv|wmv|3gp|m4v)$/i.test(f.name);
const sz=b=>{const u=['B','KB','MB','GB'];let i=0;while(b>=1024&&i<3){b/=1024;i++}return b.toFixed(i?1:0)+' '+u[i]};
function addFile(file,handle){
  if(!ok(file))return;
  if(queue.some(q=>q.file.name===file.name&&q.file.size===file.size))return;
  const item={file,handle:handle||null,url:null,state:'Bekliyor'};
  queue.push(item);renderItem(item);updateBtns();
}
function renderItem(it){
  const li=document.createElement('li');
  li.innerHTML=`<span>📹</span><span class="nm" title="${it.file.name}">${it.file.name} <small style="color:#94a3b8">${sz(it.file.size)}</small></span><span class="st">${it.state}</span>`;
  const x=document.createElement('button');x.className='x';x.textContent='✕';x.title='Kaldır';
  x.onclick=()=>{if(busy)return;if(it.url)URL.revokeObjectURL(it.url);queue=queue.filter(q=>q!==it);li.remove();updateBtns()};
  li.append(x);it.li=li;it.stEl=li.querySelector('.st');list.append(li);
}
function setState(it,s){it.state=s;if(it.stEl)it.stEl.textContent=s}
function updateBtns(){
  convertBtn.disabled=!queue.length||busy;
  clearBtn.hidden=!queue.length;
  dlAll.hidden=!queue.some(q=>q.url);
}
async function pick(){
  if(busy)return;
  // Üzerine yazabilmek için dosya tutamacı (handle) almaya çalış
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
async function ensure(){
  if(loaded)return ff;
  if(typeof FFmpeg==='undefined')throw new Error('FFmpeg yüklenemedi, interneti kontrol edin.');
  statusEl.textContent='Motor indiriliyor (~30 MB, bir kez)…';barWrap.hidden=false;
  ff=FFmpeg.createFFmpeg({log:false,corePath:CORE});
  ff.setProgress(({ratio})=>{curRatio=ratio;drawBar()});
  await ff.load();loaded=true;return ff;
}
function drawBar(){
  const total=queue.length||1,pct=Math.round(((curIdx+curRatio)/total)*100);
  bar.style.width=pct+'%';
}
function args(){
  const p={fast:['ultrafast','28'],balanced:['veryfast','23'],high:['medium','18']}[$('quality').value];
  const a=['-i','input','-c:v','libx264','-preset',p[0],'-crf',p[1],'-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart'];
  if($('resolution').value!=='original')a.splice(2,0,'-vf',`scale=-2:${$('resolution').value}`);
  return a.concat('-y','output.mp4');
}
async function overwrite(handle,blob){
  if((await handle.requestPermission({mode:'readwrite'}))!=='granted')throw new Error('Yazma izni yok');
  const w=await handle.createWritable();await w.write(blob);await w.close();
}

convertBtn.onclick=async()=>{
  if(busy||!queue.length)return;
  busy=true;updateBtns();statusEl.className='status';barWrap.hidden=false;curIdx=0;curRatio=0;
  try{
    const f=await ensure();
    for(let i=0;i<queue.length;i++){
      const it=queue[i];curIdx=i;curRatio=0;drawBar();
      if(it.state==='Hazır ✅'||it.state.startsWith('Yazıldı'))continue;
      setState(it,'Dönüştürülüyor…');statusEl.textContent=`${i+1}/${queue.length}: ${it.file.name}`;
      try{
        await f.FS('writeFile','input',await FFmpeg.fetchFile(it.file));
        await f.run(...args());
        const blob=new Blob([new Uint8Array(f.FS('readFile','output.mp4'))],{type:'video/mp4'});
        try{f.FS('unlink','input');f.FS('unlink','output.mp4')}catch(_){}
        // Önce orijinalin üzerine yazmayı dene
        let done=false;
        if($('overwrite').checked&&it.handle){
          try{await overwrite(it.handle,blob);done=true}catch(e){console.warn(e)}
        }
        if(done){setState(it,'Yazıldı ✅')}
        else{
          if(it.url)URL.revokeObjectURL(it.url);
          it.url=URL.createObjectURL(blob);
          const a=document.createElement('a');a.href=it.url;a.download=it.file.name.replace(/\.[^.]+$/,'')+'.mp4';a.textContent='⬇️ MP4';
          it.stEl.replaceWith(a);it.stEl=a;it.state='Hazır ✅';
        }
      }catch(e){console.error(e);setState(it,'Hata ❌')}
      curRatio=1;drawBar();
    }
    statusEl.textContent='Bitti!';statusEl.className='status ok';
  }catch(e){statusEl.textContent=e.message;statusEl.className='status err'}
  busy=false;updateBtns();
};

/* --- toplu indirme (üzerine yazılamayanlar için) --- */
dlAll.onclick=async()=>{
  const items=queue.filter(q=>q.url);
  for(const it of items){
    const a=document.createElement('a');a.href=it.url;a.download=it.file.name.replace(/\.[^.]+$/,'')+'.mp4';
    document.body.append(a);a.click();a.remove();
    await new Promise(r=>setTimeout(r,600));
  }
};
