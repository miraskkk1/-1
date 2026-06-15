const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'SUPER_SECRET_KEY_KAZAKHSTAN_2026'; 

app.use(cors()); 
app.use(express.json());

// 1. ИМИТАЦИЯ БАЗЫ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ
const usersDatabase = {
    "admin": {
        username: "miras",
        password: "kanatuly", 
        role: "moderator",
        profile: {
            "ФИО": "Канатулы Мирас",
            "Статус": "IT-IS2506",
            "ВУЗ": "МУИТ (IITU)",
            "Лаборатория": "Гидро-электролиз Юткина",
            "Доступ": "Администратор (Полный доступ)"
        }
    }
};

// 2. СТАТИЧЕСКАЯ БАЗА ДАННЫХ ИСТОЧНИКОВ
const waterSourcesDatabase = [
  { id: 1, name: "Родник «Акбулак» (Медеу)", type: "Родник", region: "Алматы", district: "Медеуский район", location: "ул. Керей-Жанибек хандар, выше экопоста", lat: 43.1945, lng: 77.0142, status: "suitable", ph: 7.4, mineralization: 180, conductivity: 250, hardness: 3.2, temp: 8, impurities: "Отсутствуют", author: "Канатулы М.", date: "2026-05-10" },
  { id: 2, name: "Алма-Арасанский термальный источник", type: "Минеральный", region: "Алматы", district: "Бостандыкский район", location: "Ущелье Алма-Арасан, возле речки", lat: 43.1114, lng: 76.9048, status: "suitable", ph: 8.2, mineralization: 320, conductivity: 410, hardness: 1.8, temp: 21, impurities: "Сероводород (микро)", author: "Иванов А.П.", date: "2026-05-12" },
  { id: 3, name: "Родник «Бутаковка»", type: "Родник", region: "Алматы", district: "Медеуский район", location: "Бутаковское ущелье, 2 км выше шлагбаума", lat: 43.1850, lng: 77.0620, status: "checking", ph: 6.9, mineralization: 140, conductivity: 190, hardness: 4.1, temp: 6, impurities: "Органические взвеси", author: "Смагулов Б.К.", date: "2026-06-01" },
  { id: 4, name: "Колонка общего пользования (Татарка)", type: "Колонка", region: "Алматы", district: "Медеуский район", location: "ул. Сервантеса — ул. Крымская", lat: 43.2712, lng: 76.9745, status: "unsuitable", ph: 5.8, mineralization: 490, conductivity: 680, hardness: 9.5, temp: 12, impurities: "Повышенный сульфатный осадок", author: "Ким Д.В.", date: "2026-05-20" }
];

// Генерация базовых точек (до 30 для компактности примера, можно увеличить)
const types = ["Родник", "Колонка", "Скважина", "Минеральный", "Артезианский"];
const statuses = ["suitable", "checking", "unsuitable"];
const districts = ["Медеуский район", "Бостандыкский район", "Турксибский район", "Ауэзовский район", "Наурызбайский район", "Алмалинский район"];

if (waterSourcesDatabase.length < 30) {
    for (let i = 5; i <= 30; i++) {
        const radiusLat = 0.06 * Math.sin(i * 1.7); 
        const radiusLng = 0.09 * Math.cos(i * 2.3); 
        waterSourcesDatabase.push({
            id: i,
            name: `${types[i % 5]} №${i}`,
            type: types[i % 5],
            region: "Алматы",
            district: districts[i % 6],
            location: `Сектор замера №${i * 2}`,
            lat: parseFloat((43.22 + radiusLat).toFixed(4)),
            lng: parseFloat((76.89 + radiusLng).toFixed(4)),
            status: statuses[i % 3],
            ph: (6.5 + (i % 4) * 0.4).toFixed(1),
            mineralization: 150 + (i * 7),
            conductivity: 200 + (i * 9),
            hardness: (2.0 + (i % 5) * 1.2).toFixed(1),
            temp: 7 + (i % 8),
            impurities: "Отсутствуют",
            author: "Система",
            date: "2026-06-15"
        });
    }
}

// ПОЛУЧЕНИЕ ВСЕХ ТОЧЕК
app.get('/api/sources', (req, res) => {
    res.json(waterSourcesDatabase);
});

// ДОБАВЛЕНИЕ НОВОЙ ТОЧКИ (Студентом или гостем)
app.post('/api/sources', (req, res) => {
    const { name, type, district, location, lat, lng, ph, mineralization, conductivity, hardness, temp, impurities, author } = req.body;
    
    const newPoint = {
        id: waterSourcesDatabase.length + 1,
        name, type, region: "Алматы", district, location,
        lat: parseFloat(lat), lng: parseFloat(lng),
        status: "checking", // По умолчанию всегда отправляется на проверку!
        ph, mineralization, conductivity, hardness, temp, impurities,
        author: author || "Анонимный исследователь",
        date: new Date().toISOString().split('T')[0]
    };

    waterSourcesDatabase.push(newPoint);
    res.json({ success: true, point: newPoint });
});

// МОДЕРАЦИЯ ТОЧКИ (Изменение статуса)
app.post('/api/sources/moderate', (req, res) => {
    const { id, status } = req.body;
    const point = waterSourcesDatabase.find(p => p.id === parseInt(id));
    
    if (point) {
        point.status = status; // suitable или unsuitable
        return res.json({ success: true, message: `Статус точки ID ${id} изменен на ${status}` });
    }
    res.status(404).json({ success: false, message: "Точка не найдена" });
});

// НАЗНАЧЕНИЕ НОВОГО МОДЕРАТОРА
app.post('/api/auth/make-moderator', (req, res) => {
    const { username } = req.body;
    const user = usersDatabase[username?.toLowerCase()];

    if (user) {
        user.role = "moderator";
        if (user.profile) {
            user.profile["Доступ"] = "Модератор системы";
            user.profile["Статус"] = "Проверенный лаборант";
        }
        return res.json({ success: true, message: `Пользователь ${username} успешно назначен модератором!` });
    }
    res.status(404).json({ success: false, message: "Пользователь с таким логином не найден в системе" });
});

// АВТЕНТИФИКАЦИЯ И СЕССИИ
app.post('/api/auth/register', (req, res) => {
    const { username, password, fio, age, university, specialty, course } = req.body;
    if (usersDatabase[username.toLowerCase()]) return res.status(400).json({ success: false, message: "Логин занят" });

    usersDatabase[username.toLowerCase()] = {
        username: username.toLowerCase(), password, role: "student",
        profile: {
            "ФИО": fio, "Возраст": `${age} лет`, "ВУЗ": university,
            "Специальность": specialty, "Курс": `${course} курс`, "Доступ": "Студент"
        }
    };
    res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDatabase[username?.toLowerCase()];
    if (user && user.password === password) {
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, role: user.role, profile: user.profile });
    }
    res.status(401).json({ success: false, message: "Неверные данные" });
});

app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false });
        const user = usersDatabase[decoded.username];
        res.json({ success: true, role: user.role, profile: user.profile });
    });
});

app.listen(PORT, () => console.log(`Запущен на порту ${PORT}`));
