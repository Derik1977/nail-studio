const content=document.querySelector("#adminContent");
const tabs=document.querySelectorAll("[data-tab]");
const views={
today:'<h2>Сегодня</h2><div class="cards"><div class="stat">Записей<strong>5</strong></div><div class="stat">Свободных окон<strong>3</strong></div><div class="stat">Выручка по записи<strong>10 200 ₽</strong></div></div><table class="admin-table"><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th></th></tr><tr><td>10:00</td><td>Анна</td><td>Маникюр + покрытие</td><td><button class="small">Изменить</button></td></tr><tr><td>13:00</td><td>Мария</td><td>Педикюр</td><td><button class="small">Изменить</button></td></tr></table>',
calendar:'<h2>Календарь записей</h2><p>Здесь будут день / неделя / месяц, перенос записи и ручное добавление клиента.</p><div class="admin-actions"><button class="primary">+ Добавить запись</button><button class="small">Закрыть время</button></div>',
services:'<h2>Услуги</h2><p>Добавление, изменение цены, длительности, фото и включение/выключение услуги.</p><div class="admin-actions"><button class="primary">+ Добавить услугу</button></div>',
schedule:'<h2>Рабочее время</h2><div class="toggle-row"><span>Понедельник</span><strong>09:00–19:00</strong></div><div class="toggle-row"><span>Воскресенье</span><strong>Выходной</strong></div><p>Будут поддерживаться: закрыть часть дня, сделать конкретную дату выходной, открыть обычный выходной и поставить отпуск.</p>',
promo:'<h2>Акции и баннеры</h2><div class="toggle-row"><span><strong>-15% на первое посещение</strong><br><small>Показывать на главной</small></span><button class="small">ВКЛ</button></div><div class="admin-actions" style="margin-top:12px"><button class="primary">+ Новая акция</button></div>',
gallery:'<h2>Галерея</h2><p>Загрузка фотографий работ, подпись и удаление.</p><button class="primary">+ Добавить фото</button>'
};
function openTab(name){content.innerHTML=views[name];tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===name))}
tabs.forEach(b=>b.onclick=()=>openTab(b.dataset.tab));openTab("today");