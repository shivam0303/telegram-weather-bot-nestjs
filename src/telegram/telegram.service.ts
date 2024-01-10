import { Injectable } from '@nestjs/common';
const TelegramBot = require('node-telegram-bot-api');
import axios from 'axios';

const TelegramToken = "6890019664:AAF_lvh9Cgh-6C4TFU9DPwEv54w_VSVE9uc";
const weatherAPI = '2cdae64e2e5cd7586a6d1f975ac346df';

@Injectable()
export class TelegramService {
  private readonly bot: any;
  private subscriptions: { chatId: number; city: string }[] = [];
  private userStates: Map<number, string> = new Map();

  constructor() {
    this.bot = new TelegramBot(TelegramToken, { polling: true });
    this.setupListeners();
  }

  private async sendMessage(chatId: number, message: string, options?: any): Promise<any> {
    return this.bot.sendMessage(chatId, message, options);
  }

  private async getWeatherData(city: string): Promise<string> {
    const apiKey = weatherAPI;
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;

    try {
      const response = await axios.get(apiUrl);
      console.log('Weather data:', response.data)
      const weatherDescription = response.data.weather[0].description;
      return `Current weather: ${weatherDescription} 
              Minimum temperature: ${response.data.main.temp_min} 
              Maximum temperature: ${response.data.main.temp_max} 
              Humidity: ${response.data.main.humidity} 
              Wind speed: ${response.data.wind.speed} 
              Pressure: ${response.data.main.pressure} `;
    } catch (error) {
      console.error('Error fetching weather data:', error.message);
      throw error;
    }
  }

  private setupListeners() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const options = {
        reply_markup: {
          keyboard: [
            [{ text: '/subscribe' }],
            [{ text: '/unsubscribe' }],
            [{ text: '/weather' }],
          ],
        },
      };
      this.sendMessage(chatId, 'Welcome! Choose an option:', options);
    });

    this.bot.onText(/\/subscribe/, (msg) => {
      const chatId = msg.chat.id;
      this.userStates.set(chatId, 'subscribe');
      this.sendMessage(chatId, 'Please enter the city you want to subscribe to:');
    });

    this.bot.onText(/\/unsubscribe/, (msg) => {
      const chatId = msg.chat.id;
      this.userStates.set(chatId, 'unsubscribe');
      this.sendMessage(chatId, 'Please enter the city you want to unsubscribe from:');
    });

    this.bot.on('text', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (this.userStates.has(chatId)) {
        const state = this.userStates.get(chatId);

        if (state === 'subscribe' && text !== '/subscribe'  && text !== '/weather') {
          const city = text;
          this.subscriptions.push({ chatId, city });
          console.log('Subscriptions:', this.subscriptions);
          this.sendMessage(chatId, `Subscribed to weather updates for ${city}`);
        } else if (state === 'unsubscribe' && text !== '/unsubscribe'  && text !== '/weather') {
          const city = text;
          const index = this.subscriptions.findIndex((s) => s.chatId === chatId && s.city === city);
          if (index !== -1) {
            this.subscriptions.splice(index, 1);
            this.sendMessage(chatId, `Unsubscribed from weather updates for ${city}`);
          } else {
            this.sendMessage(chatId, `You are not subscribed to weather updates for ${city}`);
          }
        }

        this.userStates.delete(chatId);
      }
    });

    this.bot.onText(/\/weather/, async (msg) => {
      const chatId = msg.chat.id;
      const subscribedCities = this.subscriptions
        .filter((s) => s.chatId === chatId)
        .map((s) => s.city);

      if (subscribedCities.length > 0) {
        const weatherPromises = subscribedCities.map((city) => this.getWeatherData(city));
        const weatherResults = await Promise.all(weatherPromises);
        weatherResults.forEach((result, index) => {
          this.sendMessage(chatId, `Weather update for ${subscribedCities[index]}: \n${result}`);
        });
      } else {
        this.sendMessage(chatId, 'You are not subscribed to any city. Use /subscribe to subscribe.');
      }
    });
  }
}
