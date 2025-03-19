import './style.css';
import Swiper from 'swiper';
import 'swiper/swiper-bundle.css';
import { Navigation, Pagination } from 'swiper/modules';
import { apiKey } from './secret.js';

new Swiper('.swiper', {
  modules: [Navigation, Pagination],
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  loop: true,
});

const cities = document.querySelectorAll('.swiper-slide');
const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather';
const units = 'metric';

async function getWeather(city) {
  const response = await fetch(
    `${weatherApiUrl}?q=${city}&units=${units}&appid=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Error fetching weather data: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function updateWeather() {
  for (const cityElement of cities) {
    const cityName = cityElement.getAttribute('data-city');
    try {
      const weatherData = await getWeather(cityName);
      const tempElement = cityElement.querySelector('.temp');
      tempElement.textContent = `${Math.round(weatherData.main.temp)}°C`;
    } catch (error) {
      console.error(error);
    }
  }
}

updateWeather();
