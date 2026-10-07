const SUPABASE_URL="https://lmwdxqispxslaetubbrb.supabase.co";
const SUPABASE_KEY="sb_publishable_oEF4vjw8OwTpSMRfUMgMCg_yVuJHzfx";
const $=s=>document.querySelector(s);
const rub=n=>new Intl.NumberFormat("ru-RU").format(Number(n||0))+" ₽";
let services=[],addons=[],selectedService=null,selectedAddons=[],selectedSlot=null;

async function api(path,options={}){
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,"Content-Type":"application/json",...(options.headers||{})}});
  const text=await r.text(); const data=text?JSON.parse(text):null;
  if(!r.ok) throw new Error(data?.message||data?.hint||"Ошибка связи с базой");
  return data;
}
async function rpc(name,body){
  return api("rpc/"+name,{method:"POST",body:JSON.stringify(body)});
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

async function loadSite(){
  try{services=await api("services?select=*&active=eq.true&order=id.asc");renderServices()}catch(e){console.error("services",e)}
  try{addons=await api("service_addons?select=*&active=eq.true&order=id.asc")}catch(e){console.error("addons",e);addons=[]}
  renderPromo();
  renderGallery();
}
function renderServices(){
  $("#services").innerHTML=services.map(s=>'<article class="service" data-id="'+s.id+'">'+
    (s.image_url?'<img class="service-img" src="'+escapeHtml(s.image_url)+'" alt="">':'')+
    '<div class="service-body"><h3>'+escapeHtml(s.name)+'</h3><p class="service-desc">'+escapeHtml(s.description||"")+'</p><div class="service-meta"><span>'+s.duration_minutes+' мин</span><span>1 мастер</span></div><div class="service-price">'+rub(s.price)+'</div></div></article>').join("");
  document.querySelectorAll(".service").forEach(el=>el.onclick=()=>selectService(+el.dataset.id));
}
function selectService(id){
  selectedService=services.find(s=>s.id===id); selectedAddons=[]; selectedSlot=null;
  document.querySelectorAll(".service").forEach(el=>el.classList.toggle("active",+el.dataset.id===id));
  renderAddons(); updateSummary(); renderAvailableDates(); renderSlots();
  $("#booking").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderAddons(){
  const available=addons.filter(a=>!a.service_id||a.service_id===selectedService.id);
  if(!available.length){$("#addonsBlock").classList.add("hidden");return}
  $("#addonsBlock").classList.remove("hidden");
  $("#addons").innerHTML=available.map(a=>'<label class="addon-card"><input type="checkbox" value="'+a.id+'"><span><strong>'+escapeHtml(a.name)+'</strong><small>+'+a.duration_minutes+' мин · +'+rub(a.price)+'</small></span></label>').join("");
  document.querySelectorAll("#addons input").forEach(i=>i.onchange=()=>{
    selectedAddons=[...document.querySelectorAll("#addons input:checked")].map(x=>Number(x.value)); selectedSlot=null; updateSummary(); renderAvailableDates(); renderSlots();
  });
}
function updateSummary(){
  if(!selectedService){$("#bookingSummary").textContent="Сначала выберите услугу";return}
  const aa=addons.filter(a=>selectedAddons.includes(a.id));
  const dur=selectedService.duration_minutes+aa.reduce((s,a)=>s+a.duration_minutes,0);
  const price=selectedService.price+aa.reduce((s,a)=>s+a.price,0);
  $("#bookingSummary").textContent=selectedService.name+" · "+dur+" мин · "+rub(price);
}
function moscowToday(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function setMinDate(){
  const iso=moscowToday(); $("#bookingDate").min=iso; $("#bookingDate").value=iso;
}
async function renderAvailableDates(){
  if(!selectedService){$("#dateChips").innerHTML="";return}
  $("#dateChips").innerHTML='<span class="note">Ищем свободные даты…</span>';
  try{
    const data=await rpc("get_available_dates",{p_from:moscowToday(),p_days:14,p_service_id:selectedService.id,p_addon_ids:selectedAddons});
    $("#dateChips").innerHTML=(data||[]).slice(0,8).map(x=>'<button type="button" class="date-chip" data-date="'+x.day+'"><strong>'+new Date(x.day+"T12:00:00").toLocaleDateString("ru-RU",{day:"2-digit",month:"short"})+'</strong><small>'+x.slots_count+' окон</small></button>').join("")||'<span class="note">В ближайшие две недели свободных дат нет</span>';
    document.querySelectorAll(".date-chip").forEach(b=>b.onclick=()=>{$("#bookingDate").value=b.dataset.date;renderSlots();});
  }catch(e){$("#dateChips").innerHTML='<span class="note danger">'+escapeHtml(e.message)+'</span>'}
}
async function renderSlots(){
  selectedSlot=null;
  if(!selectedService){$("#slots").innerHTML='<span class="note">Сначала выберите услугу</span>';return}
  $("#slots").innerHTML='<span class="note">Проверяем свободное время…</span>';
  try{
    const data=await rpc("get_available_slots",{p_date:$("#bookingDate").value,p_service_id:selectedService.id,p_addon_ids:selectedAddons});
    $("#slots").innerHTML=(data||[]).length?(data||[]).map(x=>'<button type="button" class="slot" data-time="'+x.slot+'">'+x.slot+'</button>').join(""):'<span class="note">На эту дату свободного времени нет</span>';
    document.querySelectorAll(".slot").forEach(el=>el.onclick=()=>{selectedSlot=el.dataset.time;document.querySelectorAll(".slot").forEach(x=>x.classList.remove("active"));el.classList.add("active")});
  }catch(e){$("#slots").innerHTML='<span class="note danger">'+escapeHtml(e.message)+'</span>'}
}
async function renderPromo(){
  try{
    const data=await api("promos?select=*&active=eq.true&order=id.desc&limit=1");
    const p=data?.[0]; if(!p) return;
    $(".promo-card").innerHTML='<strong>'+escapeHtml(p.title)+'</strong><span>'+escapeHtml(p.body||"")+'</span><small>Акция действует в указанные администратором даты.</small>';
    if(p.image_url) $(".promo").style.backgroundImage='linear-gradient(90deg,rgba(255,255,255,.95),rgba(255,245,249,.83)),url("'+p.image_url+'")';
  }catch{}
}
async function renderGallery(){
  try{
    const data=await api("gallery?select=*&active=eq.true&order=sort_order.asc");
    const cats=["Маникюр","Френч","Педикюр","Дизайн"];
    $("#gallery").innerHTML=cats.map(cat=>{
      const items=(data||[]).filter(g=>(g.category||"Маникюр")===cat);
      if(!items.length) return "";
      return '<section class="gallery-section"><div class="gallery-section-head"><h3>'+cat+'</h3><span>'+items.length+' фото</span></div><div class="gallery">'+items.map(g=>'<figure class="gallery-photo"><img loading="lazy" src="'+escapeHtml(g.image_url)+'" alt="'+escapeHtml(g.caption||cat)+'"><figcaption>'+escapeHtml(g.caption||"")+'</figcaption></figure>').join("")+'</div></section>';
    }).join("");
    bindGalleryLightbox();
    document.querySelectorAll("#gallery img").forEach(img=>img.addEventListener("error",()=>{
      const card=img.closest(".gallery-photo");
      if(card) card.remove();
    },{once:true}));
  }catch{}
}
function showModal(text){$("#modalText").textContent=text;$("#modal").classList.remove("hidden")}
$("#bookingForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!selectedService){alert("Сначала выберите услугу");return}
  if(!selectedSlot){alert("Выберите свободное время");return}
  const f=Object.fromEntries(new FormData(e.currentTarget));
  const hasMessenger=!!(f.notify_whatsapp||f.notify_telegram||f.notify_max);
  const notifyError=$("#notifyError");
  if(!hasMessenger){
    notifyError.classList.remove("hidden");
    notifyError.scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  notifyError.classList.add("hidden");
  const btn=e.currentTarget.querySelector('button[type="submit"]'); btn.disabled=true; btn.textContent="Сохраняем…";
  try{
    await rpc("create_appointment",{p_client_name:f.name,p_client_phone:f.phone,p_service_id:selectedService.id,p_date:$("#bookingDate").value,p_time:selectedSlot,p_comment:f.comment||"",p_addon_ids:selectedAddons,p_notify_whatsapp:!!f.notify_whatsapp,p_notify_telegram:!!f.notify_telegram,p_notify_max:!!f.notify_max});
    showModal(f.name+", заявка отправлена мастеру: "+selectedService.name+", "+$("#bookingDate").value+" в "+selectedSlot+". После подтверждения вы получите уведомление.");
    e.currentTarget.reset(); await renderSlots();
  }catch(err){alert(err.message)}
  finally{btn.disabled=false;btn.textContent="Отправить заявку"}
});
$("#bookingDate").addEventListener("change",renderSlots);
$("#scrollBooking").onclick=()=>$("#booking").scrollIntoView({behavior:"smooth"});
$("#promoBook").onclick=()=>$("#services").scrollIntoView({behavior:"smooth"});
$("#closeModal").onclick=$("#modalOk").onclick=()=>$("#modal").classList.add("hidden");
setMinDate(); loadSite();
document.querySelectorAll('#bookingForm input[name^="notify_"]').forEach(i=>i.addEventListener("change",()=>{
  const any=[...document.querySelectorAll('#bookingForm input[name^="notify_"]')].some(x=>x.checked);
  if(any) $("#notifyError").classList.add("hidden");
}));


let galleryItems=[],galleryIndex=0;
function collectGalleryItems(){
  galleryItems=[...document.querySelectorAll("#gallery .gallery-photo")].map(card=>({
    src:card.querySelector("img")?.src||"",
    caption:card.querySelector("figcaption")?.textContent||"",
    category:card.closest(".gallery-section")?.querySelector(".gallery-section-head h3")?.textContent||""
  })).filter(x=>x.src);
}
function showGalleryItem(index){
  if(!galleryItems.length) return;
  galleryIndex=(index+galleryItems.length)%galleryItems.length;
  const item=galleryItems[galleryIndex];
  $("#lightboxImage").src=item.src;
  $("#lightboxImage").alt=item.caption||item.category||"Фото";
  $("#lightboxCaption").textContent=[item.category,item.caption].filter(Boolean).join(" — ");
  $("#lightboxCounter").textContent=(galleryIndex+1)+" / "+galleryItems.length;
}
function openLightbox(index){
  collectGalleryItems();
  if(!galleryItems.length) return;
  $("#galleryLightbox").classList.remove("hidden");
  document.body.classList.add("no-scroll");
  showGalleryItem(index);
}
function closeLightbox(){
  $("#galleryLightbox").classList.add("hidden");
  document.body.classList.remove("no-scroll");
}
function bindGalleryLightbox(){
  const cards=[...document.querySelectorAll("#gallery .gallery-photo")];
  cards.forEach((card,i)=>{
    card.classList.add("clickable-photo");
    card.onclick=()=>openLightbox(i);
  });
}
$("#lightboxClose").onclick=closeLightbox;
$("#lightboxPrev").onclick=()=>showGalleryItem(galleryIndex-1);
$("#lightboxNext").onclick=()=>showGalleryItem(galleryIndex+1);
$("#galleryLightbox").addEventListener("click",e=>{if(e.target.id==="galleryLightbox") closeLightbox()});
document.addEventListener("keydown",e=>{
  if($("#galleryLightbox").classList.contains("hidden")) return;
  if(e.key==="Escape") closeLightbox();
  if(e.key==="ArrowLeft") showGalleryItem(galleryIndex-1);
  if(e.key==="ArrowRight") showGalleryItem(galleryIndex+1);
});
let touchStartX=null;
$("#galleryLightbox").addEventListener("touchstart",e=>{touchStartX=e.changedTouches[0].clientX},{passive:true});
$("#galleryLightbox").addEventListener("touchend",e=>{
  if(touchStartX===null) return;
  const dx=e.changedTouches[0].clientX-touchStartX;
  if(Math.abs(dx)>45) showGalleryItem(galleryIndex+(dx<0?1:-1));
  touchStartX=null;
},{passive:true});
