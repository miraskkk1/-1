// НАСТРОЙКА: Ссылка на бэкенд, развернутый на Render
const BACKEND_URL = "https://1-1-5hl5.onrender.com"; 

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;

// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ ЯНДЕКС КАРТЫ
// ==========================================
ymaps.ready(initYandexMap);

function initYandexMap() {
    myMap = new ymaps.Map("map", {
        center: [43.2389, 76.8897], // Алматы
        zoom: 11,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    geoObjectsCollection = new ymaps.GeoObjectCollection();
    myMap.geoObjects.add(geoObjectsCollection);

    // Вешаем слушатели на элементы фильтрации
    document.getElementById("searchQuery").addEventListener("input", renderApp);
    document.getElementById("filterStatus").addEventListener("change", renderApp);
    document.getElementById("filterType").addEventListener("change", renderApp);

    checkBackendSession();
    renderApp();
}

// ==========================================
// 2. АВТОРИЗАЦИЯ С СЕРВЕРА через fetch (JWT)
// ==========================================

function openAuthModal() {
    document.getElementById("authModal").classList.remove("hidden");
}

function closeAuthModal() {
    document.getElementById("authModal").classList.add("hidden");
    document.getElementById("loginError").classList.add("hidden");
}

async function handleBackendLogin(event) {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const errorBlock = document.getElementById("loginError");

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem("jwtToken", data.token);
            closeAuthModal();
            updateUIForAuth(data.role, data.profile);
        } else {
            errorBlock.innerText = data.message || "Ошибка входа";
            errorBlock.classList.remove("hidden");
        }
    } catch (err) {
        errorBlock.innerText = "Сервер недоступен";
        errorBlock.classList.remove("hidden");
    }
}

async function checkBackendSession() {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            updateUIForAuth(data.role, data.profile);
        } else {
            localStorage.removeItem("jwtToken");
        }
    } catch (err) {
        console.error("Ошибка проверки сессии:", err);
    }
}

function updateUIForAuth(role, profile) {
    // Меняем кнопку Войти на Выйти
    const authSection = document.getElementById("authSection");
    authSection.innerHTML = `
        <button onclick="handleLogout()" class="bg-red-600 text-white px-4 py-1.5 rounded-full font-medium hover:bg-red-700 text-sm shadow-sm transition">
            Выйти
        </button>
    `;

    // Активируем кабинет модератора, если зашел админ
    const adminBtn = document.getElementById("adminPanelBtn");
    if (role === 'moderator') {
        adminBtn.classList.remove("text-gray-400", "opacity-40", "cursor-not-allowed");
        adminBtn.classList.add("text-white", "hover:bg-blue-900");
        adminBtn.innerText = "⚙️ Панель модератора (Активна)";
    }

    // Заполняем дашборд профиля
    const profileDashboard = document.getElementById("profileDashboard");
    const grid = document.getElementById("profileDetailsGrid");
    profileDashboard.classList.remove("hidden");

    grid.innerHTML = Object.entries(profile).map(([key, value]) => `
        <div class="bg-white p-2 rounded-md border border-blue-100 shadow-2xs">
            <span class="font-semibold text-gray-500 uppercase text-[10px] block">${key}</span>
            <span class="text-gray-800 font-medium">${value}</span>
        </div>
    `).join('');
}

function handleLogout() {
    localStorage.removeItem("jwtToken");
    location.reload();
}

// ==========================================
// 3. ОТРИСОВКА ТОЧЕК, ПОИСК И ФИЛЬТРАЦИЯ
// ==========================================

function renderApp() {
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;

    // Фильтруем массив initialSources (из data.js)
    const filtered = initialSources.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(query) || 
                              item.district.toLowerCase().includes(query) ||
                              item.location.toLowerCase().includes(query);
        const matchesStatus = filterStatus === "all" || item.status === filterStatus;
        const matchesType = filterType === "all" || item.type === filterType;

        return matchesSearch && matchesStatus && matchesType;
    });

    renderList(filtered);
    renderMapMarkers(filtered);
}

function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (items.length === 0) {
        listContainer.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Источники не найдены</p>`;
        return;
    }

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
    
    // Обновляем активный класс в списке
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;
    const filtered = initialSources.filter(item => {
        return (item.name.toLowerCase().includes(query) || item.district.toLowerCase().includes(query)) &&
               (filterStatus === "all" || item.status === filterStatus) &&
               (filterType === "all" || item.type === filterType);
    });
    renderList(filtered);

    const item = initialSources.find(s => s.id === id);
    if (!item) return;

    // Центрируем карту на выбранном источнике
    myMap.setCenter([item.lat, item.lng], 14, { duration: 300 });

    // Отрисовываем паспорт физико-химических данных
    const detailsCard = document.getElementById("detailsCard");
    const placeholder = document.getElementById("noSelectPlaceholder");

    placeholder.classList.add("hidden");
    detailsCard.classList.remove("hidden");

    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">📋 Проверяется</span>`;
    let borderClass = "border-l-amber-500";
    if (item.status === "suitable") {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">💚 Подходит для Юткина</span>`;
        borderClass = "border-l-emerald-500";
    } else if (item.status === "unsuitable") {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">❌ Не подходит</span>`;
        borderClass = "border-l-rose-500";
    }

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

        <h4 class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Физико-химические показатели:</h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span class="text-gray-400 block text-[10px]">Водородный показатель</span>
                <span class="font-bold text-gray-700">pH ${item.ph}</span>
            </div>
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span class="text-gray-400 block text-[10px]">Минерализация</span>
                <span class="font-bold text-gray-700">${item.mineralization} мг/л</span>
            </div>
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span class="text-gray-400 block text-[10px]">Электропроводность</span>
                <span class="font-bold text-gray-700">${item.conductivity} мкСм/см</span>
            </div>
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span class="text-gray-400 block text-[10px]">Жёсткость</span>
                <span class="font-bold text-gray-700">${item.hardness} мг-экв/л</span>
            </div>
        </div>

        <div class="text-xs space-y-1.5 border-t pt-3 text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><strong>Температура воды:</strong> ${item.temp} °C</div>
            <div><strong>Примеси:</strong> <span class="text-gray-800 font-medium">${item.impurities}</span></div>
            <div><strong>Исследователь:</strong> ${item.author}</div>
            <div><strong>Дата замера:</strong> ${item.date}</div>
        </div>
    `;
}
