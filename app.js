// Ссылка на бэкенд, развернутый на Render (без слэша на конце)
const BACKEND_URL = "https://1-1-5hl5.onrender.com"; 

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = []; 
let currentUserProfile = null;

// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ ЯНДЕКС КАРТЫ
// ==========================================
ymaps.ready(initYandexMap);

async function initYandexMap() {
    myMap = new ymaps.Map("map", {
        center: [43.2389, 76.8897], // Алматы
        zoom: 11,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    geoObjectsCollection = new ymaps.GeoObjectCollection();
    myMap.geoObjects.add(geoObjectsCollection);

    document.getElementById("searchQuery").addEventListener("input", renderApp);
    document.getElementById("filterStatus").addEventListener("change", renderApp);
    document.getElementById("filterType").addEventListener("change", renderApp);

    await checkBackendSession();
    await loadPointsFromServer();
}

// ==========================================
// 2. ЗАГРУЗКА И СИНХРОНИЗАЦИЯ ДАННЫХ
// ==========================================
async function loadPointsFromServer() {
    try {
        let response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();
        
        if (loadedSources.length === 0 && typeof initialSources !== 'undefined') {
            console.log("База данных сервера пуста. Синхронизируем начальные точки из data.js...");
            await fetch(`${BACKEND_URL}/api/sources/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialSources)
            });
            response = await fetch(`${BACKEND_URL}/api/sources`);
            loadedSources = await response.json();
        }
        
        renderApp();
        renderModerationQueue();
    } catch (err) {
        console.error("Ошибка при работе с сервером источников:", err);
    }
}

// ==========================================
// 3. АВТОРИЗАЦИЯ, РЕГИСТРАЦИЯ И СЕССИИ
// ==========================================
function openAuthModal() { 
    document.getElementById("authModal").classList.remove("hidden"); 
    toggleToLogin(); 
}
function closeAuthModal() { 
    document.getElementById("authModal").classList.add("hidden"); 
}
function openAddPointModal() { document.getElementById("addPointModal").classList.remove("hidden"); }
function closeAddPointModal() { document.getElementById("addPointModal").classList.add("hidden"); }
function openAdminModal() { document.getElementById("adminModal").classList.remove("hidden"); renderModerationQueue(); }
function closeAdminModal() { document.getElementById("adminModal").classList.add("hidden"); }

// Переключение интерфейса модалки на РЕГИСТРАЦИЮ
function toggleToRegister() {
    document.getElementById("authModalTitle").innerText = "Регистрация в системе";
    document.getElementById("loginFormSubmits").classList.add("hidden");
    document.getElementById("registerFormSubmits").classList.remove("hidden");
    document.getElementById("loginError").classList.add("hidden");
}

// Переключение интерфейса модалки на ВХОД
function toggleToLogin() {
    document.getElementById("authModalTitle").innerText = "Авторизация";
    document.getElementById("loginFormSubmits").classList.remove("hidden");
    document.getElementById("registerFormSubmits").classList.add("hidden");
    document.getElementById("loginError").classList.add("hidden");
}

// Вход в систему
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
        console.error("Ошибка сети при авторизации:", err);
    }
}

// Регистрация нового пользователя
async function handleBackendRegister(event) {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const errorBlock = document.getElementById("loginError");

    if (!username || !password) {
        errorBlock.innerText = "Заполните логин и пароль";
        errorBlock.classList.remove("hidden");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            alert("Регистрация успешна! Теперь вы можете войти.");
            toggleToLogin(); 
        } else {
            errorBlock.innerText = data.message || "Ошибка регистрации";
            errorBlock.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Ошибка сети при регистрации:", err);
    }
}

// Проверка сессии при загрузке страницы
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
    } catch(e) {
        localStorage.removeItem("jwtToken");
    }
}

function updateUIForAuth(role, profile) {
    currentUserProfile = profile;
    
    document.getElementById("authSection").innerHTML = `
        <button onclick="handleLogout()" class="bg-red-600 text-white px-4 py-1.5 rounded-full font-medium text-sm shadow-sm hover:bg-red-700 transition cursor-pointer">
            Выйти
        </button>
    `;
    
    const adminBtn = document.getElementById("adminPanelBtn");
    if (role === 'moderator' && adminBtn) {
        adminBtn.classList.remove("text-gray-400", "opacity-40", "cursor-not-allowed");
        adminBtn.classList.add("text-white", "hover:bg-blue-900", "cursor-pointer");
        adminBtn.removeAttribute("disabled");
        adminBtn.setAttribute("onclick", "openAdminModal()");
    }
    
    const dashboard = document.getElementById("profileDashboard");
    if (dashboard && profile) {
        dashboard.classList.remove("hidden");
        document.getElementById("profileDetailsGrid").innerHTML = Object.entries(profile).map(([key, value]) => `
            <div class="bg-white p-2 rounded-md border border-blue-100">
                <span class="font-semibold text-gray-400 uppercase text-[9px] block">${key}</span>
                <span class="text-gray-800 font-medium">${value}</span>
            </div>
        `).join('');
    }
}

function handleLogout() {
    localStorage.removeItem("jwtToken");
    location.reload();
}

// ==========================================
// 4. ДОБАВЛЕНИЕ И МОДЕРАЦИЯ ТОЧЕК
// ==========================================
async function handleCreatePoint(event) {
    event.preventDefault();
    const authorName = currentUserProfile ? currentUserProfile["ФИО"] : "Студент-Лаборант";

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: document.getElementById("addDistrict").value,
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
            alert("Заявка успешно создана и отправлена модераторам на верификацию!");
            closeAddPointModal();
            await loadPointsFromServer(); 
        }
    } catch (err) {
        console.error("Ошибка добавления точки:", err);
    }
}

async function moderatePoint(id, status) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sources/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        if (response.ok) {
            await loadPointsFromServer();
        }
    } catch (err) {
        console.error("Ошибка модерации:", err);
    }
}

async function handleAssignModerator(event) {
    event.preventDefault();
    const username = document.getElementById("modTargetUsername").value.trim();
    const messageBlock = document.getElementById("modAssignMessage");

    try {
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
    } catch (err) {
        console.error("Ошибка изменения прав:", err);
    }
}

function renderModerationQueue() {
    const queueContainer = document.getElementById("moderationQueueList");
    if (!queueContainer) return;
    
    const pendingPoints = loadedSources.filter(p => p.status === 'checking');

    if (pendingPoints.length === 0) {
        queueContainer.innerHTML = `<p class="text-gray-400 text-center py-4">Нет новых точек на проверку.</p>`;
        return;
    }

    queueContainer.innerHTML = pendingPoints.map(p => `
        <div class="bg-white p-3 border rounded-lg flex justify-between items-start gap-4">
            <div>
                <h5 class="font-bold text-gray-800 text-xs">${p.name} <span class="text-blue-500">(${p.type})</span></h5>
                <p class="text-gray-500 text-[11px]">📍 Место: ${p.location}</p>
                <p class="text-gray-400 text-[10px]">Отправил: ${p.author} | pH: ${p.ph}</p>
            </div>
            <div class="flex gap-1 shrink-0">
                <button onclick="moderatePoint(${p.id}, 'suitable')" class="bg-emerald-500 text-white font-bold text-[10px] px-2 py-1 rounded hover:bg-emerald-600 cursor-pointer">✓ Одобрить</button>
                <button onclick="moderatePoint(${p.id}, 'unsuitable')" class="bg-rose-500 text-white font-bold text-[10px] px-2 py-1 rounded hover:bg-rose-600 cursor-pointer">✕ Отклонить</button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 5. РЕНДЕРИНГ ИНТЕРФЕЙСА И КАРТЫ
// ==========================================
function renderApp() {
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;

    const filtered = loadedSources.filter(item => {
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
async function submitNewSource() {
    // 1. Собираем данные из полей ввода
    const sourceData = {
        name: document.getElementById('addName').value, // убедитесь, что у инпутов есть эти ID
        district: document.getElementById('addDistrict').value,
        lat: parseFloat(document.getElementById('addLat').value),
        lng: parseFloat(document.getElementById('addLng').value),
        type: 'Родник', // Или значение из вашего селектора типа
        status: 'checking'
    };

    // 2. Простейшая проверка на заполненность
    if (!sourceData.name || !sourceData.lat || !sourceData.lng) {
        alert("Пожалуйста, заполните все обязательные поля!");
        return;
    }

    try {
        // 3. Отправка данных на ваш сервер
        const response = await fetch('/api/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sourceData)
        });

        if (response.ok) {
            alert("Точка успешно добавлена на карту!");
            // Здесь можно вызвать функцию обновления карты, например:
            // loadMarkers(); 
            // closeAddModal(); // Ваша функция закрытия окна
        } else {
            alert("Ошибка при сохранении на сервере.");
        }
    } catch (error) {
        console.error("Ошибка сети:", error);
        alert("Не удалось отправить данные.");
    }
}
function renderList(items) {
    const listContainer = document.getElementById("sourcesList");
    if (!listContainer) return;
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
            <div onclick="selectSource(${item.id})" class="p-2.5 border rounded-lg cursor-pointer transition flex justify-between items-start gap-2 text-xs ${isSelected}">
                <div>
                    <h4 class="font-bold text-gray-800">${item.name}</h4>
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

    myMap.setCenter([item.lat, item.lng], 13, { duration: 300 });
    
    const detailsCard = document.getElementById("detailsCard");
    const placeholder = document.getElementById("noSelectPlaceholder");
    
    if (placeholder) placeholder.classList.add("hidden");
    if (!detailsCard) return;
    
    detailsCard.classList.remove("hidden");

    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">📋 На проверке</span>`;
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
        <div class="flex justify-between items-start gap-4 flex-wrap border-b pb-2 mb-3 text-xs">
            <div>
                <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">${item.type}</span>
                <h3 class="text-sm font-bold text-gray-800">${item.name}</h3>
                <p class="text-gray-500 text-[11px]">📍 ${item.location} (${item.district})</p>
            </div>
            <div>${statusBadge}</div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-3">
            <div class="bg-gray-50 p-2 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[9px]">Показатель рН</span><span class="font-bold text-gray-700">pH ${item.ph}</span></div>
            <div class="bg-gray-50 p-2 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[9px]">Минерализация</span><span class="font-bold text-gray-700">${item.mineralization} мг/л</span></div>
            <div class="bg-gray-50 p-2 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[9px]">Проводимость</span><span class="font-bold text-gray-700">${item.conductivity} мкСм</span></div>
            <div class="bg-gray-50 p-2 rounded-lg border border-gray-100"><span class="text-gray-400 block text-[9px]">Жёсткость</span><span class="font-bold text-gray-700">${item.hardness} мг-экв</span></div>
        </div>
        <div class="text-[11px] space-y-1 text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-1 border-t pt-2">
            <div><strong>Температура:</strong> ${item.temp} °C</div>
            <div><strong>Примеси:</strong> ${item.impurities}</div>
            <div><strong>Исследователь:</strong> ${item.author}</div>
            <div><strong>Дата внесения:</strong> ${item.date}</div>
        </div>
    `;
   

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
}
