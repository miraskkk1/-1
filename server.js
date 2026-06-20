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
    res.json({ success: true, message: "Синхронизация не требуется или неверный формат данных" });
});

// Добавление новой точки
app.post('/api/sources', (req, res) => {
    const { name, type, district, location, lat, lng, ph, mineralization, conductivity, hardness, temp, impurities, author } = req.body;
    
    const newPoint = {
        id: waterSourcesDatabase.length > 0 ? Math.max(...waterSourcesDatabase.map(p => p.id)) + 1 : 1,
        name,
        type,
        district,
        location,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        status: "checking", 
        ph: parseFloat(ph) || 7.0,
        mineralization: parseInt(mineralization) || 0,
        conductivity: parseInt(conductivity) || 0,
        hardness: parseFloat(hardness) || 0,
        temp: parseInt(temp) || 0,
        impurities: impurities || "Нет",
        author: author || "Аноним",
        date: new Date().toISOString().split('T')[0]
    };

    waterSourcesDatabase.push(newPoint);
    res.status(201).json({ success: true, message: "Точка успешно создана и отправлена на модерацию", data: newPoint });
});

// Изменение статуса модератором
app.post('/api/sources/moderate', (req, res) => {
    const { id, status } = req.body;
    const point = waterSourcesDatabase.find(p => p.id === parseInt(id));
    
    if (!point) {
        return res.status(404).json({ success: false, message: "Точка не найдена" });
    }

    point.status = status; 
    res.json({ success: true, message: `Статус точки успешно изменен на ${status}`, data: point });
});

// ФИЧА: Обновление параметров источника модератором
app.post('/api/sources/update', (req, res) => {
    const { id, name, location, ph, mineralization, conductivity, hardness, temp, impurities } = req.body;
    
    const sourceIndex = waterSourcesDatabase.findIndex(item => item.id === parseInt(id));
    
    if (sourceIndex === -1) {
        return res.status(404).json({ success: false, message: "Источник не найден" });
    }

    waterSourcesDatabase[sourceIndex] = {
        ...waterSourcesDatabase[sourceIndex],
        name: name || waterSourcesDatabase[sourceIndex].name,
        location: location || waterSourcesDatabase[sourceIndex].location,
        ph: parseFloat(ph) !== undefined ? parseFloat(ph) : waterSourcesDatabase[sourceIndex].ph,
        mineralization: parseInt(mineralization) !== undefined ? parseInt(mineralization) : waterSourcesDatabase[sourceIndex].mineralization,
        conductivity: parseInt(conductivity) !== undefined ? parseInt(conductivity) : waterSourcesDatabase[sourceIndex].conductivity,
        hardness: parseFloat(hardness) !== undefined ? parseFloat(hardness) : waterSourcesDatabase[sourceIndex].hardness,
        temp: parseInt(temp) !== undefined ? parseInt(temp) : waterSourcesDatabase[sourceIndex].temp,
        impurities: impurities || waterSourcesDatabase[sourceIndex].impurities
    };

    res.json({ success: true, message: "Данные источника успешно обновлены!", data: waterSourcesDatabase[sourceIndex] });
});

// Назначение модератора
app.post('/api/auth/assign-moderator', (req, res) => {
    const { username } = req.body;
    const cleanUsername = username.toLowerCase().trim();

    if (!usersDatabase[cleanUsername]) {
        return res.status(404).json({ success: false, message: "Пользователь с таким логином не найден в системе." });
    }

    usersDatabase[cleanUsername].role = "moderator";
    res.json({ success: true, message: `Пользователю ${username} успешно выданы права модератора.` });
});

// Авторизация
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = username.toLowerCase().trim();

    const user = usersDatabase[cleanUsername];
    if (user && user.password === password) {
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '6h' });
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
            "ФИО": username,
            "Статус": "Исследователь (Студент)",
            "Доступ": "Базовый уровень"
        }
    };

    res.json({ success: true, message: "Регистрация прошла успешно!" });
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
