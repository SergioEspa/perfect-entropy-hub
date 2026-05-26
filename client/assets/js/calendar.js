import { CONFIG } from "./config.js"; 
import { createEvent } from "./service.js";

const API_BASE = `${CONFIG.API_URL}/api/calendar`;

export function initializeCalendar() {
    const calendarEl = document.getElementById('calendar-root');
    if (!calendarEl) return;

    if (typeof FullCalendar === 'undefined') {
        console.error("FullCalendar Core no se encuentra cargado en el index.html global.");
        return;
    }

    // --- MÁQUINA DE ESTADOS Y COMPONENTES ---
    let isProposingMode = false;
    
    // 1. Buscamos si hay modales "huérfanos" en el body de visitas anteriores y los borramos
    const oldModals = document.querySelectorAll('body > #modalDraftEvent');
    oldModals.forEach(m => m.remove());

    // 2. Cogemos el modal recién inyectado en el HTML
    const draftModalEl = document.getElementById('modalDraftEvent');
    
    // 3. TRUCO DE MAGIA: Lo movemos al body para escapar de la animación CSS
    document.body.appendChild(draftModalEl);
    
    // 4. Ahora sí, lo instanciamos con Bootstrap
    const draftModal = new bootstrap.Modal(draftModalEl);

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'es',
        firstDay: 1,
        slotMinTime: '09:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        
        customButtons: {
            btnNuevoEvento: {
                text: '+ Proponer',
                click: function() {
                    isProposingMode = !isProposingMode; // Alternar estado on/off
                    calendar.setOption('selectable', isProposingMode); // Solo permitir selección en modo propuesta
                    const btn = document.querySelector('.fc-btnNuevoEvento-button');

                    if (isProposingMode) {
                        calendarEl.classList.add('proposing-mode');
                        btn.innerHTML = '<i class="bi bi-x-circle me-1"></i> Cancelar selección';
                        btn.classList.add('btn-danger'); // Le damos un toque rojo para indicar "cancelar"
                    } else {
                        calendarEl.classList.remove('proposing-mode');
                        btn.innerHTML = '+ Proponer';
                        btn.classList.remove('btn-danger');
                    }
                }
            }
        },

        headerToolbar: {
            left: 'prev,next today btnNuevoEvento',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        
        themeSystem: 'bootstrap5',
        editable: true,
        selectable: false,
        selectMirror: true, // Crucial: dibuja el bloque MIENTRAS arrastras el ratón
        height: 'calc(100vh - 180px)', 
        expandRows: true, 
        stickyHeaderDates: true, 

        eventSources: [
            {
                url: `${API_BASE}/oficial`,
                id: 'source-oficial',
                color: 'rgba(6, 182, 212, 0.15)', 
                borderColor: '#06b6d4',
                textColor: '#f3f4f6'
            },
            {
                url: `${API_BASE}/propuestas`,
                id: 'source-propuestas',
                color: 'rgba(234, 179, 8, 0.1)', 
                borderColor: '#eab308',
                textColor: '#eab308'
            },
            {
                url: `${API_BASE}/mis-bloqueos`,
                id: 'source-bloqueos',
                color: 'rgba(239, 68, 68, 0.12)', 
                borderColor: '#ef4444',
                textColor: '#f9fafb'
            }
        ],

        // --- EL CEREBRO DE LA SELECCIÓN ---
        select: function(info) {
            if (isProposingMode) {
                // 1. Si ya había un borrador por la pantalla, lo purgamos
                const oldDraft = calendar.getEventById('draft-event');
                if (oldDraft) oldDraft.remove();

                // 2. Renderizamos el evento "fantasma" moldeable
                calendar.addEvent({
                    id: 'draft-event',
                    title: 'Nueva Propuesta',
                    start: info.startStr,
                    end: info.endStr,
                    color: '#8b5cf6',
                    editable: true, // Para que el usuario pueda estirarlo a placer
                    classNames: ['draft-event-pulse'],
                    extendedProps: {
                        type: 'ENSAYO',
                        description: ''
                    }
                });

                // 3. Reseteamos la UI a la normalidad
                isProposingMode = false;
                calendar.setOption('selectable', false);
                calendarEl.classList.remove('proposing-mode');
                
                const btn = document.querySelector('.fc-btnNuevoEvento-button');
                btn.innerHTML = '+ Proponer';
                btn.classList.remove('btn-danger');

                // Quitamos el sombreado azul nativo
                calendar.unselect();
                
                // 4. Abrimos el modal para customizar
                abrirModalEdicion(calendar.getEventById('draft-event'));
            }
        },

        // Si hacen click sobre el borrador, se vuelve a abrir el editor
        eventClick: function(info) {
            if (info.event.id === 'draft-event') {
                abrirModalEdicion(info.event);
            }
        },

        eventDrop: function(info) {
            // Cortafuegos: El fantasma no toca la red
            if (info.event.id === 'draft-event') return; 

            syncEventChange(info);
        },
        
        eventResize: function(info) {
            // Cortafuegos: El fantasma no toca la red al estirarse
            if (info.event.id === 'draft-event') return; 

            syncEventChange(info);
        }
    });

    calendar.render();

    // ==========================================
    // LÓGICA DEL MODAL Y EVENTOS DEL FORMULARIO
    // ==========================================
    
    // Función auxiliar para extraer HH:mm de un objeto Date
    const getLocalTimeString = (dateObj) => {
        if (!dateObj) return '';
        return dateObj.toTimeString().substring(0, 5);
    };

    function abrirModalEdicion(eventObj) {
        document.getElementById('draft-title').value = eventObj.title === 'Nueva Propuesta' ? '' : eventObj.title;
        document.getElementById('draft-type').value = eventObj.extendedProps.type || 'ENSAYO';
        document.getElementById('draft-color').value = eventObj.backgroundColor || '#8b5cf6';
        document.getElementById('draft-desc').value = eventObj.extendedProps.description || '';
        document.getElementById('draft-periodicity').value = eventObj.extendedProps.periodicity || 'SINGLE';
        
        // Inyectamos las horas extraídas del grid visual
        document.getElementById('draft-start-time').value = getLocalTimeString(eventObj.start);
        document.getElementById('draft-end-time').value = getLocalTimeString(eventObj.end || eventObj.start);
        
        draftModal.show();
    }

    // --- REACTIVIDAD EN TIEMPO REAL ---
    document.getElementById('draft-title').addEventListener('input', (e) => {
        const draftEvent = calendar.getEventById('draft-event');
        if (draftEvent) draftEvent.setProp('title', e.target.value || 'Nueva Propuesta');
    });
    
    document.getElementById('draft-color').addEventListener('input', (e) => {
        const draftEvent = calendar.getEventById('draft-event');
        if (draftEvent) draftEvent.setProp('backgroundColor', e.target.value);
    });

    // Magia: Si cambias la hora en el input, el evento se redibuja en el calendario detrás
    const updateEventTimeFromInputs = () => {
        const draftEvent = calendar.getEventById('draft-event');
        if (!draftEvent) return;

        const startTimeStr = document.getElementById('draft-start-time').value;
        const endTimeStr = document.getElementById('draft-end-time').value;

        if (startTimeStr) {
            const base = draftEvent.start;
            const [hours, mins] = startTimeStr.split(':');
            const newStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, mins);
            draftEvent.setStart(newStart);
        }
        
        if (endTimeStr) {
            // El fin usa la misma fecha base que el inicio para no descuadrar días
            const base = draftEvent.start; 
            const [hours, mins] = endTimeStr.split(':');
            const newEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, mins);
            // Evitar que la fecha de fin sea anterior a la de inicio visualmente
            if (newEnd > draftEvent.start) {
                draftEvent.setEnd(newEnd);
            }
        }
    };

    document.getElementById('draft-start-time').addEventListener('change', updateEventTimeFromInputs);
    document.getElementById('draft-end-time').addEventListener('change', updateEventTimeFromInputs);

    // --- ACCIONES PRINCIPALES ---
    document.getElementById('btn-save-draft').addEventListener('click', async () => {
        const draftEvent = calendar.getEventById('draft-event');
        if (!draftEvent) return;

        // Validamos que los campos obligatorios del HTML5 se hayan rellenado
        const form = document.getElementById('draft-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            title: document.getElementById('draft-title').value,
            start_time: draftEvent.start.toISOString(),
            end_time: draftEvent.end ? draftEvent.end.toISOString() : draftEvent.start.toISOString(),
            type: document.getElementById('draft-type').value,
            color: document.getElementById('draft-color').value,
            description: document.getElementById('draft-desc').value,
            periodicity: document.getElementById('draft-periodicity').value // Añadido al payload
        };

        await createEvent(payload);

        draftModal.hide();
        draftEvent.remove(); 
    });

    document.getElementById('btn-delete-draft').addEventListener('click', () => {
        const draftEvent = calendar.getEventById('draft-event');
        if (draftEvent) draftEvent.remove();
        draftModal.hide();
    });

    // Función auxiliar para extraer la lógica del PUT
    function syncEventChange(info) {
        const eventData = {
            title: info.event.title,
            start_time: info.event.start.toISOString(),
            end_time: info.event.end ? info.event.end.toISOString() : info.event.start.toISOString(),
            type: info.event.extendedProps.type,
            color: info.event.extendedProps.color,
            description: info.event.extendedProps.description,
            periodicity: info.event.extendedProps.periodicity
        };
        
        fetch(`${API_BASE}/${info.event.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        })
        .then(res => { if(!res.ok) throw new Error(); })
        .catch(() => info.revert()); 
    }
}