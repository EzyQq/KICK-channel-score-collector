// background.js - Фоновый скрипт расширения

import KickAPI from './kick-api.js';

// Глобальные переменные
let streamers = []; // Список стримеров
let openedStreams = {}; // Открытые вкладки со стримами: {username: tabId}
let checkInterval = 60000; // Интервал проверки статуса стримеров (1 минута)
let isChecking = false; // Флаг, чтобы избежать параллельных проверок
let extensionEnabled = true; // Флаг состояния расширения (включено/выключено)

// Инициализация расширения
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Kick Points Collector установлен');
  
  // Загружаем сохраненных стримеров
  await loadStreamers();
  
  // Загружаем состояние расширения
  await loadExtensionState();
  
  // Настраиваем периодическую проверку стримеров
  setupAlarm();
  
  // Логируем установку
  addLog('Расширение установлено и запущено', 'info');
});

// Создаем будильник для периодической проверки стримеров
function setupAlarm() {
  chrome.alarms.create('checkStreamers', {
    periodInMinutes: 1
  });
  
  // Обработчик будильника
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkStreamers' && extensionEnabled) {
      checkStreamersStatus();
    }
  });
}

// Загрузка списка стримеров из хранилища
async function loadStreamers() {
  const data = await chrome.storage.local.get('streamers');
  streamers = data.streamers || [];
  console.log('Загружено стримеров:', streamers.length);
}

// Загрузка состояния расширения
async function loadExtensionState() {
  const data = await chrome.storage.local.get('extensionEnabled');
  extensionEnabled = data.extensionEnabled !== undefined ? data.extensionEnabled : true;
  console.log('Состояние расширения:', extensionEnabled ? 'включено' : 'выключено');
}

// Сохранение списка стримеров в хранилище
async function saveStreamers() {
  await chrome.storage.local.set({ streamers });
  console.log('Сохранено стримеров:', streamers.length);
}

// Сохранение состояния расширения
async function saveExtensionState() {
  await chrome.storage.local.set({ extensionEnabled });
  console.log('Сохранено состояние расширения:', extensionEnabled ? 'включено' : 'выключено');
}

// Добавление записи в лог
function addLog(message, type = 'info') {
  console.log(`[${type}] ${message}`);
  
  // Добавляем запись в хранилище логов
  chrome.storage.local.get('logEntries', (data) => {
    const logEntries = data.logEntries || [];
    const timestamp = new Date().toLocaleTimeString();
    
    logEntries.push({ timestamp, message, type });
    
    // Ограничиваем количество записей в логе до 100
    if (logEntries.length > 100) {
      logEntries.splice(0, logEntries.length - 100);
    }
    
    chrome.storage.local.set({ logEntries });
  });
  
  // Отправляем запись в popup, если он открыт
  chrome.runtime.sendMessage({
    action: 'logEntry',
    message,
    type
  }).catch(() => {
    // Игнорируем ошибку, если popup не открыт
  });
}

// Проверка статуса всех стримеров
async function checkStreamersStatus() {
  // Избегаем параллельных проверок
  if (isChecking || !extensionEnabled) return;
  isChecking = true;
  
  try {
    for (let i = 0; i < streamers.length; i++) {
      const streamer = streamers[i];
      
      // Пропускаем отключенных стримеров и стримеров без имени
      if (!streamer.enabled || !streamer.username || streamer.username.trim() === '') {
        // Если стример неактивен или удален, проверяем, не нужно ли закрыть его вкладку
        if (openedStreams[streamer.username]) {
          await closeStream(streamer);
        }
        continue;
      }
      
      // Проверяем статус стримера
      const status = await KickAPI.checkStreamerStatus(streamer.username);
      
      // Обновляем информацию о стримере
      const wasLive = streamer.isLive;
      streamer.isLive = status.isLive;
      streamer.viewers = status.viewers;
      
      // Если стример только что начал стрим
      if (status.isLive && !wasLive) {
        addLog(`${streamer.username} начал стрим! Зрителей: ${status.viewers}`, 'success');
        openStream(streamer);
      } 
      // Если стример только что закончил стрим
      else if (!status.isLive && wasLive) {
        addLog(`${streamer.username} закончил стрим`, 'warning');
        closeStream(streamer);
      }
    }
    
    // Обновляем данные в хранилище
    await saveStreamers();
    
    // Отправляем обновленные данные в popup, если он открыт
    chrome.runtime.sendMessage({
      action: 'updateStreamers',
      streamers
    }).catch(() => {
      // Игнорируем ошибку, если popup не открыт
    });
  } catch (error) {
    console.error('Ошибка при проверке статуса стримеров:', error);
    addLog(`Ошибка при проверке статуса: ${error.message}`, 'error');
  }
  
  isChecking = false;
}

// Закрытие всех открытых вкладок со стримами
async function closeAllStreams() {
  for (const username in openedStreams) {
    try {
      await chrome.tabs.remove(openedStreams[username]);
      addLog(`Закрыта вкладка для ${username} (отключение расширения)`, 'info');
    } catch (error) {
      console.error(`Ошибка закрытия вкладки для ${username}:`, error);
    }
  }
  openedStreams = {};
}

// Открытие вкладки со стримом
async function openStream(streamer) {
  if (!extensionEnabled) return;
  
  try {
    // Проверяем, не открыт ли уже стрим этого стримера
    if (openedStreams[streamer.username]) {
      const tab = await chrome.tabs.get(openedStreams[streamer.username])
        .catch(() => null);
      
      if (tab) {
        // Стрим уже открыт, просто обновляем страницу
        chrome.tabs.reload(tab.id);
        addLog(`Обновлена вкладка для ${streamer.username}`, 'info');
        return;
      }
    }
    
    // Создаем новую вкладку со стримом
    const tab = await chrome.tabs.create({
      url: `https://kick.com/${streamer.username}`,
      active: false // Открываем в фоне
    });
    
    // Сохраняем ID вкладки
    openedStreams[streamer.username] = tab.id;
    addLog(`Открыта вкладка для ${streamer.username} (ID: ${tab.id})`, 'info');
    
    // Добавляем обработчик закрытия вкладки
    chrome.tabs.onRemoved.addListener(function tabClosedHandler(tabId) {
      if (tabId === tab.id) {
        delete openedStreams[streamer.username];
        chrome.tabs.onRemoved.removeListener(tabClosedHandler);
        addLog(`Вкладка для ${streamer.username} закрыта вручную`, 'warning');
        
        // Проверяем, активен ли стрим и если стример всё ещё в списке отслеживаемых и включен
        const streamerInfo = streamers.find(s => s.username === streamer.username);
        if (streamerInfo && streamerInfo.isLive && streamerInfo.enabled && extensionEnabled) {
          addLog(`Стрим ${streamer.username} все еще активен, переоткрываем вкладку`, 'info');
          // Небольшая задержка перед повторным открытием
          setTimeout(() => {
            openStream(streamer);
          }, 5000);
        }
      }
    });
    
    // Через 5 секунд после открытия страницы выполняем скрипт для имитации активности
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: simulateUserActivity
      }).catch(error => {
        console.error(`Ошибка выполнения скрипта для ${streamer.username}:`, error);
        addLog(`Ошибка имитации активности: ${error.message}`, 'error');
      });
    }, 5000);
  } catch (error) {
    console.error(`Ошибка открытия стрима ${streamer.username}:`, error);
    addLog(`Ошибка открытия вкладки: ${error.message}`, 'error');
  }
}

// Закрытие вкладки со стримом
async function closeStream(streamer) {
  try {
    // Проверяем, открыт ли стрим
    if (openedStreams[streamer.username]) {
      // Закрываем вкладку
      await chrome.tabs.remove(openedStreams[streamer.username]);
      delete openedStreams[streamer.username];
      addLog(`Закрыта вкладка для ${streamer.username}`, 'info');
    }
  } catch (error) {
    console.error(`Ошибка закрытия стрима ${streamer.username}:`, error);
    addLog(`Ошибка закрытия вкладки: ${error.message}`, 'error');
    // На всякий случай удаляем из списка открытых стримов
    delete openedStreams[streamer.username];
  }
}

// Функция для имитации активности пользователя (выполняется в контексте страницы)
function simulateUserActivity() {
  console.log('Имитация активности пользователя...');
  
  // Функция прокрутки, которая будет выполняться периодически
  const scrollPage = () => {
    // Небольшая прокрутка вниз
    window.scrollBy({
      top: Math.floor(Math.random() * 100) + 50,
      behavior: 'smooth'
    });
    
    // Через некоторое время прокрутка вверх
    setTimeout(() => {
      window.scrollBy({
        top: -Math.floor(Math.random() * 100) - 50,
        behavior: 'smooth'
      });
    }, 2000);
  };
  
  // Первоначальная прокрутка для загрузки всех элементов
  setTimeout(scrollPage, 2000);
  
  // Периодическая имитация активности
  setInterval(() => {
    // Случайным образом выбираем действие
    const action = Math.floor(Math.random() * 3);
    
    switch (action) {
      case 0:
        // Прокрутка страницы
        scrollPage();
        break;
      case 1:
        // Имитация движения мыши (через изменение фокуса)
        const buttons = document.querySelectorAll('button');
        if (buttons.length > 0) {
          const randomButton = buttons[Math.floor(Math.random() * buttons.length)];
          randomButton.focus();
          setTimeout(() => randomButton.blur(), 500);
        }
        break;
      case 2:
        // Клик по чату или другой области (без реального взаимодействия)
        const chatArea = document.querySelector('.chatroom-container');
        if (chatArea) {
          chatArea.scrollTop = chatArea.scrollHeight;
        }
        break;
    }
  }, 30000); // Каждые 30 секунд
  
  // Сообщаем, что активность настроена
  return true;
}

// Обработчик для сообщений от popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Обновление списка стримеров
  if (message.action === 'updateStreamers') {
    streamers = message.streamers;
    saveStreamers();
    checkStreamersStatus(); // Сразу проверяем стримеров
    sendResponse({ success: true });
  }
  
  // Запрос статуса (при открытии popup)
  else if (message.action === 'getStatus') {
    checkStreamersStatus();
    sendResponse({ success: true });
  }
  
  // Обновление количества баллов для стримера
  else if (message.action === 'updatePoints') {
    const streamerIndex = streamers.findIndex(
      s => s.username.toLowerCase() === message.username.toLowerCase()
    );
    
    if (streamerIndex !== -1) {
      // Обновляем количество баллов
      streamers[streamerIndex].points = message.points;
      saveStreamers();
      
      // Логируем обновление
      addLog(`Баллы для ${message.username}: ${message.points}`, 'info');
      
      // Отправляем обновленные данные в popup, если он открыт
      chrome.runtime.sendMessage({
        action: 'updateStreamers',
        streamers
      }).catch(() => {
        // Игнорируем ошибку, если popup не открыт
      });
    }
    
    sendResponse({ success: true });
  }
  
  // Обновление состояния расширения
  else if (message.action === 'setExtensionState') {
    extensionEnabled = message.enabled;
    saveExtensionState();
    
    // Если расширение отключено, закрываем все открытые вкладки
    if (!extensionEnabled) {
      closeAllStreams();
    } else {
      // Если расширение включено, проверяем стримеров
      checkStreamersStatus();
    }
    
    // Логируем изменение состояния
    addLog(`Расширение ${extensionEnabled ? 'включено' : 'отключено'}`, 'info');
    
    sendResponse({ success: true });
  }
  
  // Запрос состояния расширения
  else if (message.action === 'getExtensionState') {
    sendResponse({ enabled: extensionEnabled });
  }
  
  return true; // Важно для асинхронных sendResponse
});

// При запуске браузера проверяем статус стримеров
chrome.runtime.onStartup.addListener(async () => {
  await loadStreamers();
  await loadExtensionState();
  
  if (extensionEnabled) {
    checkStreamersStatus();
    addLog('Браузер запущен, проверка стримеров', 'info');
  } else {
    addLog('Браузер запущен, расширение отключено', 'warning');
  }
});

// Проверяем статус каждую минуту (если расширение включено)
setInterval(() => {
  if (extensionEnabled) {
    checkStreamersStatus();
  }
}, checkInterval);