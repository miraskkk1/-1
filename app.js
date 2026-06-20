const BACKEND_URL = "https://1-1-5hl5.onrender.com";

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = [];
let currentUserProfile = null;

ymaps.ready(initYandexMap);

async function initYandexMap() {
    try {
        myMap = new ymaps.Map("map", {
            center: [43.2389, 76.8897],
            zoom: 11,
            controls: ['zoomControl', 'typeSelector']
        });

        geoObjectsCollection = new ymaps.GeoObjectCollection();
        myMap.geoObjects.add(geoObjectsCollection);

        // ФИЧА 1: Определение координат кликом по карте
        myMap.events.add('click', function (e) {
            const coords = e.get('coords'); // Получаем массив [широта, долгота]
            
            const latField = document.getElementById("addLat");
            const lngField = document.getElementById("addLng");
            
            if (latField && lngField) {
                latField.value = coords[0].toFixed(4);
                lngField.value = coords[1].toFixed(4);
                
                // Визуальный отклик - открываем модалку, если она была скрыта
                openAddPointModal();
                
                // Подсветим хелпер, что координаты успешно пойманы
                const helper = document.getElementById("coordinateHelperText");
                if (helper) {
                    helper.innerText = `🎯 Координаты успешно пойманы с карты: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
                    helper.className = "text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 uppercase font-bold animate-pulse";
                }
            }
        });

        document.getElementById("searchQuery").addEventListener("input", renderApp);
        document.getElementById("filterStatus").addEventListener("change", renderApp);
        document.getElementById("filterType").addEventListener("change", renderApp);

        await checkBackendSession();
        await loadPointsFromServer();
    } catch (e) {
        console.error("Ошибка инициализации карт:", e);
    }
}

async function loadPointsFromServer() {
    try {
        let response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();

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
        console.error("Ошибка при получении точек:", err);
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
        listContainer.innerHTML = '<div class="p-4 bg-white dark:bg-slate-950 rounded-xl shadow border border-slate-200 text-[11px] text-slate-400 text-center">Ничего не найдено</div>';
        return;
    }

    listContainer.innerHTML = items.map(item => {
        let statusBadge = item.status === 'suitable' ? '<span class="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200">Подходит</span>' : 
                          item.status === 'checking' ? '<span class="text-amber-600 dark:text-amber-400 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200">Анализ</span>' : 
                                                       '<span class="text-rose-600 dark:text-rose-400 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200">Отклонен</span>';
        
        const isSelected = currentSelectedId === item.id;
        return `
            <div onclick="selectSource(${item.id})" class="p-3 bg-white/95 dark:bg-slate-950/95 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80 text-xs transition-all flex justify-between items-center gap-3 shadow-sm pointer-events-auto ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 dark:border-slate-800/80'}" style="backdrop-blur: 4px;">
                <div class="truncate">
                    <h4 class="font-semibold text-slate-900 dark:text-white truncate">${item.name}</h4>
                    <p class="text-slate-400 text-[10px] mt-0.5">${item.type} • ${item.location}</p>
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
            balloonContentHeader: `<strong style="color:#1e3a8a">${item.name}</strong>`,
            balloonContentBody: `<span style="font-size:12px">${item.type}<br>📍 ${item.location}</span>`
        }, {
            preset: presetColor
        });
        
        placemark.events.add('click', () => selectSource(item.id));
        geoObjectsCollection.add(placemark);
    });
}

function selectSource(id) {
    currentSelectedId = id;
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const wrapper = document.getElementById("detailsWrapper");
    const container = document.getElementById("detailsCard");
    
    if (container && wrapper) {
        container.classList.remove("hidden");
        
        let statusText = item.status === 'suitable' ? '<span class="text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px] tracking-wide uppercase">💚 Подходит</span>' : 
                         item.status === 'checking' ? '<span class="text-amber-400 font-bold font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-[11px] tracking-wide uppercase">💛 Анализ</span>' : 
                                                      '<span class="text-rose-400 font-bold font-mono bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/30 text-[11px] tracking-wide uppercase">❌ Отклонен</span>';

        container.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-slate-800 pb-3 gap-3 pr-6">
                <div>
                    <h3 class="text-base font-bold text-white font-mono tracking-wide">${item.name}</h3>
                    <p class="text-[11px] text-slate-400 mt-1">📍 Ориентир: <span class="text-slate-300">${item.location}</span></p>
                </div>
                <div class="shrink-0">${statusText}</div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 mt-3">
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Водородный pH</span> 
                    <strong class="text-xs font-mono text-amber-400 block">pH ${item.ph}</strong>
                </div>
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Минерализация</span> 
                    <strong class="text-xs font-mono text-white block">${item.mineralization} <span class="text-[9px] text-slate-400 font-normal">мг/л</span></strong>
                </div>
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Проводимость</span> 
                    <strong class="text-xs font-mono text-white block">${item.conductivity} <span class="text-[9px] text-slate-400 font-normal">мкСм</span></strong>
                </div>
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Жёсткость</span> 
                    <strong class="text-xs font-mono text-white block">${item.hardness} <span class="text-[9px] text-slate-400 font-normal">мг-экв</span></strong>
                </div>
            </div>
            <div class="text-[11px] space-y-1 text-slate-300 pt-3 font-mono">
                <p><span class="text-slate-500">🌡️ Температура:</span> <span class="text-white font-medium">${item.temp} °C</span></p>
                <p><span class="text-slate-500">🔬 Примеси/Осадок:</span> <span class="text-white font-medium">${item.impurities}</span></p>
                <p><span class="text-slate-500">👤 Лаборант:</span> <span class="text-amber-400 font-medium">${item.author}</span></p>
            </div>
        `;
        wrapper.classList.remove("translate-y-full");
        const isMobile = window.innerWidth < 768;
        const targetLat = isMobile ? item.lat - 0.003 : item.lat; 
        if (myMap) myMap.setCenter([targetLat, item.lng], 14, { duration: 300 });
    }
}

function closeDetailsCard() {
    const wrapper = document.getElementById("detailsWrapper");
    if (wrapper) wrapper.classList.add("translate-y-full");
    currentSelectedId = null;
}

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
            alert("Исследование успешно оплачено и оформлено!");
            closeAddPointModal();
            event.target.reset();
            // Возвращаем исходное состояние подсказке
            const helper = document.getElementById("coordinateHelperText");
            if (helper) {
                helper.innerText = "💡 Подсказка: Вы можете просто кликнуть в любое место на карте, чтобы заполнить координаты автоматически!";
                helper.className = "text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 uppercase font-semibold";
            }
            await loadPointsFromServer();
        }
    } catch (err) { console.error(err); }
}

// --- ФИЧА 2: РЕДАКТИРОВАНИЕ ТОЧЕК МОДЕРАТОРОМ ---
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
            <div class="text-center py-8 text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                📥 Очередь пуста. Нет источников на проверку.
            </div>
        `;
        return;
    }

    queueContainer.innerHTML = checkingPoints.map(item => `
        <div class="p-3.5 border border-slate-800 rounded-xl bg-slate-900/60 flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
            <div class="truncate max-w-full sm:max-w-[60%]">
                <h4 class="font-bold text-white font-mono text-sm truncate">${item.name || 'Без названия'}</h4>
                <p class="text-slate-400 text-[11px] mt-0.5 truncate">📍 Ориентир: ${item.location || 'Не указан'}</p>
                <p class="text-slate-500 text-[10px] mt-1 font-mono">pH: ${item.ph} | Минерал: ${item.mineralization} мг/л</p>
            </div>
            <div class="flex gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                <button onclick="startEditingSource(${item.id})" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all">
                    📝 Редактировать
                </button>
                <button onclick="moderatePointInCabinet(${item.id}, 'suitable')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all">
                    ✓ Одобрить
                </button>
            </div>
        </div>
    `).join('');
}

// Загрузка показателей выбранной точки в форму редактирования
function startEditingSource(id) {
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    document.getElementById("editFormPlaceholder").style.display = "none";
    const form = document.getElementById("moderatorEditForm");
    form.classList.remove("hidden");
    form.style.display = "block";

    // Заполняем инпуты текущими значениями из БД
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

// Отправка отредактированных модератором данных на бэкенд
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
            alert("Данные успешно изменены!");
            await loadPointsFromServer(); // Перезагружаем общую базу
            renderModerationQueue();      // Обновляем список модератора
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка при сохранении обновлений.");
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
            await loadPointsFromServer();
            renderModerationQueue();
            // Сбрасываем форму редактирования, если одобрили эту же точку
            document.getElementById("moderatorEditForm").style.display = "none";
            document.getElementById("editFormPlaceholder").style.display = "block";
        }
    } catch (err) { console.error(err); }
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
    } catch (err) { console.error(err); }
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
            errorDiv.innerText = data.message || "Ошибка";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) { console.error(err); }
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
        if (response.ok) { alert("Успешно!"); toggleToLogin(); }
    } catch (err) { console.error(err); }
}

function handleAuthSuccess(data) {
    currentUserProfile = data.profile;
    document.getElementById("authSection").innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">👤 ${currentUserProfile["ФИО"]}</span>
            <button onclick="logout()" class="text-[11px] text-red-500 hover:underline cursor-pointer">Выйти</button>
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

function logout() { localStorage.removeItem("token"); window.location.reload(); }
function openAddPointModal() { const m = document.getElementById("addPointModal"); if(m) m.classList.remove("hidden"); }
function closeAddPointModal() { const m = document.getElementById("addPointModal"); if(m) m.classList.add("hidden"); }
function openAuthModal() { const m = document.getElementById("authModal"); if(m) m.classList.remove("hidden"); }
function closeAuthModal() { const m = document.getElementById("authModal"); if(m) m.classList.add("hidden"); }
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
        console.error("Ошибка при получении точек:", err);
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
        listContainer.innerHTML = '<div class="p-4 bg-white dark:bg-slate-950 rounded-xl shadow border border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center">Ничего не найдено</div>';
        return;
    }

    listContainer.innerHTML = items.map(item => {
        let statusBadge = item.status === 'suitable' ? '<span class="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200">Подходит</span>' : 
                          item.status === 'checking' ? '<span class="text-amber-600 dark:text-amber-400 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200">Анализ</span>' : 
                                                       '<span class="text-rose-600 dark:text-rose-400 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200">Отклонен</span>';
        
        const isSelected = currentSelectedId === item.id;
        return `
            <div onclick="selectSource(${item.id})" class="p-3 bg-white/95 dark:bg-slate-950/95 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80 text-xs transition-all flex justify-between items-center gap-3 shadow-sm pointer-events-auto ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 dark:border-slate-800/80'}" style="backdrop-blur: 4px;">
                <div class="truncate">
                    <h4 class="font-semibold text-slate-900 dark:text-white truncate">${item.name}</h4>
                    <p class="text-slate-400 text-[10px] mt-0.5">${item.type} • ${item.location}</p>
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
            balloonContentHeader: `<strong style="color:#1e3a8a">${item.name}</strong>`,
            balloonContentBody: `<span style="font-size:12px">${item.type}<br>📍 ${item.location}</span>`
        }, {
            preset: presetColor
        });
        
        placemark.events.add('click', () => selectSource(item.id));
        geoObjectsCollection.add(placemark);
    });
}

function selectSource(id) {
    currentSelectedId = id;
    
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const wrapper = document.getElementById("detailsWrapper");
    const container = document.getElementById("detailsCard");
    
    if (container && wrapper) {
        container.classList.remove("hidden");
        
        let statusText = item.status === 'suitable' ? '<span class="text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px] tracking-wide uppercase">💚 Подходит</span>' : 
                         item.status === 'checking' ? '<span class="text-amber-400 font-bold font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-[11px] tracking-wide uppercase">💛 Анализ</span>' : 
                                                      '<span class="text-rose-400 font-bold font-mono bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/30 text-[11px] tracking-wide uppercase">❌ Отклонен</span>';

        container.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-slate-800 pb-3 gap-3 pr-6">
                <div>
                    <h3 class="text-base font-bold text-white font-mono tracking-wide">${item.name}</h3>
                    <p class="text-[11px] text-slate-400 mt-1">📍 Ориентир: <span class="text-slate-300">${item.location}</span></p>
                </div>
                <div class="shrink-0">${statusText}</div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 mt-3">
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Водородный pH</span> 
                    <strong class="text-xs font-mono text-amber-400 block">pH ${item.ph}</strong>
                </div>
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Минерализация</span> 
                    <strong class="text-xs font-mono text-white block">${item.mineralization} <span class="text-[9px] text-slate-400 font-normal">мг/л</span></strong>
                </div>
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Проводимость</span> 
                    <strong class="text-xs font-mono text-white block">${item.conductivity} <span class="text-[9px] text-slate-400 font-normal">мкСм</span></strong>
                </div>
                <div class="space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                    <span class="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Жёсткость</span> 
                    <strong class="text-xs font-mono text-white block">${item.hardness} <span class="text-[9px] text-slate-400 font-normal">мг-экв</span></strong>
                </div>
            </div>
            
            <div class="text-[11px] space-y-1 text-slate-300 pt-3 font-mono">
                <p><span class="text-slate-500">🌡️ Температура:</span> <span class="text-white font-medium">${item.temp} °C</span></p>
                <p><span class="text-slate-500">🔬 Примеси/Осадок:</span> <span class="text-white font-medium">${item.impurities}</span></p>
                <p><span class="text-slate-500">👤 Лаборант:</span> <span class="text-amber-400 font-medium">${item.author}</span></p>
            </div>
        `;
        
        wrapper.classList.remove("translate-y-full");
        
        const isMobile = window.innerWidth < 768;
        const targetLat = isMobile ? item.lat - 0.003 : item.lat; 
        if (myMap) myMap.setCenter([targetLat, item.lng], 14, { duration: 300 });
    }
}

function closeDetailsCard() {
    const wrapper = document.getElementById("detailsWrapper");
    if (wrapper) wrapper.classList.add("translate-y-full");
    currentSelectedId = null;
}

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
            alert("Исследование успешно оплачено и оформлено!");
            closeAddPointModal();
            event.target.reset();
            await loadPointsFromServer();
        } else {
            alert("Ошибка сохранения заказа.");
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка соединения с сервером.");
    }
}

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
        console.error(err);
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
            errorDiv.innerText = data.message || "Неверные данные";
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
        if (response.ok) {
            alert("Регистрация успешна!");
            toggleToLogin();
        } else {
            errorDiv.innerText = "Ошибка регистрации";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error(err);
    }
}

function handleAuthSuccess(data) {
    currentUserProfile = data.profile;
    
    document.getElementById("authSection").innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">👤 ${currentUserProfile["ФИО"]}</span>
            <button onclick="logout()" class="text-[11px] text-red-500 hover:underline cursor-pointer">Выйти</button>
        </div>
    `;

    if (data.role === 'moderator') {
        const btn = document.getElementById("adminPanelBtn");
        if (btn) {
            btn.removeAttribute("disabled");
            btn.classList.remove("opacity-0", "pointer-events-none");
            btn.classList.add("bg-white", "dark:bg-slate-950", "text-slate-900", "dark:text-white", "cursor-pointer");
        }
    }
    renderApp();
}

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
    
    // Безопасная фильтрация: ищем элементы на анализе
    const checkingPoints = loadedSources.filter(item => item && item.status === "checking");

    if (checkingPoints.length === 0) {
        queueContainer.innerHTML = `
            <div class="text-center py-8 text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                📥 Очередь пуста. Нет источников на проверку.
            </div>
        `;
        return;
    }

    queueContainer.innerHTML = checkingPoints.map(item => `
        <div class="p-3.5 border border-slate-800 rounded-xl bg-slate-900/60 flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
            <div class="truncate max-w-full sm:max-w-[70%]">
                <h4 class="font-bold text-white font-mono text-sm truncate">${item.name || 'Без названия'}</h4>
                <p class="text-slate-400 text-[11px] mt-0.5 truncate">📍 Ориентир: ${item.location || 'Не указан'}</p>
                <p class="text-slate-500 text-[10px] mt-1 font-mono">Тип: ${item.type || 'Родник'} | pH: ${item.ph || 7} | Создал: ${item.author || 'Лаборант'}</p>
            </div>
            <div class="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button onclick="moderatePointInCabinet(${item.id}, 'suitable')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all active:scale-95">
                    Одобрить
                </button>
                <button onclick="moderatePointInCabinet(${item.id}, 'unsuitable')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all active:scale-95">
                    Отклонить
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
            // Перезагружаем данные с сервера и обновляем списки
            await loadPointsFromServer();
            renderModerationQueue();
        } else {
            alert("Не удалось изменить статус точки на бэкенде.");
        }
    } catch (err) { 
        console.error("Ошибка модерации:", err); 
        alert("Ошибка соединения с сервером.");
    }
}

function logout() { localStorage.removeItem("token"); window.location.reload(); }

function openAddPointModal() { const m = document.getElementById("addPointModal"); if(m) m.classList.remove("hidden"); }
function closeAddPointModal() { const m = document.getElementById("addPointModal"); if(m) m.classList.add("hidden"); }
function openAuthModal() { const m = document.getElementById("authModal"); if(m) m.classList.remove("hidden"); }
function closeAuthModal() { const m = document.getElementById("authModal"); if(m) m.classList.add("hidden"); }
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
