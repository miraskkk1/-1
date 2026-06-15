// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ И ПЕРЕМЕННЫХ
// ==========================================
let map;
let markers = [];
let currentSelectedId = null;

// Инициализация Google Maps
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 43.2389, lng: 76.8897 },
        zoom: 11,
        mapId: "DEMO_MAP_ID"
    });

    // Проверяем, был ли выполнен вход ранее
    checkAuthSession();
    renderApp();
}

// ==========================================
// 2. БЛОК АВТОРИЗАЦИИ (ЛОГИКА И СЕССИЯ)
// ==========================================

// Тестовая база пользователей (логин и пароль)
const usersDB = {
    // Модераторы
    "admin": { password: "123", name: "Канатулы Мирас (Модератор)", role: "moderator" },
    // Студенты-исследователи
    "student1": { password: "123", name: "Асхат Бахытжан (Студент #1)", role: "student" },
    "student2": { password: "123", name: "Диана Серикова (Студент #2)", role: "student" }
};

// Функция проверки сессии при загрузке страницы
function checkAuthSession() {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        const user = JSON.parse(savedUser);
        applyUserInterface(user);
    }
}

// Функция обработки отправки формы входа
function handleLoginSubmit(event) {
    event.preventDefault();
    const loginInput = document.getElementById("loginUsername").value.trim();
    const passwordInput = document.getElementById("loginPassword").value.trim();
    const errorBlock = document.getElementById("loginError");

    // Ищем пользователя в нашей мини-базе
    const user = usersDB[loginInput];

    if (user && user.password === passwordInput) {
        // Сохраняем пользователя в localStorage (запоминаем вход)
        localStorage.setItem("currentUser", JSON.stringify(user));
        
        // Применяем изменения в интерфейсе
        applyUserInterface(user);
        
        // Закрываем модальное окно и очищаем форму
        closeAuthModal();
        errorBlock.classList.add("hidden");
    } else {
        // Показываем ошибку
        errorBlock.textContent = "Неверный логин или пароль!";
        errorBlock.classList.remove("hidden");
    }
}

// Изменение интерфейса под конкретную роль
function applyUserInterface(user) {
    const authSection = document.getElementById("authSection");
    const adminPanelBtn = document.getElementById("adminPanelBtn");

    // Меняем кнопки входа на имя пользователя и кнопку Выход
    authSection.innerHTML = `
        <div class="flex items-center gap-3 bg-blue-800/50 px-3 py-1.5 rounded-lg border border-blue-500/30">
            <span class="text-xs font-medium text-white">👤 ${user.name}</span>
            <button onclick="handleLogout()" class="text-[11px] bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded transition font-semibold">
                Выйти
            </button>
        </div>
    `;

    // Если зашёл модератор — активируем кнопку кабинета модератора
    if (user.role === "moderator") {
        adminPanelBtn.className = "bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold rounded-md transition shadow-sm animate-pulse";
        adminPanelBtn.onclick = () => alert("Добро пожаловать в Кабинет Модератора! Доступ разрешен.");
    } else {
        // Если зашёл студент
        adminPanelBtn.className = "bg-blue-800 hover:bg-blue-900 text-gray-300 px-3 py-1.5 text-xs font-semibold rounded-md transition opacity-50 cursor-not-allowed";
        adminPanelBtn.onclick = () => alert("Доступ ограничен. Этот раздел предназначен только для модераторов системы.");
    }
}

// Выход из системы (очистка памяти)
function handleLogout() {
    localStorage.removeItem("currentUser");
    // Возвращаем исходную шапку сайта
    location.reload(); 
}

function openAuthModal() {
    document.getElementById("authModal").classList.remove("hidden");
}

function closeAuthModal() {
    document.getElementById("authModal").classList.add("hidden");
}

// ==========================================
// 3. ОТРИСОВКА И ФИЛЬТРАЦИЯ ИСТОЧНИКОВ
// ==========================================
function renderApp() {
    const query = document.getElementById('searchQuery').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const typeFilter = document.getElementById('filterType').value;

    const filtered = initialSources.filter(source => {
        const matchesSearch = source.name.toLowerCase().includes(query) || 
                              source.district.toLowerCase().includes(query) ||
                              source.location.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || source.status === statusFilter;
        const matchesType = typeFilter === 'all' || source.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    markers.forEach(marker => marker.setMap(null));
    markers = [];

    const listContainer = document.getElementById('sourcesList');
    listContainer.innerHTML = '';

    filtered.forEach(source => {
        let color = 'blue';
        if (source.status === 'suitable') color = 'green';
        if (source.status === 'checking') color = 'orange';
        if (source.status === 'unsuitable') color = 'red';

        const marker = new google.maps.Marker({
            position: { lat: source.lat, lng: source.lng },
            map: map,
            title: source.name,
            icon: {
                url: `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`
            }
        });

        marker.addListener("click", () => selectSource(source.id));
        markers.push(marker);

        const item = document.createElement('div');
        item.className = `p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${currentSelectedId === source.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`;
        item.innerHTML = `
            <div>
                <h4 class="font-bold text-sm text-gray-800">${source.name}</h4>
                <p class="text-xs text-gray-500">${source.district} • ${source.type}</p>
            </div>
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${color}"></span>
        `;
        item.onclick = () => {
            selectSource(source.id);
            map.setCenter({ lat: source.lat, lng: source.lng });
            map.setZoom(14);
        };
        listContainer.appendChild(item);
    });
}

function selectSource(id) {
    currentSelectedId = id;
    const source = initialSources.find(s => s.id === id);
    if (!source) return;

    document.getElementById('noSelectPlaceholder').classList.add('hidden');
    const detailsCard = document.getElementById('detailsCard');
    detailsCard.classList.remove('hidden');

    let statusText = '';
    if (source.status === 'suitable') {
        statusText = `<div class="bg-green-100 text-green-800 p-2.5 rounded-lg font-bold text-xs text-center border border-green-200">✅ Подходит для получения живой и мёртвой воды методом электролиза.</div>`;
    } else if (source.status === 'checking') {
        statusText = `<div class="bg-yellow-100 text-yellow-800 p-2.5 rounded-lg font-bold text-xs text-center border border-yellow-200">⚠️ Статус уточняется. Требуется повторный анализ лаборатории.</div>`;
    } else {
        statusText = `<div class="bg-red-100 text-red-800 p-2.5 rounded-lg font-bold text-xs text-center border border-red-200">❌ Не рекомендуется для электролиза! Повышенные примеси.</div>`;
    }

    detailsCard.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <span class="text-xs font-bold tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">${source.type}</span>
                <h3 class="text-xl font-bold text-gray-800 mt-2">${source.name}</h3>
                <p class="text-sm text-gray-600 mt-1">📍 ${source.region}, ${source.district}, ${source.location}</p>
                <p class="text-xs text-gray-400 mt-1">🌐 Координаты: ${source.lat}, ${source.lng}</p>
            </div>
            <div class="flex flex-col justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                    <h4 class="font-bold text-sm text-gray-700 mb-2">📊 Лабораторные замеры:</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div class="bg-white p-2 rounded shadow-xs"><strong>pH:</strong> ${source.ph}</div>
                        <div class="bg-white p-2 rounded shadow-xs"><strong>Минералы:</strong> ${source.mineralization} мг/л</div>
                        <div class="bg-white p-2 rounded shadow-xs"><strong>Проводимость:</strong> ${source.conductivity} мкСм</div>
                        <div class="bg-white p-2 rounded shadow-xs"><strong>Жесткость:</strong> ${source.hardness} °Ж</div>
                    </div>
                </div>
                ${statusText}
            </div>
        </div>
    `;
    renderApp();
}

// Привязка событий фильтрации
document.getElementById('searchQuery').addEventListener('input', renderApp);
document.getElementById('filterStatus').addEventListener('change', renderApp);
document.getElementById('filterType').addEventListener('change', renderApp);

window.initMap = initMap;
