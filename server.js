const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'SUPER_SECRET_KEY_KAZAKHSTAN_2026'; 

app.use(cors()); 
app.use(express.json());

// 1. БАЗА ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ (В памяти сервера)
const usersDatabase = {
    "admin": {
        username: "mirasknly",
        password: "kanatuly", 
        role: "moderator",
        profile: {
            "ФИО": "Канатулы Мирас",
            "Статус": "PhD в области электротехники",
            "ВУЗ": "МУИТ (IITU)",
            "Лаборатория": "Гидро-электролиз Юткина",
            "Доступ": "Администратор (Полный доступ)"
        }
    }
};

// 2. СТАТИЧЕСКАЯ БАЗА ДАННЫХ ИСТОЧНИКОВ (Реальные координаты + 42 зафиксированные точки)
// Теперь они никогда не изменятся случайным образом!
const waterSourcesDatabase = [
  { id: 1, name: "Родник «Акбулак» (Медеу)", type: "Родник", region: "Алматы", district: "Медеуский район", location: "ул. Керей-Жанибек хандар, выше экопоста", lat: 43.1945, lng: 77.0142, status: "suitable", ph: 7.4, mineralization: 180, conductivity: 250, hardness: 3.2, temp: 8, impurities: "Отсутствуют", author: "Канатулы М.", date: "2026-05-10" },
  { id: 2, name: "Алма-Арасанский термальный источник", type: "Минеральный", region: "Алматы", district: "Бостандыкский район", location: "Ущелье Алма-Арасан, возле речки", lat: 43.1114, lng: 76.9048, status: "suitable", ph: 8.2, mineralization: 320, conductivity: 410, hardness: 1.8, temp: 21, impurities: "Сероводород (микро)", author: "Иванов А.П.", date: "2026-05-12" },
  { id: 3, name: "Родник «Бутаковка»", type: "Родник", region: "Алматы", district: "Медеуский район", location: "Бутаковское ущелье, 2 км выше шлагбаума", lat: 43.1850, lng: 77.0620, status: "checking", ph: 6.9, mineralization: 140, conductivity: 190, hardness: 4.1, temp: 6, impurities: "Органические взвеси", author: "Смагулов Б.К.", date: "2026-06-01" },
  { id: 4, name: "Колонка общего пользования (Татарка)", type: "Колонка", region: "Алматы", district: "Медеуский район", location: "ул. Сервантеса — ул. Крымская", lat: 43.2712, lng: 76.9745, status: "unsuitable", ph: 5.8, mineralization: 490, conductivity: 680, hardness: 9.5, temp: 12, impurities: "Повышенный сульфатный осадок", author: "Ким Д.В.", date: "2026-05-20" },
  { id: 5, name: "Артезианская скважина «Каменское плато»", type: "Артезианский", region: "Алматы", district: "Медеуский район", location: "Санаторий за обсерваторией", lat: 43.1780, lng: 76.9450, status: "suitable", ph: 7.6, mineralization: 210, conductivity: 290, hardness: 2.8, temp: 11, impurities: "Отсутствуют", author: "Канатулы М.", date: "2026-05-25" },
  { id: 6, name: "Городская колонка (Малая станица)", type: "Колонка", region: "Алматы", district: "Медеуский район", location: "ул. Ирченко, угол ул. Халлиулина", lat: 43.2655, lng: 76.9890, status: "checking", ph: 7.1, mineralization: 280, conductivity: 340, hardness: 5.4, temp: 13, impurities: "Следы ржавчины", author: "Ахметов А.А.", date: "2026-06-11" },
  { id: 7, name: "Родник в Парке Первого Президента", type: "Родник", region: "Алматы", district: "Бостандыкский район", location: "Южная граница парка, ближе к горам", lat: 43.1890, lng: 76.8870, status: "suitable", ph: 7.2, mineralization: 165, conductivity: 220, hardness: 3.0, temp: 9, impurities: "Отсутствуют", author: "Жаксылыков М.Б.", date: "2026-06-14" },
  { id: 8, name: "Скважина «Ремизовка»", type: "Скважина", region: "Алматы", district: "Бостандыкский район", location: "пер. Веселый, частный сектор", lat: 43.1640, lng: 76.9280, status: "unsuitable", ph: 6.2, mineralization: 550, conductivity: 790, hardness: 8.2, temp: 10, impurities: "Кальциты, железо", author: "Алиева Д.Р.", date: "2026-06-03" }
];

// Автоматически генерируем остальные точки до 50 штук, но СТРОГО один раз при запуске бэкенда!
// Локации привязаны к сетке шагов, поэтому прыгать при обновлении страницы они больше не будут.
const types = ["Родник", "Колонка", "Скважина", "Минеральный", "Артезианские"];
const statuses = ["suitable", "checking", "unsuitable"];
const districts = ["Медеуский район", "Бостандыкский район", "Турксибский район", "Ауэзовский район", "Наурызбайский район", "Илийский район"];

if (waterSourcesDatabase.length < 50) {
    for (let i = 9; i <= 50; i++) {
        // Фиксированная сетка шагов вместо Math.random()
        const latStep = (i * 0.0043) % 0.15;
        const lngStep = (i * 0.0057) % 0.22;
        
        waterSourcesDatabase.push({
            id: i,
            name: `${types[i % 5]} №${i} (${districts[i % 6]})`,
            type: types[i % 5],
            region: "Алматы",
            district: districts[i % 6],
            location: `Улица Инженерная, сектор замера №${i * 2}`,
            lat: parseFloat((43.18 + latStep).toFixed(4)),
            lng: parseFloat((76.82 + lngStep).toFixed(4)),
            status: statuses[i % 3],
            ph: (6.5 + (i % 4) * 0.4).toFixed(1),
            mineralization: 150 + (i * 7),
            conductivity: 200 + (i * 9),
            hardness: (2.0 + (i % 5) * 1.2).toFixed(1),
            temp: 7 + (i % 8),
            impurities: i % 3 === 0 ? "Песчаный осадок" : "Отсутствуют",
            author: "Студент-Лаборант",
            date: "2026-06-15"
        });
    }
}

// МАРШРУТ ПОЛУЧЕНИЯ ВСЕХ ТОЧЕК ДЛЯ КАРТЫ
app.get('/api/sources', (req, res) => {
    res.json(waterSourcesDatabase);
});

// МАРШРУТ РЕГИСТРАЦИИ СТУДЕНТА
app.post('/api/auth/register', (req, res) => {
    const { username, password, fio, age, university, specialty, course } = req.body;
    if (!username || !password || !fio || !university) {
        return res.status(400).json({ success: false, message: "Заполните обязательные поля" });
    }
    if (usersDatabase[username.toLowerCase()]) {
        return res.status(400).json({ success: false, message: "Этот логин уже занят" });
    }

    usersDatabase[username.toLowerCase()] = {
        username: username.toLowerCase(),
        password: password,
        role: "student",
        profile: {
            "ФИО": fio, "Возраст": `${age} лет`, "Университет": university,
            "Специальность": specialty, "Курс обучения": `${course} курс`,
            "Статус": "Студент-исследователь", "Образцы": "0 принесено"
        }
    };
    return res.json({ success: true, message: "Регистрация успешна" });
});

// МАРШРУТ АВТОРИЗАЦИИ (LOGIN)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDatabase[username?.toLowerCase()];
    
    if (user && user.password === password) {
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, role: user.role, profile: user.profile });
    }
    return res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// ЗАЩИЩЕННЫЙ МАРШРУТ ПРОВЕРКИ ТОКЕНА
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Токен отсутствует" });
    }
    const token = authHeader.split(' ')[1]; 
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ success: false, message: "Сессия истекла" });
        const user = usersDatabase[decodedUser.username];
        if (!user) return res.status(404).json({ success: false, message: "Пользователь не найден" });
        res.json({ success: true, role: user.role, profile: user.profile });
    });
});

app.listen(PORT, () => console.log(`Сервер успешно запущен на порту ${PORT}`));
