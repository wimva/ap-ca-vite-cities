import './style.css';
import Swiper from 'swiper';
import 'swiper/swiper-bundle.css';
import { Navigation, Pagination } from 'swiper/modules';
import { apiKey } from './secret.js';
import * as THREE from 'three';

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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

function animate() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render(scene, camera);
}
