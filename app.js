const BACKEND_URL = "https://1-1-5hl5.onrender.com";

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = [];
let currentUserProfile = null;

ymaps.ready(initYandexMap);

async function initYandexMap() {
    // Центрирование карты с адаптивным зумом
    myMap = new ymaps.Map("map", {
        center: [43.2389, 76.8897],
        zoom: 11,
        controls: ['zoomControl', 'typeSelector']
    });

    geoObjectsCollection = new ymaps.GeoObjectCollection();
    myMap.geoObjects.add(geoObjectsCollection);

    document.getElementById("searchQuery").addEventListener("input", renderApp);
    document.getElementById("filterStatus").addEventListener("change", renderApp);
    document.getElementById("filterType").addEventListener("change", renderApp);

    await checkBackendSession();
    await loadPointsFromServer();
}

async function loadPointsFromServer() {
    try {
        let response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();

        if (loadedSources.length === 0 && typeof initialSources !== 'undefined' && initialSources.length > 0) {
            console.log("Синхронизация базовых точек...");
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
        console.error("Ошибка сети при загрузке данных:", err);
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

// Рендеринг элементов списка во флоатинг-сайдбар (скрыт на мобильных, управляется картой)
function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (!listContainer) return;
    
    if (items.length === 0) {
        listContainer.innerHTML = '<div class="p-4 bg-white dark:bg-slate-950 rounded-xl shadow border border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center">Ничего не найдено</div>';
        return;
    }

    listContainer.innerHTML = items.map(item => {
        let statusBadge = item.status === 'suitable' ? '<span class="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/40">Подходит</span>' : 
                          item.status === 'checking' ? '<span class="text-amber-600 dark:text-amber-400 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/40">Анализ</span>' : 
                                                       '<span class="text-rose-600 dark:text-rose-400 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/40">Отклонен</span>';
        
        const isSelected = currentSelectedId === item.id;
        return `
            <div onclick="selectSource(${item.id})" class="p-3 bg-white/95 dark:bg-slate-950/95 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80 text-xs transition-all flex justify-between items-center gap-3 shadow-sm pointer-events-auto ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 dark:border-slate-800/80'}" style="backdrop-blur: 4px;">
                <div class="truncate">
                    <h4 class="font-semibold text-slate-900 dark:text-white truncate">${item.name}</h4>
                    <p class="text-slate-400 text-[10px] mt-0.5">${item.type} • ${item.district || 'Алматы'}</p>
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

// Открытие карточки в стиле аккуратного 2ГИС-компонента
function selectSource(id) {
    currentSelectedId = id;
    
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;
    const filtered = loadedSources.filter(item => {
        const matchesSearch = (item.name && item.name.toLowerCase().includes(query)) || (item.location && item.location.toLowerCase().includes(query));
        return matchesSearch && (filterStatus === "all" || item.status === filterStatus) && (filterType === "all" || item.type === filterType);
    });
    renderList(filtered);
    
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const wrapper = document.getElementById("detailsWrapper");
    const container = document.getElementById("detailsCard");
    
    if (container && wrapper) {
        let statusText = item.status === 'suitable' ? '<span class="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">💚 Подходит</span>' : 
                         item.status === 'checking' ? '<span class="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 text-[10px]">💛 Анализ</span>' : 
                                                      '<span class="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 text-[10px]">❌ Отклонен</span>';

        // Адаптивная структура: на мобильных — ультра-компактно, на ПК — развернуто
        container.innerHTML = `
            <div class="pr-6 flex items-start justify-between gap-2">
                <div>
                    <span class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">${item.type}</span>
                    <h3 class="text-sm md:text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">${item.name}</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5 truncate max-w-[280px] md:max-w-none">📍 ${item.location}</p>
                </div>
                <div class="shrink-0 mt-1">${statusText}</div>
            </div>

            <div class="mt-2.5 flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar text-[11px] bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                <span class="bg-white dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200/50 shrink-0">🧬 <strong>pH:</strong> ${item.ph}</span>
                <span class="bg-white dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200/50 shrink-0">💎 <strong>Мин:</strong> ${item.mineralization} мг/л</span>
                <span class="bg-white dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200/50 shrink-0">⚡ <strong>Жестк:</strong> ${item.hardness}</span>
                <span class="bg-white dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200/50 shrink-0">🌡️ <strong>t:</strong> ${item.temp}°C</span>
            </div>

            <div class="text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-2.5 flex justify-between items-center">
                <p class="truncate max-w-[180px]">🔬 Примеси: <span class="text-slate-800 dark:text-slate-200 font-medium">${item.impurities}</span></p>
                <p class="text-right text-[9px] text-slate-400">Лаборант: ${item.author}</p>
            </div>
        `;
        
        wrapper.classList.remove("translate-y-full");
        
        // Умный фокус: на мобилках смещаем карту чуть сильнее вниз (`item.lat - 0.004`), чтобы маркер вставал ровно в свободную верхнюю часть экрана
        const isMobile = window.innerWidth < 768;
        const targetLat = isMobile ? item.lat - 0.004 : item.lat; 
        
        myMap.setCenter([targetLat, item.lng], 14, { duration: 300 });
    }
}

function closeDetailsCard() {
    const wrapper = document.getElementById("detailsWrapper");
    if (wrapper) wrapper.classList.add("translate-y-full");
    currentSelectedId = null;
    renderApp();
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

// --- УПРАВЛЕНИЕ СЕССИЯМИ ---

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

function openModeratorModal() { document.getElementById("moderatorModal").classList.remove("hidden"); renderModerationQueue(); }
function closeModeratorModal() { document.getElementById("moderatorModal").classList.add("hidden"); }

function renderModerationQueue() {
    const queueContainer = document.getElementById("moderationQueueList");
    if (!queueContainer) return;
    const checkingPoints = loadedSources.filter(item => item.status === "checking");

    if (checkingPoints.length === 0) {
        queueContainer.innerHTML = '<div class="text-center py-6 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Очередь пуста</div>';
        return;
    }

    queueContainer.innerHTML = checkingPoints.map(item => `
        <div class="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row justify-between gap-2 items-start sm:items-center">
            <div>
                <h4 class="font-bold text-slate-900 dark:text-white">${item.name}</h4>
                <p class="text-slate-400 text-[11px]">📍 ${item.location}</p>
            </div>
            <div class="flex gap-1.5 self-end sm:self-auto">
                <button onclick="moderatePointInCabinet(${item.id}, 'suitable')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-semibold text-[11px] cursor-pointer">Одобрить</button>
                <button onclick="moderatePointInCabinet(${item.id}, 'unsuitable')" class="bg-red-600 text-white px-2.5 py-1 rounded-lg font-semibold text-[11px] cursor-pointer">Отклонить</button>
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
            await loadPointsFromServer();
            renderModerationQueue();
        }
    } catch (err) { console.error(err); }
}

async function handleAssignModerator() {
    const usernameInput = document.getElementById("assignUsername");
    const username = usernameInput.value.trim();
    const token = localStorage.getItem("token");
    if (!username) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/assign-moderator`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username })
        });
        if (response.ok) { alert("Успешно повышен!"); usernameInput.value = ""; }
    } catch (err) { console.error(err); }
}

function logout() { localStorage.removeItem("token"); window.location.reload(); }
function openAddPointModal() { document.getElementById("addPointModal").classList.remove("hidden"); }
function closeAddPointModal() { document.getElementById("addPointModal").classList.add("hidden"); }
// [Остальные хелперы окон openAuthModal, closeAuthModal, toggleToRegister, toggleToLogin остаются без изменений]
function openAuthModal() { document.getElementById("authModal").classList.remove("hidden"); }
function closeAuthModal() { document.getElementById("authModal").classList.add("hidden"); }
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
