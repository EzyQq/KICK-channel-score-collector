// popup.js - Скрипт для интерфейса расширения

// Глобальные переменные
let streamers = []; // Список стримеров
let logEntries = []; // Лог активности

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  await loadStreamers();
  await loadLog();
  renderStreamers();
  renderLog();
  setupEventListeners();
});

// Загрузка данных о стримерах из хранилища
async function loadStreamers() {
  const data = await chrome.storage.local.get('streamers');
  streamers = data.streamers || [];
}

// Загрузка лога активности из хранилища
async function loadLog() {
  const data = await chrome.storage.local.get('logEntries');
  logEntries = data.logEntries || [];
}

// Сохранение данных о стримерах в хранилище
async function saveStreamers() {
  await chrome.storage.local.set({ streamers });
  addLogEntry('Список стримеров сохранен', 'info');
  
  // Отправляем сообщение в background script, чтобы обновить отслеживание
  chrome.runtime.sendMessage({ action: 'updateStreamers', streamers });
}

// Сохранение лога активности в хранилище
async function saveLog() {
  // Ограничиваем количество записей в логе до 100
  if (logEntries.length > 100) {
    logEntries = logEntries.slice(-100);
  }
  await chrome.storage.local.set({ logEntries });
}

// Добавление новой записи в лог
function addLogEntry(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  logEntries.push({ timestamp, message, type });
  saveLog();
  renderLog();
}

// Отображение списка стримеров
function renderStreamers() {
  const streamersListElement = document.getElementById('streamers-list');
  streamersListElement.innerHTML = '';
  
  if (streamers.length === 0) {
    // Добавляем пустую строку для первого стримера
    addStreamer();
    return;
  }
  
  streamers.forEach((streamer, index) => {
    const streamerElement = document.createElement('div');
    streamerElement.className = 'streamer-item';
    
    // Имя стримера (ввод)
    const nameElement = document.createElement('div');
    nameElement.className = 'streamer-name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = streamer.username || '';
    nameInput.placeholder = 'Никнейм стримера';
    nameInput.dataset.index = index;
    nameElement.appendChild(nameInput);
    
    // Статус стримера (онлайн/оффлайн)
    const statusElement = document.createElement('div');
    statusElement.className = 'streamer-status';
    const statusDot = document.createElement('span');
    statusDot.className = `status-dot ${streamer.isLive ? 'status-online' : 'status-offline'}`;
    const statusText = document.createElement('span');
    statusText.textContent = streamer.isLive ? 'Онлайн' : 'Оффлайн';
    statusElement.appendChild(statusDot);
    statusElement.appendChild(statusText);
    
    // Количество зрителей
    const viewersElement = document.createElement('div');
    viewersElement.className = 'streamer-viewers';
    viewersElement.textContent = streamer.isLive ? streamer.viewers : '-';
    
    // Кнопки действий
    const actionsElement = document.createElement('div');
    actionsElement.className = 'streamer-actions';
    
    // Переключатель вкл/выкл
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = streamer.enabled;
    toggleInput.dataset.index = index;
    toggleInput.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      streamers[idx].enabled = e.target.checked;
    });
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);
    
    // Кнопка удаления
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-btn';
    removeButton.textContent = '×';
    removeButton.dataset.index = index;
    removeButton.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      removeStreamer(idx);
    });
    
    actionsElement.appendChild(toggleLabel);
    actionsElement.appendChild(removeButton);
    
    // Добавляем все элементы в строку стримера
    streamerElement.appendChild(nameElement);
    streamerElement.appendChild(statusElement);
    streamerElement.appendChild(viewersElement);
    streamerElement.appendChild(actionsElement);
    
    streamersListElement.appendChild(streamerElement);
  });
}

// Отображение лога активности
function renderLog() {
  const logElement = document.getElementById('activity-log');
  logElement.innerHTML = '';
  
  if (logEntries.length === 0) {
    const emptyLog = document.createElement('div');
    emptyLog.className = 'log-entry';
    emptyLog.textContent = 'Лог пуст';
    logElement.appendChild(emptyLog);
    return;
  }
  
  // Отображаем последние 30 записей лога
  const entriesToShow = logEntries.slice(-30);
  
  entriesToShow.forEach(entry => {
    const logEntryElement = document.createElement('div');
    logEntryElement.className = `log-entry log-${entry.type}`;
    
    const timeElement = document.createElement('span');
    timeElement.className = 'log-time';
    timeElement.textContent = `[${entry.timestamp}]`;
    
    const messageElement = document.createElement('span');
    messageElement.className = 'log-message';
    messageElement.textContent = ` ${entry.message}`;
    
    logEntryElement.appendChild(timeElement);
    logEntryElement.appendChild(messageElement);
    
    logElement.appendChild(logEntryElement);
  });
  
  // Прокручиваем лог вниз
  logElement.scrollTop = logElement.scrollHeight;
}

// Добавление нового стримера
function addStreamer() {
  streamers.push({
    username: '',
    enabled: true,
    isLive: false,
    viewers: 0,
    points: 0
  });
  renderStreamers();
}

// Удаление стримера
function removeStreamer(index) {
  if (index >= 0 && index < streamers.length) {
    const username = streamers[index].username;
    streamers.splice(index, 1);
    renderStreamers();
    addLogEntry(`Стример ${username || 'без имени'} удален`, 'warning');
  }
}

// Обновление данных о стримерах из полей ввода
function updateStreamersFromInputs() {
  const inputs = document.querySelectorAll('.streamer-name input');
  inputs.forEach((input, index) => {
    if (index < streamers.length) {
      streamers[index].username = input.value.trim();
    }
  });
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Кнопка добавления стримера
  document.getElementById('add-streamer').addEventListener('click', addStreamer);
  
  // Кнопка сохранения списка стримеров
  document.getElementById('save-streamers').addEventListener('click', () => {
    updateStreamersFromInputs();
    saveStreamers();
  });
  
  // Кнопка очистки лога
  document.getElementById('clear-log').addEventListener('click', () => {
    logEntries = [];
    saveLog();
    renderLog();
    addLogEntry('Лог очищен', 'info');
  });
  
  // Прослушивание сообщений от background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateStreamers') {
      streamers = message.streamers;
      renderStreamers();
    } else if (message.action === 'logEntry') {
      addLogEntry(message.message, message.type);
    }
  });
}

// Запрашиваем актуальный статус стримеров при открытии popup
chrome.runtime.sendMessage({ action: 'getStatus' });