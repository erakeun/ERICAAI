document.getElementById('exportPNG').addEventListener('click',async function(){
 const button=this;button.disabled=true;
 try{await document.fonts.ready;const card=document.querySelector('#previewSlot .badge');await Promise.all([...card.querySelectorAll('img')].map(i=>i.decode()));
 const clone=card.cloneNode(true);const computed=getComputedStyle(card);
 for(const key of computed)if(key.startsWith('--'))clone.style.setProperty(key,computed.getPropertyValue(key));
 clone.style.position='fixed';clone.style.left='0';clone.style.top='0';clone.style.transform='none';clone.style.zIndex='-1';document.body.append(clone);
 // html2canvas does not implement object-fit; give artwork its true aspect ratio.
 for(const img of clone.querySelectorAll('img')){const box=img.getBoundingClientRect(),ratio=img.naturalWidth/img.naturalHeight;let w=box.width,h=w/ratio;if(h>box.height){h=box.height;w=h*ratio;}img.style.width=w+'px';img.style.height=h+'px';}
 try{const canvas=await html2canvas(clone,{scale:300/96,backgroundColor:'#fff',logging:false});const link=document.createElement('a');link.download='경기대학교-명찰.png';link.href=canvas.toDataURL('image/png');link.click();}finally{clone.remove();}
 }catch(e){alert('PNG를 만들지 못했습니다. 이미지와 내용을 확인해 주세요.');console.error(e);}finally{button.disabled=false;}
});
