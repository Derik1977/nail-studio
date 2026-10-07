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

async function api(path,options={}){
  const session=getSession();
  const headers={
    "apikey":SUPABASE_KEY,
    "Authorization":"Bearer "+(session?.access_token||SUPABASE_KEY),
    "Content-Type":"application/json",
    ...(options.headers||{})
  };
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers});
  const text=await r.text();
  const data=text?JSON.parse(text):null;
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
  return '<h2>Сегодня</h2><div class="cards"><div class="stat">Записей<strong>'+rows.length+'</strong></div><div class="stat">Активных<strong>'+rows.filter(x=>x.status==="booked").length+'</strong></div><div class="stat">Сумма услуг<strong>'+new Intl.NumberFormat("ru-RU").format(revenue)+' ₽</strong></div></div><table class="admin-table"><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th>Статус</th></tr>'+table+'</table>';
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

async function promoView(){
  const data=await api("promos?select=*&order=id.desc");
  const rows=(data||[]).map(x=>'<div class="toggle-row"><span><strong>'+escapeHtml(x.title)+'</strong><br><small>'+escapeHtml(x.body||"")+'</small></span><strong>'+(x.active?"ВКЛ":"ВЫКЛ")+'</strong></div>').join("");
  return '<h2>Акции и баннеры</h2>'+rows;
}

async function openTab(name){
  tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  content.innerHTML='<p>Загрузка…</p>';
  try{
    if(name==="today") content.innerHTML=await todayView();
    else if(name==="services") content.innerHTML=await servicesView();
    else if(name==="schedule") content.innerHTML=await scheduleView();
    else if(name==="promo") content.innerHTML=await promoView();
    else if(name==="calendar") content.innerHTML='<h2>Календарь записей</h2><p>Следующим обновлением сделаем рабочий календарь.</p>';
    else if(name==="gallery") content.innerHTML='<h2>Галерея</h2><p>Следующим обновлением подключим загрузку фотографий.</p>';

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
