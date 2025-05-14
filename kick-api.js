// kick-api.js - Модуль для работы с API Kick.com

/**
 * Класс для работы с API Kick.com
 */
class KickAPI {
  /**
   * Проверяет, находится ли стример в сети
   * @param {string} username - Никнейм стримера
   * @returns {Promise<Object>} - Данные о статусе стримера
   */
  static async checkStreamerStatus(username) {
    if (!username || username.trim() === '') {
      return { isLive: false, viewers: 0, error: 'Empty username' };
    }
    
    try {
      // Запрос к API Kick.com для получения статуса стримера
      const response = await fetch(`https://kick.com/api/v1/channels/${username}`);
      
      // Если стример не найден или произошла ошибка
      if (!response.ok) {
        console.error(`Error fetching streamer ${username}: ${response.status}`);
        return { isLive: false, viewers: 0, error: `HTTP error ${response.status}` };
      }
      
      const data = await response.json();
      
      // Проверяем, онлайн ли стример
      const isLive = data.livestream !== null;
      const viewers = isLive && data.livestream ? data.livestream.viewer_count : 0;
      
      return {
        isLive,
        viewers,
        title: isLive ? data.livestream.session_title : '',
        thumbnail: isLive ? data.livestream.thumbnail.url : '',
        streamer: {
          id: data.id,
          username: data.username,
          displayname: data.user.username
        }
      };
    } catch (error) {
      console.error(`Error checking streamer ${username}:`, error);
      return { isLive: false, viewers: 0, error: error.message };
    }
  }
  
  /**
   * Получает количество баллов канала для пользователя
   * @param {string} username - Никнейм стримера
   * @returns {Promise<number>} - Количество баллов
   */
  static async getChannelPoints(username) {
    // Этот метод требует доступа к DOM страницы и будет вызываться из content-script.js
    // Здесь возвращаем заглушку, так как реальное значение будет получено через content script
    return 0;
  }
}

export default KickAPI;