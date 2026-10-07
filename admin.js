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
  const rows=(data||[]).map(s=>'<tr><td>'+escapeHtml(s.name)+'</td><td>'+s.duration_minutes+' мин</td><td>'+new Intl.NumberFormat("ru-RU").format(s.price)+' ₽</td><td>'+(s.active?"Включена":"Выключена")+'</td></tr>').join("");
  return '<h2>Услуги</h2><p>Услуги загружаются из защищённой базы.</p><table class="admin-table"><tr><th>Услуга</th><th>Длительность</th><th>Цена</th><th>Статус</th></tr>'+rows+'</table>';
}

async function scheduleView(){
  const data=await api("schedule_rules?select=*&order=weekday.asc");
  const names=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const rows=(data||[]).map(x=>'<div class="toggle-row"><span>'+names[x.weekday]+'</span><strong>'+(x.is_working?(x.start_time.slice(0,5)+"–"+x.end_time.slice(0,5)):"Выходной")+'</strong></div>').join("");
  return '<h2>Рабочее время</h2>'+rows;
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
  }catch(e){content.innerHTML='<p class="auth-message error">'+escapeHtml(e.message)+'</p>'}
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

document.querySelector("#loginButton").addEventListener("click",login);
document.querySelector("#signupButton").addEventListener("click",signup);
document.querySelector("#resendButton").addEventListener("click",resend);
logoutButton.addEventListener("click",()=>{clearSession();adminApp.classList.add("hidden");logoutButton.classList.add("hidden");authPanel.classList.remove("hidden");setMessage("Вы вышли из панели.","success")});
tabs.forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.tab)));

if(getSession()) showAdmin();
