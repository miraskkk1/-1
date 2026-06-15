// 2. ЗАЩИЩЕННЫЙ МАРШРУТ ПРОВЕРКИ ТОКЕНА (ПРИ ОБНОВЛЕНИИ СТРАНИЦЫ)
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
