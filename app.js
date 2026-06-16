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
            console.log("Бэкенд пуст. Синхронизируем первичные данные из data.js...");
            const syncResponse = await fetch(`${BACKEND_URL}/api/sources/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialSources)
            });
            if (syncResponse.ok) {
                let resData = await syncResponse.json();
                console.log(resData.message);
                response = await fetch(`${BACKEND_URL}/api/sources`);
                loadedSources = await response.json();
            }
        }

        renderApp();
    } catch (err) {
        console.error("Ошибка при получении данных с бэкенда:", err);
        // Резервный режим: если бэкенд упал, работаем на локальном data.js
        if (typeof initialSources !== 'undefined') {
            loadedSources = initialSources;
            renderApp();
        }
    }
}

// Основной пайплайн рендеринга интерфейса (Фильтрация -> Карта -> Список)
function renderApp() {
    const searchVal = document.getElementById("searchQuery").value.toLowerCase();
    const statusVal = document.getElementById("filterStatus").value;
    const typeVal = document.getElementById("filterType").value;

    // 1. Фильтрация массива данных
    const filtered = loadedSources.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchVal) || 
                              item.location.toLowerCase().includes(searchVal) ||
                              (item.district && item.district.toLowerCase().includes(searchVal));
        
        const matchesStatus = (statusVal === 'all') || (item.status === statusVal);
        const matchesType = (typeVal === 'all') || (item.type === typeVal);

        return matchesSearch && matchesStatus && matchesType;
    });

    // 2. Обновление маркеров на Яндекс.Карте
    if (geoObjectsCollection) {
        geoObjectsCollection.removeAll();

        filtered.forEach(item => {
            let markerColor = "#f59e0b"; // Премиальный янтарный по умолчанию (На проверке)
            if (item.status === 'suitable') markerColor = "#10b981";  // Изумрудный (Подходит)
            if (item.status === 'unsuitable') markerColor = "#f43f5e"; // Розово-красный (Не подходит)

            const placemark = new ymaps.Placemark([item.lat, item.lng], {
                balloonContentHeader: `<b style="color:#0f172a;font-family:monospace;">${item.name}</b>`,
                balloonContentBody: `
                    <div style="font-size:12px;color:#334155;font-family:sans-serif;">
                        <p><b>Тип:</b> ${item.type}</p>
                        <p><b>pH:</b> ${item.ph} • <b>Жёсткость:</b> ${item.hardness}</p>
                        <p><b>Ориентир:</b> ${item.location}</p>
                        <button onclick="window.selectSourceFromMap(${item.id})" style="margin-top:8px;background:#d97706;color:white;border:none;padding:4px 8px;font-size:11px;border-radius:4px;cursor:pointer;width:100%;">Открыть карточку</button>
                    </div>
                `,
                hintContent: item.name
            }, {
                preset: 'islands#dotIcon',
                iconColor: markerColor
            });

            geoObjectsCollection.add(placemark);
        });
    }

    // 3. Отрисовка списка слева
    renderList(filtered);

    // 4. Обновление очередей модератора, если он залогинен
    if (currentUserProfile && currentUserProfile.role === 'moderator') {
        updateModeratorQueue();
    }
}

// Глобальный хелпер для вызова клика из балуна карты
window.selectSourceFromMap = function(id) {
    myMap.balloon.close();
    selectSource(id);
};

// ПРЕМИАЛЬНЫЙ РЕНДЕРИНГ СПИСКА КАРТОЧЕК СЛЕВА
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

// ПРЕМИАЛЬНЫЙ ДЕТАЛЬНЫЙ ПРОСМОТР ИСТОЧНИКА ВОДЫ
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
                         item.status === 'checking' ? '<span class="text-amber-400 font-bold font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-[11px] tracking-wide uppercase">💛 На проверке лаборатории</span>' : 
                                                      '<span class="text-rose-400 font-bold font-mono bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/30 text-[11px] tracking-wide uppercase">❌ Не подходит</span>';

        detailsCard.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-slate-800/80 pb-4 gap-3">
                <div>
                    <h3 class="text-lg font-bold text-white font-mono tracking-wide">${item.name}</h3>
                    <p class="text-xs text-slate-400 mt-1">📍 Географическая привязка: <span class="text-slate-300">${item.location}</span></p>
                </div>
                <div class="shrink-0">${statusText}</div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Водородный индекс:</span> <strong class="text-sm font-mono text-amber-400">pH ${item.ph}</strong></div>
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Минерализация:</span> <strong class="text-sm font-mono text-white">${item.mineralization || item.conductivity} мг/л</strong></div>
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Проводимость:</span> <strong class="text-sm font-mono text-white">${item.conductivity || 0} мкСм/см</strong></div>
                <div class="space-y-0.5"><span class="text-slate-500 block text-[10px] uppercase tracking-wider">Общая жёсткость:</span> <strong class="text-sm font-mono text-white">${item.hardness} мг-экв/л</strong></div>
            </div>
            <div class="text-xs space-y-2 text-slate-300 pt-2 font-mono">
                <p><span class="text-slate-500">🌡️ Температура выхода:</span> <span class="text-white">${item.temp} °C</span></p>
                <p><span class="text-slate-500">🔬 Характер примесей / Осадок:</span> <span class="text-white">${item.impurities || 'Отсутствует'}</span></p>
                <p><span class="text-slate-500">👤 Ответственный эксперт:</span> <span class="text-amber-400">${item.author || 'Лаборатория'}</span> <span class="text-[10px] text-slate-500">(${item.date || '2026'})</span></p>
            </div>
        `;
        
        myMap.setCenter([item.lat, item.lng], 14, { duration: 400 });
    }
}

// --- БЛОК АВТОРИЗАЦИИ И СЕССИЙ (СВЯЗКА С БЭКЕНДОМ) ---

async function checkBackendSession() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            currentUserProfile = { role: data.role, details: data.profile };
            rebuildMenuForUser(data.role, data.profile);
        } else {
            localStorage.removeItem("token");
        }
    } catch (err) {
        console.error("Сбой проверки токена сессии:", err);
    }
}

function rebuildMenuForUser(role, profile) {
    const authSection = document.getElementById("authSection");
    if (authSection) {
        authSection.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-bold text-white font-mono">${profile["ФИО"] || 'Исследователь'}</p>
                    <p class="text-[9px] text-amber-400 tracking-widest uppercase">${role === 'moderator' ? 'Модератор системы' : 'Лаборант'}</p>
                </div>
                <button onclick="logout()" class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 text-xs font-medium rounded-lg transition cursor-pointer">
                    Выйти
                </button>
            </div>
        `;
    }

    // Активация панели администратора/модератора при наличии прав
    const adminPanelBtn = document.getElementById("adminPanelBtn");
    if (adminPanelBtn && role === 'moderator') {
        adminPanelBtn.disabled = false;
        adminPanelBtn.classList.remove("opacity-40", "cursor-not-allowed");
        adminPanelBtn.classList.add("hover:bg-slate-800", "border-amber-500/40", "text-amber-400", "cursor-pointer");
    }

    // Показываем блок дашборда профиля снизу карты
    const profileDashboard = document.getElementById("profileDashboard");
    const profileDetailsGrid = document.getElementById("profileDetailsGrid");
    if (profileDashboard && profileDetailsGrid) {
        profileDashboard.classList.remove("hidden");
        profileDetailsGrid.innerHTML = Object.entries(profile).map(([key, val]) => `
            <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span class="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">${key}:</span>
                <span class="text-slate-200 font-medium font-mono">${val}</span>
            </div>
        `).join('');
    }
}

async function handleBackendLogin() {
    const uInput = document.getElementById("loginUsername").value;
    const pInput = document.getElementById("loginPassword").value;
    const errBlock = document.getElementById("loginError");

    errBlock.classList.add("hidden");

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uInput, password: pInput })
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem("token", data.token);
            window.location.reload();
        } else {
            errBlock.innerText = data.message || "Ошибка авторизации.";
            errBlock.classList.remove("hidden");
        }
    } catch (err) {
        errBlock.innerText = "Сервер аутентификации недоступен.";
        errBlock.classList.remove("hidden");
    }
}

async function handleBackendRegister() {
    const uInput = document.getElementById("loginUsername").value;
    const pInput = document.getElementById("loginPassword").value;
    const errBlock = document.getElementById("loginError");

    errBlock.classList.add("hidden");

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uInput, password: pInput })
        });
        const data = await response.json();

        if (data.success) {
            alert("Аккаунт лаборанта успешно создан! Теперь вы можете авторизоваться.");
            toggleToLogin();
        } else {
            errBlock.innerText = data.message || "Ошибка при регистрации.";
            errBlock.classList.remove("hidden");
        }
    } catch (err) {
        errBlock.innerText = "Не удалось связаться с сервером.";
        errBlock.classList.remove("hidden");
    }
}

// --- БЛОК ДОБАВЛЕНИЯ ЛАБОРАТОРНЫХ ДАННЫХ ЭКСПЕРТАМИ ---

async function handleCreatePoint(event) {
    event.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Ошибка: Внесение в базу доступно только авторизованным лаборантам.");
        closeAddPointModal();
        openAuthModal();
        return;
    }

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: "Алматинская область",
        location: document.getElementById("addLocation").value,
        lat: parseFloat(document.getElementById("addLat").value),
        lng: parseFloat(document.getElementById("addLng").value),
        ph: parseFloat(document.getElementById("addPh").value),
        mineralization: parseInt(document.getElementById("addMin").value),
        conductivity: parseInt(document.getElementById("addCond").value),
        hardness: parseFloat(document.getElementById("addHard").value),
        temp: parseInt(document.getElementById("addTemp").value),
        impurities: document.getElementById("addImpurities").value || "Нет"
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Источник успешно отправлен на сервер! Заявка находится на рассмотрении модератора лаборатории.");
            closeAddPointModal();
            // Сброс полей
            event.target.reset();
            await loadPointsFromServer();
        } else {
            const errData = await response.json();
            alert(errData.message || "Ошибка сохранения точки сервером.");
        }
    } catch (err) {
        console.error("Сбой сети при создании точки:", err);
        alert("Ошибка связи с сервером бэкенда.");
    }
}

// --- ПАНЕЛЬ ВЕРИФИКАЦИИ И МОДЕРАЦИИ ДАННЫХ ---

function updateModeratorQueue() {
    const queueList = document.getElementById("moderationQueueList");
    if (!queueList) return;

    // Выбираем точки со статусом "checking"
    const checkingItems = loadedSources.filter(p => p.status === 'checking');

    if (checkingItems.length === 0) {
        queueList.innerHTML = '<p class="text-slate-500 font-mono text-[11px] py-4 text-center">Очередь верификации пуста</p>';
        return;
    }

    queueList.innerHTML = checkingItems.map(item => `
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-start gap-2">
                <div>
                    <h5 class="font-bold text-white">${item.name}</h5>
                    <p class="text-[10px] text-slate-500 font-mono">${item.location}</p>
                    <p class="text-[10px] text-slate-400 mt-1 font-mono">Параметры: pH ${item.ph} | Мин: ${item.mineralization || item.conductivity} мг/л | От: ${item.author || 'Гость'}</p>
                </div>
            </div>
            <div class="flex justify-end gap-1.5 pt-1.5 border-t border-slate-900">
                <button onclick="handleStatusChange(${item.id}, 'unsuitable')" class="bg-rose-950/40 hover:bg-rose-900 border border-rose-900/40 text-rose-400 text-[10px] px-2 py-1 rounded transition font-mono cursor-pointer">Отклонить</button>
                <button onclick="handleStatusChange(${item.id}, 'suitable')" class="bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-900/40 text-emerald-400 text-[10px] px-2 py-1 rounded transition font-mono font-bold cursor-pointer">Одобрить</button>
            </div>
        </div>
    `).join('');
}

async function handleStatusChange(id, newStatus) {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            await loadPointsFromServer(); // Перерендеринг всего приложения
        } else {
            alert("Не удалось изменить статус. Возможно, у вас недостаточно прав.");
        }
    } catch (err) {
        console.error("Ошибка при обновлении статуса:", err);
    }
}

async function handleAssignModerator() {
    const token = localStorage.getItem("token");
    const usernameInput = document.getElementById("assignUsername");
    const username = usernameInput.value.trim();

    if (!token || !username) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/assign-moderator`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username: username })
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

// --- ХЕЛПЕРЫ ДЛЯ ОТКРЫТИЯ/ЗАКРЫТИЯ МОДАЛОК ---
function openAuthModal() { document.getElementById("authModal").classList.remove("hidden"); }
function closeAuthModal() { document.getElementById("authModal").classList.add("hidden"); }
function openAddPointModal() { document.getElementById("addPointModal").classList.remove("hidden"); }
function closeAddPointModal() { document.getElementById("addPointModal").classList.add("hidden"); }
function openModeratorModal() { document.getElementById("moderatorModal").classList.remove("hidden"); }
function closeModeratorModal() { document.getElementById("moderatorModal").classList.add("hidden"); }

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


// --- НОВАЯ ЛОГИКА ДЛЯ ОКНА ПРЕДЛОЖЕНИЙ НОВЫХ ПОСЕТИТЕЛЕЙ ---

function openSuggestModal() {
    document.getElementById("suggestModal").classList.remove("hidden");
}

function closeSuggestModal() {
    document.getElementById("suggestModal").classList.add("hidden");
    // Сброс полей ввода
    document.getElementById("suggestName").value = "";
    document.getElementById("suggestLocation").value = "";
    document.getElementById("suggestLat").value = "";
    document.getElementById("suggestLng").value = "";
    document.getElementById("suggestContact").value = "";
}

// Обработка отправки упрощенного предложения локации посетителем
async function handleSuggestLocation(event) {
    event.preventDefault();
    
    const name = document.getElementById("suggestName").value;
    const location = document.getElementById("suggestLocation").value;
    const lat = parseFloat(document.getElementById("suggestLat").value);
    const lng = parseFloat(document.getElementById("suggestLng").value);
    const contact = document.getElementById("suggestContact").value || "Не указан";

    // Так как рядовой посетитель не знает физ-хим данные, мы генерируем структуру для проверки (status: checking)
    const payload = {
        name: `📍 [Заявка] ${name}`,
        type: "Родник",
        district: "Алматы",
        location: location,
        lat: lat,
        lng: lng,
        ph: 7.0,             // Дефолтное нейтральное значение до выезда лаборантов
        mineralization: 0,
        conductivity: 0,
        hardness: 0,
        temp: 0,
        impurities: `Предложено посетителем. Контакт для связи: ${contact}`,
        author: "Новый посетитель"
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert("Благодарим вас! Ваше предложение успешно зарегистрировано. Проверенные координаты отправлены в хаб верификации лаборатории Юткина. Специалисты проведут замеры воды при ближайшем выезде.");
            closeSuggestModal();
            await loadPointsFromServer(); // Мгновенное обновление данных на клиенте
        } else {
            alert("Не удалось отправить предложение. Ошибка записи на сервере.");
        }
    } catch (err) {
        console.error("Сбой сети при отправке координат локации:", err);
        alert("Ошибка соединения: бэкенд сервер в данный момент недоступен.");
    }
}
