const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'SUPER_SECRET_KEY_KAZAKHSTAN_2026'; // Ключ для шифрования токенов

app.use(cors()); // Разрешаем фронтенду делать запросы к бэкенду
app.use(express.json());

// ИМИТАЦИЯ СЛОЖНОЙ БАЗЫ ДАННЫХ (Расширенные профили из ТЗ)
const usersDatabase = {
    "admin": {
        username: "admin",
        password: "123", 
        role: "moderator",
        profile: {
            fio: "Канатулы Мирас",
            degree: "PhD в области электротехники",
            university: "МУИТ (IITU)",
            department: "Лаборатория гидро-электролиза Юткина",
            managedPointsCount: 50,
            accessLevel: "Полный доступ (Администратор системы)"
        }
    },
    "student1": {
        username: "student1",
        password: "123",
        role: "student",
        profile: {
            fio: "Асхат Бахытжан",
            university: "МУИТ (IITU)",
            specialty: "Вычислительная техника",
            course: 3,
            broughtSamples: 4,
            assignedRegion: "Алматы, Бостандыкский район",
            rating: "Активный исследователь"
        }
    },
    "student2": {
        username: "student2",
        password: "123",
        role: "student",
        profile: {
            fio: "Диана Серикова",
            university: "КазНУ им. аль-Фараби",
            specialty: "Гидрология",
            course: 4,
            broughtSamples: 2,
            assignedRegion: "Алматинская область, Талгарский район",
            rating: "Лаборант-стажер"
        }
    }
};

// 1. МАРШРУТ АВТОРИЗАЦИИ (LOGIN)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = usersDatabase[username];
    
    if (user && user.password === password) {
        // Создаем токен, зашифровав в него имя и роль (токен активен 24 часа)
        const token = jwt.sign(
            { username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        // Возвращаем токен и полную информацию о профиле
        return res.json({
            success: true,
            token: token,
            role: user.role,
            profile: user.profile
        });
    }
    
    return res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// 2. ЗАЩИЩЕННЫЙ МАРШРУТ ПРОВЕРКИ ТОКЕНА (ПРИ ОБНОВЛЕНИИ СТРАНИЦЫ)
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Извлекаем "Bearer TOKEN"
    
    if (!token) return res.status(401).json({ success: false, message: "Токен отсутствует" });
    
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ success: false, message: "Невалидный или просроченный токен" });
        
        // Если токен верный, берем свежие данные профиля из БД
        const user = usersDatabase[decodedUser.username];
        res.json({
            success: true,
            role: user.role,
            profile: user.profile
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
