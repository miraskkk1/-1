// Инициализация интерактивной карты (Фокус на Алматы)
const map = L.map('map').setView([43.2389, 76.8897], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let currentSelectedId = null;

// Функция отрисовки маркеров и списка
function renderApp() {
    const query = document.getElementById('searchQuery').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const typeFilter = document.getElementById('filterType').value;

    // Фильтрация данных
    const filtered = initialSources.filter(source => {
        const matchesSearch = source.name.toLowerCase().includes(query) || 
                              source.district.toLowerCase().includes(query) ||
                              source.location.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || source.status === statusFilter;
        const matchesType = typeFilter === 'all' || source.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    // Очищаем старые маркеры на карте
    markersLayer.clearLayers();

    // Очищаем список слева
    const listContainer = document.getElementById('sourcesList');
    listContainer.innerHTML = '';

    // Отрисовка элементов
    filtered.forEach(source => {
        // Установка цвета маркера
        let color = 'blue';
        if (source.status === 'suitable') color = 'green';
        if (source.status === 'checking') color = 'orange';
        if (source.status === 'unsuitable') color = 'red';

        // Создаем маркер на карте
        const iconHtml = `<span class="custom-pin" style="color: ${color};">💧</span>`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-div-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });

        const marker = L.marker([source.lat, source.lng], { icon: customIcon });
        marker.on('click', () => selectSource(source.id));
        markersLayer.addLayer(marker);

        // Создаем карточку в боковом списке
        const item = document.createElement('div');
        item.className = `p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${currentSelectedId === source.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`;
        item.innerHTML = `
            <div>
                <h4 class="font-bold text-sm text-gray-800">${source.name}</h4>
                <p class="text-xs text-gray-500">${source.district} • ${source.type}</p>
            </div>
            <span class="w-3 h-3 rounded-full flex-shrink-0 bg-${color}-500" style="background-color: ${color}"></span>
        `;
        item.onclick = () => {
            selectSource(source.id);
            map.setView([source.lat, source.lng], 13);
        };
        listContainer.appendChild(item);
    });
}

// Функция выбора источника и показа детальной инфы
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
                <div class="mt-4 p-3 bg-gray-50 rounded-lg text-xs space-y-1 text-gray-600">
                    <p><strong>Исследователь:</strong> ${source.author}</p>
                    <p><strong>Дата замера:</strong> ${source.date}</p>
                </div>
            </div>
            <div class="flex flex-col justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                    <h4 class="font-bold text-sm text-gray-700 mb-2">📊 Лабораторные замеры:</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div class="bg-white p-2 rounded shadow-2xs"><strong>pH:</strong> ${source.ph}</div>
                        <div class="bg-white p-2 rounded shadow-2xs"><strong>Минералы:</strong> ${source.mineralization} мг/л</div>
                        <div class="bg-white p-2 rounded shadow-2xs"><strong>Проводимость:</strong> ${source.conductivity} мкСм</div>
                        <div class="bg-white p-2 rounded shadow-2xs"><strong>Жесткость:</strong> ${source.hardness} °Ж</div>
                    </div>
                    <p class="text-[11px] text-gray-500 mb-3"><strong>Примеси:</strong> ${source.impurities}</p>
                </div>
                ${statusText}
            </div>
        </div>
    `;

    // Перерисовываем список, чтобы подсветить активный элемент
    renderApp();
}

// Добавление новой пользовательской точки
function addNewSourceItem() {
    const name = document.getElementById('newFormName').value;
    const lat = parseFloat(document.getElementById('newFormLat').value);
    const lng = parseFloat(document.getElementById('newFormLng').value);
    const loc = document.getElementById('newFormLoc').value;
    const author = document.getElementById('newFormAuthor').value;

    if(!name || !lat || !lng) {
        alert("Заполните название и GPS координаты!");
        return;
    }

    const newObj = {
        id: Date.now(),
        name: name,
        type: "Родник",
        region: "Алматы",
        district: "Выбранный район",
        location: loc || "Указано пользователем",
        lat: lat,
        lng: lng,
        status: "checking",
        labChecked: false,
        ph: 7.0,
        mineralization: 250,
        conductivity: 310,
        hardness: 3.5,
        temp: 12,
        impurities: "Ожидает приезда студентов и отправки в лабораторию",
        author: author || "Анонимный исследователь",
        date: new Date().toISOString().split('T')[0]
    };

    initialSources.unshift(newObj);
    document.getElementById('addFormModal').classList.add('hidden');
    renderApp();
    alert("Точка добавлена на карту со статусом 'На модерации'!");
}

// Генерация блока 56 студентов-исследователей
const studentsGrid = document.getElementById('studentsGrid');
for (let i = 1; i <= 56; i++) {
    const student = document.createElement('div');
    student.className = 'bg-gray-50 p-2 rounded border border-gray-100 text-[11px]';
    student.innerHTML = `
        <p class="font-bold text-gray-700">Студент №${i}</p>
        <p class="text-gray-500">Регион: Алматы</p>
        <p class="text-blue-600 font-semibold">Принёс проб: ${(i % 3) + 1}</p>
    `;
    studentsGrid.appendChild(student);
}

// Слушатели событий на фильтры
document.getElementById('searchQuery').addEventListener('input', renderApp);
document.getElementById('filterStatus').addEventListener('change', renderApp);
document.getElementById('filterType').addEventListener('change', renderApp);

// Первый запуск приложения при загрузке страницы
window.onload = renderApp;
let map;
let markers = [];
let currentSelectedId = null;

// Инициализация Google Maps
function initMap() {
    // Центрируем карту на Алматы
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 43.2389, lng: 76.8897 },
        zoom: 11,
        mapId: "DEMO_MAP_ID" // Можно заменить на свой стиль из Google Console
    });

    renderApp();
}

// Отрисовка приложения, фильтров и маркеров
function renderApp() {
    const query = document.getElementById('searchQuery').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const typeFilter = document.getElementById('filterType').value;

    // Фильтруем массив initialSources из data.js
    const filtered = initialSources.filter(source => {
        const matchesSearch = source.name.toLowerCase().includes(query) || 
                              source.district.toLowerCase().includes(query) ||
                              source.location.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || source.status === statusFilter;
        const matchesType = typeFilter === 'all' || source.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    // Удаляем старые маркеры с карты Google
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    // Очищаем боковой список
    const listContainer = document.getElementById('sourcesList');
    listContainer.innerHTML = '';

    // Добавляем новые маркеры и элементы списка
    filtered.forEach(source => {
        let color = 'blue';
        if (source.status === 'suitable') color = 'green';
        if (source.status === 'checking') color = 'orange';
        if (source.status === 'unsuitable') color = 'red';

        // Создаем маркер Google Maps
        const marker = new google.maps.Marker({
            position: { lat: source.lat, lng: source.lng },
            map: map,
            title: source.name,
            icon: {
                url: `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`
            }
        });

        // Клик по маркеру открывает карточку
        marker.addListener("click", () => {
            selectSource(source.id);
        });

        markers.push(marker);

        // Карточка в списке слева
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

// Показ деталей источника
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

// Привязка событий к фильтрам
document.getElementById('searchQuery').addEventListener('input', renderApp);
document.getElementById('filterStatus').addEventListener('change', renderApp);
document.getElementById('filterType').addEventListener('change', renderApp);

// Привязываем инициализацию карты к глобальному окну
window.initMap = initMap;
