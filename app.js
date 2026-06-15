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

    // Вешаем события
    document.getElementById("searchQuery").addEventListener("input", renderApp);
    document.getElementById("filterStatus").addEventListener("change", renderApp);
    document.getElementById("filterType").addEventListener("change", renderApp);

    // Запускаем загрузку
    await checkBackendSession();
    await loadPointsFromServer();
}

async function loadPointsFromServer() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();
        renderApp();
        renderModerationQueue();
    } catch (err) {
        console.error("Ошибка при загрузке точек:", err);
    }
}

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
            alert("Заявка успешно создана!");
            document.getElementById("addPointModal").classList.add("hidden");
            await loadPointsFromServer();
        } else {
            alert("Ошибка сохранения.");
        }
    } catch (err) {
        console.error("Ошибка отправки:", err);
    }
}

// Заглушки, чтобы код не падал, если функции вызываются раньше времени
function renderApp() {
    if (!loadedSources) return;
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    const filterType = document.getElementById("filterType").value;

    const filtered = loadedSources.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(query) || 
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
    if (!listContainer) return;
    
    listContainer.innerHTML = items.map(item => `
        <div onclick="selectSource(${item.id})" class="p-2 border rounded-lg cursor-pointer hover:bg-gray-100 text-xs">
            <h4 class="font-bold">${item.name}</h4>
            <p>${item.type}</p>
        </div>
    `).join('');
}

function renderMapMarkers(items) {
    if (!geoObjectsCollection) return;
    geoObjectsCollection.removeAll();
    items.forEach(item => {
        const p = new ymaps.Placemark([item.lat, item.lng]);
        p.events.add('click', () => selectSource(item.id));
        geoObjectsCollection.add(p);
    });
}

function selectSource(id) { /* Логика выбора */ }
function renderModerationQueue() { /* Логика очереди */ }
function checkBackendSession() { /* Логика сессии */ }
// ... (добавьте свои функции логина/авторизации сюда)
