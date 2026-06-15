// Ссылка на бэкенд
const BACKEND_URL = "https://1-1-5hl5.onrender.com"; 

let myMap;
let currentSelectedId = null;
let geoObjectsCollection;
let loadedSources = []; 
let currentUserProfile = null;

ymaps.ready(initYandexMap);

async function initYandexMap() {
    myMap = new ymaps.Map("map", {
        center: [43.2389, 76.8897],
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

async function loadPointsFromServer() {
    try {
        let response = await fetch(`${BACKEND_URL}/api/sources`);
        loadedSources = await response.json();
        renderApp();
        renderModerationQueue();
    } catch (err) {
        console.error("Ошибка при работе с сервером:", err);
    }
}

// ... (остальные функции handleBackendLogin, handleBackendRegister, checkBackendSession и т.д. остаются прежними)

async function handleCreatePoint(event) {
    event.preventDefault();
    const authorName = currentUserProfile ? currentUserProfile["ФИО"] : "Студент-Лаборант";

    const payload = {
        name: document.getElementById("addName").value,
        type: document.getElementById("addType").value,
        district: "Не указан", 
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
            alert("Заявка успешно отправлена!");
            closeAddPointModal();
            await loadPointsFromServer(); 
        } else {
            alert("Ошибка сервера при сохранении.");
        }
    } catch (err) {
        console.error("Ошибка:", err);
    }
}

// ... (остальной код: renderApp, renderList, renderMapMarkers, selectSource и т.д. остается прежним)
