import { CONFIG } from './config.js';

export async function createEvent(payload) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating event:', error);
        throw error;
    }
}