// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ LEAFLET
// ==========================================
const map = L.map('map').setView([43.2389, 76.8897], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let currentSelectedId = null;

// База пользователей (Авторизация)
const usersDB = {
    "admin": { password: "123", name: "Канатулы Мирас (Модератор)", role: "moderator" },
    "student1": { password: "123", name: "Асхат Бахытжан (Студент #1)", role: "student" }
};

// ==========================================
// 2. СИСТЕМА СЕССИЙ И АВТОРИЗАЦИИ
// ==========================================
function checkAuthSession() {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        applyUserInterface(JSON.parse(savedUser));
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();
    const loginInput = document.getElementById("loginUsername").value.trim();
    const passwordInput = document.getElementById("loginPassword").value.trim();
    const errorBlock = document.getElementById("loginError");

    const user = usersDB[loginInput];

    if (user && user.password === passwordInput) {
        localStorage.setItem("currentUser", JSON.stringify(user));
        applyUserInterface(user);
        closeAuthModal();
        errorBlock.classList.add("hidden");
    } else {
        errorBlock.textContent = "Неверный логин или пароль!";
        errorBlock.classList.remove("hidden");
    }
}

function applyUserInterface(user) {
    const authSection = document.getElementById("authSection");
    const adminPanelBtn = document.getElementById("adminPanelBtn");

    authSection.innerHTML = `
        <div class="flex items-center gap-2 bg-blue-950 px-3 py-1.5 rounded-lg border border-blue-400/30">
            <span class="text-xs text-white font-medium">👤 ${user.name}</span>
            <button onclick="handleLogout()" class="text-[10px] bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded transition font-bold">Выйти</button>
        </div>
    `;

    if (user.role === "moderator") {
        adminPanelBtn.className = "bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold rounded-md transition shadow-sm cursor-pointer";
        adminPanelBtn.onclick = () => alert("Добро пожаловать в Кабинет Модератора! Доступ открыт.");
    } else {
        adminPanelBtn.className = "bg-blue-900 text-gray-400 px-3 py-1.5 text-xs font-semibold rounded-md transition opacity-40 cursor-not-allowed";
        adminPanelBtn.onclick = () => alert("Ошибка доступа! Раздел только для модераторов.");
    }
}

function handleLogout() {
    localStorage.removeItem("currentUser");
    location.reload();
}

function openAuthModal() { document.getElementById("authModal").classList.remove("hidden"); }
function closeAuthModal() { document.getElementById("authModal").classList.add("hidden"); }

// ==========================================
// 3. ОТРИСОВКА ИСТОЧНИКОВ И КАРТЫ
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

    markersLayer.clearLayers();
    const listContainer = document.getElementById('sourcesList');
    listContainer.innerHTML = '';

    filtered.forEach(source => {
        let color = 'blue';
        if (source.status === 'suitable') color = 'green';
        if (source.status === 'checking') color = 'orange';
        if (source.status === 'unsuitable') color = 'red';

        // Создаем маркер Leaflet через эмодзи-каплю
        const iconHtml = `<span class="custom-pin" style="color: ${color}">💧</span>`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-div-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });

        const marker = L.marker([source.lat, source.lng], { icon: customIcon });
        marker.on('click', () => selectSource(source.id));
        markersLayer.addLayer(marker);

        // Карточка в списке
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
            map.setView([source.lat, source.lng], 14);
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

    let statusText = source.status === 'suitable' 
        ? `<div class="bg-green-100 text-green-800 p-2.5 rounded-lg font-bold text-xs text-center border border-green-200">✅ Подходит для получения живой и мёртвой воды методом электролиза.</div>`
        : source.status === 'checking'
        ? `<div class="bg-yellow-100 text-yellow-800 p-2.5 rounded-lg font-bold text-xs text-center border border-yellow-200">⚠️ Статус уточняется. Требуется анализ.</div>`
        : `<div class="bg-red-100 text-red-800 p-2.5 rounded-lg font-bold text-xs text-center border border-red-200">❌ Не рекомендуется для электролиза! Повышенные примеси.</div>`;

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
                    <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div class="bg-white p-2 rounded shadow-xs"><strong>pH:</strong> ${source.ph}</div>
                        <div class="bg-white p-2 rounded shadow-xs"><strong>Минералы:</strong> ${source.mineralization} мг/л</div>
                    </div>
                </div>
                ${statusText}
            </div>
        </div>
    `;
    renderApp();
}

function addNewSourceItem() {
    const name = document.getElementById('newFormName').value;
    const lat = parseFloat(document.getElementById('newFormLat').value);
    const lng = parseFloat(document.getElementById('newFormLng').value);
    const loc = document.getElementById('newFormLoc').value;
    const author = document.getElementById('newFormAuthor').value;

    if(!name || !lat || !lng) { alert("Заполните название и координаты!"); return; }

    initialSources.unshift({
        id: Date.now(), name, type: "Родник", region: "Алматы", district: "Наурызбайский район",
        location: loc || "Указано пользователем", lat, lng, status: "checking", labChecked: false,
        ph: 7.2, mineralization: 210, conductivity: 290, hardness: 3.1, temp: 9, impurities: "Проверка",
        author: author || "Исследователь", date: new Date().toISOString().split('T')[0]
    });

    document.getElementById('addFormModal').classList.add('hidden');
    renderApp();
}

// Рендер блока 56 студентов
const studentsGrid = document.getElementById('studentsGrid');
for (let i = 1; i <= 56; i++) {
    const s = document.createElement('div');
    s.className = 'bg-gray-50 p-2 rounded border border-gray-100 text-[11px]';
    s.innerHTML = `<p class="font-bold text-gray-700">Студент №${i}</p><p class="text-blue-600 font-semibold">Проб: ${(i % 3) + 1}</p>`;
    studentsGrid.appendChild(s);
}

document.getElementById('searchQuery').addEventListener('input', renderApp);
document.getElementById('filterStatus').addEventListener('change', renderApp);
document.getElementById('filterType').addEventListener('change', renderApp);

// Запуск сессии и приложения
checkAuthSession();
renderApp();
