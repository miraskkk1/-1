const BACKEND_URL = "https://1-1-5hl5.onrender.com";

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = [];
let currentUserProfile = null;

// Инициализация при полной загрузке карт Яндекс
ymaps.ready(initYandexMap);

async function initYandexMap() {
    myMap = new ymaps.Map("map", {
        center: [43.2389, 76.8897],
        zoom: 11,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    geoObjectsCollection = new ymaps.GeoObjectCollection();
    myMap.geoObjects.add(geoObjectsCollection);

    // Вешаем слушатели событий фильтрации интерфейса
    document.getElementById("searchQuery").addEventListener("input", renderApp);
    document.getElementById("filterStatus").addEventListener("change", renderApp);
    document.getElementById("filterType").addEventListener("change", renderApp);

    // Первичные проверки сессии и загрузка
    await checkBackendSession();
    await loadPointsFromServer();
}

// Загрузка точек с авто-инициализацией базы данных (в случае сброса сервера Render)
async function loadPointsFromServer() {
    try {
        let response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();

        // СИНХРОНИЗАЦИЯ: Если бэкенд чистый, отправляем массив initialSources из data.js
        if (loadedSources.length === 0 && typeof initialSources !== 'undefined' && initialSources.length > 0) {
            console.log("База данных сервера пуста. Отправляем стартовые точки из data.js...");
            await fetch(`${BACKEND_URL}/api/sources/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialSources)
            });
            response = await fetch(`${BACKEND_URL}/api/sources`);
            loadedSources = await response.json();
        }

        renderApp();
    } catch (err) {
        console.error("Ошибка при получении данных с сервера:", err);
    }
}

// Главная функция рендеринга интерфейса (Фильтрация + Поиск)
function renderApp() {
    if (!loadedSources) return;
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;

    const filtered = loadedSources.filter(item => {
        const matchesSearch = (item.name && item.name.toLowerCase().includes(query)) || 
                              (item.location && item.location.toLowerCase().includes(query));
        const matchesStatus = filterStatus === "all" || item.status === filterStatus;
        const matchesType = filterType === "all" || item.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });

    renderList(filtered);
    renderMapMarkers(filtered);
}

// Отображение списка элементов на левой боковой панели (КРАСИВАЯ ТЕМНАЯ ТЕМА)
function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (!listContainer) return;
    
    if (items.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-6 font-mono tracking-wider">ЛОКАЦИИ НЕ НАЙДЕНЫ</p>';
        return;
    }

    listContainer.innerHTML = items.map(item => {
        let statusBadge = item.status === 'suitable' ? '<span class="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25 font-mono">ПОДХОДИТ</span>' : 
                          item.status === 'checking' ? '<span class="text-amber-400 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25 font-mono font-bold">АНАЛИЗ</span>' : 
                                                       '<span class="text-rose-400 text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/25 font-mono">ОТКЛОНЕН</span>';
        return `
            <div onclick="selectSource(${item.id})" class="p-3 border rounded-xl cursor-pointer hover:bg-slate-800/80 text-xs transition-all flex justify-between items-center gap-2 ${currentSelectedId === item.id ? 'bg-slate-800 border-amber-500/60 shadow-lg shadow-amber-500/5' : 'bg-slate-950 border-slate-900'}">
                <div class="truncate">
                    <h4 class="font-bold text-white truncate">${item.name}</h4>
                    <p class="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">${item.type} • ${item.district || 'Алматы'}</p>
                </div>
                <div class="shrink-0 font-mono">${statusBadge}</div>
            </div>
        `;
    }).join('');
}

// Отрисовка гео-точек и кластеров на Яндекс Картах (ЦВЕТНЫЕ МЕТКИ ВОССТАНОВЛЕНЫ)
function renderMapMarkers(items) {
    if (!geoObjectsCollection) return;
    geoObjectsCollection.removeAll();
    
    items.forEach(item => {
        let presetColor = 'islands#yellowIcon'; // На проверке 💛
        if (item.status === 'suitable') presetColor = 'islands#greenIcon'; // Подходит 💚
        if (item.status === 'unsuitable') presetColor = 'islands#redIcon'; // Не подходит ❌

        const placemark = new ymaps.Placemark([item.lat, item.lng], {
            balloonContentHeader: `<strong class="text-blue-800">${item.name}</strong>`,
            balloonContentBody: `<span class="text-xs">${item.type}<br>📍 ${item.location}</span>`
        }, {
            preset: presetColor
        });
        
        placemark.events.add('click', () => selectSource(item.id));
        geoObjectsCollection.add(placemark);
    });
}

// Выбор источника и отображение карточки расширенных лабораторных данных
function selectSource(id) {
    currentSelectedId = id;
    renderApp(); 
    
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const detailsCard = document.getElementById("detailsCard");
    const placeholder = document.getElementById("noSelectPlaceholder");
    
    if (placeholder) placeholder.classList.add("hidden");
    if (detailsCard) {
        detailsCard.classList.remove("hidden");
        
        let statusText = item.status === 'suitable' ? '<span class="text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px] tracking-wide uppercase">💚 Подходит для электролиза</span>' : 
                         item.status === 'checking' ? '<span class="text-amber-400 font-bold font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-[11px] tracking-wide uppercase">💛 На проверке</span>' : 
                                                      '<span class="text-rose-400 font-bold font-mono bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/30 text-[11px] tracking-wide uppercase">❌ Не подходит</span>';

        detailsCard.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-slate-800/80 pb-4 gap-3">
                <div>
                    <h3 class="text-lg font-bold text-white font-mono tracking-wide">${item.name}</h3>
                    <p class="text-xs text-gray-400 mt-1">📍 Ориентир: <span class="text-slate-300">${item.location}</span></p>
                </div>
                <div class="shrink-0">${statusText}</div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80 mt-3">
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Водородный индекс:</span> <strong class="text-sm font-mono text-amber-400">pH ${item.ph}</strong></div>
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Минерализация:</span> <strong class="text-sm font-mono text-white">${item.mineralization} мг/л</strong></div>
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Проводимость:</span> <strong class="text-sm font-mono text-white">${item.conductivity} мкСм/см</strong></div>
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Общая жёсткость:</span> <strong class="text-sm font-mono text-white">${item.hardness} мг-экв/л</strong></div>
            </div>
            <div class="text-xs space-y-2 text-slate-300 pt-3 font-mono">
                <p><span class="text-slate-500">🌡️ Температура воды на выходе:</span> <span class="text-white">${item.temp} °C</span></p>
                <p><span class="text-slate-500">🔬 Характер примесей / Осадок:</span> <span class="text-white">${item.impurities}</span></p>
                <p><span class="text-slate-500">👤 Исследователь-лаборант:</span> <span class="text-amber-400">${item.author}</span> <span class="text-[10px] text-slate-500">(${item.date || '2026'})</span></p>
            </div>
        `;
        
        myMap.setCenter([item.lat, item.lng], 14, { duration: 300 });
    }
}

// Отправка формы создания новой точки (Оформление заказа на исследование)
async function handleCreatePoint(event) {
    event.preventDefault();
    const authorName = currentUserProfile ? currentUserProfile["ФИО"] : "Заказчик (Студент)";

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: "Алматы",
        location: document.getElementById("addLocation").value,
        lat: parseFloat(document.getElementById("addLat").value) || 0,
        lng: parseFloat(document.getElementById("addLng").value) || 0,
        ph: parseFloat(document.getElementById("addPh").value) || 7.0,
        mineralization: parseInt(document.getElementById("addMin").value) || 0,
        conductivity: parseInt(document.getElementById("addCond").value) || 0,
        hardness: parseFloat(document.getElementById("addHard").value) || 0,
        temp: parseInt(document.getElementById("addTemp").value) || 0,
        impurities: document.getElementById("addImpurities").value || "Требуется лабораторный анализ",
        author: authorName
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert("Заказ на сумму 20 000 ₸ успешно оформлен! Заявка направлена в лабораторию Юткина. Точка отобразится на карте со статусом АНАЛИЗ.");
            closeAddPointModal();
            event.target.reset(); // Полностью очищаем поля формы ввода
            await loadPointsFromServer();
        } else {
            alert("Ошибка сохранения заказа сервером.");
        }
    } catch (err) {
        console.error("Сбой сети при отправке заказа:", err);
        alert("Ошибка соединения с бэкенд сервером.");
    }
}

// --- СИСТЕМА АВТОРИЗАЦИИ, СЕССИЙ И СЕКЬЮРНОСТИ ---

async function checkBackendSession() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            handleAuthSuccess(data);
        } else {
            localStorage.removeItem("token");
        }
    } catch (err) {
        console.error("Сервер авторизации недоступен:", err);
    }
}

async function handleBackendLogin() {
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("token", data.token);
            handleAuthSuccess(data);
            closeAuthModal();
        } else {
            errorDiv.innerText = data.message || "Неверный логин или пароль";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Ошибка при авторизации:", err);
    }
}

async function handleBackendRegister() {
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok) {
            alert("Регистрация успешна! Войдите под своими учетными данными.");
            toggleToLogin();
        } else {
            errorDiv.innerText = data.message || "Ошибка при регистрации";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Ошибка при регистрации:", err);
    }
}

function handleAuthSuccess(data) {
    currentUserProfile = data.profile;
    
    document.getElementById("authSection").innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-xs bg-slate-800 border border-blue-400 text-cyan-300 px-2 py-1 rounded-md font-mono">👤 ${currentUserProfile["ФИО"]}</span>
            <button onclick="logout()" class="text-xs text-red-300 hover:text-red-100 underline cursor-pointer">Выйти</button>
        </div>
    `;

    if (data.role === 'moderator') {
        const btn = document.getElementById("adminPanelBtn");
        if (btn) {
            btn.removeAttribute("disabled");
            btn.classList.remove("opacity-40", "cursor-not-allowed", "text-gray-400");
            btn.classList.add("bg-indigo-600", "text-white", "hover:bg-indigo-700", "shadow-md", "cursor-pointer");
        }
    }
    renderApp();
}

// --- УПРАВЛЕНИЕ КАБИНЕТОМ МОДЕРАТОРА ---

function openModeratorModal() {
    document.getElementById("moderatorModal").classList.remove("hidden");
    renderModerationQueue();
}

function closeModeratorModal() {
    document.getElementById("moderatorModal").classList.add("hidden");
}

function renderModerationQueue() {
    const queueContainer = document.getElementById("moderationQueueList");
    if (!queueContainer) return;

    const checkingPoints = loadedSources.filter(item => item.status === "checking");

    if (checkingPoints.length === 0) {
        queueContainer.innerHTML = `
            <div class="text-center py-10 text-gray-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 font-mono">
                🎉 Очередь пуста! Новых заказов на модерацию нет.
            </div>
        `;
        return;
    }

    queueContainer.innerHTML = checkingPoints.map(item => `
        <div class="p-4 border border-slate-800 rounded-xl bg-slate-950 flex flex-col md:flex-row justify-between gap-3 items-start md:items-center shadow-lg">
            <div class="space-y-1 flex-grow">
                <h4 class="font-bold text-white text-sm font-mono">${item.name}</h4>
                <p class="text-slate-400">📍 Местоположение: ${item.location}</p>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 mt-1 text-slate-300 font-mono">
                    <div><strong>pH:</strong> ${item.ph}</div>
                    <div><strong>Мин:</strong> ${item.mineralization} мг/л</div>
                    <div><strong>Провод:</strong> ${item.conductivity}</div>
                    <div><strong>Жестк:</strong> ${item.hardness}</div>
                    <div><strong>Темп:</strong> ${item.temp}°C</div>
                </div>
                <p class="text-[11px] text-slate-500 mt-1">👤 Заказчик: ${item.author} | Примечания: ${item.impurities}</p>
            </div>
            <div class="flex gap-2 shrink-0 w-full md:w-auto justify-end border-t border-slate-800 pt-2 md:border-t-0 md:pt-0">
                <button onclick="moderatePointInCabinet(${item.id}, 'suitable')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer">
                    💚 Одобрить
                </button>
                <button onclick="moderatePointInCabinet(${item.id}, 'unsuitable')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer">
                    ❌ Отклонить
                </button>
            </div>
        </div>
    `).join('');
}

async function moderatePointInCabinet(id, status) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sources/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id), status: status })
        });
        
        if (response.ok) {
            alert(`Статус исследования успешно обновлен: ${status === 'suitable' ? 'Подходит' : 'Не подходит'}`);
            await loadPointsFromServer();
            renderModerationQueue();
        } else {
            alert("Сервер отклонил операцию модерации.");
        }
    } catch (err) {
        console.error("Ошибка при модерации источника:", err);
    }
}

// ФУНКЦИЯ ДЛЯ НАЗНАЧЕНИЯ НОВОГО МОДЕРАТОРА
async function handleAssignModerator() {
    const usernameInput = document.getElementById("assignUsername");
    const username = usernameInput.value.trim();
    const token = localStorage.getItem("token");

    if (!username) {
        alert("Пожалуйста, введите логин лаборанта.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/assign-moderator`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (response.ok) {
            alert(`Пользователь ${username} успешно повышен до уровня Модератора/Администратора!`);
            usernameInput.value = ""; 
        } else {
            alert(data.message || "Не удалось назначить модератора.");
        }
    } catch (err) {
        console.error("Ошибка сети при изменении роли:", err);
        alert("Ошибка связи с бэкенд сервером.");
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.reload();
}

// --- УЛУЧШЕННЫЕ И ГАРАНТИРОВАННО РАБОЧИЕ ХЕЛПЕРЫ МОДАЛЬНЫХ ОКОН ---
function openAddPointModal() { 
    const modal = document.getElementById("addPointModal");
    if (modal) modal.classList.remove("hidden"); 
}
function closeAddPointModal() { 
    const modal = document.getElementById("addPointModal");
    if (modal) modal.classList.add("hidden"); 
}
function openAuthModal() { 
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.remove("hidden"); 
}
function closeAuthModal() { 
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.add("hidden"); 
}
function toggleToRegister() {
    document.getElementById("authModalTitle").innerText = "Регистрация";
    document.getElementById("loginFormSubmits").classList.add("hidden");
    document.getElementById("registerFormSubmits").classList.remove("hidden");
}
function toggleToLogin() {
    document.getElementById("authModalTitle").innerText = "Авторизация";
    document.getElementById("loginFormSubmits").classList.remove("hidden");
    document.getElementById("registerFormSubmits").classList.add("hidden");
}
