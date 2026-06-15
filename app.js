const { useState, useEffect, useRef } = React;

function App() {
  // Состояния
  const [sources, setSources] = useState(initialSources);
  const [filteredSources, setFilteredSources] = useState(initialSources);
  const [selectedSource, setSelectedSource] = useState(null);
  
  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Форма добавления новой точки
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPoint, setNewPoint] = useState({
    name: "", type: "Родник", region: "Алматы", district: "", location: "",
    lat: "", lng: "", author: "", ph: 7.0, mineralization: 200
  });

  // Модерация и авторизация
  const [userRole, setUserRole] = useState("guest"); // guest, user, moderator
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Ссылка на инстанс карты Leaflet
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Инициализация карты (Фокус на Алматы)
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([43.2389, 76.8897], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }
  }, []);

  // Обновление маркеров при фильтрации
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    filteredSources.forEach(source => {
      // Цвета меток согласно ТЗ
      let color = 'blue'; // По умолчанию синий
      if (source.status === 'suitable') color = 'green';
      if (source.status === 'checking') color = 'orange'; // жёлтый/оранжевый
      if (source.status === 'unsuitable') color = 'red';

      // Кастомный маркер в виде эмодзи-капли нужного цвета
      const iconHtml = `<span class="custom-pin" style="color: ${color}; text-shadow: 1px 1px 2px #000;">💧</span>`;
      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      const marker = L.marker([source.lat, source.lng], { icon: customIcon });
      
      marker.on('click', () => {
        setSelectedSource(source);
      });

      markersLayerRef.current.addLayer(marker);
    });
  }, [filteredSources]);

  // Логика фильтрации и поиска
  useEffect(() => {
    let result = sources;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.region.toLowerCase().includes(q) || 
        s.district.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "all") {
      result = result.filter(s => s.status === filterStatus);
    }

    if (filterType !== "all") {
      result = result.filter(s => s.type === filterType);
    }

    setFilteredSources(result);
  }, [searchQuery, filterStatus, filterType, sources]);

  // Функция фокусировки карты на источнике
  const focusOnMap = (lat, lng) => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 14);
      window.scrollTo({ top: document.getElementById('map').offsetTop - 20, behavior: 'smooth' });
    }
  };

  // Хендлер добавления источника пользователем
  const handleAddSource = (e) => {
    e.preventDefault();
    const created = {
      ...newPoint,
      id: Date.now(),
      lat: parseFloat(newPoint.lat) || 43.25,
      lng: parseFloat(newPoint.lng) || 76.9,
      status: "checking", // Все новые уходят на модерацию
      labChecked: false,
      hardness: 4.0,
      conductivity: 300,
      temp: 10,
      impurities: "Данные на проверке модератором",
      date: new Date().toISOString().split('T')[0]
    };
    
    setSources([created, ...sources]);
    setShowAddForm(false);
    alert("Источник успешно предложен и отправлен на модерацию!");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Шапка сайта */}
      <header className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-lg p-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">💧 ГИДРО-КАРТА КАЗАХСТАНА</h1>
            <p className="text-xs text-blue-100 mt-1">Интерактивный анализ природных источников для электролиза Юткина</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setUserRole("moderator"); alert("Вы вошли как Модератор!"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${userRole === 'moderator' ? 'bg-yellow-400 text-gray-900' : 'bg-blue-800 hover:bg-blue-900'}`}
            >
              ⚙️ Кабинет модератора
            </button>
            <button 
              onClick={() => setShowAuthModal(true)} 
              className="bg-white text-blue-700 px-4 py-1.5 rounded-full font-medium hover:bg-blue-50 text-sm shadow-sm"
            >
              {userRole === 'guest' ? 'Войти в систему' : `Профиль (${userRole})`}
            </button>
          </div>
        </div>
      </header>

      {/* Контентная область */}
      <main className="container mx-auto p-4 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Левая панель: Поиск, Фильтры и Список */}
        <div className="lg:col-span-1 flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-700 border-b pb-2">🔍 Поиск и фильтрация</h2>
          
          <input 
            type="text" 
            placeholder="Поиск по названию, району..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none"
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-gray-500 font-medium mb-1">Статус электролиза</label>
              <select className="w-full p-2 border rounded-md bg-gray-50" onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Все статусы</option>
                <option value="suitable">💚 Подходит</option>
                <option value="checking">💛 Проверяется</option>
                <option value="unsuitable">❤️ Не подходит</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-500 font-medium mb-1">Тип источника</label>
              <select className="w-full p-2 border rounded-md bg-gray-50" onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Все типы</option>
                <option value="Родник">Родники</option>
                <option value="Колонка">Колонки</option>
                <option value="Скважина">Скважины</option>
                <option value="Минеральный">Минеральные</option>
                <option value="Артезианский">Артезианские</option>
              </select>
            </div>
          </div>

          <button 
            onClick={() => setShowAddForm(true)}
            className="w-full bg-cyan-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 transition mt-2"
          >
            ➕ Предложить новый источник
          </button>

          {/* Список отфильтрованных источников */}
          <div className="mt-2 border-t pt-3 flex-grow overflow-y-auto max-h-[380px] space-y-2 pr-1">
            <p className="text-xs font-semibold text-gray-400 uppercase">Найдено объектов: {filteredSources.length}</p>
            {filteredSources.map(s => (
              <div 
                key={s.id} 
                onClick={() => { setSelectedSource(s); focusOnMap(s.lat, s.lng); }}
                className={`p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${selectedSource?.id === s.id ? 'border-blue-500 bg-blue-50/50' : 'hover:bg-gray-50'}`}
              >
                <div>
                  <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{s.name}</h4>
                  <p className="text-xs text-gray-500">{s.district}, {s.type}</p>
                </div>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.status === 'suitable' ? 'bg-green-500' : s.status === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
              </div>
            ))}
          </div>
        </div>

        {/* Правая панель: Интерактивная карта и Карточка */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* Интерактивная карта */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <div id="map"></div>
          </div>

          {/* Карточка детальной информации выбранного источника */}
          {selectedSource ? (
            <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-blue-600 border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">{selectedSource.type}</span>
                <h3 className="text-xl font-bold text-gray-800 mt-2">{selectedSource.name}</h3>
                <p className="text-sm text-gray-600 mt-1">📍 {selectedSource.region}, {selectedSource.district}, {selectedSource.location}</p>
                <p className="text-xs text-gray-400 mt-1">🌐 GPS Координаты: {selectedSource.lat}, {selectedSource.lng}</p>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs space-y-1 text-gray-600">
                  <p><strong>Дата замера:</strong> {selectedSource.date}</p>
                  <p><strong>Исследователь:</strong> {selectedSource.author}</p>
                  <p><strong>Лабораторный статус:</strong> {selectedSource.labChecked ? "🔬 Исследование выполнено" : "⏳ На валидации"}</p>
                </div>
              </div>

              {/* Анализ показателей воды */}
              <div className="flex flex-col justify-between bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-2">📊 Лабораторные замеры воды:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded shadow-2xs"><strong>Кислотность (pH):</strong> {selectedSource.ph}</div>
                    <div className="bg-white p-2 rounded shadow-2xs"><strong>Минерализация:</strong> {selectedSource.mineralization} мг/л</div>
                    <div className="bg-white p-2 rounded shadow-2xs"><strong>Проводимость:</strong> {selectedSource.conductivity} мкСм</div>
                    <div className="bg-white p-2 rounded shadow-2xs"><strong>Жёсткость:</strong> {selectedSource.hardness: 'suitable' ? (
                    <div className="bg-green-100 text-green-800 p-2.5 rounded-lg font-bold text-xs text-center border border-green-200">
                      ✅ Подходит для получения живой и мёртвой воды методом электролиза.
                    </div>
                  ) : selectedSource.status === 'checking' ? (
                    <div className="bg-yellow-100 text-yellow-800 p-2.5 rounded-lg font-bold text-xs text-center border border-yellow-200">
                      ⚠️ Статус уточняется. Требуется повторный анализ.
                    </div>
                  ) : (
                    <div className="bg-red-100 text-red-800 p-2.5 rounded-lg font-bold text-xs text-center border border-red-200">
                      ❌ Не рекомендуется для электролиза! Избыток примесей.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500 text-sm">
              👈 Выберите любой источник на карте или в списке слева, чтобы открыть развёрнутую лабораторную карточку показателей.
            </div>
          )}

          {/* Финансовая поддержка (Kaspi) */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h4 className="font-bold text-gray-800 text-sm">🧪 Поддержать исследование новых источников</h4>
              <p className="text-xs text-gray-600 mt-0.5">Стоимость полного лабораторного химического анализа одного образца воды составляет около <strong>20 000 тенге</strong>.</p>
            </div>
            <button 
              onClick={() => alert("Симуляция интеграции: Открытие Kaspi QR / Оплата картой...")}
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm whitespace-nowrap transition"
            >
              📱 Оплатить через Kaspi QR
            </button>
          </div>
        </div>
      </main>

      {/* Раздел: 56 Исследователей проекта */}
      <section className="bg-white border-t border-gray-200 mt-8 p-6">
        <div className="container mx-auto">
          <h3 className="text-lg font-bold text-gray-800 mb-1">🎓 Раздел участников: «56 исследователей проекта»</h3>
          <p className="text-xs text-gray-500 mb-4">Студенты и молодые учёные вузов Казахстана, собравшие и доставившие пробы воды в сертифицированные лаборатории.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[160px] overflow-y-auto pr-2">
            {[...Array(56)].map((_, i) => (
              <div key={i} className="bg-gray-50 p-2 rounded border border-gray-100 text-[11px]">
                <p className="font-bold text-gray-700">Студент {i + 1}</p>
                <p className="text-gray-500">Регион: {i % 2 === 0 ? "Алматы" : "Алматинская обл."}</p>
                <p className="text-blue-600 font-semibold">Проб: {1 + (i % 4)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Подвал и генерация QR для аппаратов */}
      <footer className="bg-gray-900 text-gray-400 text-xs py-6 mt-auto border-t border-gray-800">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <p>© 2026 Национальный реестр природных источников воды Республики Казахстан.</p>
            <p className="text-gray-600 mt-0.5">Разработано в научных целях.</p>
          </div>
          <div className="bg-white p-2 rounded-lg flex items-center gap-2 border border-gray-700">
            <div className="w-10 h-10 bg-gray-300 flex items-center justify-center text-gray-900 font-bold text-[8px] text-center border">QR-код</div>
            <p className="text-gray-900 text-[10px] font-medium max-w-[150px]">Скан на аппаратах электролиза: моментальный просмотр карты без регистрации</p>
          </div>
        </div>
      </footer>

      {/* Модальное окно: Добавить источник */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <form onSubmit={handleAddSource} className="bg-white p-5 rounded-xl max-w-md w-full shadow-2xl space-y-3">
            <h3 className="text-lg font-bold text-gray-800">➕ Предложить источник воды</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Название источника</label>
              <input type="text" required placeholder="Например: Родник Акку" className="w-full p-2 border rounded text-sm" onChange={e => setNewPoint({...newPoint, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Широта (Lat)</label>
                <input type="number" step="0.0001" required placeholder="43.2389" className="w-full p-2 border rounded text-sm" onChange={e => setNewPoint({...newPoint, lat: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Долгота (Lng)</label>
                <input type="number" step="0.0001" required placeholder="76.8897" className="w-full p-2 border rounded text-sm" onChange={e => setNewPoint({...newPoint, lng: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Адрес / Описание проезда</label>
              <input type="text" required placeholder="Ущелье такое-то, 200м от дороги" className="w-full p-2 border rounded text-sm" onChange={e => setNewPoint({...newPoint, location: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Ваше ФИО</label>
                <input type="text" required placeholder="Алиев Н." className="w-full p-2 border rounded text-sm" onChange={e => setNewPoint({...newPoint, author: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Район Алматы</label>
                <input type="text" required placeholder="Медеуский" className="w-full p-2 border rounded text-sm" onChange={e => setNewPoint({...newPoint, district: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-xs border rounded text-gray-500 hover:bg-gray-50">Отмена</button>
              <button type="submit" className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded">Отправить на модерацию</button>
            </div>
          </form>
        </div>
      )}

      {/* Модальное окно авторизации */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white p-5 rounded-xl max-w-xs w-full text-center space-y-4">
            <h3 className="font-bold text-gray-800">Вход в систему</h3>
            <button onClick={() => { setUserRole("GoogleUser"); setShowAuthModal(false); }} className="w-full bg-red-500 text-white text-xs py-2 rounded font-semibold hover:bg-red-600">Вход через Google</button>
            <button onClick={() => { setUserRole("TelegramUser"); setShowAuthModal(false); }} className="w-full bg-blue-500 text-white text-xs py-2 rounded font-semibold hover:bg-blue-600">Вход через Telegram</button>
            <button onClick={() => setShowAuthModal(false)} className="w-full bg-gray-200 text-gray-700 text-xs py-1.5 rounded">Закрыть</button>
          </div>
        </div>
      )}

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
