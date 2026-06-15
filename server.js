const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'SUPER_SECRET_KEY_KAZAKHSTAN_2026'; 

app.use(cors()); 
app.use(express.json());

// 1. ИМИТАЦИЯ БАЗЫ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ (Поля синхронизированы с UI)
const usersDatabase = {
    "admin": {
        username: "admin",
        password: "123", 
        role: "moderator",
        profile: {
            "ФИО": "Канатулы Мирас",
            "Статус": "PhD в области электротехники",
            "ВУЗ": "МУИТ (IITU)",
            "Лаборатория": "Гидро-электролиз Юткина",
            "Доступ": "Администратор (Полный доступ)"
        }
    },
    "student1": {
        username: "student1",
        password: "123",
        role: "student",
        profile: {
            "ФИО": "Асхат Бахытжан",
            "ВУЗ": "МУИТ (IITU)",
            "Специальность": "Вычислительная техника",
            "Курс": "3 курс",
            "Доступ": "Студент"
        }
    }
};

// 2. ДИНАМИЧЕСКИЙ МАССИВ ТОЧЕК НА БЭКЕНДЕ
let waterSourcesDatabase = [];

// ПОЛУЧЕНИЕ ВСЕХ ТОЧЕК
app.get('/api/sources', (req, res) => {
    res.json(waterSourcesDatabase);
});

// СИНХРОНИЗАЦИЯ БАЗЫ (Если на сервере пусто, фронт скинет свои базовые точки из data.js)
app.post('/api/sources/sync', (req, res) => {
    if (waterSourcesDatabase.length === 0 && Array.isArray(req.body)) {
        waterSourcesDatabase = req.body;
        return res.json({ success: true, message: "База данных бэкенда успешно инициализирована точками!", count: waterSourcesDatabase.length });
    }
    res.json({ success: true, message: "Синхронизация не требуется", count: waterSourcesDatabase.length });
});

// ДОБАВЛЕНИЕ НОВОЙ ТОЧКИ (Заявка от исследователя)
app.post('/api/sources', (req, res) => {
    const { name, type, district, location, lat, lng, ph, mineralization, conductivity, hardness, temp, impurities, author } = req.body;
    
    const newPoint = {
        id: waterSourcesDatabase.length + 1,
        name, type, region: "Алматы", district, location,
        lat: parseFloat(lat), lng: parseFloat(lng),
        status: "checking", 
        labChecked: false,
        ph: parseFloat(ph) || 7.0, 
        mineralization: parseInt(mineralization) || 200, 
        conductivity: parseInt(conductivity) || 300, 
        hardness: parseFloat(hardness) || 3.0, 
        temp: parseInt(temp) || 10, 
        impurities: impurities || "Отсутствуют",
        author: author || "Анонимный лаборант",
        date: new Date().toISOString().split('T')[0]
    };

    waterSourcesDatabase.push(newPoint);
    res.json({ success: true, point: newPoint });
});

// МОДЕРАЦИЯ (Одобрение или Отклонение точки)
app.post('/api/sources/moderate', (req, res) => {
    const { id, status } = req.body;
    const point = waterSourcesDatabase.find(p => p.id === parseInt(id));
    
    if (point) {
        point.status = status; 
        point.labChecked = true;
        return res.json({ success: true, message: `Статус точки ID ${id} изменен на ${status}` });
    }
    res.status(404).json({ success: false, message: "Точка не найдена" });
});

// НАЗНАЧЕНИЕ НОВОГО МОДЕРАТОРА
app.post('/api/auth/make-moderator', (req, res) => {
    const { username } = req.body;
    const user = usersDatabase[username?.toLowerCase().trim()];

    if (user) {
        user.role = "moderator";
        if (user.profile) {
            user.profile["Доступ"] = "Модератор системы";
        }
        return res.json({ success: true, message: `Пользователь ${username} успешно повышен до Модератора!` });
    }
    res.status(404).json({ success: false, message: "Пользователь с таким логином не зарегистрирован" });
});

// АВТЕНТИФИКАЦИЯ (ВХОД)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDatabase[username?.toLowerCase().trim()];
    
    if (user && user.password === password) {
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, role: user.role, profile: user.profile });
    }
    res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// ПРОВЕРКА СЕССИИ (ME)
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
