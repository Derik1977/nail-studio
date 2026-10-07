const services=[
{id:1,name:"Маникюр без покрытия",duration:60,price:1200},
{id:2,name:"Маникюр + покрытие",duration:120,price:2000},
{id:3,name:"Укрепление + покрытие",duration:150,price:2500},
{id:4,name:"Наращивание ногтей",duration:180,price:3200},
{id:5,name:"Коррекция наращивания",duration:150,price:2700},
{id:6,name:"Педикюр + покрытие",duration:120,price:2300}
];
let selectedService=null,selectedSlot=null;
const $=s=>document.querySelector(s);
const rub=n=>new Intl.NumberFormat("ru-RU").format(n)+" ₽";

function renderServices(){
 $("#services").innerHTML=services.map(s=>'<article class="service" data-id="'+s.id+'"><h3>'+s.name+'</h3><div class="service-meta"><span>'+s.duration+' мин</span><span>1 мастер</span></div><div class="service-price">'+rub(s.price)+'</div></article>').join("");
 document.querySelectorAll(".service").forEach(el=>el.onclick=()=>selectService(+el.dataset.id));
}
function selectService(id){
 selectedService=services.find(s=>s.id===id);
 document.querySelectorAll(".service").forEach(el=>el.classList.toggle("active",+el.dataset.id===id));
 $("#bookingSummary").textContent=selectedService.name+" · "+selectedService.duration+" мин · "+rub(selectedService.price);
 document.querySelector("#booking").scrollIntoView({behavior:"smooth",block:"start"});
 renderSlots();
}
function setMinDate(){
 const d=new Date(); const iso=d.toISOString().slice(0,10); $("#bookingDate").min=iso; $("#bookingDate").value=iso;
}
function renderSlots(){
 selectedSlot=null;
 if(!selectedService){$("#slots").innerHTML='<span class="note">Сначала выберите услугу</span>';return}
 const base=["09:00","10:30","12:00","14:00","15:30","17:00","18:30"];
 const demoBusy=["12:00","17:00"];
 $("#slots").innerHTML=base.map(t=>'<button class="slot '+(demoBusy.includes(t)?"busy":"")+'" data-time="'+t+'" '+(demoBusy.includes(t)?"disabled":"")+'>'+t+'</button>').join("");
 document.querySelectorAll(".slot:not(.busy)").forEach(el=>el.onclick=()=>{selectedSlot=el.dataset.time;document.querySelectorAll(".slot").forEach(x=>x.classList.remove("active"));el.classList.add("active")});
}
function showModal(text){$("#modalText").textContent=text;$("#modal").classList.remove("hidden")}
$("#bookingForm").addEventListener("submit",e=>{
 e.preventDefault();
 if(!selectedService){alert("Сначала выберите услугу");return}
 if(!selectedSlot){alert("Выберите свободное время");return}
 const data=Object.fromEntries(new FormData(e.currentTarget));
 const date=$("#bookingDate").value;
 showModal(data.name+", ваша запись: "+selectedService.name+", "+date+" в "+selectedSlot+". Цена "+rub(selectedService.price)+".");
});
$("#bookingDate").addEventListener("change",renderSlots);
$("#scrollBooking").onclick=()=>$("#booking").scrollIntoView({behavior:"smooth"});
$("#promoBook").onclick=()=>$("#services").scrollIntoView({behavior:"smooth"});
$("#closeModal").onclick=$("#modalOk").onclick=()=>$("#modal").classList.add("hidden");
renderServices();setMinDate();renderSlots();