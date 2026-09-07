// Detecta automáticamente si estás corriendo el Live Server en tu PC local
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const CONFIG = {
    API_URL: isLocalhost ? "http://localhost:8001" : ""
};