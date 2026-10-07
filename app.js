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
  renderAboutMasterVisibility();
  renderNotificationSettings();
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
  const base=available.filter(a=>!a.is_quantity_variant);
  if(!base.length){$("#addonsBlock").classList.add("hidden");return}
  $("#addonsBlock").classList.remove("hidden");

  $("#addons").innerHTML=base.map(a=>{
    if(a.quantity_group){
      const variants=available.filter(v=>v.quantity_group===a.quantity_group).sort((x,y)=>x.quantity_value-y.quantity_value);
      const first=variants[0];
      return '<div class="addon-card addon-counter-card" data-qty-card="'+a.quantity_group+'">'+
        '<label class="addon-main"><input type="checkbox" data-addon-group="'+a.quantity_group+'"><span><strong>'+escapeHtml(a.name)+'</strong><small>300 ₽ за 1 ноготь</small></span></label>'+
        '<div class="addon-counter disabled" data-counter="'+a.quantity_group+'">'+
          '<button type="button" class="qty-btn" data-qty-minus="'+a.quantity_group+'" aria-label="Уменьшить">−</button>'+
          '<span class="qty-value" data-qty-value="'+a.quantity_group+'">1</span>'+
          '<button type="button" class="qty-btn" data-qty-plus="'+a.quantity_group+'" aria-label="Увеличить">+</button>'+
          '<span class="qty-price" data-qty-price="'+a.quantity_group+'">'+rub(first?.price||300)+'</span>'+
        '</div>'+
      '</div>';
    }
    return '<label class="addon-card"><input type="checkbox" data-addon-id="'+a.id+'"><span><strong>'+escapeHtml(a.name)+'</strong><small>+'+a.duration_minutes+' мин · +'+rub(a.price)+'</small></span></label>';
  }).join("");

  const qtyState={};
  base.filter(a=>a.quantity_group).forEach(a=>qtyState[a.quantity_group]=1);

  function variantFor(group){
    const q=qtyState[group]||1;
    return available.find(v=>v.quantity_group===group&&Number(v.quantity_value)===q);
  }
  function syncAddons(){
    selectedAddons=[
      ...[...document.querySelectorAll("[data-addon-id]:checked")].map(x=>Number(x.dataset.addonId)),
      ...[...document.querySelectorAll("[data-addon-group]:checked")].map(x=>{
        const v=variantFor(x.dataset.addonGroup);
        return v?Number(v.id):null;
      }).filter(Boolean)
    ];
    selectedSlot=null;
    updateSummary();
    renderAvailableDates();
    renderSlots();
  }
  function updateCounter(group){
    const q=qtyState[group]||1;
    const v=variantFor(group);
    const value=document.querySelector('[data-qty-value="'+group+'"]');
    const price=document.querySelector('[data-qty-price="'+group+'"]');
    if(value)value.textContent=q;
    if(price)price.textContent=rub(v?.price||300*q);
    const minus=document.querySelector('[data-qty-minus="'+group+'"]');
    const plus=document.querySelector('[data-qty-plus="'+group+'"]');
    if(minus)minus.disabled=q<=1;
    if(plus)plus.disabled=q>=10;
  }

  document.querySelectorAll("[data-addon-id]").forEach(i=>i.onchange=syncAddons);
  document.querySelectorAll("[data-addon-group]").forEach(i=>i.onchange=()=>{
    const group=i.dataset.addonGroup;
    document.querySelector('[data-counter="'+group+'"]')?.classList.toggle("disabled",!i.checked);
    updateCounter(group);
    syncAddons();
  });
  document.querySelectorAll("[data-qty-minus]").forEach(b=>b.onclick=()=>{
    const group=b.dataset.qtyMinus;
    if(qtyState[group]>1){qtyState[group]--;updateCounter(group);syncAddons()}
  });
  document.querySelectorAll("[data-qty-plus]").forEach(b=>b.onclick=()=>{
    const group=b.dataset.qtyPlus;
    if(qtyState[group]<10){qtyState[group]++;updateCounter(group);syncAddons()}
  });
  Object.keys(qtyState).forEach(updateCounter);
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
      return '<section class="gallery-section"><div class="gallery-section-head"><h3>'+cat+'</h3><span>'+items.length+' фото</span></div><div class="gallery">'+items.map(g=>'<figure class="gallery-photo"><img loading="lazy" src="'+escapeHtml(g.image_url)+'" alt="'+escapeHtml(cat)+'"></figure>').join("")+'</div></section>';
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
  const availableMessengerInputs=[...document.querySelectorAll('#bookingForm input[name^="notify_"]')].filter(i=>!i.closest("label")?.classList.contains("hidden"));
  const hasMessenger=availableMessengerInputs.some(i=>i.checked);
  const notifyError=$("#notifyError");
  if(availableMessengerInputs.length&&!hasMessenger){
    notifyError.classList.remove("hidden");
    notifyError.scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  notifyError.classList.add("hidden");
  const btn=e.currentTarget.querySelector('button[type="submit"]'); btn.disabled=true; btn.textContent="Сохраняем…";
  try{
    const created=await rpc("create_appointment",{p_client_name:f.name,p_client_phone:f.phone,p_service_id:selectedService.id,p_date:$("#bookingDate").value,p_time:selectedSlot,p_comment:f.comment||"",p_addon_ids:selectedAddons,p_notify_whatsapp:!!f.notify_whatsapp,p_notify_telegram:!!f.notify_telegram,p_notify_max:!!f.notify_max});
    if(created?.chat_token){
      localStorage.setItem("nail_client_chat_token",created.chat_token);
      const list=JSON.parse(localStorage.getItem("nail_client_appointment_tokens")||"[]");
      if(!list.includes(created.chat_token)) list.push(created.chat_token);
      localStorage.setItem("nail_client_appointment_tokens",JSON.stringify(list.slice(-50)));
      $("#clientChatButton").classList.remove("hidden");
    }
    showModal(f.name+", заявка отправлена мастеру: "+selectedService.name+", "+$("#bookingDate").value+" в "+selectedSlot+". Статус записи можно посмотреть в разделе «Мои записи».");
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
    category:card.closest(".gallery-section")?.querySelector(".gallery-section-head h3")?.textContent||""
  })).filter(x=>x.src);
}
function showGalleryItem(index){
  if(!galleryItems.length) return;
  galleryIndex=(index+galleryItems.length)%galleryItems.length;
  const item=galleryItems[galleryIndex];
  $("#lightboxImage").src=item.src;
  $("#lightboxImage").alt=item.category||"Фото";
  $("#lightboxCaption").textContent=item.category||"";
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


/* ===== Мини-чат клиента ===== */
const CLIENT_CHAT_KEY="nail_client_chat_token";
const GUEST_CHAT_KEY="nail_guest_chat_token";
let clientChatTimer=null;
let clientChatMode="appointment";

function clientStatusText(s){
  return ({pending:"Ожидает подтверждения",confirmed:"Подтверждена",completed:"Выполнена",cancelled:"Отменена",no_show:"Не пришёл",booked:"Подтверждена"})[s]||s||"";
}
function clientTime(iso){
  return new Date(iso).toLocaleString("ru-RU",{timeZone:"Europe/Moscow",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function setChatMode(mode){
  clientChatMode=mode;
  const start=$("#guestChatStartForm");
  const msgs=$("#clientChatMessages");
  const compose=$("#clientChatForm");
  if(mode==="start"){
    start.classList.remove("hidden");
    msgs.classList.add("hidden");
    compose.classList.add("hidden");
    $("#clientChatMeta").textContent="Напишите мастеру до записи";
  }else{
    start.classList.add("hidden");
    msgs.classList.remove("hidden");
    compose.classList.remove("hidden");
  }
}
async function loadClientChat(){
  try{
    if(clientChatMode==="guest"){
      const token=localStorage.getItem(GUEST_CHAT_KEY);
      if(!token){setChatMode("start");return}
      const rows=await rpc("guest_chat_get",{p_token:token});
      if(!Array.isArray(rows)||!rows.length) throw new Error("Чат не найден");
      const h=rows[0];
      $("#clientChatMeta").textContent="Общий чат · "+(h.client_name||"");
      const messages=rows.filter(x=>x.message_id);
      $("#clientChatMessages").innerHTML=messages.length?messages.map(m=>'<div class="chat-bubble '+(m.sender==="client"?"mine":"theirs")+'"><div>'+escapeHtml(m.body)+'</div><small>'+clientTime(m.message_created_at)+'</small></div>').join(""):'<div class="chat-empty">Чат открыт. Напишите мастеру первое сообщение.</div>';
    }else{
      const token=localStorage.getItem(CLIENT_CHAT_KEY);
      if(!token){setChatMode("start");return}
      const rows=await rpc("client_get_chat",{p_token:token});
      if(!Array.isArray(rows)||!rows.length) throw new Error("Чат не найден");
      const h=rows[0];
      $("#clientChatMeta").textContent=(h.service_name||"")+" · "+clientTime(h.starts_at)+" · "+clientStatusText(h.status);
      const messages=rows.filter(x=>x.message_id);
      $("#clientChatMessages").innerHTML=messages.length?messages.map(m=>'<div class="chat-bubble '+(m.sender==="client"?"mine":"theirs")+'"><div>'+escapeHtml(m.body)+'</div><small>'+clientTime(m.message_created_at)+'</small></div>').join(""):'<div class="chat-empty">Сообщений пока нет. Можно написать мастеру по этой записи.</div>';
    }
    const box=$("#clientChatMessages");box.scrollTop=box.scrollHeight;
  }catch(e){
    $("#clientChatMessages").innerHTML='<div class="chat-empty">Не удалось открыть чат. Попробуйте ещё раз.</div>';
  }
}
function openClientChat(){
  const appointmentToken=localStorage.getItem(CLIENT_CHAT_KEY);
  const guestToken=localStorage.getItem(GUEST_CHAT_KEY);
  if(appointmentToken){setChatMode("appointment")}
  else if(guestToken){setChatMode("guest")}
  else setChatMode("start");
  $("#clientChatPanel").classList.remove("hidden");
  if(clientChatMode!=="start") loadClientChat();
  clearInterval(clientChatTimer);
  clientChatTimer=setInterval(()=>{if(clientChatMode!=="start")loadClientChat()},5000);
}
function closeClientChat(){
  $("#clientChatPanel").classList.add("hidden");
  clearInterval(clientChatTimer);clientChatTimer=null;
}
$("#clientChatButton").onclick=openClientChat;
$("#clientChatClose").onclick=closeClientChat;

$("#guestChatStartForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("#guestChatName").value.trim();
  const phone=$("#guestChatPhone").value.trim();
  const msg=$("#guestChatStartMessage");
  const btn=e.currentTarget.querySelector("button");
  btn.disabled=true;
  try{
    const token=await rpc("guest_chat_start",{p_name:name,p_phone:phone});
    localStorage.setItem(GUEST_CHAT_KEY,String(token));
    setChatMode("guest");
    await loadClientChat();
  }catch(err){
    msg.textContent=err.message;msg.className="auth-message error";
  }finally{btn.disabled=false}
});

$("#clientChatForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const input=$("#clientChatInput");
  const body=input.value.trim();
  if(!body) return;
  const btn=e.currentTarget.querySelector("button");btn.disabled=true;
  try{
    if(clientChatMode==="guest"){
      const token=localStorage.getItem(GUEST_CHAT_KEY);
      if(!token) return setChatMode("start");
      await rpc("guest_chat_send",{p_token:token,p_body:body});
    }else{
      const token=localStorage.getItem(CLIENT_CHAT_KEY);
      if(!token) return setChatMode("start");
      await rpc("client_send_chat_message",{p_token:token,p_body:body});
    }
    input.value="";
    await loadClientChat();
  }catch(err){alert(err.message)}
  finally{btn.disabled=false}
});

const backToTop=$("#backToTop");
function toggleBackToTop(){
  if(window.scrollY>500) backToTop.classList.remove("hidden");
  else backToTop.classList.add("hidden");
}
window.addEventListener("scroll",toggleBackToTop,{passive:true});
backToTop.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
toggleBackToTop();

async function renderAboutMasterVisibility(){
  try{
    const rows=await api("site_settings?select=show_about_master&id=eq.1");
    const show=rows?.[0]?.show_about_master!==false;
    const about=$("#aboutMaster");
    const aboutLink=document.querySelector('a[href="#aboutMaster"]');
    const hero=$("#promo");
    if(about) about.classList.toggle("hidden",!show);
    if(aboutLink) aboutLink.classList.toggle("hidden",!show);
    document.querySelectorAll("[data-master-info]").forEach(el=>el.classList.toggle("hidden",!show));
    if(hero) hero.classList.toggle("master-info-hidden",!show);
  }catch{}
}

async function renderNotificationSettings(){
  try{
    const rows=await api("site_settings?select=enable_notify_whatsapp,enable_notify_telegram,enable_notify_max&id=eq.1");
    const s=rows?.[0]||{};
    const map={
      notify_whatsapp:!!s.enable_notify_whatsapp,
      notify_telegram:!!s.enable_notify_telegram,
      notify_max:!!s.enable_notify_max
    };
    let enabled=0;
    Object.entries(map).forEach(([name,show])=>{
      const input=document.querySelector('#bookingForm input[name="'+name+'"]');
      const label=input?.closest("label");
      if(label)label.classList.toggle("hidden",!show);
      if(input&&!show)input.checked=false;
      if(show)enabled++;
    });
    const box=document.querySelector(".notify-box");
    if(box)box.classList.toggle("hidden",enabled===0);
    const note=box?.querySelector("small");
    if(note&&enabled)note.textContent="Выберите хотя бы один доступный мессенджер для уведомлений.";
    $("#notifyError")?.classList.add("hidden");
  }catch(e){console.error("notification settings",e)}
}


/* ===== Мои записи ===== */
const CLIENT_APPOINTMENTS_KEY="nail_client_appointment_tokens";

function appointmentTokens(){
  let list=[];
  try{list=JSON.parse(localStorage.getItem(CLIENT_APPOINTMENTS_KEY)||"[]")}catch{}
  const legacy=localStorage.getItem(CLIENT_CHAT_KEY);
  if(legacy&&!list.includes(legacy)) list.push(legacy);
  return [...new Set(list.filter(Boolean))];
}
function clientDateTime(iso){
  return new Date(iso).toLocaleString("ru-RU",{timeZone:"Europe/Moscow",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function historyText(h){
  if(h.event_type==="moved"&&h.old_starts_at&&h.new_starts_at){
    return "Перенесено: было "+clientDateTime(h.old_starts_at)+" → стало "+clientDateTime(h.new_starts_at);
  }
  if(h.event_type==="status_changed"){
    return "Статус изменён: "+clientStatusText(h.old_status)+" → "+clientStatusText(h.new_status);
  }
  if(h.event_type==="service_changed") return "Изменены услуга или дополнения";
  return "Запись изменена";
}
function appointmentCard(a){
  const addonsText=(a.addons||[]).map(x=>x.name).filter(Boolean).join(", ");
  const hist=(a.history||[]).length
    ? '<div class="appointment-history"><strong>История изменений</strong>'+a.history.map(h=>'<div>'+escapeHtml(historyText(h))+'</div>').join("")+'</div>'
    : "";
  return '<article class="my-appointment-card">'+
    '<div class="my-appointment-top"><div><strong>'+escapeHtml(a.service_name)+'</strong><span>'+clientDateTime(a.starts_at)+'</span></div><span class="status '+escapeHtml(a.status)+'">'+escapeHtml(clientStatusText(a.status))+'</span></div>'+
    (addonsText?'<p><b>Дополнения:</b> '+escapeHtml(addonsText)+'</p>':'')+
    '<p><b>Стоимость:</b> '+rub(a.total_price)+'</p>'+
    (a.comment?'<p><b>Комментарий:</b> '+escapeHtml(a.comment)+'</p>':'')+
    hist+
    '<div class="admin-actions"><button type="button" class="small" data-my-repeat="'+a.appointment_id+'">Повторить</button><button type="button" class="small" data-my-chat="'+a.appointment_id+'">Чат</button></div>'+
  '</article>';
}
let myAppointmentsCache=[];
async function loadMyAppointments(){
  const list=$("#myAppointmentsList");
  list.innerHTML='<div class="empty-state">Загружаем записи…</div>';
  let rows=[];
  const accountToken=localStorage.getItem(CLIENT_ACCOUNT_TOKEN_KEY);

  if(accountToken){
    try{
      const data=await rpc("client_account_appointments",{p_token:accountToken});
      rows=(Array.isArray(data)?data:[]).map(a=>({...a,_token:a.chat_token}));
      $("#myAppointmentsIntro").textContent="Все записи по вашему номеру телефона, включая прошлые, отменённые и перенесённые.";
    }catch(e){
      console.error("account appointments",e);
    }
  }else{
    const tokens=appointmentTokens();
    if(!tokens.length){
      list.innerHTML='<div class="empty-state">На этом устройстве пока нет сохранённых записей. Войдите или зарегистрируйтесь, чтобы видеть историю с любого устройства.</div>';
      return;
    }
    rows=(await Promise.all(tokens.map(async token=>{
      try{
        const data=await rpc("get_client_appointment",{p_token:token});
        const a=Array.isArray(data)?data[0]:null;
        return a?{...a,_token:token}:null;
      }catch{return null}
    }))).filter(Boolean);
    $("#myAppointmentsIntro").textContent="Записи, сохранённые на этом устройстве. Зарегистрируйтесь, чтобы видеть их с любого устройства.";
  }

  myAppointmentsCache=rows.sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
  const now=Date.now();
  const upcoming=rows.filter(a=>new Date(a.starts_at).getTime()>=now&&!["cancelled","completed","no_show"].includes(a.status));
  const past=rows.filter(a=>!upcoming.includes(a));
  list.innerHTML=(upcoming.length?'<h4 class="appointments-group-title">Предстоящие</h4>'+upcoming.map(appointmentCard).join(""):'')+
    (past.length?'<h4 class="appointments-group-title">Прошлые и отменённые</h4>'+past.map(appointmentCard).join(""):'')||
    '<div class="empty-state">Записей по этому номеру пока нет.</div>';
  document.querySelectorAll("[data-my-repeat]").forEach(b=>b.onclick=()=>repeatAppointment(Number(b.dataset.myRepeat)));
  document.querySelectorAll("[data-my-chat]").forEach(b=>b.onclick=()=>openAppointmentChat(Number(b.dataset.myChat)));
}
function openAppointmentChat(id){
  const a=myAppointmentsCache.find(x=>Number(x.appointment_id)===id);
  if(!a)return;
  localStorage.setItem(CLIENT_CHAT_KEY,a._token);
  $("#myAppointmentsModal").classList.add("hidden");
  openClientChat();
}
function repeatAppointment(id){
  const a=myAppointmentsCache.find(x=>Number(x.appointment_id)===id);
  if(!a)return;
  $("#myAppointmentsModal").classList.add("hidden");
  selectService(Number(a.service_id));
  const saved=(a.addons||[]).map(x=>Number(x.id));
  saved.forEach(addonId=>{
    const ad=addons.find(x=>Number(x.id)===addonId);
    if(!ad)return;
    if(ad.quantity_group){
      const check=document.querySelector('[data-addon-group="'+ad.quantity_group+'"]');
      if(check){
        check.checked=true;
        check.dispatchEvent(new Event("change"));
        const plus=document.querySelector('[data-qty-plus="'+ad.quantity_group+'"]');
        for(let i=1;i<Number(ad.quantity_value||1);i++) plus?.click();
      }
    }else{
      const check=document.querySelector('[data-addon-id="'+addonId+'"]');
      if(check){check.checked=true;check.dispatchEvent(new Event("change"))}
    }
  });
  const comment=document.querySelector('#bookingForm textarea[name="comment"]');
  if(comment&&a.comment)comment.value=a.comment;
  $("#booking").scrollIntoView({behavior:"smooth",block:"start"});
}
$("#myAppointmentsButton").onclick=async()=>{
  $("#myAppointmentsModal").classList.remove("hidden");
  await loadMyAppointments();
};
$("#closeMyAppointments").onclick=()=>$("#myAppointmentsModal").classList.add("hidden");
$("#myAppointmentsModal").addEventListener("click",e=>{if(e.target.id==="myAppointmentsModal")$("#myAppointmentsModal").classList.add("hidden")});


/* ===== Личный кабинет клиента ===== */
const CLIENT_ACCOUNT_TOKEN_KEY="nail_client_account_token";
const CLIENT_ACCOUNT_PHONE_KEY="nail_client_account_phone";

function clientAccountState(){
  return {
    token:localStorage.getItem(CLIENT_ACCOUNT_TOKEN_KEY)||"",
    phone:localStorage.getItem(CLIENT_ACCOUNT_PHONE_KEY)||""
  };
}
function updateClientAccountUI(){
  const s=clientAccountState();
  const logged=!!s.token;
  $("#clientAccountGuest").classList.toggle("hidden",logged);
  $("#clientAccountLogged").classList.toggle("hidden",!logged);
  $("#clientAccountButton").textContent=logged?"Личный кабинет":"Войти / Регистрация";
  if(logged){
    $("#clientAccountPhoneDisplay").textContent=s.phone;
    const bookingPhone=document.querySelector('#bookingForm input[name="phone"]');
    if(bookingPhone&&!bookingPhone.value) bookingPhone.value=s.phone;
  }
}
async function loadAccountAppointments(){
  const holder=$("#accountAppointmentsList");
  if(!holder)return;
  const token=clientAccountState().token;
  if(!token){
    holder.innerHTML='<div class="empty-state">Войдите в кабинет.</div>';
    return;
  }
  holder.innerHTML='<div class="empty-state">Загружаем записи…</div>';
  try{
    const data=await rpc("client_account_appointments",{p_token:token});
    const rows=(Array.isArray(data)?data:[]).map(a=>({...a,_token:a.chat_token}));
    myAppointmentsCache=rows.sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
    const now=Date.now();
    const upcoming=rows.filter(a=>new Date(a.starts_at).getTime()>=now&&!["cancelled","completed","no_show"].includes(a.status));
    const past=rows.filter(a=>!upcoming.includes(a));
    holder.innerHTML=
      (upcoming.length?'<h4 class="appointments-group-title">Предстоящие</h4>'+upcoming.map(appointmentCard).join(""):'')+
      (past.length?'<h4 class="appointments-group-title">Прошлые и отменённые</h4>'+past.map(appointmentCard).join(""):'')||
      '<div class="empty-state">Записей пока нет.</div>';
    holder.querySelectorAll("[data-my-repeat]").forEach(b=>b.onclick=()=>repeatAppointment(Number(b.dataset.myRepeat)));
    holder.querySelectorAll("[data-my-chat]").forEach(b=>b.onclick=()=>openAppointmentChat(Number(b.dataset.myChat)));
  }catch(e){
    holder.innerHTML='<div class="empty-state">Не удалось загрузить записи.</div>';
  }
}
async function openClientAccount(){
  $("#clientAccountModal").classList.remove("hidden");
  document.body.classList.add("no-scroll");
  updateClientAccountUI();
  if(clientAccountState().token) await loadAccountAppointments();
}
function closeClientAccount(){
  $("#clientAccountModal").classList.add("hidden");
  document.body.classList.remove("no-scroll");
}
function saveClientAccount(result){
  if(!result?.token) throw new Error("Не удалось открыть личный кабинет");
  localStorage.setItem(CLIENT_ACCOUNT_TOKEN_KEY,String(result.token));
  localStorage.setItem(CLIENT_ACCOUNT_PHONE_KEY,String(result.phone||""));
  const bookingPhone=document.querySelector('#bookingForm input[name="phone"]');
  if(bookingPhone) bookingPhone.value=String(result.phone||"");
  updateClientAccountUI();
  loadAccountAppointments();
}
async function clientAccountAuth(mode){
  const phone=$("#clientAccountPhone").value.trim();
  const password=$("#clientAccountPassword").value;
  const message=$("#clientAccountMessage");
  const login=$("#clientLoginButton"),reg=$("#clientRegisterButton");
  if(!phone||!password){
    message.textContent="Введите телефон и пароль";
    message.className="auth-message error";
    return;
  }
  login.disabled=reg.disabled=true;
  message.textContent="Проверяем…";message.className="auth-message";
  try{
    const result=await rpc(mode==="register"?"client_register":"client_login",{p_phone:phone,p_password:password});
    saveClientAccount(result);
    message.textContent="";
    $("#clientAccountPassword").value="";
    if(mode==="register"){
      alert("Регистрация готова. Все записи с этим номером телефона уже доступны в «Моих записях».");
    }
  }catch(e){
    message.textContent=e.message;
    message.className="auth-message error";
  }finally{
    login.disabled=reg.disabled=false;
  }
}
$("#clientAccountButton").onclick=openClientAccount;
$("#closeClientAccount").onclick=closeClientAccount;
$("#clientAccountModal").addEventListener("click",e=>{if(e.target.id==="clientAccountModal")closeClientAccount()});
$("#clientLoginButton").onclick=()=>clientAccountAuth("login");
$("#clientRegisterButton").onclick=()=>clientAccountAuth("register");
$("#clientLogoutButton").onclick=()=>{
  localStorage.removeItem(CLIENT_ACCOUNT_TOKEN_KEY);
  localStorage.removeItem(CLIENT_ACCOUNT_PHONE_KEY);
  updateClientAccountUI();
};
$("#clientChangePassword").onclick=async()=>{
  const oldPassword=$("#clientOldPassword").value;
  const newPassword=$("#clientNewPassword").value;
  const repeat=$("#clientNewPassword2").value;
  const m=$("#clientPasswordMessage");
  if(newPassword!==repeat){
    m.textContent="Новые пароли не совпадают";m.className="auth-message error";return;
  }
  const token=clientAccountState().token;
  try{
    await rpc("client_change_password",{p_token:token,p_old_password:oldPassword,p_new_password:newPassword});
    m.textContent="Пароль изменён";m.className="auth-message success";
    $("#clientOldPassword").value=$("#clientNewPassword").value=$("#clientNewPassword2").value="";
  }catch(e){
    m.textContent=e.message;m.className="auth-message error";
  }
};
updateClientAccountUI();


$("#accountNewBooking").onclick=()=>{
  closeClientAccount();
  $("#services").scrollIntoView({behavior:"smooth",block:"start"});
};
$("#accountOpenChat").onclick=()=>{
  closeClientAccount();
  openClientChat();
};
