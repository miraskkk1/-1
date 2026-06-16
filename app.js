// --- ЛОГИКА ДЛЯ ОКНА ПРЕДЛОЖЕНИЙ НОВЫХ ПОСЕТИТЕЛЕЙ ---

function openSuggestModal() {
    document.getElementById("suggestModal").classList.remove("hidden");
}

function closeSuggestModal() {
    document.getElementById("suggestModal").classList.add("hidden");
    // Сброс полей
    document.getElementById("suggestName").value = "";
    document.getElementById("suggestLocation").value = "";
    document.getElementById("suggestLat").value = "";
    document.getElementById("suggestLng").value = "";
    document.getElementById("suggestContact").value = "";
}

// Обработка отправки предложения от посетителя
async function handleSuggestLocation(event) {
    event.preventDefault();
    
    const name = document.getElementById("suggestName").value;
    const location = document.getElementById("suggestLocation").value;
    const lat = parseFloat(document.getElementById("suggestLat").value);
    const lng = parseFloat(document.getElementById("suggestLng").value);
    const contact = document.getElementById("suggestContact").value || "Не указан";

    // Посетитель не знает физ-хим данные, отправляем базовый шаблон на модерацию
    const payload = {
        name: `📍 [Предложение] ${name}`,
        type: "Родник",
        district: "Алматы",
        location: location,
        lat: lat,
        lng: lng,
        ph: 7.0, // Дефолтное значение
        mineralization: 0,
        conductivity: 0,
        hardness: 0,
        temp: 0,
        impurities: `Предложено посетителем. Контакт для связи: ${contact}`,
        author: "Посетитель сайта"
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert("Благодарим вас! Координаты локации успешно переданы в лабораторию Юткина. Наши специалисты проведут анализ воды в ближайшее время.");
            closeSuggestModal();
            await loadPointsFromServer(); // Перезагружаем список
        } else {
            alert("Ошибка сохранения данных сервером.");
        }
    } catch (err) {
        console.error("Сбой сети при отправке координат:", err);
        alert("Не удалось связаться с сервером.");
    }
}
