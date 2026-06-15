const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'SUPER_SECRET_KEY_KAZAKHSTAN_2026'; 

app.use(cors()); 
app.use(express.json());

// НАША ДИНАМИЧЕСКАЯ БАЗА ДАННЫХ (хранится в оперативной памяти)
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
    }
};

// 1. МАРШРУТ РЕГИСТРАЦИИ СТУДЕНТА (НОВЫЙ)
app.post('/api/auth/register', (req, res) => {
    const { username, password, fio, age, university, specialty, course } = req.body;

    if (!username || !password || !fio || !university) {
        return res.status(400).json({ success: false, message: "Заполните обязательные поля" });
    }

    // Проверяем, существует ли уже пользователь с таким логином
    if (usersDatabase[username.toLowerCase()]) {
        return res.status(400).json({ success: false, message: "Этот логин уже занят" });
    }

    // Сохраняем нового студента в базу данных
    usersDatabase[username.toLowerCase()] = {
        username: username.toLowerCase(),
        password: password, // В пет-проектах допускается хранение строкой
        role: "student",
        profile: {
            "ФИО": fio,
            "Возраст": `${age} лет`,
            "Университет": university,
            "Специальность": specialty,
            "Курс обучения": `${course} курс`,
            "Статус": "Студент-исследователь",
            "Образцы": "0 принесено (Новый аккаунт)"
        }
    };

    return res.json({ success: true, message: "Пользователь успешно зарегистрирован" });
});

// 2. МАРШРУТ АВТОРИЗАЦИИ (LOGIN)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username) return res.status(400).json({ success: false, message: "Введите логин" });
    
    const user = usersDatabase[username.toLowerCase()];
    
    if (user && user.password === password) {
        const token = jwt.sign(
            { username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        return res.json({
            success: true,
            token: token,
            role: user.role,
            profile: user.profile
        });
    }
    
    return res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// 3. ЗАЩИЩЕННЫЙ МАРШРУТ ПРОВЕРКИ ТОКЕНА
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Токен отсутствует или неверного формата" });
    }
    
    const token = authHeader.split(' ')[1]; 
    
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ success: false, message: "Невалидный или просроченный токен" });
        
        const user = usersDatabase[decodedUser.username];
        if (!user) return res.status(404).json({ success: false, message: "Пользователь не найден" });

        res.json({
            success: true,
            role: user.role,
            profile: user.profile
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
