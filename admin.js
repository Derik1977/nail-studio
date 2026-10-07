const SUPABASE_URL="https://lmwdxqispxslaetubbrb.supabase.co";
const SUPABASE_KEY="sb_publishable_oEF4vjw8OwTpSMRfUMgMCg_yVuJHzfx";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

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

async function isAdmin(){
  const {data,error}=await db.from("admin_users").select("user_id").limit(1);
  if(error) return false;
  return Array.isArray(data)&&data.length>0;
}

async function showAdmin(){
  const ok=await isAdmin();
  if(!ok){
    await db.auth.signOut();
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
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error){setMessage("Не удалось войти: "+error.message,"error");return}
  setMessage("");
  await showAdmin();
}

async function signup(){
  const email=emailInput.value.trim();
  const password=passwordInput.value;
  if(!email||!password){setMessage("Введите e-mail и пароль.","error");return}
  if(password.length<8){setMessage("Пароль должен содержать не менее 8 символов.","error");return}
  setMessage("Создаём доступ…");
  const {data,error}=await db.auth.signUp({email,password});
  if(error){setMessage("Не удалось создать доступ: "+error.message,"error");return}
  if(data.session){
    await showAdmin();
  }else{
    setMessage("Аккаунт создан. Проверьте почту и подтвердите e-mail, затем нажмите «Войти».","success");
  }
}

async function getTodayAppointments(){
  const now=new Date();
  const start=new Date(now);start.setHours(0,0,0,0);
  const end=new Date(now);end.setHours(23,59,59,999);
  const {data,error}=await db.from("appointments")
    .select("id,client_name,client_phone,starts_at,ends_at,status,comment,services(name,price,duration_minutes)")
    .gte("starts_at",start.toISOString()).lte("starts_at",end.toISOString()).order("starts_at");
  if(error) return [];
  return data||[];
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
  const {data}=await db.from("services").select("*").order("id");
  const rows=(data||[]).map(s=>'<tr><td>'+escapeHtml(s.name)+'</td><td>'+s.duration_minutes+' мин</td><td>'+new Intl.NumberFormat("ru-RU").format(s.price)+' ₽</td><td>'+(s.active?"Включена":"Выключена")+'</td></tr>').join("");
  return '<h2>Услуги</h2><p>Услуги уже загружаются из защищённой базы. Следующим этапом добавим редактирование прямо отсюда.</p><table class="admin-table"><tr><th>Услуга</th><th>Длительность</th><th>Цена</th><th>Статус</th></tr>'+rows+'</table>';
}

async function scheduleView(){
  const {data}=await db.from("schedule_rules").select("*").order("weekday");
  const names=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const rows=(data||[]).map(x=>'<div class="toggle-row"><span>'+names[x.weekday]+'</span><strong>'+(x.is_working?(x.start_time.slice(0,5)+"–"+x.end_time.slice(0,5)):"Выходной")+'</strong></div>').join("");
  return '<h2>Рабочее время</h2>'+rows+'<p class="note">Следующим этапом добавим изменение графика, закрытие часов и отдельные выходные даты.</p>';
}

async function promoView(){
  const {data}=await db.from("promos").select("*").order("id",{ascending:false});
  const rows=(data||[]).map(x=>'<div class="toggle-row"><span><strong>'+escapeHtml(x.title)+'</strong><br><small>'+escapeHtml(x.body||"")+'</small></span><strong>'+(x.active?"ВКЛ":"ВЫКЛ")+'</strong></div>').join("");
  return '<h2>Акции и баннеры</h2>'+rows+'<p class="note">Управление включением, текстом и сроком акции добавим в следующем обновлении.</p>';
}

async function openTab(name){
  tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  content.innerHTML='<p>Загрузка…</p>';
  if(name==="today") content.innerHTML=await todayView();
  else if(name==="services") content.innerHTML=await servicesView();
  else if(name==="schedule") content.innerHTML=await scheduleView();
  else if(name==="promo") content.innerHTML=await promoView();
  else if(name==="calendar") content.innerHTML='<h2>Календарь записей</h2><p>Следующим обновлением сделаем рабочий календарь с переносом, отменой и ручным добавлением записи.</p>';
  else if(name==="gallery") content.innerHTML='<h2>Галерея</h2><p>Следующим обновлением подключим загрузку фотографий в Supabase Storage.</p>';
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

document.querySelector("#loginButton").onclick=login;
document.querySelector("#signupButton").onclick=signup;
logoutButton.onclick=async()=>{await db.auth.signOut();adminApp.classList.add("hidden");logoutButton.classList.add("hidden");authPanel.classList.remove("hidden");setMessage("Вы вышли из панели.","success")};
tabs.forEach(b=>b.onclick=()=>openTab(b.dataset.tab));

(async()=>{
  const {data:{session}}=await db.auth.getSession();
  if(session) await showAdmin();
})();
