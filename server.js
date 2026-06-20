const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'SUPER_SECRET_KEY_KAZAKHSTAN_2026'; 

app.use(cors()); 
app.use(express.json());

// 1. База данных пользователей
const usersDatabase = {
    "miras": {
        username: "miras",
        password: "kanatuly", 
        role: "moderator",
        profile: {
            "ФИО": "Канатулы Мирас",
            "Статус": "is",
            "ВУЗ": "МУИТ (IITU)",
            "Лаборатория": "Гидро-электролиз Юткина",
            "Доступ": "Администратор (Полный доступ)"
        }
    },
};

// Динамический массив точек
let waterSourcesDatabase = [];

// Получение всех точек
app.get('/api/sources', (req, res) => {
    res.json(waterSourcesDatabase);
});

// Синхронизация базы (если сервер перезагрузился и пуст)
app.post('/api/sources/sync', (req, res) => {
    if (waterSourcesDatabase.length === 0 && Array.isArray(req.body)) {
        waterSourcesDatabase = req.body;
        return res.json({ success: true, message: "База данных успешно инициализирована", count: waterSourcesDatabase.length });
    }
    res.json({ success: true, message: "Синхронизация не требуется", count: waterSourcesDatabase.length });
});

// Добавление новой точки (заявка)
app.post('/api/sources', (req, res) => {
    const { name, type, district, location, lat, lng, ph, mineralization, conductivity, hardness, temp, impurities, author } = req.body;
    
    const newPoint = {
        id: waterSourcesDatabase.length + 1,
        name, type, region: "Алматы", district, location,
        lat: parseFloat(lat) || 0, 
        lng: parseFloat(lng) || 0,
        status: "checking", 
        labChecked: false,
        ph: parseFloat(ph) || 7.0, 
        mineralization: parseInt(mineralization) || 200, 
        conductivity: parseInt(conductivity) || 300, 
        hardness: parseFloat(hardness) || 3.0, 
        temp: parseInt(temp) || 10, 
        impurities: impurities || "Отсутствуют",
        author: author || "Анонимный исследователь",
        date: new Date().toISOString().split('T')[0]
    };

    waterSourcesDatabase.push(newPoint);
    res.json({ success: true, point: newPoint });
});

// Модерация (Одобрить/Отклонить)
app.post('/api/sources/moderate', (req, res) => {
    const { id, status } = req.body;
    const point = waterSourcesDatabase.find(p => p.id === parseInt(id));
    
    if (point) {
        point.status = status; 
        point.labChecked = true;
        return res.json({ success: true, message: `Статус точки ID ${id} изменено на ${status}` });
    }
    res.status(404).json({ success: false, message: "Точка не найдена" });
});

// Повышение прав до модератора (Исправлен роут под фронтенд)
app.post('/api/auth/assign-moderator', (req, res) => {
    const { username } = req.body;
    const user = usersDatabase[username?.toLowerCase().trim()];

    if (user) {
        user.role = "moderator";
        if (user.profile) {
            user.profile["Доступ"] = "Модератор системы";
        }
        return res.json({ success: true, message: `Пользователь ${username} успешно повышен до Модератора!` });
    }
    res.status(404).json({ success: false, message: "Пользователь не зарегистрирован" });
});

// Авторизация
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDatabase[username?.toLowerCase().trim()];
    
    if (user && user.password === password) {
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, role: user.role, profile: user.profile });
    }
    res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// Регистрация
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = username.toLowerCase().trim();

    if (usersDatabase[cleanUsername]) {
        return res.status(400).json({ success: false, message: "Пользователь уже существует" });
    }

    usersDatabase[cleanUsername] = {
        username: cleanUsername,
        password: password,
        role: "student",
        profile: {
            "ФИО": cleanUsername,
            "Статус": "Исследователь (Студент)",
            "Доступ": "Базовый уровень"
        }
    };

    res.json({ success: true, message: "Регистрация прошла успешно!" });
});

// Редактирование параметров источника модератором
app.post('/api/sources/update', (req, res) => {
    const { id, name, type, location, ph, mineralization, conductivity, hardness, temp, impurities } = req.body;
    
    const sourceIndex = waterSourcesDatabase.findIndex(item => item.id === parseInt(id));
    
    if (sourceIndex === -1) {
        return res.status(404).json({ success: false, message: "Источник не найден" });
    }

    // Обновляем поля
    waterSourcesDatabase[sourceIndex] = {
        ...waterSourcesDatabase[sourceIndex],
        name: name || waterSourcesDatabase[sourceIndex].name,
        type: type || waterSourcesDatabase[sourceIndex].type,
        location: location || waterSourcesDatabase[sourceIndex].location,
        ph: parseFloat(ph) || waterSourcesDatabase[sourceIndex].ph,
        mineralization: parseInt(mineralization) || waterSourcesDatabase[sourceIndex].mineralization,
        conductivity: parseInt(conductivity) || waterSourcesDatabase[sourceIndex].conductivity,
        hardness: parseFloat(hardness) || waterSourcesDatabase[sourceIndex].hardness,
        temp: parseInt(temp) || waterSourcesDatabase[sourceIndex].temp,
        impurities: impurities || waterSourcesDatabase[sourceIndex].impurities
    };

    res.json({ success: true, message: "Данные источника успешно обновлены!", data: waterSourcesDatabase[sourceIndex] });
});

// Проверка сессии
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (!token) return res.status(401).json({ success: false, message: "Токен отсутствует" });
    
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ success: false, message: "Невалидный токен" });
        
        const user = usersDatabase[decodedUser.username];
        if (user) {
            res.json({ success: true, role: user.role, profile: user.profile });
        } else {
            res.status(404).json({ success: false, message: "Пользователь не найден" });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
