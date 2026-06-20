const BACKEND_URL = "https://1-1-5hl5.onrender.com";

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = [];
let currentUserProfile = null;

// Инициализация при полной загрузке карт Яндекс
ymaps.ready(initYandexMap);

async function initYandexMap() {
    try {
        myMap = new ymaps.Map("map", {
            center: [43.2389, 76.8897],
            zoom: 11,
            controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
        });

        geoObjectsCollection = new ymaps.GeoObjectCollection();
        myMap.geoObjects.add(geoObjectsCollection);

        // ФИЧА 1: Автоопределение координат кликом по карте
        myMap.events.add('click', function (e) {
            const coords = e.get('coords'); 
            const latField = document.getElementById("addLat");
            const lngField = document.getElementById("addLng");
            
            if (latField && lngField) {
                latField.value = coords[0].toFixed(4);
                lngField.value = coords[1].toFixed(4);
                
                openAddPointModal(); // Автоматически открываем модалку для оформления
                
                const helper = document.getElementById("coordinateHelperText");
                if (helper) {
                    helper.innerText = `🎯 Координаты пойманы: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
                    helper.className = "text-[11px] text-emerald-400 mt-0.5 uppercase font-bold animate-pulse";
                }
            }
        });

        // Вешаем слушатели событий фильтрации интерфейса
        document.getElementById("searchQuery").addEventListener("input", renderApp);
        document.getElementById("filterStatus").addEventListener("change", renderApp);
        document.getElementById("filterType").addEventListener("change", renderApp);

        // Первичные проверки сессии и загрузка
        await checkBackendSession();
        await loadPointsFromServer();
    } catch (err) {
        console.error("Ошибка инициализации Yandex Map:", err);
    }
}

// Загрузка точек с авто-инициализацией базы данных
async function loadPointsFromServer() {
    try {
        let response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();

        // СИНХРОНИЗАЦИЯ: Если бэкенд пуст, отправляем массив initialSources из data.js
        if (loadedSources.length === 0 && typeof initialSources !== 'undefined' && initialSources.length > 0) {
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
        console.error("Ошибка при получении точек с бэкенда:", err);
    }
}

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

function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (!listContainer) return;

    if (items.length === 0) {
        listContainer.innerHTML = `
            <div class="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono">
                🔍 Источники не найдены
            </div>
        `;
        return;
    }

    listContainer.innerHTML = items.map(item => {
        let statusBadge = '';
        if (item.status === 'suitable') {
            statusBadge = `<span class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold font-mono">ПОДХОДИТ</span>`;
        } else if (item.status === 'checking') {
            statusBadge = `<span class="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold font-mono">АНАЛИЗ</span>`;
        } else {
            statusBadge = `<span class="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md font-bold font-mono">ОТКЛОНЕН</span>`;
        }

        const isSelected = currentSelectedId === item.id;

        return `
            <div onclick="selectSource(${item.id})" class="p-3 bg-slate-900/80 border rounded-xl hover:bg-slate-800/60 transition-all cursor-pointer flex justify-between items-center gap-4 ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-800/80'}">
                <div class="truncate">
                    <h4 class="font-bold text-xs text-slate-100 truncate">${item.name}</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5 truncate">${item.type} • ${item.location}</p>
                </div>
                <div class="shrink-0">${statusBadge}</div>
            </div>
        `;
    }).join('');
}

function renderMapMarkers(items) {
    if (!geoObjectsCollection) return;
    geoObjectsCollection.removeAll();

    items.forEach(item => {
        let presetColor = 'islands#yellowIcon'; 
        if (item.status === 'suitable') presetColor = 'islands#greenIcon';
        if (item.status === 'unsuitable') presetColor = 'islands#redIcon';

        const placemark = new ymaps.Placemark([item.lat, item.lng], {
            balloonContentHeader: `<strong style="color:#2563eb; font-family:monospace;">${item.name}</strong>`,
            balloonContentBody: `<span style="font-size:11px; color:#334155;">${item.type}<br>📍 Ориентир: ${item.location}</span>`
        }, {
            preset: presetColor
        });

        placemark.events.add('click', () => {
            selectSource(item.id);
        });

        geoObjectsCollection.add(placemark);
    });
}

function selectSource(id) {
    currentSelectedId = id;
    renderApp(); 

    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const card = document.getElementById("detailsCard");
    const content = document.getElementById("detailsContent");

    if (card && content) {
        card.classList.remove("hidden");

        let statusHtml = '';
        if (item.status === 'suitable') statusHtml = `<span class="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">💚 Пригодна для питья</span>`;
        else if (item.status === 'checking') statusHtml = `<span class="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">💛 На проверке в лаборатории</span>`;
        else statusHtml = `<span class="text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-lg">❌ Не подходит для употребления</span>`;

        content.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-slate-800 pb-3 gap-2 pr-6 font-mono">
                <div>
                    <h3 class="text-sm font-bold text-white tracking-wide">${item.name}</h3>
                    <p class="text-[10px] text-slate-400 mt-1">📍 Ориентир: <span class="text-slate-200">${item.location}</span></p>
                </div>
                <div class="text-[10px] shrink-0 pt-1">${statusHtml}</div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 font-mono">
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                    <span class="text-slate-500 block text-[9px] uppercase font-bold">Водородный рН</span>
                    <strong class="text-xs text-amber-400 block mt-0.5">pH ${item.ph}</strong>
                </div>
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                    <span class="text-slate-500 block text-[9px] uppercase font-bold">Минерализация</span>
                    <strong class="text-xs text-slate-100 block mt-0.5">${item.mineralization} <span class="text-[9px] text-slate-400 font-normal">мг/л</span></strong>
                </div>
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                    <span class="text-slate-500 block text-[9px] uppercase font-bold">Проводимость</span>
                    <strong class="text-xs text-slate-100 block mt-0.5">${item.conductivity} <span class="text-[9px] text-slate-400 font-normal">мкСм</span></strong>
                </div>
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                    <span class="text-slate-500 block text-[9px] uppercase font-bold">Жёсткость воды</span>
                    <strong class="text-xs text-slate-100 block mt-0.5">${item.hardness} <span class="text-[9px] text-slate-400 font-normal">мг-экв</span></strong>
                </div>
            </div>

            <div class="text-[11px] font-mono grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 pt-4 border-t border-slate-800/50 mt-3">
                <p><span class="text-slate-500">🌡️ Температура:</span> <span class="text-white">${item.temp} °C</span></p>
                <p><span class="text-slate-500">🔬 Примеси/Осадок:</span> <span class="text-white">${item.impurities}</span></p>
                <p><span class="text-slate-500">👤 Проверил:</span> <span class="text-indigo-400 font-bold">${item.author}</span></p>
            </div>
        `;

        if (myMap) {
            myMap.setCenter([item.lat, item.lng], 14, { duration: 300 });
        }
    }
}

function closeDetailsCard() {
    const card = document.getElementById("detailsCard");
    if (card) card.classList.add("hidden");
    currentSelectedId = null;
    renderApp();
}

async function handleCreatePoint(event) {
    event.preventDefault();

    const authorName = currentUserProfile ? currentUserProfile["ФИО"] : "Заказчик (Студент)";

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: "Региональный округ",
        location: document.getElementById("addLocation").value,
        lat: parseFloat(document.getElementById("addLat").value) || 0,
        lng: parseFloat(document.getElementById("addLng").value) || 0,
        ph: parseFloat(document.getElementById("addPh").value) || 7.0,
        mineralization: parseInt(document.getElementById("addMin").value) || 0,
        conductivity: parseInt(document.getElementById("addCond").value) || 0,
        hardness: parseFloat(document.getElementById("addHard").value) || 0,
        temp: parseInt(document.getElementById("addTemp").value) || 0,
        impurities: document.getElementById("addImpurities").value || "Нет",
        author: authorName
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Исследование успешно оплачено и добавлено в очередь модерации!");
            closeAddPointModal();
            event.target.reset();
            
            const helper = document.getElementById("coordinateHelperText");
            if (helper) {
                helper.innerText = "💡 Кликните в любое место на карте, чтобы заполнить координаты автоматически!";
                helper.className = "text-[11px] text-indigo-400 mt-0.5 uppercase font-semibold";
            }

            await loadPointsFromServer();
        } else {
            alert("Ошибка при отправке запроса на бэкенд.");
        }
    } catch (err) {
        console.error("Ошибка при создании точки:", err);
    }
}

// --- УПРАВЛЕНИЕ ПАНЕЛЬЮ МОДЕРАТОРА ---
function openModeratorModal() { 
    const modal = document.getElementById("moderatorModal");
    if (modal) {
        modal.classList.remove("hidden"); 
        renderModerationQueue(); 
    }
}

function closeModeratorModal() { 
    const modal = document.getElementById("moderatorModal");
    if (modal) modal.classList.add("hidden"); 
}

function renderModerationQueue() {
    const queueContainer = document.getElementById("moderationQueueList");
    if (!queueContainer) return;
    
    const checkingPoints = loadedSources.filter(item => item && item.status === "checking");

    if (checkingPoints.length === 0) {
        queueContainer.innerHTML = `
            <div class="text-slate-500 italic py-4 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                📥 Очередь пуста. Нет заявок на верификацию.
            </div>
        `;
        return;
    }

    queueContainer.innerHTML = checkingPoints.map(item => `
        <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div class="truncate max-w-full sm:max-w-[55%]">
                <strong class="text-slate-100 block text-xs truncate">${item.name}</strong>
                <span class="text-[11px] text-slate-400 block truncate">📍 Локация: ${item.location}</span>
                <span class="text-[10px] text-slate-500 block font-mono">pH: ${item.ph} | Жесткость: ${item.hardness} | Создал: ${item.author}</span>
            </div>
            <div class="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button onclick="startEditingSource(${item.id})" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition">
                    📝 Изменить
                </button>
                <button onclick="moderatePointInCabinet(${item.id}, 'suitable')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition">
                    Одобрить
                </button>
                <button onclick="moderatePointInCabinet(${item.id}, 'unsuitable')" class="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition">
                    Отклонить
                </button>
            </div>
        </div>
    `).join('');
}

// ФИЧА 2: Открытие и наполнение формы быстрого редактирования
function startEditingSource(id) {
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const block = document.getElementById("moderatorEditBlock");
    if (block) block.classList.remove("hidden");

    document.getElementById("editId").value = item.id;
    document.getElementById("editName").value = item.name;
    document.getElementById("editLocation").value = item.location;
    document.getElementById("editPh").value = item.ph;
    document.getElementById("editMin").value = item.mineralization;
    document.getElementById("editCond").value = item.conductivity;
    document.getElementById("editHard").value = item.hardness;
    document.getElementById("editTemp").value = item.temp;
    document.getElementById("editImpurities").value = item.impurities;
}

// ФИЧА 2: Отправка отредактированных модератором данных на бэкенд
async function submitUpdatedSource(event) {
    event.preventDefault();
    
    const payload = {
        id: parseInt(document.getElementById("editId").value),
        name: document.getElementById("editName").value,
        location: document.getElementById("editLocation").value,
        ph: parseFloat(document.getElementById("editPh").value),
        mineralization: parseInt(document.getElementById("editMin").value),
        conductivity: parseInt(document.getElementById("editCond").value),
        hardness: parseFloat(document.getElementById("editHard").value),
        temp: parseInt(document.getElementById("editTemp").value),
        impurities: document.getElementById("editImpurities").value
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Изменения успешно сохранены в базе данных!");
            document.getElementById("moderatorEditBlock").classList.add("hidden");
            await loadPointsFromServer(); 
            renderModerationQueue();      
        } else {
            alert("Ошибка сохранения обновлений.");
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка связи с сервером.");
    }
}

async function moderatePointInCabinet(id, status) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sources/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id), status: status })
        });
        
        if (response.ok) {
            document.getElementById("moderatorEditBlock").classList.add("hidden");
            await loadPointsFromServer();
            renderModerationQueue();
        } else {
            alert("Не удалось изменить статус модерации.");
        }
    } catch (err) { 
        console.error(err); 
    }
}

// --- СЕССИИ И АВТОРИЗАЦИЯ ---
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
        console.error("Ошибка сессии:", err);
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
            errorDiv.innerText = data.message || "Ошибка авторизации";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error(err);
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
            alert("Учетная запись лаборанта создана!");
            toggleToLogin();
        } else {
            errorDiv.innerText = data.message || "Ошибка регистрации";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error(err);
    }
}

function handleAuthSuccess(data) {
    currentUserProfile = data.profile;
    
    document.getElementById("authSection").innerHTML = `
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono">
            <span class="text-[11px] font-semibold text-slate-300 truncate max-w-[140px]">👤 ${currentUserProfile["ФИО"]}</span>
            <button onclick="logout()" class="text-[11px] text-red-400 hover:underline cursor-pointer ml-1">Выйти</button>
        </div>
    `;

    const btn = document.getElementById("adminPanelBtn");
    if (btn) {
        if (data.role === 'moderator') {
            btn.removeAttribute("disabled");
            btn.style.display = "block";
        } else {
            btn.setAttribute("disabled", "true");
            btn.style.display = "none";
        }
    }
    
    renderApp();
}

async function handleAssignModerator() {
    const usernameInput = document.getElementById("assignUsername");
    const username = usernameInput.value;

    if (!username) return alert("Введите логин!");

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/assign-moderator`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            usernameInput.value = ""; 
        } else {
            alert(data.message || "Не удалось назначить модератора.");
        }
    } catch (err) {
        console.error(err);
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.reload();
}

// --- ХЕЛПЕРЫ МОДАЛЬНЫХ ОКОН ---
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
    document.getElementById("authModalTitle").innerText = "Регистрация нового аккаунта";
    document.getElementById("loginFormSubmits").classList.add("hidden");
    document.getElementById("registerFormSubmits").classList.remove("hidden");
}
function toggleToLogin() {
    document.getElementById("authModalTitle").innerText = "Авторизация в системе";
    document.getElementById("loginFormSubmits").classList.remove("hidden");
    document.getElementById("registerFormSubmits").classList.add("hidden");
}
