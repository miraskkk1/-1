const initialSources = [
  // --- АЛМАТЫ И АЛМАТИНСКАЯ ОБЛАСТЬ (Родники и Колонки) ---
  {
    id: 1,
    name: "Родник «Акбулак» (Медеу)",
    type: "Родник",
    region: "Алматы",
    district: "Медеуский район",
    location: "ул. Керей-Жанибек хандар, выше экопоста",
    lat: 43.1945,
    lng: 77.0142,
    status: "suitable", // зелёный
    labChecked: true,
    ph: 7.4,
    mineralization: 180,
    conductivity: 250,
    hardness: 3.2,
    temp: 8,
    impurities: "Отсутствуют",
    author: "Иванов А.П.",
    date: "2026-05-10"
  },
  {
    id: 2,
    name: "Алма-Арасанский термальный источник",
    type: "Минеральный",
    region: "Алматы",
    district: "Бостандыкский район",
    location: "Ущелье Алма-Арасан, возле речки",
    lat: 43.1114,
    lng: 76.9048,
    status: "suitable",
    labChecked: true,
    ph: 8.2,
    mineralization: 320,
    conductivity: 410,
    hardness: 1.5,
    temp: 22,
    impurities: "Следы серы",
    author: "Смагулов Б.К.",
    date: "2026-04-18"
  },
  {
    id: 3,
    name: "Колонка на Ремизовке",
    type: "Колонка",
    region: "Алматы",
    district: "Бостандыкский район",
    location: "пер. Мичурина, возле дома 12",
    lat: 43.1982,
    lng: 76.9385,
    status: "checking", // жёлтый
    labChecked: false,
    ph: 6.8,
    mineralization: 450,
    conductivity: 580,
    hardness: 6.5,
    temp: 11,
    impurities: "Требуется проверка",
    author: "Ким Д.В.",
    date: "2026-06-01"
  },
  {
    id: 4,
    name: "Родник в Бутаковском ущелье",
    type: "Родник",
    region: "Алматы",
    district: "Медеуский район",
    location: "Нижняя терраса ущелья Бутаковка",
    lat: 43.1850,
    lng: 77.0620,
    status: "suitable",
    labChecked: true,
    ph: 7.5,
    mineralization: 195,
    conductivity: 270,
    hardness: 2.8,
    temp: 7,
    impurities: "Отсутствуют",
    author: "Оспанов Е.М.",
    date: "2026-05-12"
  },
  {
    id: 5,
    name: "Скважина Баганашил",
    type: "Скважина",
    region: "Алматы",
    district: "Бостандыкский район",
    location: "ул. Сыргабекова, уч. 45",
    lat: 43.1895,
    lng: 76.9150,
    status: "unsuitable", // красный
    labChecked: true,
    ph: 5.5,
    mineralization: 1200,
    conductivity: 1650,
    hardness: 11.0,
    temp: 14,
    impurities: "Высокое содержание сульфатов",
    author: "Ахметов А.А.",
    date: "2026-03-25"
  },
  {
    id: 6,
    name: "Родник «Святой Ключ»",
    type: "Родник",
    region: "Алматинская область",
    district: "Карасайский район",
    location: "Окрестности посёлка Райымбек",
    lat: 43.1920,
    lng: 76.7320,
    status: "suitable",
    labChecked: true,
    ph: 7.2,
    mineralization: 210,
    conductivity: 310,
    hardness: 3.5,
    temp: 9,
    impurities: "Отсутствуют",
    author: "Пак В.Э.",
    date: "2026-05-20"
  },
  {
    id: 7,
    name: "Городская колонка на Тастаке",
    type: "Колонка",
    region: "Алматы",
    district: "Алмалинский район",
    location: "ул. Васнецова — ул. Дуйсенова",
    lat: 43.2510,
    lng: 76.8820,
    status: "unsuitable",
    labChecked: true,
    ph: 6.2,
    mineralization: 890,
    conductivity: 1100,
    hardness: 8.2,
    temp: 15,
    impurities: "Превышение хлоридов",
    author: "Султанов Р.Т.",
    date: "2026-02-14"
  },
  {
    id: 8,
    name: "Каменское плато — Горный родник",
    type: "Родник",
    region: "Алматы",
    district: "Медеуский район",
    location: "Выше санатория «Каменское Плато»",
    lat: 43.1780,
    lng: 76.9740,
    status: "suitable",
    labChecked: true,
    ph: 7.6,
    mineralization: 150,
    conductivity: 220,
    hardness: 2.1,
    temp: 6,
    impurities: "Отсутствуют",
    author: "Нурланова Г.С.",
    date: "2026-05-29"
  }
];

// Автоматически генерируем еще 42 точки вокруг Алматы, чтобы суммарно вышло 50 (как требует ТЗ)
const types = ["Родник", "Колонка", "Скважина", "Минеральный", "Артезианский"];
const statuses = ["suitable", "checking", "unsuitable"];
const districts = ["Медеуский район", "Бостандыкский район", "Турксибский район", "Ауэзовский район", "Наурызбайский район", "Илийский район"];
const authors = ["Иванов А.П.", "Смагулов Б.К.", "Ким Д.В.", "Ахметов А.А.", "Жаксылыков М.Б.", "Алиева Д.Р."];

for (let i = 9; i <= 50; i++) {
  // Координаты раскидываем небольшим случайным радиусом вокруг Алматы
  const randomLat = 43.15 + (Math.random() - 0.5) * 0.25;
  const randomLng = 76.85 + (Math.random() - 0.5) * 0.35;
  const currentStatus = statuses[i % 3];
  const isChecked = currentStatus !== "checking";
  const currentPh = (6.0 + Math.random() * 2.5).toFixed(1);
  const currentHardness = (1.5 + Math.random() * 8).toFixed(1);

  initialSources.push({
    id: i,
    name: `${types[i % 5]} №${i} в районе ${districts[i % 6]}`,
    type: types[i % 5],
    region: "Алматы",
    district: districts[i % 6],
    location: `Улица Генеральная, объект №${i * 3}`,
    lat: parseFloat(randomLat.toFixed(4)),
    lng: parseFloat(randomLng.toFixed(4)),
    status: currentStatus,
    labChecked: isChecked,
    ph: parseFloat(currentPh),
    mineralization: Math.floor(100 + Math.random() * 900),
    conductivity: Math.floor(150 + Math.random() * 1200),
    hardness: parseFloat(currentHardness),
    temp: Math.floor(5 + Math.random() * 15),
    impurities: currentStatus === "unsuitable" ? "Повышенный осадок солей" : "В пределах нормы",
    author: authors[i % 6],
    date: `2026-05-${10 + (i % 20)}`
  });
}
