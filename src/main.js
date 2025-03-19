import './style.css';
import Swiper from 'swiper';
import 'swiper/swiper-bundle.css';
import { Navigation, Pagination } from 'swiper/modules';
import { apiKey } from './secret.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ----- Swiper Setup -----
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

// ----- Helper Functions -----
// Convert latitude and longitude to a Vector3 on a sphere.
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
  // Set canvas dimensions based on text size.
  canvas.width = textWidth;
  canvas.height = fontSize * 1.2;
  // Reapply font after changing canvas size.
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
  // Adjust sprite scale based on canvas dimensions (tweak these values as needed)
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

// Global object to store city coordinates.
const cityCoords = {};

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
      if (tempElement) {
        tempElement.textContent = `${roundedTemp}°C`;
      }

      // Save the coordinates for later use.
      cityCoords[cityName] = {
        lat: weatherData.coord.lat,
        lon: weatherData.coord.lon,
      };

      // Get coordinates and compute the pin position (slightly above the globe).
      const { lat, lon } = weatherData.coord;
      const pinPosition = latLonToVector3(lat, lon, globeRadius + 0.1);

      // Create a small white sphere for the pin.
      const pinGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const pinMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial);
      pinMesh.position.copy(pinPosition);

      // Create the label sprite.
      const labelText = `${cityName}: ${roundedTemp}°C`;
      const labelSprite = createLabelSprite(labelText);
      // Position the label: if the pin is in the southern hemisphere, offset downward; otherwise upward.
      if (pinMesh.position.y < 0) {
        labelSprite.position.set(0, -0.6, 0);
      } else {
        labelSprite.position.set(0, 0.6, 0);
      }
      pinMesh.add(labelSprite);

      // Add the pin (with its label) to the globe so it rotates together.
      globe.add(pinMesh);
      pins.push(pinMesh);
    } catch (error) {
      console.error(error);
    }
  }
}

updateWeatherAndPins();

// ----- Rotate Globe to Active City -----
// When the active slide changes, rotate the globe to bring the corresponding city to the front.
swiper.on('slideChange', () => {
  const activeSlide = swiper.slides[swiper.activeIndex];
  const cityName = activeSlide.getAttribute('data-city');
  const coords = cityCoords[cityName];
  if (coords) {
    rotateGlobeToCity(coords.lat, coords.lon, 1000); // Rotate over 1 second.
  }
});

function rotateGlobeToCity(lat, lon, duration = 1000) {
  // Compute the target vector for the city (on the globe's surface).
  const cityVector = latLonToVector3(lat, lon, globeRadius).normalize();
  // Define the "front" direction (from the globe center toward the camera).
  // For a camera at (0,0,12) looking at the origin, the front of the globe is roughly along (0,0,1).
  const frontVector = new THREE.Vector3(0, 0, 1);

  // Calculate the quaternion that rotates cityVector to frontVector.
  const dot = cityVector.dot(frontVector);
  let targetQuaternion = new THREE.Quaternion();
  if (dot < -0.9999) {
    // Vectors nearly opposite – choose an arbitrary axis.
    targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  } else if (dot > 0.9999) {
    // Already aligned; use identity.
    targetQuaternion.identity();
  } else {
    const axis = new THREE.Vector3()
      .crossVectors(cityVector, frontVector)
      .normalize();
    const angle = Math.acos(dot);
    targetQuaternion.setFromAxisAngle(axis, angle);
  }

  // Tween from the current globe quaternion to the target quaternion.
  const startQuaternion = globe.quaternion.clone();
  const startTime = performance.now();

  function animateRotation() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Instead of using the static method, use the instance method: copy and then slerp.
    globe.quaternion.copy(startQuaternion).slerp(targetQuaternion, t);
    if (t < 1) {
      requestAnimationFrame(animateRotation);
    }
  }
  animateRotation();
}

// ----- Animation Loop -----
function animate() {
  requestAnimationFrame(animate);

  // Auto-rotate the globe slowly (optional: you can disable this during city rotation if desired).
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
