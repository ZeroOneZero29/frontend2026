const API_KEY = '43237f08d27e33cc2503ec2e4a7e2b35'; // Вставьте сюда ваш API ключ
const API_URL = 'https://api.openweathermap.org/data/2.5/forecast';

// Элементы DOM
const weatherForm = document.getElementById('weather-form');
const cityInput = document.getElementById('city-input');
const weatherResults = document.getElementById('weather-results');
const historyList = document.getElementById('history-list');
const lastRequestTimeEl = document.getElementById('last-request-time');
const updateBtn = document.getElementById('update-btn');
const loader = document.getElementById('loader');

// Состояние
let lastRequestTime = null;
let currentCity = null;
let checkInterval = null;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  startStaleCheck();
});

// Обработка отправки формы
weatherForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) {
    fetchWeather(city);
  }
});

// Кнопка обновления
updateBtn.addEventListener('click', () => {
  if (currentCity) {
    fetchWeather(currentCity, true);
  }
});

// Основная функция запроса погоды
async function fetchWeather(city, isUpdate = false) {
  showLoader(true);
  // Скрываем старый заголовок города во время загрузки
  document.getElementById('current-city-title').classList.add('hidden');

  try {
    const response = await fetch(
      `${API_URL}?q=${city}&appid=${API_KEY}&units=metric&lang=ru`
    );

    if (!response.ok) {
      throw new Error('Город не найден или ошибка API');
    }

    const data = await response.json();

    // Получаем нормализованное название города от самого API (например, "Москва" вместо "msk")
    const cityName = data.city.name;
    currentCity = cityName;

    // Сохраняем время запроса
    lastRequestTime = Date.now();
    updateTimeDisplay();

    // Добавляем в историю
    addToHistory(cityName);

    // Обрабатываем и отображаем данные
    const dailyData = processForecastData(data.list);
    renderWeather(dailyData, cityName); // Передаем cityName
  } catch (error) {
    alert(
      'Ошибка: ' + error.message + '. Проверьте название города или API ключ.'
    );
  } finally {
    showLoader(false);
  }
}

// Группировка данных по дням (из 3-часовых интервалов в дневные)
function processForecastData(list) {
  const dailyMap = {};

  list.forEach((item) => {
    const date = item.dt_txt.split(' ')[0]; // "YYYY-MM-DD"
    if (!dailyMap[date]) {
      dailyMap[date] = {
        temps: [],
        humidities: [],
        winds: [],
        pops: [],
        status: item.weather[0].description,
        icon: item.weather[0].icon,
      };
    }

    dailyMap[date].temps.push(item.main.temp);
    dailyMap[date].humidities.push(item.main.humidity);
    dailyMap[date].winds.push(item.wind.speed);
    dailyMap[date].pops.push(item.pop || 0); // pop может отсутствовать, тогда 0

    // Берем статус погоды ближе к полудню (12:00:00) для репрезентативности
    if (item.dt_txt.includes('12:00:00')) {
      dailyMap[date].status = item.weather[0].description;
      dailyMap[date].icon = item.weather[0].icon;
    }
  });

  // Преобразуем объект в массив и берем первые 5 дней
  return Object.keys(dailyMap)
    .slice(0, 5)
    .map((date) => {
      const day = dailyMap[date];
      return {
        date: formatDate(date),
        status: capitalize(day.status),
        minTemp: Math.round(Math.min(...day.temps)),
        maxTemp: Math.round(Math.max(...day.temps)),
        humidity: Math.round(
          day.humidities.reduce((a, b) => a + b, 0) / day.humidities.length
        ),
        wind: Math.max(...day.winds).toFixed(1),
        pop: Math.round(Math.max(...day.pops) * 100), // Переводим в проценты
      };
    });
}

// Отрисовка погоды
function renderWeather(dailyData, cityName) {
  // Показываем и заполняем заголовок города
  const cityTitle = document.getElementById('current-city-title');
  cityTitle.textContent = `📍 Погода в городе: ${cityName}`;
  cityTitle.classList.remove('hidden');

  weatherResults.innerHTML = '';

  dailyData.forEach((day) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'weather-day';
    dayEl.innerHTML = `
            <div class="date">${day.date}</div>
            <div class="status">${day.status}</div>
            <div class="details">
                <span>🌡️ ${day.minTemp}°C ... ${day.maxTemp}°C</span>
                <span>💧 ${day.humidity}%</span>
                <span>💨 ${day.wind} м/с</span>
                <span>🌧️ ${day.pop}%</span>
            </div>
        `;
    weatherResults.appendChild(dayEl);
  });
}

// Работа с историей (localStorage)
function addToHistory(city) {
  let history = JSON.parse(localStorage.getItem('weatherHistory')) || [];
  // Удаляем город, если он уже есть, чтобы переместить его в начало
  history = history.filter((c) => c.toLowerCase() !== city.toLowerCase());
  // Добавляем в начало
  history.unshift(city);
  // Оставляем максимум 5
  history = history.slice(0, 5);

  localStorage.setItem('weatherHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('weatherHistory')) || [];
  historyList.innerHTML = '';

  history.forEach((city) => {
    const li = document.createElement('li');
    li.textContent = city;
    li.addEventListener('click', () => {
      cityInput.value = city;
      fetchWeather(city);
    });
    historyList.appendChild(li);
  });
}

// Проверка устаревания данных (5 минут = 300 000 мс)
function startStaleCheck() {
  // Проверяем каждую минуту
  checkInterval = setInterval(() => {
    if (lastRequestTime) {
      const diff = Date.now() - lastRequestTime;
      if (diff > 5 * 60 * 1000) {
        updateBtn.classList.remove('hidden');
        lastRequestTimeEl.textContent += ' (данные устарели)';
      }
    }
  }, 60000);
}

function updateTimeDisplay() {
  const now = new Date(lastRequestTime);
  lastRequestTimeEl.textContent = `Последний запрос: ${now.toLocaleTimeString()}`;
  updateBtn.classList.add('hidden');
}

// Вспомогательные функции
function showLoader(show) {
  if (show) {
    loader.classList.remove('hidden');
    weatherResults.innerHTML = '';
  } else {
    loader.classList.add('hidden');
  }
}

function formatDate(dateStr) {
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  return new Date(dateStr).toLocaleDateString('ru-RU', options);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==================== TODO LIST ====================

const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoSearch = document.getElementById('todo-search');

// Загрузка задач из localStorage при старте
let todos = JSON.parse(localStorage.getItem('todos')) || [];

// Инициализация Todo
document.addEventListener('DOMContentLoaded', () => {
  renderTodos();
});

// Добавление задачи
todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();

  if (text) {
    const newTodo = {
      id: Date.now(),
      text: text,
      completed: false,
    };

    todos.push(newTodo);
    saveTodos();
    renderTodos();
    todoInput.value = '';
  }
});

// Поиск задач (фильтрация в реальном времени)
todoSearch.addEventListener('input', (e) => {
  renderTodos(e.target.value.trim().toLowerCase());
});

// Отрисовка задач
function renderTodos(searchQuery = '') {
  todoList.innerHTML = '';

  // Фильтрация по поисковому запросу
  let filteredTodos = todos;
  if (searchQuery) {
    filteredTodos = todos.filter((todo) =>
      todo.text.toLowerCase().includes(searchQuery)
    );
  }

  // Проверка на пустой список
  if (filteredTodos.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.className = 'empty-message';
    emptyMsg.textContent = searchQuery
      ? 'Ничего не найдено'
      : 'Нет задач. Добавьте первую!';
    todoList.appendChild(emptyMsg);
    return;
  }

  // Отрисовка каждой задачи
  filteredTodos.forEach((todo) => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''}>
            <span class="todo-text">${todo.text}</span>
            <button class="delete-btn">Удалить</button>
        `;

    // Обработчик checkbox (переключение статуса)
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      toggleTodo(todo.id);
    });

    // Обработчик удаления
    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      deleteTodo(todo.id);
    });

    todoList.appendChild(li);
  });
}

// Переключение статуса задачи
function toggleTodo(id) {
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  );
  saveTodos();
  renderTodos(todoSearch.value.trim().toLowerCase());
}

// Удаление задачи
function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  saveTodos();
  renderTodos(todoSearch.value.trim().toLowerCase());
}

// Сохранение в localStorage
function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}
