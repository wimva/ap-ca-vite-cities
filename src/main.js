import './style.css';
import Swiper from 'swiper';
import 'swiper/swiper-bundle.css';
import { Navigation, Pagination } from 'swiper/modules';
import { apiKey } from './secret.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Initialize Swiper and keep a reference.
const swiper = new Swiper('.swiper', {
  modules: [Navigation, Pagination],
  navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
  pagination: { el: '.swiper-pagination', clickable: true },
  loop: true,
});

const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather';
const units = 'metric';

async function getWeather(city) {
  const response = await fetch(
    `${weatherApiUrl}?q=${city}&units=${units}&appid=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Error fetching weather data: ${response.statusText}`);
  }
  return await response.json();
}

// Helper: Convert latitude and longitude to a Vector3 on a sphere.
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Create a sprite label from text using an offscreen canvas.
function createLabelSprite(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 18;
  context.font = `Bold ${fontSize}px Arial`;
  const metrics = context.measureText(text);
  const textWidth = metrics.width;
  // Set canvas dimensions based on text size
  canvas.width = textWidth;
  canvas.height = fontSize * 1.2;
  // Reapply font after resizing canvas.
  context.font = `${fontSize}px Arial`;
  context.fillStyle = 'white';
  context.fillText(text, 0, fontSize);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  // Adjust sprite scale based on canvas dimensions.
  sprite.scale.set(2, 0.5, 0.5);
  return sprite;
}

// ----- Three.js Setup -----
const container = document.getElementById('threejs-container') || document.body;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 12;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false; // disable zooming

// Create the globe using the earth.jpg texture from your public folder.
const globeRadius = 5;
const sphereGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('earth.jpg');
const sphereMaterial = new THREE.MeshBasicMaterial({ map: earthTexture });
const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(globe);

// Array to keep track of the pin meshes.
const pins = [];

// ----- Update Weather and Add Pins -----
async function updateWeatherAndPins() {
  const cityElements = document.querySelectorAll('.swiper-slide');
  for (const cityElement of cityElements) {
    const cityName = cityElement.getAttribute('data-city');
    try {
      const weatherData = await getWeather(cityName);
      const roundedTemp = Math.round(weatherData.main.temp);

      // Update the swiper slide with temperature info.
      const tempElement = cityElement.querySelector('.temp');
      tempElement.textContent = `${roundedTemp}°C`;

      // Get coordinates and compute the pin position (slightly above the globe).
      const { lat, lon } = weatherData.coord;
      const pinPosition = latLonToVector3(lat, lon, globeRadius + 0.1);

      // Create a small white sphere for the pin.
      const pinGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const pinMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial);
      pinMesh.position.copy(pinPosition);
      // Store the city name so we can reference it later.
      pinMesh.userData.city = cityName;

      // Create the label sprite.
      const labelText = `${cityName}: ${roundedTemp}°C`;
      const labelSprite = createLabelSprite(labelText);
      // Compute an offset based on the pin's outward direction.
      const offset = new THREE.Vector3()
        .copy(pinMesh.position)
        .normalize()
        .multiplyScalar(0.6);
      labelSprite.position.copy(offset);
      // Add the label sprite to the pin.
      pinMesh.add(labelSprite);

      // Attach the pin (with its label) to the globe so it rotates together.
      globe.add(pinMesh);
      pins.push(pinMesh);
    } catch (error) {
      console.error(error);
    }
  }
}

updateWeatherAndPins();

// ----- Centering on Active City on Slide Change -----
swiper.on('slideChange', () => {
  // Get the active slide's city name.
  const activeSlide = swiper.slides[swiper.activeIndex];
  const activeCity = activeSlide.getAttribute('data-city');
  // Find the corresponding pin.
  const activePin = pins.find((pin) => pin.userData.city === activeCity);
  if (activePin) {
    // Compute the active pin's world position.
    const worldPos = new THREE.Vector3();
    activePin.getWorldPosition(worldPos);
    // Update the OrbitControls target to center on the active city.
    controls.target.copy(worldPos);
    // Optionally, adjust the camera position (or animate the transition) here.
  }
});

// ----- Animation Loop -----
function animate() {
  requestAnimationFrame(animate);

  // Rotate the globe slowly.
  globe.rotation.y += 0.001;
  controls.update();
  renderer.render(scene, camera);
}

animate();

// ----- Handle Window Resizing -----
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});
