// НАСТРОЙКА: Укажи ссылку на твой бэкенд, развернутый на Render
const BACKEND_URL = "http://localhost:5000"; // Замени на свой URL на Render после деплоя бэка

let myMap;
let currentSelectedId = null;

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

    checkBackendSession();
    renderApp();
}

// ==========================================
// 2. СЛОЖНАЯ АВТОРИЗАЦИЯ С СЕРВЕРА через fetch
// ==========================================

// Функция входа
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
            // Сохраняем ТОКЕН безопасности, а не просто объект
            localStorage.setItem("
