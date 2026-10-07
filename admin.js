const SUPABASE_URL="https://lmwdxqispxslaetubbrb.supabase.co";
const SUPABASE_KEY="sb_publishable_oEF4vjw8OwTpSMRfUMgMCg_yVuJHzfx";
const ADMIN_URL="https://derik1977.github.io/nail-studio/admin.html";
const TOKEN_KEY="nail_admin_session";

const content=document.querySelector("#adminContent");
const tabs=document.querySelectorAll("[data-tab]");
const authPanel=document.querySelector("#authPanel");
const adminApp=document.querySelector("#adminApp");
const logoutButton=document.querySelector("#logoutButton");
const authMessage=document.querySelector("#authMessage");
const emailInput=document.querySelector("#adminEmail");
const passwordInput=document.querySelector("#adminPassword");

function setMessage(text,type=""){
  authMessage.textContent=text;
  authMessage.className="auth-message "+type;
}

function saveSession(data){
  if(data?.access_token) localStorage.setItem(TOKEN_KEY,JSON.stringify(data));
}
function getSession(){
  try{return JSON.parse(localStorage.getItem(TOKEN_KEY)||"null")}catch{return null}
}
function clearSession(){localStorage.removeItem(TOKEN_KEY)}

async function authRequest(path,body){
  const r=await fetch(SUPABASE_URL+"/auth/v1/"+path,{
    method:"POST",
    headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.msg||data.message||data.error_description||"Ошибка авторизации");
  return data;
}

async function refreshSession(){
  const session=getSession();
  if(!session?.refresh_token) return session;
  const expiresAt=Number(session.expires_at||0)*1000;
  if(expiresAt && expiresAt-Date.now()>120000) return session;
  const fresh=await authRequest("token?grant_type=refresh_token",{refresh_token:session.refresh_token});
  saveSession(fresh);
  return fresh;
}
async function api(path,options={}){
  let session=getSession();
  if(session?.refresh_token){
    try{session=await refreshSession()}catch(e){
      clearSession();
      throw new Error("Сессия истекла. Войдите в админку ещё раз.");
    }
  }
  const headers={
    "apikey":SUPABASE_KEY,
    "Authorization":"Bearer "+(session?.access_token||SUPABASE_KEY),
    "Content-Type":"application/json",
    ...(options.headers||{})
  };
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers});
  const text=await r.text();
  const data=text?JSON.parse(text):null;
  if(r.status===401 && session?.refresh_token){
    clearSession();
    throw new Error("Сессия истекла. Войдите в админку ещё раз.");
  }
  if(!r.ok) throw new Error(data?.message||"Ошибка базы данных");
  return data;
}

async function isAdmin(){
  try{
    const data=await api("admin_users?select=user_id&limit=1");
    return Array.isArray(data)&&data.length>0;
  }catch{return false}
}

async function showAdmin(){
  const ok=await isAdmin();
  if(!ok){
    clearSession();
    authPanel.classList.remove("hidden");
    adminApp.classList.add("hidden");
    logoutButton.classList.add("hidden");
    setMessage("Этот пользователь не имеет прав администратора.","error");
    return;
  }
  authPanel.classList.add("hidden");
  adminApp.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  await openTab("today");
}

async function login(){
  const email=emailInput.value.trim();
  const password=passwordInput.value;
  if(!email||!password){setMessage("Введите e-mail и пароль.","error");return}
  setMessage("Выполняется вход…");
  try{
    const data=await authRequest("token?grant_type=password",{email,password});
    saveSession(data);
    setMessage("");
    await showAdmin();
  }catch(e){
    setMessage("Не удалось войти: "+e.message,"error");
  }
}

async function signup(){
  const email=emailInput.value.trim();
  const password=passwordInput.value;
  if(!email||!password){setMessage("Введите e-mail и пароль.","error");return}
  if(password.length<8){setMessage("Пароль должен содержать не менее 8 символов.","error");return}
  setMessage("Создаём доступ…");
  try{
    const data=await authRequest("signup",{email,password,data:{},gotrue_meta_security:{},redirect_to:ADMIN_URL});
    if(data?.access_token){
      saveSession(data);
      await showAdmin();
    }else{
      setMessage("Аккаунт создан. Проверьте почту и подтвердите e-mail, затем нажмите «Войти».","success");
    }
  }catch(e){
    setMessage("Не удалось создать доступ: "+e.message,"error");
  }
}

async function resend(){
  const email=emailInput.value.trim();
  if(!email){setMessage("Введите e-mail.","error");return}
  setMessage("Отправляем новое письмо…");
  try{
    await authRequest("resend",{type:"signup",email,options:{emailRedirectTo:ADMIN_URL}});
    setMessage("Новое письмо отправлено. Используйте самую свежую ссылку.","success");
  }catch(e){
    setMessage("Не удалось отправить письмо: "+e.message,"error");
  }
}

async function getTodayAppointments(){
  const now=new Date();
  const start=new Date(now);start.setHours(0,0,0,0);
  const end=new Date(now);end.setHours(23,59,59,999);
  try{
    return await api("appointments?select=id,client_name,client_phone,starts_at,ends_at,status,comment,services(name,price,duration_minutes)&starts_at=gte."+encodeURIComponent(start.toISOString())+"&starts_at=lte."+encodeURIComponent(end.toISOString())+"&order=starts_at.asc");
  }catch{return []}
}

async function todayView(){
  const rows=await getTodayAppointments();
  const revenue=rows.filter(x=>x.status!=="cancelled").reduce((s,x)=>s+(x.services?.price||0),0);
  const table=rows.length?rows.map(x=>{
    const t=new Date(x.starts_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
    return '<tr><td>'+t+'</td><td>'+escapeHtml(x.client_name)+'</td><td>'+escapeHtml(x.services?.name||"—")+'</td><td>'+escapeHtml(x.status)+'</td></tr>';
  }).join(""):'<tr><td colspan="4">На сегодня записей пока нет</td></tr>';
  return '<h2>Сегодня</h2><div class="cards"><div class="stat">Записей<strong>'+rows.length+'</strong></div><div class="stat">Активных<strong>'+rows.filter(x=>x.status==="confirmed").length+'</strong></div><div class="stat">Сумма услуг<strong>'+new Intl.NumberFormat("ru-RU").format(revenue)+' ₽</strong></div></div><table class="admin-table"><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th>Статус</th></tr>'+table+'</table>';
}

async function servicesView(){
  const data=await api("services?select=*&order=id.asc");
  const rows=(data||[]).map(s=>'<tr><td>'+escapeHtml(s.name)+'</td><td>'+s.duration_minutes+' мин</td><td>'+new Intl.NumberFormat("ru-RU").format(s.price)+' ₽</td><td>'+(s.active?"Включена":"Выключена")+'</td><td><button class="small" data-edit-service="'+s.id+'">Изменить</button></td></tr>').join("");
  return '<div class="section-head-admin"><div><h2>Услуги</h2><p>Добавляйте услуги, меняйте цену, длительность и видимость на сайте.</p></div><button class="primary" id="addServiceButton">+ Добавить услугу</button></div><div id="serviceEditor"></div><table class="admin-table"><tr><th>Услуга</th><th>Длительность</th><th>Цена</th><th>Статус</th><th></th></tr>'+rows+'</table>';
}

function serviceForm(s={}){
  return '<div class="editor-card"><h3>'+(s.id?"Редактирование услуги":"Новая услуга")+'</h3><div class="form-grid"><label class="field"><span>Название</span><input id="serviceName" value="'+escapeAttr(s.name||"")+'"></label><label class="field"><span>Цена, ₽</span><input id="servicePrice" type="number" min="0" step="50" value="'+(s.price??0)+'"></label><label class="field"><span>Длительность, минут</span><input id="serviceDuration" type="number" min="15" step="15" value="'+(s.duration_minutes??60)+'"></label><label class="field"><span>Описание</span><input id="serviceDescription" value="'+escapeAttr(s.description||"")+'"></label></div><label class="check-row"><input id="serviceActive" type="checkbox" '+(s.active!==false?"checked":"")+'> Показывать услугу на сайте</label><div class="admin-actions"><button class="primary" id="saveServiceButton" data-id="'+(s.id||"")+'">Сохранить</button><button class="small" id="cancelServiceButton">Отмена</button>'+(s.id?'<button class="small danger" id="deleteServiceButton" data-id="'+s.id+'">Удалить</button>':'')+'</div><div id="serviceMessage" class="auth-message"></div></div>';
}

async function openServiceEditor(id=null){
  const holder=document.querySelector("#serviceEditor");
  let service={};
  if(id){
    const data=await api("services?select=*&id=eq."+id);
    service=data?.[0]||{};
  }
  holder.innerHTML=serviceForm(service);
  document.querySelector("#cancelServiceButton").onclick=()=>holder.innerHTML="";
  document.querySelector("#saveServiceButton").onclick=saveService;
  const del=document.querySelector("#deleteServiceButton");
  if(del) del.onclick=deleteService;
}

async function saveService(e){
  const id=e.currentTarget.dataset.id;
  const msg=document.querySelector("#serviceMessage");
  const payload={
    name:document.querySelector("#serviceName").value.trim(),
    description:document.querySelector("#serviceDescription").value.trim(),
    price:Number(document.querySelector("#servicePrice").value||0),
    duration_minutes:Number(document.querySelector("#serviceDuration").value||60),
    active:document.querySelector("#serviceActive").checked
  };
  if(!payload.name){msg.textContent="Введите название услуги.";msg.className="auth-message error";return}
  try{
    if(id) await api("services?id=eq."+id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
    else await api("services",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
    await openTab("services");
  }catch(err){msg.textContent=err.message;msg.className="auth-message error"}
}

async function deleteService(e){
  const id=e.currentTarget.dataset.id;
  if(!confirm("Удалить эту услугу?")) return;
  try{
    await api("services?id=eq."+id,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
    await openTab("services");
  }catch(err){document.querySelector("#serviceMessage").textContent=err.message}
}

async function scheduleView(){
  const data=await api("schedule_rules?select=*&order=weekday.asc");
  const names=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const rows=(data||[]).map(x=>'<div class="schedule-edit-row" data-schedule-row="'+x.id+'"><label class="check-row"><input type="checkbox" data-working '+(x.is_working?"checked":"")+'> <strong>'+names[x.weekday]+'</strong></label><div class="time-pair"><input type="time" data-start value="'+(x.start_time?x.start_time.slice(0,5):"09:00")+'" '+(!x.is_working?"disabled":"")+'><span>—</span><input type="time" data-end value="'+(x.end_time?x.end_time.slice(0,5):"18:00")+'" '+(!x.is_working?"disabled":"")+'></div><button class="small" data-save-day="'+x.id+'">Сохранить</button></div>').join("");
  return '<h2>Рабочее время</h2><p>Выключите день, чтобы сделать его выходным, или укажите начало и конец работы.</p><div class="schedule-editor">'+rows+'</div><div id="scheduleMessage" class="auth-message"></div>';
}

async function saveScheduleDay(e){
  const id=e.currentTarget.dataset.saveDay;
  const row=document.querySelector('[data-schedule-row="'+id+'"]');
  const working=row.querySelector("[data-working]").checked;
  const start=row.querySelector("[data-start]").value;
  const end=row.querySelector("[data-end]").value;
  const msg=document.querySelector("#scheduleMessage");
  if(working&&(!start||!end||start>=end)){msg.textContent="Проверьте время начала и окончания.";msg.className="auth-message error";return}
  try{
    await api("schedule_rules?id=eq."+id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({is_working:working,start_time:working?start:null,end_time:working?end:null})});
    msg.textContent="Рабочее время сохранено.";msg.className="auth-message success";
  }catch(err){msg.textContent=err.message;msg.className="auth-message error"}
}

async function calendarView(){
  const d=new Date(); const iso=d.toISOString().slice(0,10);
  return '<div class="section-head-admin"><div><h2>Календарь записей</h2><p>Просмотр, ручная запись, перенос, отмена и закрытие времени.</p></div><button class="primary" id="addAppointmentButton">+ Добавить запись</button></div>'+
  '<div class="calendar-toolbar"><input id="calendarDate" type="date" value="'+iso+'"><div class="view-switch"><button class="small active" data-view="day">День</button><button class="small" data-view="week">Неделя</button><button class="small" data-view="month">Месяц</button></div><button class="small" id="blockTimeButton">Закрыть время</button></div>'+
  '<div id="appointmentEditor"></div><div id="calendarList"></div>';
}
async function fetchAppointmentsRange(start,end){
  return api("appointments?select=id,client_name,client_phone,starts_at,ends_at,status,comment,total_price,addons,services(id,name,price,duration_minutes)&starts_at=gte."+encodeURIComponent(start.toISOString())+"&starts_at=lt."+encodeURIComponent(end.toISOString())+"&order=starts_at.asc");
}
function rangeFor(dateStr,view){
  const d=new Date(dateStr+"T00:00:00");
  if(view==="day"){const e=new Date(d);e.setDate(e.getDate()+1);return[d,e]}
  if(view==="week"){const s=new Date(d);const dow=(s.getDay()+6)%7;s.setDate(s.getDate()-dow);const e=new Date(s);e.setDate(e.getDate()+7);return[s,e]}
  const s=new Date(d.getFullYear(),d.getMonth(),1);const e=new Date(d.getFullYear(),d.getMonth()+1,1);return[s,e]
}
async function loadCalendar(view="day"){
  const [start,end]=rangeFor(document.querySelector("#calendarDate").value,view);
  const rows=await fetchAppointmentsRange(start,end);
  const groups={}; rows.forEach(a=>{const day=new Date(a.starts_at).toLocaleDateString("ru-RU");(groups[day]??=[]).push(a)});
  const html=Object.keys(groups).length?Object.entries(groups).map(([day,list])=>'<div class="day-group"><h3>'+day+'</h3>'+list.map(a=>'<div class="appointment-row"><div><strong>'+new Date(a.starts_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})+'</strong><br><small>'+escapeHtml(a.services?.name||"")+'</small></div><div><strong>'+escapeHtml(a.client_name)+'</strong><br><small>'+escapeHtml(a.client_phone)+'</small></div><div><span class="status '+a.status+'">'+statusText(a.status)+'</span><br><small>'+new Intl.NumberFormat("ru-RU").format(a.total_price||a.services?.price||0)+' ₽</small></div><button class="small" data-edit-appointment="'+a.id+'">Изменить</button></div>').join("")+'</div>').join(""):'<p class="empty-state">На выбранный период записей нет.</p>';
  document.querySelector("#calendarList").innerHTML=html;
  document.querySelectorAll("[data-edit-appointment]").forEach(b=>b.onclick=()=>openAppointmentEditor(Number(b.dataset.editAppointment)));
}
function statusText(s){return ({pending:"Ожидает",confirmed:"Подтверждена",completed:"Выполнено",cancelled:"Отменена",no_show:"Не пришёл",booked:"Подтверждена"})[s]||s}
async function appointmentForm(a=null){
  const services=await api("services?select=*&order=id.asc");
  const addons=await api("service_addons?select=*&active=eq.true&order=id.asc");
  const dt=a?new Date(a.starts_at):new Date();
  const date=a?dt.toISOString().slice(0,10):document.querySelector("#calendarDate").value;
  const time=a?dt.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"10:00";
  const selectedAddonIds=(a?.addons||[]).map(x=>Number(x.id));
  return '<div class="editor-card"><h3>'+(a?"Редактирование записи":"Новая запись")+'</h3><div class="form-grid">'+
  '<label class="field"><span>Имя клиента</span><input id="apName" value="'+escapeAttr(a?.client_name||"")+'"></label>'+
  '<label class="field"><span>Телефон</span><input id="apPhone" value="'+escapeAttr(a?.client_phone||"")+'"></label>'+
  '<label class="field"><span>Услуга</span><select id="apService">'+services.map(s=>'<option value="'+s.id+'" '+(a?.services?.id===s.id?"selected":"")+'>'+escapeHtml(s.name)+' — '+s.price+' ₽</option>').join("")+'</select></label>'+
  '<label class="field"><span>Дата</span><input id="apDate" type="date" value="'+date+'"></label>'+
  '<label class="field"><span>Время</span><input id="apTime" type="time" value="'+time+'"></label>'+
  '<label class="field"><span>Статус</span><select id="apStatus"><option value="pending" '+(a?.status==="pending"?"selected":"")+'>Ожидает подтверждения</option><option value="confirmed" '+((a?.status==="confirmed"||a?.status==="booked")?"selected":"")+'>Подтверждена</option><option value="completed" '+(a?.status==="completed"?"selected":"")+'>Выполнено</option><option value="cancelled" '+(a?.status==="cancelled"?"selected":"")+'>Отменена</option><option value="no_show" '+(a?.status==="no_show"?"selected":"")+'>Не пришёл</option></select></label>'+
  '<label class="field wide"><span>Комментарий</span><textarea id="apComment" rows="2">'+escapeHtml(a?.comment||"")+'</textarea></label></div>'+
  '<div class="addons-admin"><strong>Дополнения</strong>'+addons.map(x=>'<label class="check-row"><input type="checkbox" data-ap-addon value="'+x.id+'" '+(selectedAddonIds.includes(x.id)?"checked":"")+'> '+escapeHtml(x.name)+' (+'+x.price+' ₽)</label>').join("")+'</div>'+
  '<div class="admin-actions"><button class="primary" id="saveAppointment" data-id="'+(a?.id||"")+'">Сохранить</button><button class="small" id="cancelAppointmentEdit">Отмена</button></div><div id="appointmentMessage" class="auth-message"></div></div>';
}
async function openAppointmentEditor(id=null){
  let a=null;if(id){const d=await api("appointments?select=id,client_name,client_phone,starts_at,status,comment,addons,services(id,name)&id=eq."+id);a=d?.[0]}
  document.querySelector("#appointmentEditor").innerHTML=await appointmentForm(a);
  document.querySelector("#cancelAppointmentEdit").onclick=()=>document.querySelector("#appointmentEditor").innerHTML="";
  document.querySelector("#saveAppointment").onclick=saveAppointment;
}
async function saveAppointment(e){
  const id=e.currentTarget.dataset.id?Number(e.currentTarget.dataset.id):null;
  const addonIds=[...document.querySelectorAll("[data-ap-addon]:checked")].map(x=>Number(x.value));
  const body={p_id:id,p_client_name:document.querySelector("#apName").value.trim(),p_client_phone:document.querySelector("#apPhone").value.trim(),p_service_id:Number(document.querySelector("#apService").value),p_date:document.querySelector("#apDate").value,p_time:document.querySelector("#apTime").value,p_comment:document.querySelector("#apComment").value,p_status:document.querySelector("#apStatus").value,p_addon_ids:addonIds};
  const m=document.querySelector("#appointmentMessage");
  try{await api("rpc/admin_save_appointment",{method:"POST",body:JSON.stringify(body)});document.querySelector("#appointmentEditor").innerHTML="";await loadCalendar(document.querySelector("[data-view].active")?.dataset.view||"day")}catch(err){m.textContent=err.message;m.className="auth-message error"}
}
function blockTimeForm(){
  const d=document.querySelector("#calendarDate").value;
  return '<div class="editor-card"><h3>Закрыть время</h3><div class="form-grid"><label class="field"><span>Дата</span><input id="blockDate" type="date" value="'+d+'"></label><label class="field"><span>С</span><input id="blockStart" type="time" value="12:00"></label><label class="field"><span>До</span><input id="blockEnd" type="time" value="13:00"></label><label class="field"><span>Причина</span><input id="blockReason" value="Личное время"></label></div><div class="admin-actions"><button class="primary" id="saveBlock">Закрыть интервал</button><button class="small" id="cancelBlock">Отмена</button></div><div id="blockMessage" class="auth-message"></div></div>';
}
async function saveBlock(){
  const m=document.querySelector("#blockMessage");
  try{await api("rpc/admin_add_blocked_time",{method:"POST",body:JSON.stringify({p_date:document.querySelector("#blockDate").value,p_start:document.querySelector("#blockStart").value,p_end:document.querySelector("#blockEnd").value,p_reason:document.querySelector("#blockReason").value})});m.textContent="Время закрыто.";m.className="auth-message success"}catch(e){m.textContent=e.message;m.className="auth-message error"}
}

async function promoView(){
  const data=await api("promos?select=*&order=id.desc");
  const rows=(data||[]).map(x=>'<div class="management-card"><div><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(x.body||"")+'</p><small>'+(x.starts_on||"без даты")+' — '+(x.ends_on||"без даты")+'</small></div><div><span class="status '+(x.active?"completed":"cancelled")+'">'+(x.active?"Включена":"Выключена")+'</span> <button class="small" data-edit-promo="'+x.id+'">Изменить</button></div></div>').join("");
  return '<div class="section-head-admin"><div><h2>Акции и баннеры</h2><p>Акция автоматически перестаёт показываться после даты окончания.</p></div><button class="primary" id="addPromo">+ Новая акция</button></div><div id="promoEditor"></div>'+rows;
}
async function openPromoEditor(id=null){
  let p={};if(id){const d=await api("promos?select=*&id=eq."+id);p=d?.[0]||{}}
  document.querySelector("#promoEditor").innerHTML='<div class="editor-card"><h3>'+(id?"Редактирование акции":"Новая акция")+'</h3><div class="form-grid"><label class="field"><span>Заголовок</span><input id="promoTitle" value="'+escapeAttr(p.title||"")+'"></label><label class="field"><span>Текст</span><input id="promoBody" value="'+escapeAttr(p.body||"")+'"></label><label class="field"><span>Начало</span><input id="promoStart" type="date" value="'+(p.starts_on||"")+'"></label><label class="field"><span>Окончание</span><input id="promoEnd" type="date" value="'+(p.ends_on||"")+'"></label><label class="field wide"><span>Фото / ссылка</span><input id="promoImage" value="'+escapeAttr(p.image_url||"")+'"></label></div><label class="check-row"><input id="promoActive" type="checkbox" '+(p.active?"checked":"")+'> Показывать акцию</label><div class="admin-actions"><button class="primary" id="savePromo" data-id="'+(id||"")+'">Сохранить</button><button class="small" id="cancelPromo">Отмена</button></div><div id="promoMessage" class="auth-message"></div></div>';
  document.querySelector("#cancelPromo").onclick=()=>document.querySelector("#promoEditor").innerHTML="";
  document.querySelector("#savePromo").onclick=savePromo;
}
async function savePromo(e){
  const id=e.currentTarget.dataset.id;const payload={title:document.querySelector("#promoTitle").value.trim(),body:document.querySelector("#promoBody").value.trim(),starts_on:document.querySelector("#promoStart").value||null,ends_on:document.querySelector("#promoEnd").value||null,image_url:document.querySelector("#promoImage").value.trim()||null,active:document.querySelector("#promoActive").checked};
  try{if(id)await api("promos?id=eq."+id,{method:"PATCH",body:JSON.stringify(payload)});else await api("promos",{method:"POST",body:JSON.stringify(payload)});await openTab("promo")}catch(err){document.querySelector("#promoMessage").textContent=err.message}
}

async function galleryView(){
  const data=await api("gallery?select=*&order=sort_order.asc");
  return '<div class="section-head-admin"><div><h2>Галерея</h2><p>Добавляйте фотографии работ с компьютера или по ссылке.</p></div><button class="primary" id="addGallery">+ Добавить фото</button></div><div id="galleryEditor"></div><div class="admin-gallery">'+(data||[]).map(g=>'<div class="admin-photo"><img src="'+escapeHtml(g.image_url)+'"><div><strong>'+escapeHtml(g.caption||"Без подписи")+'</strong><br><small>'+ (g.active?"Показывается":"Скрыто") +'</small></div><button class="small" data-edit-gallery="'+g.id+'">Изменить</button></div>').join("")+'</div>';
}
async function uploadImage(file){
  const session=getSession();const ext=(file.name.split(".").pop()||"jpg").toLowerCase();const name=Date.now()+"-"+Math.random().toString(36).slice(2)+"."+ext;
  const r=await fetch(SUPABASE_URL+"/storage/v1/object/nail-images/"+name,{method:"POST",headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
  if(!r.ok){const t=await r.text();throw new Error("Не удалось загрузить фото: "+t)}
  return SUPABASE_URL+"/storage/v1/object/public/nail-images/"+name;
}
async function openGalleryEditor(id=null){
  let g={};if(id){const d=await api("gallery?select=*&id=eq."+id);g=d?.[0]||{}}
  document.querySelector("#galleryEditor").innerHTML='<div class="editor-card"><h3>'+(id?"Редактирование фото":"Новое фото")+'</h3><div class="form-grid"><label class="field"><span>Подпись</span><input id="galleryCaption" value="'+escapeAttr(g.caption||"")+'"></label><label class="field"><span>Порядок</span><input id="galleryOrder" type="number" value="'+(g.sort_order??0)+'"></label><label class="field wide"><span>Ссылка на фото</span><input id="galleryUrl" value="'+escapeAttr(g.image_url||"")+'"></label><label class="field wide"><span>Или загрузить файл</span><input id="galleryFile" type="file" accept="image/*"></label></div><label class="check-row"><input id="galleryActive" type="checkbox" '+(g.active!==false?"checked":"")+'> Показывать в галерее</label><div class="admin-actions"><button class="primary" id="saveGallery" data-id="'+(id||"")+'">Сохранить</button><button class="small" id="cancelGallery">Отмена</button></div><div id="galleryMessage" class="auth-message"></div></div>';
  document.querySelector("#cancelGallery").onclick=()=>document.querySelector("#galleryEditor").innerHTML="";
  document.querySelector("#saveGallery").onclick=saveGallery;
}
async function saveGallery(e){
  const id=e.currentTarget.dataset.id;const m=document.querySelector("#galleryMessage");
  try{let url=document.querySelector("#galleryUrl").value.trim();const file=document.querySelector("#galleryFile").files[0];if(file)url=await uploadImage(file);if(!url)throw new Error("Добавьте фото");const payload={image_url:url,caption:document.querySelector("#galleryCaption").value.trim(),sort_order:Number(document.querySelector("#galleryOrder").value||0),active:document.querySelector("#galleryActive").checked};if(id)await api("gallery?id=eq."+id,{method:"PATCH",body:JSON.stringify(payload)});else await api("gallery",{method:"POST",body:JSON.stringify(payload)});await openTab("gallery")}catch(err){m.textContent=err.message;m.className="auth-message error"}
}

async function openTab(name){
  tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  content.innerHTML='<p>Загрузка…</p>';
  try{
    if(name==="today") content.innerHTML=await todayView();
    else if(name==="services") content.innerHTML=await servicesView();
    else if(name==="schedule") content.innerHTML=await scheduleView();
    else if(name==="promo") content.innerHTML=await promoView();
    else if(name==="calendar") content.innerHTML=await calendarView();
    else if(name==="gallery") content.innerHTML=await galleryView();

    if(name==="calendar"){
      document.querySelector("#addAppointmentButton").onclick=()=>openAppointmentEditor();
      document.querySelector("#blockTimeButton").onclick=()=>{document.querySelector("#appointmentEditor").innerHTML=blockTimeForm();document.querySelector("#cancelBlock").onclick=()=>document.querySelector("#appointmentEditor").innerHTML="";document.querySelector("#saveBlock").onclick=saveBlock};
      document.querySelector("#calendarDate").onchange=()=>loadCalendar(document.querySelector("[data-view].active")?.dataset.view||"day");
      document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-view]").forEach(x=>x.classList.remove("active"));b.classList.add("active");loadCalendar(b.dataset.view)});
      await loadCalendar("day");
    }
    if(name==="promo"){document.querySelector("#addPromo").onclick=()=>openPromoEditor();document.querySelectorAll("[data-edit-promo]").forEach(b=>b.onclick=()=>openPromoEditor(b.dataset.editPromo))}
    if(name==="gallery"){document.querySelector("#addGallery").onclick=()=>openGalleryEditor();document.querySelectorAll("[data-edit-gallery]").forEach(b=>b.onclick=()=>openGalleryEditor(b.dataset.editGallery))}
    if(name==="services"){
      document.querySelector("#addServiceButton").onclick=()=>openServiceEditor();
      document.querySelectorAll("[data-edit-service]").forEach(b=>b.onclick=()=>openServiceEditor(b.dataset.editService));
    }
    if(name==="schedule"){
      document.querySelectorAll("[data-working]").forEach(ch=>ch.onchange=()=>{
        const row=ch.closest(".schedule-edit-row");
        row.querySelector("[data-start]").disabled=!ch.checked;
        row.querySelector("[data-end]").disabled=!ch.checked;
      });
      document.querySelectorAll("[data-save-day]").forEach(b=>b.onclick=saveScheduleDay);
    }
  }catch(e){content.innerHTML='<p class="auth-message error">'+escapeHtml(e.message)+'</p>'}
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function escapeAttr(v){return escapeHtml(v).replace(/\`/g,"&#96;")}

document.querySelector("#loginButton").addEventListener("click",login);
document.querySelector("#signupButton").addEventListener("click",signup);
document.querySelector("#resendButton").addEventListener("click",resend);
logoutButton.addEventListener("click",()=>{clearSession();adminApp.classList.add("hidden");logoutButton.classList.add("hidden");authPanel.classList.remove("hidden");setMessage("Вы вышли из панели.","success")});
tabs.forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.tab)));

if(getSession()) showAdmin();


/* ===== Расширенная админка ===== */
async function servicesView(){
  const [data,add]=await Promise.all([api("services?select=*&order=id.asc"),api("service_addons?select=*&order=id.asc")]);
  const rows=(data||[]).map(s=>'<tr><td><div class="service-admin-title">'+(s.image_url?'<img src="'+escapeHtml(s.image_url)+'">':'')+'<span>'+escapeHtml(s.name)+'</span></div></td><td>'+s.duration_minutes+' мин</td><td>'+new Intl.NumberFormat("ru-RU").format(s.price)+' ₽</td><td>'+(s.active?"Включена":"Выключена")+'</td><td><button class="small" data-edit-service="'+s.id+'">Изменить</button></td></tr>').join("");
  const addons=(add||[]).map(a=>'<div class="management-card"><div><strong>'+escapeHtml(a.name)+'</strong><p>+'+a.duration_minutes+' мин · +'+a.price+' ₽ · '+(a.active?"активно":"выключено")+'</p></div><button class="small" data-edit-addon="'+a.id+'">Изменить</button></div>').join("");
  return '<div class="section-head-admin"><div><h2>Услуги</h2><p>Цена, длительность, фото, описание и дополнительные опции.</p></div><button class="primary" id="addServiceButton">+ Добавить услугу</button></div><div id="serviceEditor"></div><table class="admin-table"><tr><th>Услуга</th><th>Длительность</th><th>Цена</th><th>Статус</th><th></th></tr>'+rows+'</table><div class="section-head-admin section-gap"><div><h2>Дополнения</h2><p>Френч, дизайн, снятие, ремонт и другие опции.</p></div><button class="primary" id="addAddonButton">+ Добавить дополнение</button></div><div id="addonEditor"></div>'+addons;
}
function serviceForm(s={}){
  return '<div class="editor-card"><h3>'+(s.id?"Редактирование услуги":"Новая услуга")+'</h3><div class="form-grid"><label class="field"><span>Название</span><input id="serviceName" value="'+escapeAttr(s.name||"")+'"></label><label class="field"><span>Цена, ₽</span><input id="servicePrice" type="number" min="0" step="50" value="'+(s.price??0)+'"></label><label class="field"><span>Длительность, минут</span><input id="serviceDuration" type="number" min="15" step="15" value="'+(s.duration_minutes??60)+'"></label><label class="field"><span>Описание</span><input id="serviceDescription" value="'+escapeAttr(s.description||"")+'"></label><label class="field wide"><span>Ссылка на фото</span><input id="serviceImage" value="'+escapeAttr(s.image_url||"")+'"></label><label class="field wide"><span>Или загрузить фото</span><input id="serviceFile" type="file" accept="image/*"></label></div><label class="check-row"><input id="serviceActive" type="checkbox" '+(s.active!==false?"checked":"")+'> Показывать услугу на сайте</label><div class="admin-actions"><button class="primary" id="saveServiceButton" data-id="'+(s.id||"")+'">Сохранить</button><button class="small" id="cancelServiceButton">Отмена</button>'+(s.id?'<button class="small danger" id="deleteServiceButton" data-id="'+s.id+'">Удалить</button>':'')+'</div><div id="serviceMessage" class="auth-message"></div></div>';
}
async function saveService(e){
  const id=e.currentTarget.dataset.id; const msg=document.querySelector("#serviceMessage");
  try{
    let image=document.querySelector("#serviceImage").value.trim();
    const file=document.querySelector("#serviceFile").files[0]; if(file) image=await uploadImage(file);
    const payload={name:document.querySelector("#serviceName").value.trim(),description:document.querySelector("#serviceDescription").value.trim(),price:Number(document.querySelector("#servicePrice").value||0),duration_minutes:Number(document.querySelector("#serviceDuration").value||60),image_url:image||null,active:document.querySelector("#serviceActive").checked};
    if(!payload.name) throw new Error("Введите название услуги");
    if(id) await api("services?id=eq."+id,{method:"PATCH",body:JSON.stringify(payload)});
    else await api("services",{method:"POST",body:JSON.stringify(payload)});
    await openTab("services");
  }catch(err){msg.textContent=err.message;msg.className="auth-message error"}
}
async function openAddonEditor(id=null){
  const holder=document.querySelector("#addonEditor"); let a={}; const services=await api("services?select=id,name&order=id.asc");
  if(id){const d=await api("service_addons?select=*&id=eq."+id);a=d?.[0]||{}}
  holder.innerHTML='<div class="editor-card"><h3>'+(id?"Редактирование дополнения":"Новое дополнение")+'</h3><div class="form-grid"><label class="field"><span>Название</span><input id="addonName" value="'+escapeAttr(a.name||"")+'"></label><label class="field"><span>Для какой услуги</span><select id="addonService"><option value="">Для всех услуг</option>'+services.map(s=>'<option value="'+s.id+'" '+(a.service_id===s.id?"selected":"")+'>'+escapeHtml(s.name)+'</option>').join("")+'</select></label><label class="field"><span>Доплата, ₽</span><input id="addonPrice" type="number" min="0" step="50" value="'+(a.price??0)+'"></label><label class="field"><span>Доп. время, минут</span><input id="addonDuration" type="number" min="0" step="5" value="'+(a.duration_minutes??0)+'"></label></div><label class="check-row"><input id="addonActive" type="checkbox" '+(a.active!==false?"checked":"")+'> Показывать клиенту</label><div class="admin-actions"><button class="primary" id="saveAddon" data-id="'+(id||"")+'">Сохранить</button><button class="small" id="cancelAddon">Отмена</button>'+(id?'<button class="small danger" id="deleteAddon" data-id="'+id+'">Удалить</button>':'')+'</div><div id="addonMessage" class="auth-message"></div></div>';
  document.querySelector("#cancelAddon").onclick=()=>holder.innerHTML="";
  document.querySelector("#saveAddon").onclick=saveAddon;
  if(id) document.querySelector("#deleteAddon").onclick=deleteAddon;
}
async function saveAddon(e){
  const id=e.currentTarget.dataset.id;const m=document.querySelector("#addonMessage");
  const sid=document.querySelector("#addonService").value;
  const p={name:document.querySelector("#addonName").value.trim(),service_id:sid?Number(sid):null,price:Number(document.querySelector("#addonPrice").value||0),duration_minutes:Number(document.querySelector("#addonDuration").value||0),active:document.querySelector("#addonActive").checked};
  try{if(!p.name)throw new Error("Введите название");if(id)await api("service_addons?id=eq."+id,{method:"PATCH",body:JSON.stringify(p)});else await api("service_addons",{method:"POST",body:JSON.stringify(p)});await openTab("services")}catch(err){m.textContent=err.message;m.className="auth-message error"}
}
async function deleteAddon(e){if(!confirm("Удалить дополнение?"))return;await api("service_addons?id=eq."+e.currentTarget.dataset.id,{method:"DELETE"});await openTab("services")}

async function scheduleView(){
  const [data,special,blocked]=await Promise.all([
    api("schedule_rules?select=*&order=weekday.asc"),
    api("special_days?select=*&day=gte."+new Date().toISOString().slice(0,10)+"&order=day.asc"),
    api("blocked_time?select=*&ends_at=gte."+encodeURIComponent(new Date().toISOString())+"&order=starts_at.asc")
  ]);
  const names=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const rows=(data||[]).map(x=>'<div class="schedule-edit-row" data-schedule-row="'+x.id+'"><label class="check-row"><input type="checkbox" data-working '+(x.is_working?"checked":"")+'> <strong>'+names[x.weekday]+'</strong></label><div class="time-pair"><input type="time" data-start value="'+(x.start_time?x.start_time.slice(0,5):"09:00")+'" '+(!x.is_working?"disabled":"")+'><span>—</span><input type="time" data-end value="'+(x.end_time?x.end_time.slice(0,5):"18:00")+'" '+(!x.is_working?"disabled":"")+'></div><button class="small" data-save-day="'+x.id+'">Сохранить</button></div>').join("");
  const exc=(special||[]).map(x=>'<div class="management-card"><div><strong>'+x.day+'</strong><p>'+(x.is_working?((x.start_time||"").slice(0,5)+'–'+(x.end_time||"").slice(0,5)):"Выходной")+' · '+escapeHtml(x.note||"")+'</p></div><button class="small danger" data-delete-special="'+x.id+'">Удалить</button></div>').join("");
  const blocks=(blocked||[]).map(x=>'<div class="management-card"><div><strong>'+new Date(x.starts_at).toLocaleString("ru-RU")+'</strong><p>до '+new Date(x.ends_at).toLocaleString("ru-RU")+' · '+escapeHtml(x.reason||"")+'</p></div><button class="small danger" data-delete-block="'+x.id+'">Удалить</button></div>').join("");
  return '<h2>Рабочее время</h2><p>Основной недельный график.</p><div class="schedule-editor">'+rows+'</div><div id="scheduleMessage" class="auth-message"></div>'+
  '<div class="section-head-admin section-gap"><div><h2>Исключение на дату</h2><p>Можно сделать обычный выходной рабочим или конкретный рабочий день выходным.</p></div></div><div class="editor-card"><div class="form-grid"><label class="field"><span>Дата</span><input id="specialDate" type="date"></label><label class="check-row"><input id="specialWorking" type="checkbox"> Рабочий день</label><label class="field"><span>С</span><input id="specialStart" type="time" value="09:00"></label><label class="field"><span>До</span><input id="specialEnd" type="time" value="18:00"></label><label class="field wide"><span>Комментарий</span><input id="specialNote" placeholder="Например: работаем по записи"></label></div><button class="primary" id="saveSpecialDay">Сохранить исключение</button><div id="specialMessage" class="auth-message"></div></div>'+exc+
  '<div class="section-head-admin section-gap"><div><h2>Отпуск и закрытые интервалы</h2><p>Закройте несколько дней целиком или отдельный период.</p></div></div><div class="editor-card"><h3>Отпуск</h3><div class="form-grid"><label class="field"><span>С даты</span><input id="vacStart" type="date"></label><label class="field"><span>По дату</span><input id="vacEnd" type="date"></label><label class="field wide"><span>Причина</span><input id="vacReason" value="Отпуск"></label></div><button class="primary" id="saveVacation">Закрыть период</button><div id="vacMessage" class="auth-message"></div></div>'+blocks;
}
async function saveSpecialDay(){
  const d=document.querySelector("#specialDate").value,working=document.querySelector("#specialWorking").checked,m=document.querySelector("#specialMessage");
  try{if(!d)throw new Error("Выберите дату");const p={day:d,is_working:working,start_time:working?document.querySelector("#specialStart").value:null,end_time:working?document.querySelector("#specialEnd").value:null,note:document.querySelector("#specialNote").value};await api("special_days?on_conflict=day",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(p)});await openTab("schedule")}catch(e){m.textContent=e.message;m.className="auth-message error"}
}
async function saveVacation(){
  const m=document.querySelector("#vacMessage");try{await api("rpc/admin_add_vacation",{method:"POST",body:JSON.stringify({p_start_date:document.querySelector("#vacStart").value,p_end_date:document.querySelector("#vacEnd").value,p_reason:document.querySelector("#vacReason").value})});await openTab("schedule")}catch(e){m.textContent=e.message;m.className="auth-message error"}
}
async function deleteSpecial(e){if(!confirm("Удалить исключение?"))return;await api("special_days?id=eq."+e.currentTarget.dataset.deleteSpecial,{method:"DELETE"});await openTab("schedule")}
async function deleteBlock(e){if(!confirm("Открыть этот период снова?"))return;await api("blocked_time?id=eq."+e.currentTarget.dataset.deleteBlock,{method:"DELETE"});await openTab("schedule")}

async function openPromoEditor(id=null){
  let p={};if(id){const d=await api("promos?select=*&id=eq."+id);p=d?.[0]||{}}
  document.querySelector("#promoEditor").innerHTML='<div class="editor-card"><h3>'+(id?"Редактирование акции":"Новая акция")+'</h3><div class="form-grid"><label class="field"><span>Заголовок</span><input id="promoTitle" value="'+escapeAttr(p.title||"")+'"></label><label class="field"><span>Текст</span><input id="promoBody" value="'+escapeAttr(p.body||"")+'"></label><label class="field"><span>Начало</span><input id="promoStart" type="date" value="'+(p.starts_on||"")+'"></label><label class="field"><span>Окончание</span><input id="promoEnd" type="date" value="'+(p.ends_on||"")+'"></label><label class="field wide"><span>Фото / ссылка</span><input id="promoImage" value="'+escapeAttr(p.image_url||"")+'"></label><label class="field wide"><span>Или загрузить фото</span><input id="promoFile" type="file" accept="image/*"></label></div><label class="check-row"><input id="promoActive" type="checkbox" '+(p.active?"checked":"")+'> Показывать акцию</label><div class="admin-actions"><button class="primary" id="savePromo" data-id="'+(id||"")+'">Сохранить</button><button class="small" id="cancelPromo">Отмена</button>'+(id?'<button class="small danger" id="deletePromo" data-id="'+id+'">Удалить</button>':'')+'</div><div id="promoMessage" class="auth-message"></div></div>';
  document.querySelector("#cancelPromo").onclick=()=>document.querySelector("#promoEditor").innerHTML="";
  document.querySelector("#savePromo").onclick=savePromo;
  if(id) document.querySelector("#deletePromo").onclick=deletePromo;
}
async function savePromo(e){
  const id=e.currentTarget.dataset.id;const m=document.querySelector("#promoMessage");
  try{let img=document.querySelector("#promoImage").value.trim();const f=document.querySelector("#promoFile").files[0];if(f)img=await uploadImage(f);const payload={title:document.querySelector("#promoTitle").value.trim(),body:document.querySelector("#promoBody").value.trim(),starts_on:document.querySelector("#promoStart").value||null,ends_on:document.querySelector("#promoEnd").value||null,image_url:img||null,active:document.querySelector("#promoActive").checked};if(!payload.title)throw new Error("Введите заголовок");if(id)await api("promos?id=eq."+id,{method:"PATCH",body:JSON.stringify(payload)});else await api("promos",{method:"POST",body:JSON.stringify(payload)});await openTab("promo")}catch(err){m.textContent=err.message;m.className="auth-message error"}
}
async function deletePromo(e){if(!confirm("Удалить акцию?"))return;await api("promos?id=eq."+e.currentTarget.dataset.id,{method:"DELETE"});await openTab("promo")}

async function openGalleryEditor(id=null){
  let g={};if(id){const d=await api("gallery?select=*&id=eq."+id);g=d?.[0]||{}}
  document.querySelector("#galleryEditor").innerHTML='<div class="editor-card"><h3>'+(id?"Редактирование фото":"Новое фото")+'</h3><div class="form-grid"><label class="field"><span>Подпись</span><input id="galleryCaption" value="'+escapeAttr(g.caption||"")+'"></label><label class="field"><span>Порядок</span><input id="galleryOrder" type="number" value="'+(g.sort_order??0)+'"></label><label class="field wide"><span>Ссылка на фото</span><input id="galleryUrl" value="'+escapeAttr(g.image_url||"")+'"></label><label class="field wide"><span>Или загрузить файл</span><input id="galleryFile" type="file" accept="image/*"></label></div><label class="check-row"><input id="galleryActive" type="checkbox" '+(g.active!==false?"checked":"")+'> Показывать в галерее</label><div class="admin-actions"><button class="primary" id="saveGallery" data-id="'+(id||"")+'">Сохранить</button><button class="small" id="cancelGallery">Отмена</button>'+(id?'<button class="small danger" id="deleteGallery" data-id="'+id+'">Удалить</button>':'')+'</div><div id="galleryMessage" class="auth-message"></div></div>';
  document.querySelector("#cancelGallery").onclick=()=>document.querySelector("#galleryEditor").innerHTML="";
  document.querySelector("#saveGallery").onclick=saveGallery;
  if(id) document.querySelector("#deleteGallery").onclick=deleteGallery;
}
async function deleteGallery(e){if(!confirm("Удалить фото из галереи?"))return;await api("gallery?id=eq."+e.currentTarget.dataset.id,{method:"DELETE"});await openTab("gallery")}

async function openTab(name){
  tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  content.innerHTML='<p>Загрузка…</p>';
  try{
    if(name==="today") content.innerHTML=await todayView();
    else if(name==="services") content.innerHTML=await servicesView();
    else if(name==="schedule") content.innerHTML=await scheduleView();
    else if(name==="promo") content.innerHTML=await promoView();
    else if(name==="calendar") content.innerHTML=await calendarView();
    else if(name==="gallery") content.innerHTML=await galleryView();

    if(name==="calendar"){
      document.querySelector("#addAppointmentButton").onclick=()=>openAppointmentEditor();
      document.querySelector("#blockTimeButton").onclick=()=>{document.querySelector("#appointmentEditor").innerHTML=blockTimeForm();document.querySelector("#cancelBlock").onclick=()=>document.querySelector("#appointmentEditor").innerHTML="";document.querySelector("#saveBlock").onclick=saveBlock};
      document.querySelector("#calendarDate").onchange=()=>loadCalendar(document.querySelector("[data-view].active")?.dataset.view||"day");
      document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-view]").forEach(x=>x.classList.remove("active"));b.classList.add("active");loadCalendar(b.dataset.view)});
      await loadCalendar("day");
    }
    if(name==="promo"){document.querySelector("#addPromo").onclick=()=>openPromoEditor();document.querySelectorAll("[data-edit-promo]").forEach(b=>b.onclick=()=>openPromoEditor(b.dataset.editPromo))}
    if(name==="gallery"){document.querySelector("#addGallery").onclick=()=>openGalleryEditor();document.querySelectorAll("[data-edit-gallery]").forEach(b=>b.onclick=()=>openGalleryEditor(b.dataset.editGallery))}
    if(name==="services"){
      document.querySelector("#addServiceButton").onclick=()=>openServiceEditor();
      document.querySelectorAll("[data-edit-service]").forEach(b=>b.onclick=()=>openServiceEditor(b.dataset.editService));
      document.querySelector("#addAddonButton").onclick=()=>openAddonEditor();
      document.querySelectorAll("[data-edit-addon]").forEach(b=>b.onclick=()=>openAddonEditor(b.dataset.editAddon));
    }
    if(name==="schedule"){
      document.querySelectorAll("[data-working]").forEach(ch=>ch.onchange=()=>{const row=ch.closest(".schedule-edit-row");row.querySelector("[data-start]").disabled=!ch.checked;row.querySelector("[data-end]").disabled=!ch.checked});
      document.querySelectorAll("[data-save-day]").forEach(b=>b.onclick=saveScheduleDay);
      document.querySelector("#saveSpecialDay").onclick=saveSpecialDay;
      document.querySelector("#specialWorking").onchange=e=>{document.querySelector("#specialStart").disabled=!e.target.checked;document.querySelector("#specialEnd").disabled=!e.target.checked};
      document.querySelector("#saveVacation").onclick=saveVacation;
      document.querySelectorAll("[data-delete-special]").forEach(b=>b.onclick=deleteSpecial);
      document.querySelectorAll("[data-delete-block]").forEach(b=>b.onclick=deleteBlock);
    }
  }catch(e){content.innerHTML='<p class="auth-message error">'+escapeHtml(e.message)+'</p>'}
}


/* ===== Единое время студии: Москва ===== */
function mskParts(iso){
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return {date:p.year+"-"+p.month+"-"+p.day,time:p.hour+":"+p.minute};
}
function addDaysStr(s,n){const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function rangeFor(dateStr,view){
  if(view==="day") return [new Date(dateStr+"T00:00:00+03:00"),new Date(addDaysStr(dateStr,1)+"T00:00:00+03:00")];
  if(view==="week"){const d=new Date(dateStr+"T12:00:00Z");const dow=(d.getUTCDay()+6)%7;const start=addDaysStr(dateStr,-dow);return[new Date(start+"T00:00:00+03:00"),new Date(addDaysStr(start,7)+"T00:00:00+03:00")]}
  const d=new Date(dateStr+"T12:00:00Z");const y=d.getUTCFullYear(),m=d.getUTCMonth()+1;const start=y+"-"+String(m).padStart(2,"0")+"-01";const nm=m===12?[y+1,1]:[y,m+1];const end=nm[0]+"-"+String(nm[1]).padStart(2,"0")+"-01";return[new Date(start+"T00:00:00+03:00"),new Date(end+"T00:00:00+03:00")]
}
async function appointmentForm(a=null){
  const services=await api("services?select=*&order=id.asc");
  const addons=await api("service_addons?select=*&active=eq.true&order=id.asc");
  const m=a?mskParts(a.starts_at):null;
  const date=a?m.date:document.querySelector("#calendarDate").value;
  const time=a?m.time:"10:00";
  const selectedAddonIds=(a?.addons||[]).map(x=>Number(x.id));
  return '<div class="editor-card"><h3>'+(a?"Редактирование записи":"Новая запись")+'</h3><div class="form-grid">'+
  '<label class="field"><span>Имя клиента</span><input id="apName" value="'+escapeAttr(a?.client_name||"")+'"></label>'+
  '<label class="field"><span>Телефон</span><input id="apPhone" value="'+escapeAttr(a?.client_phone||"")+'"></label>'+
  '<label class="field"><span>Услуга</span><select id="apService">'+services.map(s=>'<option value="'+s.id+'" '+(a?.services?.id===s.id?"selected":"")+'>'+escapeHtml(s.name)+' — '+s.price+' ₽</option>').join("")+'</select></label>'+
  '<label class="field"><span>Дата</span><input id="apDate" type="date" value="'+date+'"></label>'+
  '<label class="field"><span>Время</span><input id="apTime" type="time" value="'+time+'"></label>'+
  '<label class="field"><span>Статус</span><select id="apStatus"><option value="pending" '+(a?.status==="pending"?"selected":"")+'>Ожидает подтверждения</option><option value="confirmed" '+((a?.status==="confirmed"||a?.status==="booked")?"selected":"")+'>Подтверждена</option><option value="completed" '+(a?.status==="completed"?"selected":"")+'>Выполнено</option><option value="cancelled" '+(a?.status==="cancelled"?"selected":"")+'>Отменена</option><option value="no_show" '+(a?.status==="no_show"?"selected":"")+'>Не пришёл</option></select></label>'+
  '<label class="field wide"><span>Комментарий</span><textarea id="apComment" rows="2">'+escapeHtml(a?.comment||"")+'</textarea></label></div>'+
  '<div class="addons-admin"><strong>Дополнения</strong>'+addons.map(x=>'<label class="check-row"><input type="checkbox" data-ap-addon value="'+x.id+'" '+(selectedAddonIds.includes(x.id)?"checked":"")+'> '+escapeHtml(x.name)+' (+'+x.price+' ₽)</label>').join("")+'</div>'+
  '<div class="admin-actions"><button class="primary" id="saveAppointment" data-id="'+(a?.id||"")+'">Сохранить</button><button class="small" id="cancelAppointmentEdit">Отмена</button></div><div id="appointmentMessage" class="auth-message"></div></div>';
}
async function loadCalendar(view="day"){
  const [start,end]=rangeFor(document.querySelector("#calendarDate").value,view);
  const rows=await fetchAppointmentsRange(start,end);
  const groups={}; rows.forEach(a=>{const day=new Date(a.starts_at).toLocaleDateString("ru-RU",{timeZone:"Europe/Moscow"});(groups[day]??=[]).push(a)});
  const html=Object.keys(groups).length?Object.entries(groups).map(([day,list])=>'<div class="day-group"><h3>'+day+'</h3>'+list.map(a=>'<div class="appointment-row"><div><strong>'+new Date(a.starts_at).toLocaleTimeString("ru-RU",{timeZone:"Europe/Moscow",hour:"2-digit",minute:"2-digit"})+'</strong><br><small>'+escapeHtml(a.services?.name||"")+'</small></div><div><strong>'+escapeHtml(a.client_name)+'</strong><br><small>'+escapeHtml(a.client_phone)+'</small></div><div><span class="status '+a.status+'">'+statusText(a.status)+'</span><br><small>'+new Intl.NumberFormat("ru-RU").format(a.total_price||a.services?.price||0)+' ₽</small></div><button class="small" data-edit-appointment="'+a.id+'">Изменить</button></div>').join("")+'</div>').join(""):'<p class="empty-state">На выбранный период записей нет.</p>';
  document.querySelector("#calendarList").innerHTML=html;
  document.querySelectorAll("[data-edit-appointment]").forEach(b=>b.onclick=()=>openAppointmentEditor(Number(b.dataset.editAppointment)));
}


function studioToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
async function calendarView(){
  const iso=studioToday();
  return '<div class="section-head-admin"><div><h2>Календарь записей</h2><p>Просмотр, ручная запись, перенос, отмена и закрытие времени.</p></div><button class="primary" id="addAppointmentButton">+ Добавить запись</button></div>'+
  '<div class="calendar-toolbar"><input id="calendarDate" type="date" value="'+iso+'"><div class="view-switch"><button class="small active" data-view="day">День</button><button class="small" data-view="week">Неделя</button><button class="small" data-view="month">Месяц</button></div><button class="small" id="blockTimeButton">Закрыть время</button></div>'+
  '<div id="appointmentEditor"></div><div id="calendarList"></div>';
}
async function getTodayAppointments(){
  const d=studioToday();
  const start=new Date(d+"T00:00:00+03:00"),end=new Date(addDaysStr(d,1)+"T00:00:00+03:00");
  try{return await fetchAppointmentsRange(start,end)}catch{return []}
}
async function todayView(){
  const rows=await getTodayAppointments();
  const revenue=rows.filter(x=>x.status!=="cancelled").reduce((s,x)=>s+(x.total_price||x.services?.price||0),0);
  const table=rows.length?rows.map(x=>'<tr><td>'+new Date(x.starts_at).toLocaleTimeString("ru-RU",{timeZone:"Europe/Moscow",hour:"2-digit",minute:"2-digit"})+'</td><td>'+escapeHtml(x.client_name)+'</td><td>'+escapeHtml(x.services?.name||"—")+'</td><td><span class="status '+x.status+'">'+statusText(x.status)+'</span></td><td><button class="small" data-today-edit="'+x.id+'">Изменить</button></td></tr>').join(""):'<tr><td colspan="5">На сегодня записей пока нет</td></tr>';
  setTimeout(()=>document.querySelectorAll("[data-today-edit]").forEach(b=>b.onclick=async()=>{await openTab("calendar");document.querySelector("#calendarDate").value=studioToday();await loadCalendar("day");await openAppointmentEditor(Number(b.dataset.todayEdit))}),0);
  return '<h2>Сегодня</h2><div class="cards"><div class="stat">Записей<strong>'+rows.length+'</strong></div><div class="stat">Активных<strong>'+rows.filter(x=>x.status==="confirmed").length+'</strong></div><div class="stat">Сумма услуг<strong>'+new Intl.NumberFormat("ru-RU").format(revenue)+' ₽</strong></div></div><table class="admin-table"><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th>Статус</th><th></th></tr>'+table+'</table>';
}

async function notificationOutboxSummary(){
  try{
    const rows=await api("notification_outbox?select=status,channel,audience&order=id.desc&limit=200");
    const pending=rows.filter(x=>x.status==="pending").length;
    const failed=rows.filter(x=>x.status==="failed").length;
    return {pending,failed};
  }catch{return {pending:0,failed:0}}
}


async function quickSetStatus(id,status,returnTab="calendar"){
  try{
    await api("rpc/admin_set_appointment_status",{method:"POST",body:JSON.stringify({p_id:Number(id),p_status:status})});
    if(returnTab==="today") await openTab("today");
    else await loadCalendar(document.querySelector("[data-view].active")?.dataset.view||"day");
  }catch(e){alert(e.message)}
}

async function loadCalendar(view="day"){
  const [start,end]=rangeFor(document.querySelector("#calendarDate").value,view);
  const rows=await fetchAppointmentsRange(start,end);
  const groups={}; rows.forEach(a=>{const day=new Date(a.starts_at).toLocaleDateString("ru-RU",{timeZone:"Europe/Moscow"});(groups[day]??=[]).push(a)});
  const html=Object.keys(groups).length?Object.entries(groups).map(([day,list])=>'<div class="day-group"><h3>'+day+'</h3>'+list.map(a=>{
    const actions=a.status==="pending"
      ? '<div class="admin-actions"><button class="small success-action" data-quick-confirm="'+a.id+'">Подтвердить</button><button class="small danger" data-quick-cancel="'+a.id+'">Отклонить</button><button class="small" data-edit-appointment="'+a.id+'">Изменить</button></div>'
      : '<button class="small" data-edit-appointment="'+a.id+'">Изменить</button>';
    return '<div class="appointment-row"><div><strong>'+new Date(a.starts_at).toLocaleTimeString("ru-RU",{timeZone:"Europe/Moscow",hour:"2-digit",minute:"2-digit"})+'</strong><br><small>'+escapeHtml(a.services?.name||"")+'</small></div><div><strong>'+escapeHtml(a.client_name)+'</strong><br><small>'+escapeHtml(a.client_phone)+'</small></div><div><span class="status '+a.status+'">'+statusText(a.status)+'</span><br><small>'+new Intl.NumberFormat("ru-RU").format(a.total_price||a.services?.price||0)+' ₽</small></div>'+actions+'</div>';
  }).join("")+'</div>').join(""):'<p class="empty-state">На выбранный период записей нет.</p>';
  document.querySelector("#calendarList").innerHTML=html;
  document.querySelectorAll("[data-edit-appointment]").forEach(b=>b.onclick=()=>openAppointmentEditor(Number(b.dataset.editAppointment)));
  document.querySelectorAll("[data-quick-confirm]").forEach(b=>b.onclick=()=>quickSetStatus(b.dataset.quickConfirm,"confirmed"));
  document.querySelectorAll("[data-quick-cancel]").forEach(b=>b.onclick=()=>quickSetStatus(b.dataset.quickCancel,"cancelled"));
}

async function todayView(){
  const rows=await getTodayAppointments();
  const revenue=rows.filter(x=>x.status!=="cancelled").reduce((s,x)=>s+(x.total_price||x.services?.price||0),0);
  const table=rows.length?rows.map(x=>{
    const actions=x.status==="pending"
      ? '<div class="admin-actions"><button class="small success-action" data-today-confirm="'+x.id+'">Подтвердить</button><button class="small danger" data-today-cancel="'+x.id+'">Отклонить</button><button class="small" data-today-edit="'+x.id+'">Изменить</button></div>'
      : '<button class="small" data-today-edit="'+x.id+'">Изменить</button>';
    return '<tr><td>'+new Date(x.starts_at).toLocaleTimeString("ru-RU",{timeZone:"Europe/Moscow",hour:"2-digit",minute:"2-digit"})+'</td><td>'+escapeHtml(x.client_name)+'</td><td>'+escapeHtml(x.services?.name||"—")+'</td><td><span class="status '+x.status+'">'+statusText(x.status)+'</span></td><td>'+actions+'</td></tr>';
  }).join(""):'<tr><td colspan="5">На сегодня записей пока нет</td></tr>';
  setTimeout(()=>{
    document.querySelectorAll("[data-today-edit]").forEach(b=>b.onclick=async()=>{await openTab("calendar");document.querySelector("#calendarDate").value=studioToday();await loadCalendar("day");await openAppointmentEditor(Number(b.dataset.todayEdit))});
    document.querySelectorAll("[data-today-confirm]").forEach(b=>b.onclick=()=>quickSetStatus(b.dataset.todayConfirm,"confirmed","today"));
    document.querySelectorAll("[data-today-cancel]").forEach(b=>b.onclick=()=>quickSetStatus(b.dataset.todayCancel,"cancelled","today"));
  },0);
  return '<h2>Сегодня</h2><div class="cards"><div class="stat">Записей<strong>'+rows.length+'</strong></div><div class="stat">Ожидают<strong>'+rows.filter(x=>x.status==="pending").length+'</strong></div><div class="stat">Сумма услуг<strong>'+new Intl.NumberFormat("ru-RU").format(revenue)+' ₽</strong></div></div><table class="admin-table"><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th>Статус</th><th></th></tr>'+table+'</table>';
}
