// content-script.js - Скрипт для взаимодействия со страницей стрима

/**
 * Функция получения количества баллов канала
 * Выполняется в контексте страницы стрима
 * @returns {number} - Количество баллов канала
 */
function getChannelPoints() {
  try {
    // Находим элемент с баллами на странице
    // Селектор может меняться в зависимости от структуры страницы Kick.com
    const pointsElement = document.querySelector('.channel-points-balance');
    
    if (pointsElement) {
      // Получаем текстовое содержимое и удаляем все нецифровые символы
      const pointsText = pointsElement.textContent.replace(/[^\d]/g, '');
      return parseInt(pointsText) || 0;
    }
    
    // Альтернативный способ поиска элемента с баллами
    const alternativePointsElement = document.querySelector('[data-testid="channel-points"]');
    if (alternativePointsElement) {
      const pointsText = alternativePointsElement.textContent.replace(/[^\d]/g, '');
      return parseInt(pointsText) || 0;
    }
    
    // Пробуем найти элемент баллов по другим атрибутам
    const possibleSelectors = [
      '.points-balance',
      '.viewer-points',
      '[data-testid="points-balance"]',
      '[aria-label*="channel points"]',
      '[class*="points"]'
    ];
    
    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const pointsText = element.textContent.replace(/[^\d]/g, '');
        const points = parseInt(pointsText);
        if (!isNaN(points)) {
          console.log(`Нашли баллы через селектор ${selector}: ${points}`);
          return points;
        }
      }
    }
    
    console.log('Элемент с баллами не найден');
    return 0;
  } catch (error) {
    console.error('Ошибка при получении баллов канала:', error);
    return 0;
  }
}

/**
 * Функция имитации пользовательской активности
 * Выполняется в контексте страницы стрима
 */
function simulateActivity() {
  try {
    console.log('Имитация активности пользователя на странице стрима');
    
    // Получаем имя канала из URL
    const channelName = window.location.pathname.replace(/^\/+/, '');
    console.log(`Активация для канала: ${channelName}`);
    
    // Функция прокрутки страницы
    function scrollRandomly() {
      // Получаем текущую высоту прокрутки
      const currentScroll = window.scrollY;
      
      // Определяем случайную величину прокрутки (от -200 до +200 пикселей)
      const scrollDelta = Math.floor(Math.random() * 400) - 200;
      
      // Прокручиваем страницу
      window.scrollTo({
        top: Math.max(0, currentScroll + scrollDelta),
        behavior: 'smooth'
      });
    }
    
    // Функция для взаимодействия с видеоплеером
    function interactWithPlayer() {
      // Находим элемент видеоплеера
      const videoPlayer = document.querySelector('video');
      
      if (videoPlayer) {
        // Отправляем событие mousemove на видеоплеер
        const mouseEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        videoPlayer.dispatchEvent(mouseEvent);
        
        // Проверяем, не стоит ли видео на паузе
        if (videoPlayer.paused) {
          try {
            videoPlayer.play().catch(e => console.log('Автоматический запуск видео заблокирован браузером'));
          } catch (e) {
            console.log('Ошибка при попытке воспроизведения видео:', e);
          }
        }
        
        // Проверяем качество видео, если возможно
        try {
          // Пробуем найти кнопки настроек качества
          const qualityButtons = document.querySelectorAll('[aria-label*="качество"], [aria-label*="quality"]');
          // Если нашли, можем нажать для выбора среднего качества, чтобы сэкономить трафик
        } catch (e) {
          console.log('Не удалось взаимодействовать с настройками качества:', e);
        }
      }
    }
    
    // Функция для взаимодействия с чатом
    function interactWithChat() {
      // Находим контейнер чата
      const chatContainer = document.querySelector('.chatroom-container');
      
      if (chatContainer) {
        // Прокручиваем чат вниз
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
    
    // Начальная имитация активности
    scrollRandomly();
    interactWithPlayer();
    interactWithChat();
    
    // Устанавливаем интервалы для разных типов активности
    setInterval(scrollRandomly, 60000); // Прокрутка каждую минуту
    setInterval(interactWithPlayer, 30000); // Взаимодействие с плеером каждые 30 секунд
    setInterval(interactWithChat, 45000); // Взаимодействие с чатом каждые 45 секунд
    
    // Функция для сбора наград/сундуков/бонусов, если они появляются
    function collectRewards() {
      // Находим все элементы с возможными наградами
      // Селекторы могут отличаться в зависимости от структуры Kick.com
      const rewardSelectors = [
        '.reward-button',
        '.bonus-button',
        '.chest-button',
        '[class*="reward"]',
        '[class*="chest"]',
        '[class*="bonus"]',
        '[aria-label*="claim"]',
        '[aria-label*="reward"]',
        'button[class*="chest"]',
        'button[class*="claim"]'
      ];
      
      for (const selector of rewardSelectors) {
        const buttons = document.querySelectorAll(selector);
        
        buttons.forEach(button => {
          try {
            // Проверяем, виден ли элемент пользователю
            const rect = button.getBoundingClientRect();
            const isVisible = (
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
              rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            
            if (isVisible) {
              // Симулируем клик по кнопке награды
              button.click();
              console.log(`Собрана награда через селектор ${selector}`);
            }
          } catch (e) {
            console.error(`Ошибка при сборе награды (${selector}):`, e);
          }
        });
      }
    }
    
    // Проверяем наличие наград каждые 30 секунд
    setInterval(collectRewards, 30000);
    
    // Функция отправки информации о баллах в background script
    function reportPoints() {
      const points = getChannelPoints();
      
      // Получаем имя канала из URL
      const channelName = window.location.pathname.replace(/^\/+/, '');
      
      if (points > 0) {
        console.log(`Отправляем информацию о баллах для ${channelName}: ${points}`);
        
        // Отправляем сообщение в background script
        chrome.runtime.sendMessage({
          action: 'updatePoints',
          username: channelName,
          points: points
        }).catch(err => {
          console.error('Ошибка при отправке информации о баллах:', err);
        });
      }
    }
    
    // Отправляем информацию о баллах каждую минуту
    setInterval(reportPoints, 60000);
    
    // Также делаем начальную отправку через 10 секунд после загрузки
    setTimeout(reportPoints, 10000);
    
  } catch (error) {
    console.error('Ошибка при имитации активности:', error);
  }
}

// Запускаем имитацию активности через 5 секунд после загрузки страницы
setTimeout(simulateActivity, 5000);

// Обработчик сообщений от background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPoints') {
    // Отправляем текущее количество баллов
    const points = getChannelPoints();
    sendResponse({ points });
  }
  
  return true; // Важно для асинхронных sendResponse
});