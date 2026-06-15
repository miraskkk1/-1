const BACKEND_URL = "https://1-1-5hl5.onrender.com"; 

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = []; 
let currentUserProfile = null; // Храним профиль вошедшего юзера

ymaps.ready(initYandexMap);

async function initYandexMap() {
    myMap = new ymaps.Map("map", { center: [43.2389, 76.8897], zoom: 11, controls: ['zoomControl', 'typeSelector', 'fullscreenControl'] });
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
        const response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();
        renderApp();
        renderModerationQueue(); // Обновляем очередь в кабинете модератора
    } catch (err) { console.error(err); }
}

// ==========================================
// ОКНА И УПРАВЛЕНИЕ МОДАЛКАМИ
// ==========================================
function openAuthModal() { document.getElementById("authModal").classList.remove("hidden"); switchAuthTab('login'); }
function closeAuthModal() { document.getElementById("authModal").classList.add("hidden"); }
function openAddPointModal() { document.getElementById("addPointModal").classList.remove("hidden"); }
function closeAddPointModal() { document.getElementById("addPointModal").classList.add("hidden"); }
function openAdminModal() { document.getElementById("adminModal").classList.remove("hidden"); renderModerationQueue(); }
function closeAdminModal() { document.getElementById("adminModal").classList.add("hidden"); }

function switchAuthTab(tab) {
    const loginForm = document.getElementById("loginForm"), registerForm = document.getElementById("registerForm");
    const tabLoginBtn = document.getElementById("tabLoginBtn"), tabRegisterBtn = document.getElementById("tabRegisterBtn");
    if (tab === 'login') {
        loginForm.classList.remove("hidden"); registerForm.classList.add("hidden");
        tabLoginBtn.className = "w-1/2 pb-2 text-blue-600 border-b-2 border-blue-600 text-center";
        tabRegisterBtn.className = "w-1/2 pb-2 text-gray-400 text-center";
    } else {
        loginForm.classList.add("hidden"); registerForm.classList.remove("hidden");
        tabLoginBtn.className = "w-1/2 pb-2 text-gray-400 text-center";
        tabRegisterBtn.className = "w-1/2 pb-2 text-emerald-600 border-b-2 border-emerald-600 text-center";
    }
}

// ==========================================
// ЛОГИКА ДЛЯ СТУДЕНТОВ И МОДЕРАТОРОВ (ЗАПРОСЫ)
// ==========================================

// 1. Создание новой точки воды студентом
async function handleCreatePoint(event) {
    event.preventDefault();
    const authorName = currentUserProfile ? currentUserProfile["ФИО"] : "Студент-Исследователь";

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: document.getElementById("addDistrict").value,
        location: document.getElementById("addLocation").value,
        lat: document.getElementById("addLat").value,
        lng: document.getElementById("addLng").value,
        ph: document.getElementById("addPh").value,
        mineralization: document.getElementById("addMin").value,
        conductivity: document.getElementById("addCond").value,
        hardness: document.getElementById("addHard").value,
        temp: document.getElementById("addTemp").value,
        impurities: document.getElementById("addImpurities").value || "Отсутствуют",
        author: authorName
    };

    const response = await fetch(`${BACKEND_URL}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (response.ok) {
        alert("Точка успешно отправлена на модерацию!");
        closeAddPointModal();
        await loadPointsFromServer();
    }
}

// 2. Вынесение вердикта модератором (Одобрить / Отклонить)
async function moderatePoint(id, status) {
    const response = await fetch(`${BACKEND_URL}/api/sources/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
    });

    if (response.ok) {
        await loadPointsFromServer();
    }
}

// 3. Назначение нового модератора администратором
async function handleAssignModerator(event) {
    event.preventDefault();
    const username = document.getElementById("modTargetUsername").value.trim();
    const messageBlock = document.getElementById("modAssignMessage");

    const response = await fetch(`${BACKEND_URL}/api/auth/make-moderator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });

    const data = await response.json();
    messageBlock.classList.remove("hidden");
    if (response.ok) {
        messageBlock.innerText = data.message;
        messageBlock.className = "text-[11px] mt-1 text-emerald-600 font-semibold block";
        document.getElementById("modTargetUsername").value = "";
    } else {
        messageBlock.innerText = data.message;
        messageBlock.className = "text-[11px] mt-1 text-red-600 font-semibold block";
    }
}

// Рендеринг очереди заявок на проверку в модалке модератора
function renderModerationQueue() {
    const queueContainer = document.getElementById("moderationQueueList");
    const pendingPoints = loadedSources.filter(p => p.status === 'checking');

    if (pendingPoints.length === 0) {
        queueContainer.innerHTML = `<p class="text-gray-400 text-center py-4">Нет новых заявок для проверки.</p>`;
        return;
    }

    queueContainer.innerHTML = pendingPoints.map(p => `
        <div class="bg-white p-3 border rounded-lg shadow-2xs flex justify-between items-start gap-4">
            <div>
                <h5 class="font-bold text-gray-800">${p.name} <span class="text-blue-500">(${p.type})</span></h5>
                <p class="text-gray-500 text-[11px] mt-0.5">📍 Локация: ${p.location}</p>
                <p class="text-gray-400 text-[10px] mt-1">Автор замера: <b>${p.author}</b> • Параметры: pH ${p.ph}, ${p.mineralization} мг/л</p>
            </div>
            <div class="flex gap-1 shrink-0">
                <button onclick="moderatePoint(${p.id}, 'suitable')" class="bg-emerald-500 text-white font-bold p-1 px-2 rounded-md hover:bg-emerald-600 cursor-pointer">✓ Одобрить</button>
                <button onclick="moderatePoint(${p.id}, 'unsuitable')" class="bg-rose-500 text-white font-bold p-1 px-2 rounded-md hover:bg-rose-600 cursor-pointer">✕ Отклонить</button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// АВТОРИЗАЦИЯ С СЕРВЕРА через fetch (JWT)
// ==========================================
async function handleBackendRegister(event) {
    event.preventDefault();
    const msgBlock = document.getElementById("authMessage");
    const payload = {
        username: document.getElementById("regUsername").value, password: document.getElementById("regPassword").value,
        fio: document.getElementById("regFio").value, age: document.getElementById("regAge").value,
        university: document.getElementById("regUniversity").value, specialty: document.getElementById("regSpecialty").value,
        course: document.getElementById("regCourse").value
    };

    const response = await fetch(`${BACKEND_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (response.ok) {
        msgBlock.innerText = "Регистрация успешна! Войдите.";
        msgBlock.className = "text-xs font-medium p-2.5 rounded-md mb-3 bg-emerald-50 text-emerald-700 block";
        setTimeout(() => { switchAuthTab('login'); }, 1200);
    } else {
        msgBlock.innerText = "Ошибка регистрации или логин занят";
        msgBlock.className = "text-xs font-medium p-2.5 rounded-md mb-3 bg-red-50 text-red-700 block";
    }
}

async function handleBackendLogin(event) {
    event.preventDefault();
    const msgBlock = document.getElementById("authMessage");
    const username = document.getElementById("loginUsername").value, password = document.getElementById("loginPassword").value;

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await response.json();

    if (data.success) {
        localStorage.setItem("jwtToken", data.token);
        closeAuthModal();
        updateUIForAuth(data.role, data.profile);
    } else {
        msgBlock.innerText = data.message || "Ошибка входа";
        msgBlock.className = "text-xs font-medium p-2.5 rounded-md mb-3 bg-red-50 text-red-700 block";
    }
}

async function checkBackendSession() {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    const data = await response.json();
    if (data.success) updateUIForAuth(data.role, data.profile);
}

function updateUIForAuth(role, profile) {
    currentUserProfile = profile; 
    document.getElementById("authSection").innerHTML = `<button onclick="handleLogout()" class="bg-red-600 text-white px-4 py-1.5 rounded-full font-medium text-sm shadow-sm cursor-pointer">Выйти</button>`;
    
    const adminBtn = document.getElementById("adminPanelBtn");
    if (role === 'moderator') {
        adminBtn.classList.remove("text-gray-400", "opacity-45", "cursor-not-allowed");
        adminBtn.classList.add("text-white", "hover:bg-blue-800", "cursor-pointer");
        adminBtn.removeAttribute("disabled");
        adminBtn.innerText = "⚙️ Кабинет модератора";
    }
    document.getElementById("profileDashboard").classList.remove("hidden");
    document.getElementById("profileDetailsGrid").innerHTML = Object.entries(profile).map(([key, value]) => `
        <div class="bg-white p-2 rounded-md border border-blue-100 shadow-2xs">
            <span class="font-semibold text-gray-500 uppercase text-[10px] block">${key}</span>
            <span class="text-gray-800 font-medium text-xs">${value}</span>
        </div>
    `).join('');
}

function handleLogout() { localStorage.removeItem("jwtToken"); location.reload(); }

// ==========================================
// ФИЛЬТРАЦИЯ И ОТРЕСОВКА РЕЗУЛЬТАТОВ
// ==========================================
function renderApp() {
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;

    const filtered = loadedSources.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(query) || item.district.toLowerCase().includes(query) || item.location.toLowerCase().includes(query);
        const matchesStatus = filterStatus === "all" || item.status === filterStatus;
        const matchesType = filterType === "all" || item.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });

    renderList(filtered);
    renderMapMarkers(filtered);
}

function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (items.length === 0) { listContainer.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Источники не найдены</p>`; return; }
    listContainer.innerHTML = items.map(item => {
        let statusColor = "bg-gray-400";
        if (item.status === "suitable") statusColor = "bg-emerald-500";
        if (item.status === "checking") statusColor = "bg-amber-500";
        if (item.status === "unsuitable") statusColor = "bg-rose-500";
        const isSelected = item.id === currentSelectedId ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:bg-gray-50';
        return `
            <div onclick="selectSource(${item.id})" class="p-3 border rounded-lg cursor-pointer transition flex justify-between items-start gap-2 ${isSelected}">
                <div class="space-y-1">
                    <h4 class="text-xs font-bold text-gray-800">${item.name}</h4>
                    <p class="text-[11px] text-gray-500">${item.district} • ${item.type}</p>
                </div>
                <span class="w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${statusColor}"></span>
            </div>
        `;
    }).join('');
}

function renderMapMarkers(items) {
    if (!myMap || !geoObjectsCollection) return;
    geoObjectsCollection.removeAll();
    items.forEach(item => {
        let presetColor = "islands#grayIcon";
        if (item.status === "suitable") presetColor = "islands#emeraldWaterIcon";
        if (item.status === "checking") presetColor = "islands#amberWaterIcon";
        if (item.status === "unsuitable") presetColor = "islands#roseWaterIcon";

        const placemark = new ymaps.Placemark([item.lat, item.lng], {
            balloonContentHeader: item.name,
            balloonContentBody: `<strong>Тип:</strong> ${item.type}<br><strong>Адрес:</strong> ${item.location}`,
            hintContent: item.name
        }, { preset: presetColor });

        placemark.events.add('click', () => { selectSource(item.id); });
        geoObjectsCollection.add(placemark);
    });
}

function selectSource(id) {
    currentSelectedId = id;
    const item = loadedSources.find(s => s.id === id);
    if (!item) return;

    myMap.setCenter([item.lat, item.lng], 14, { duration: 300 });
    const detailsCard = document.getElementById("detailsCard");
    document.getElementById("noSelectPlaceholder").classList.add("hidden");
    detailsCard.classList.remove("hidden");

    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">📋 Проверяется</span>`;
    let borderClass = "border-l-amber-500";
    if (item.status === "suitable") { statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">💚 Подходит для Юткина</span>`; borderClass = "border-l-emerald-500"; }
    else if (item.status === "unsuitable") { statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">❌ Не подходит</span>`; borderClass = "border-l-rose-500"; }

    detailsCard.className = `bg-white p-5 rounded-xl shadow-sm border-l-4 ${borderClass} border border-gray-100 transition`;
    detailsCard.innerHTML = `
        <div class="flex justify-between items-start gap-4 flex-wrap border-b pb-3 mb-4">
            <div>
                <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">${item.type} (ID: ${item.id})</span>
                <h3 class="text-base font-bold text-gray-800">${item.name}</h3>
                <p class="text-xs text-gray-500 mt-0.5">📍 ${item.location} (${item.district})</p>
            </div>
            <div>${statusBadge}</div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[10px]">Водородный показатель</span><span class="font-bold text-gray-700">pH ${item.ph}</span></div>
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[10px]">Минерализация</span><span class="font-bold text-gray-700">${item.mineralization} мг/л</span></div>
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[10px]">Электропроводность</span><span class="font-bold text-gray-700">${item.conductivity} мкСм/см</span></div>
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[10px]">Жёсткость</span><span class="font-bold text-gray-700">${item.hardness} мг-экв/л</span></div>
        </div>
        <div class="text-xs space-y-1.5 border-t pt-3 text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><strong>Температура:</strong> ${item.temp} °C</div>
            <div><strong>Примеси:</strong> ${item.impurities}</div>
            <div><strong>Исследователь:</strong> ${item.author}</div>
            <div><strong>Дата замера:</strong> ${item.date}</div>
        </div>
    `;
}
