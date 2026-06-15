const BACKEND_URL = "https://1-1-5hl5.onrender.com";

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = [];
let currentUserProfile = null;

// Инициализация
ymaps.ready(initYandexMap);

async function initYandexMap() {
    myMap = new ymaps.Map("map", {
        center: [43.2389, 76.8897],
        zoom: 11,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    geoObjectsCollection = new ymaps.GeoObjectCollection();
    myMap.geoObjects.add(geoObjectsCollection);

    // Вешаем события фильтрации и поиска
    document.getElementById("searchQuery").addEventListener("input", renderApp);
    document.getElementById("filterStatus").addEventListener("change", renderApp);
    document.getElementById("filterType").addEventListener("change", renderApp);

    // Проверяем авторизацию и загружаем точки
    await checkBackendSession();
    await loadPointsFromServer();
}

// Загрузка точек с авто-синхронизацией
async function loadPointsFromServer() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();
        
        // Если сервер перезапустился и пуст, отправляем данные из data.js
        if (loadedSources.length === 0 && typeof initialSources !== 'undefined') {
            await fetch(`${BACKEND_URL}/api/sources/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialSources)
            });
            const retryResponse = await fetch(`${BACKEND_URL}/api/sources`);
            loadedSources = await retryResponse.json();
        }
        
        renderApp();
    } catch (err) {
        console.error("Ошибка при загрузке точек:", err);
    }
}

// Рендеринг приложения
function renderApp() {
    if (!loadedSources) return;
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;

    const filtered = loadedSources.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(query) || 
                              (item.location && item.location.toLowerCase().includes(query));
        const matchesStatus = filterStatus === "all" || item.status === filterStatus;
        const matchesType = filterType === "all" || item.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });

    renderList(filtered);
    renderMapMarkers(filtered);
}

// Отображение списка слева
function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (!listContainer) return;
    
    if (items.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Источники не найдены</p>';
        return;
    }

    listContainer.innerHTML = items.map(item => {
        let statusBadge = item.status === 'suitable' ? '💚' : item.status === 'checking' ? '💛' : '❌';
        return `
            <div onclick="selectSource(${item.id})" class="p-2 border rounded-lg cursor-pointer hover:bg-gray-100 text-xs transition flex justify-between items-center ${currentSelectedId === item.id ? 'bg-blue-50 border-blue-300' : ''}">
                <div>
                    <h4 class="font-bold text-gray-700">${item.name}</h4>
                    <p class="text-gray-500 text-[11px]">${item.type} • ${item.district || 'Алматы'}</p>
                </div>
                <span class="text-sm">${statusBadge}</span>
            </div>
        `;
    }).join('');
}

// Отображение маркеров на карте
function renderMapMarkers(items) {
    if (!geoObjectsCollection) return;
    geoObjectsCollection.removeAll();
    
    items.forEach(item => {
        // Задаем цвет в зависимости от статуса
        let presetColor = 'islands#yellowWaterIcon';
        if (item.status === 'suitable') presetColor = 'islands#greenWaterIcon';
        if (item.status === 'unsuitable') presetColor = 'islands#redWaterIcon';

        const p = new ymaps.Placemark([item.lat, item.lng], {
            balloonContentHeader: item.name,
            balloonContentBody: `${item.type}<br><small>${item.location}</small>`
        }, {
            preset: presetColor
        });
        
        p.events.add('click', () => selectSource(item.id));
        geoObjectsCollection.add(p);
    });
}

// Выбор конкретного источника (Карточка деталей)
function selectSource(id) {
    currentSelectedId = id;
    renderApp(); // Обновляем подсветку в списке
    
    const item = loadedSources.find(p => p.id === id);
    if (!item) return;

    const detailsCard = document.getElementById("detailsCard");
    const placeholder = document.getElementById("noSelectPlaceholder");
    
    if (placeholder) placeholder.classList.add("hidden");
    if (detailsCard) {
        detailsCard.classList.remove("hidden");
        
        let statusText = item.status === 'suitable' ? '<span class="text-emerald-600 font-bold">💚 Подходит для электролиза</span>' : 
                         item.status === 'checking' ? '<span class="text-amber-500 font-bold">💛 На проверке в лаборатории</span>' : 
                                                      '<span class="text-red-500 font-bold">❌ Не подходит</span>';

        detailsCard.innerHTML = `
            <div class="flex justify-between items-start border-b pb-3 mb-3">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${item.name}</h3>
                    <p class="text-xs text-gray-500">${item.type} — ${item.location}</p>
                </div>
                <div class="text-right">${statusText}</div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-gray-50 p-3 rounded-lg mb-4">
                <div><span class="text-gray-400">Водородный показатель:</span> <strong class="block text-sm text-gray-700">pH ${item.ph}</strong></div>
                <div><span class="text-gray-400">Минерализация:</span> <strong class="block text-sm text-gray-700">${item.mineralization} мг/л</strong></div>
                <div><span class="text-gray-400">Проводимость:</span> <strong class="block text-sm text-gray-700">${item.conductivity} мкСм/см</strong></div>
                <div><span class="text-gray-400">Жёсткость:</span> <strong class="block text-sm text-gray-700">${item.hardness} мг-экв/л</strong></div>
            </div>
            <div class="text-xs space-y-1 text-gray-600 mb-3">
                <p>🌡️ <strong>Температура воды:</strong> ${item.temp} °C</p>
                <p>🔬 <strong>Примеси / Осадок:</strong> ${item.impurities}</p>
                <p>👤 <strong>Исследователь:</strong> ${item.author} (<span class="text-[11px]">${item.date || 'Дата не указана'}</span>)</p>
            </div>
            ${currentUserProfile && currentUserProfile["Доступ"].includes("Администратор") && item.status === 'checking' ? `
                <div class="flex gap-2 pt-2 border-t mt-3">
                    <button onclick="moderatePoint(${item.id}, 'suitable')" class="bg-emerald-600 text-white px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer hover:bg-emerald-700">Одобрить источник</button>
                    <button onclick="moderatePoint(${item.id}, 'unsuitable')" class="bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer hover:bg-red-700">Отклонить</button>
                </div>
            ` : ''}
        `;
        
        myMap.setCenter([item.lat, item.lng], 14, { duration: 300 });
    }
}

// Создание новой точки на карте
async function handleCreatePoint(event) {
    event.preventDefault();
    const authorName = currentUserProfile ? currentUserProfile["ФИО"] : "Студент-Лаборант";

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: "Алматы",
        location: document.getElementById("addLocation").value,
        lat: parseFloat(document.getElementById("addLat").value),
        lng: parseFloat(document.getElementById("addLng").value),
        ph: parseFloat(document.getElementById("addPh").value),
        mineralization: parseInt(document.getElementById("addMin").value),
        conductivity: parseInt(document.getElementById("addCond").value),
        hardness: parseFloat(document.getElementById("addHard").value),
        temp: parseInt(document.getElementById("addTemp").value),
        impurities: document.getElementById("addImpurities").value || "Отсутствуют",
        author: authorName
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert("Заявка на добавление источника успешно создана и отправлена модератору!");
            closeAddPointModal();
            await loadPointsFromServer();
        } else {
            alert("Ошибка сохранения.");
        }
    } catch (err) {
        console.error("Ошибка отправки:", err);
    }
}

// --- СИСТЕМА АВТОРИЗАЦИИ И СЕССИЙ ---

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

async function handleBackendLogin(event) {
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
            errorDiv.innerText = data.message || "Ошибка входа";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Ошибка авторизации:", err);
    }
}

async function handleBackendRegister(event) {
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
            alert("Регистрация успешна! Теперь вы можете войти.");
            toggleToLogin();
        } else {
            errorDiv.innerText = data.message || "Ошибка регистрации";
            errorDiv.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Ошибка регистрации:", err);
    }
}

function handleAuthSuccess(data) {
    currentUserProfile = data.profile;
    
    // Обновляем верхнюю панель
    document.getElementById("authSection").innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-xs bg-blue-900/50 px-2 py-1 rounded border border-cyan-400/30">👤 ${currentUserProfile["ФИО"]}</span>
            <button onclick="logout()" class="text-xs text-red-200 underline cursor-pointer hover:text-white">Выйти</button>
        </div>
    `;

    // Показываем электронный паспорт исследователя
    const dashboard = document.getElementById("profileDashboard");
    const grid = document.getElementById("profileDetailsGrid");
    dashboard.classList.remove("hidden");
    
    grid.innerHTML = Object.entries(currentUserProfile).map(([key, value]) => `
        <div class="bg-white p-2 rounded border border-blue-100">
            <span class="text-gray-400 block text-[10px] uppercase font-semibold">${key}</span>
            <span class="font-medium text-gray-800">${value}</span>
        </div>
    `).join('');

    // Активируем кнопку кабинета модератора, если роль позволяет
    if (data.role === 'moderator') {
        const btn = document.getElementById("adminPanelBtn");
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-40", "cursor-not-allowed");
        btn.classList.add("bg-indigo-600", "text-white", "hover:bg-indigo-700");
    }
    renderApp();
}

// Функция модерации (для админов)
async function moderatePoint(id, status) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sources/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        if (response.ok) {
            alert("Статус точки успешно обновлен!");
            await loadPointsFromServer();
        }
    } catch (err) {
        console.error(err);
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.reload();
}

// --- УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ ---
function openAuthModal() { document.getElementById("authModal").classList.remove("hidden"); }
function closeAuthModal() { document.getElementById("authModal").classList.add("hidden"); }
function openAddPointModal() { document.getElementById("addPointModal").classList.remove("hidden"); }
function closeAddPointModal() { document.getElementById("addPointModal").classList.add("hidden"); }
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
