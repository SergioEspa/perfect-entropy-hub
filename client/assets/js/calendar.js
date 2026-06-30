import { CONFIG } from "./config.js"; 
import { createEvent, deleteEvent, getEvents, updateEvent, voteEvent } from "./service.js";

const API_BASE = `${CONFIG.API_URL}/api/calendar`;

const getColorsForType = (type) => {
    let bg = 'rgba(6, 182, 212, 0.15)'; // Default (ENSAYO)
    let border = '#06b6d4';
    
    if (type === 'GRABACION') {
        bg = 'rgba(234, 179, 8, 0.1)';
        border = '#eab308';
    } else if (type === 'CONCIERTO') {
        bg = 'rgba(239, 68, 68, 0.12)';
        border = '#ef4444';
    } else if (type === 'REUNION') { 
        bg = 'rgba(139, 92, 246, 0.15)';
        border = '#8b5cf6';
    } else if (type === 'LLAMADA') {
        bg = 'rgba(6, 212, 57, 0.15)';
        border = '#44ef77';
    }
    return { bg, border };
};

const defaultColors = getColorsForType('ENSAYO');


const getInstrumentIcon = (id) => {
    const map = {
        1: 'fa-solid fa-microphone-lines',
        2: 'fa-solid fa-guitar',
        3: 'fa-solid fa-bolt',
        4: 'fa-solid fa-wave-square',
        5: 'fa-solid fa-drum'
    };
    return map[id] || 'fa-solid fa-user';
};

const getMemberName = (id) => {
    const map = {
        1: 'Cosmin',
        2: 'Adri',
        3: 'TSG',
        4: 'Sergio',
        5: 'Alex'
    };
    return map[id] || `Usuario ${id}`;
};

export const initializeCalendar = () => {
    const calendarEl = document.getElementById('calendar-root');
    if (!calendarEl) return;
    
    let eventIds = [];
    let clickedEvent = null;
    
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
    const confirmDeleteModalEl = document.getElementById('confirmDelete');
    document.body.appendChild(confirmDeleteModalEl);
    const confirmDeleteModal = new bootstrap.Modal(confirmDeleteModalEl);

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'es',
        buttonText: {
            today:    'Hoy',
            month:    'Mes',
            week:     'Semana',
            day:      'Día',
            list:     'Agenda'
        },
        weekText: 'Sm',
        allDayText: 'Todo el día',
        moreLinkText: function(n) {
            return '+ ver ' + n + ' más';
        },
        noEventsText: 'No hay eventos para mostrar',
        firstDay: 1,
        slotMinTime: '09:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        eventBackgroundColor: 'rgba(6, 182, 212, 0.15)',
        eventBorderColor: '#06b6d4',
        eventTextColor: '#06b6d4',
        eventDisplay: 'block',
        
        eventContent: function(arg) {
            const title = arg.event.title;
            const timeText = arg.timeText;

            // Cortafuegos: El "fantasma" de proponer no lleva botones
            if (arg.event.id === 'draft-event') {
                return { html: `<div class="fc-event-main-frame"><div class="fc-event-time">${timeText}</div><div class="fc-event-title-container"><div class="fc-event-title fc-sticky">${title}</div></div></div>` };
            }

            const votes = arg.event.extendedProps.votes || [];
            const isMonthView = arg.view.type === 'dayGridMonth'; // 🚨 Detectamos la vista

            // HTML común: Botones de votación
            const buttonsHtml = `
                <div class="d-flex align-items-center position-absolute top-0 end-0 p-1" style="z-index: 5;">
                    <button class="btn btn-success rounded-circle p-0 me-1 d-flex align-items-center justify-content-center vote-btn-yes" style="width: 18px; height: 18px;" title="Asisto">
                        <i class="bi bi-check text-white"></i>
                    </button>
                    <button class="btn btn-secondary rounded-circle p-0 me-1 d-flex align-items-center justify-content-center vote-btn-null" style="width: 18px; height: 18px;" title="No lo sé">
                        <i class="bi bi-dash text-white"></i>
                    </button>
                    <button class="btn btn-danger rounded-circle p-0 d-flex align-items-center justify-content-center vote-btn-no" style="width: 18px; height: 18px;" title="No asisto">
                        <i class="bi bi-x text-white"></i>
                    </button>
                </div>
            `;

            if (isMonthView) {
                // 🚨 VISTA DE MES: Solo título (centrado) y botones
                return {
                    html: `<div class="fc-event-main-frame position-relative" style="padding-right: 65px; min-height: 26px;">
                               <div class="fc-event-title-container d-flex align-items-center h-100 ps-1">
                                   <div class="fc-event-title fc-sticky fw-bold text-truncate">${title}</div>
                               </div>
                               ${buttonsHtml}
                           </div>`
                };
            } else {
                // 🚨 VISTA SEMANAL: Diseño completo (Hora, Título, Badges y Botones)
                let badgesHtml = '<div class="d-flex gap-1 mt-1 flex-wrap">';
                votes.forEach(v => {
                    const iconClass = getInstrumentIcon(v.user_id);
                    const name = getMemberName(v.user_id);

                    if (v.can_attend === true) {
                        badgesHtml += `<span class="badge border border-success text-success bg-dark rounded-circle d-flex align-items-center justify-content-center" style="width: 18px; height: 18px; font-size: 9px;" data-bs-toggle="tooltip" data-bs-title="${name} asiste"><i class="${iconClass}"></i></span>`;
                    } else if (v.can_attend === false) {
                        badgesHtml += `<span class="badge border border-danger text-danger bg-dark rounded-circle d-flex align-items-center justify-content-center" style="width: 18px; height: 18px; font-size: 9px; opacity: 0.4;" data-bs-toggle="tooltip" data-bs-title="${name} no asiste"><i class="${iconClass}"></i></span>`;
                    }
                });
                badgesHtml += '</div>';

                return {
                    html: `<div class="fc-event-main-frame position-relative" style="padding-right: 65px;">
                               <div class="fc-event-time fw-bold">${timeText}</div>
                               <div class="fc-event-title-container">
                                   <div class="fc-event-title fc-sticky">${title}</div>
                               </div>
                               ${badgesHtml} ${buttonsHtml}
                           </div>`
                };
            }
        },

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
            right: 'dayGridMonth,timeGridWeek'
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
                events: async function(fetchInfo, successCallback, failureCallback) {
                    try{
                        const date = new Date();
                        const day = date.getDate();
                        const month = date.getMonth() + 1;
                        const year = date.getFullYear();
                        const formattedDay = (day < 10) ? `0${day}` : `${day}`
                        const formattedMonth = (month < 10) ? `0${month}` : `${month}`
                        
                        const rawEvents = await getEvents(`${year}-${formattedMonth}-${formattedDay}`, "all");

                        const mappedEvents = rawEvents.map(ev => {
                            const colors = getColorsForType(ev.type);

                            return {
                                id: ev.id,
                                title: ev.title,
                                start: ev.start_time,
                                end: ev.end_time,
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                textColor: colors.border,
                                extendedProps: {
                                    type: ev.type,
                                    description: ev.description,
                                    periodicity: ev.periodicity,
                                    status: ev.status,
                                    votes: ev.votes
                                }
                            };
                        });
                        eventIds = mappedEvents.map(ev => ev.id);
                        successCallback(mappedEvents);
                    } catch(error) {
                        console.error("Error trayendo eventos:", error);
                        failureCallback(error);
                    }
                },
                id: 'source-oficial',
                color: 'rgba(6, 182, 212, 0.15)',
                borderColor: '#06b6d4',
                textColor: '#f3f4f6'
            },
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
                    backgroundColor: defaultColors.bg,
                    borderColor: defaultColors.border,
                    textColor: defaultColors.border,
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
                openEventModal(calendar.getEventById('draft-event'));

                clickedEvent = null;
            }
        },


        eventClick: function(info) {
            const jsEvent = info.jsEvent;

            if (jsEvent.target.closest('.vote-btn-yes')) {
                handleVote(info.event.id, true);
                return;
            }

            if (jsEvent.target.closest('.vote-btn-null')) {
                handleVote(info.event.id, null);
                return;
            }

            if (jsEvent.target.closest('.vote-btn-no')) {
                handleVote(info.event.id, false);
                return;
            }

            clickedEvent = info.event;
            openEventModal(clickedEvent);
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
        },

        eventDidMount: function(info) {
            // 1. Inicializar tooltips nativos de los badges (Vista Semanal)
            info.el.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));

            // 2. 🚨 Crear el super-tooltip de información (Vista Mensual)
            if (info.view.type === 'dayGridMonth' && info.event.id !== 'draft-event') {
                const votes = info.event.extendedProps.votes || [];
                let attending = [];
                let notAttending = [];
                
                votes.forEach(v => {
                    const name = getMemberName(v.user_id);
                    if (v.can_attend === true) attending.push(name);
                    else if (v.can_attend === false) notAttending.push(name);
                });

                // Construimos el HTML interno del Tooltip
                let tooltipContent = `<div class="text-start" style="min-width: 160px;">`;
                
                if (info.timeText) {
                    tooltipContent += `<div class="mb-1 border-bottom border-secondary pb-1"><strong><i class="bi bi-clock me-1"></i>${info.timeText}</strong></div>`;
                }
                
                if (info.event.extendedProps.description) {
                    tooltipContent += `<div class="mb-2 small border-start border-2 border-info ps-2 text-light">${info.event.extendedProps.description}</div>`;
                }

                if (attending.length > 0) {
                    tooltipContent += `<div class="small text-success mt-1"><i class="bi bi-check-circle me-1"></i>${attending.join(', ')}</div>`;
                }
                if (notAttending.length > 0) {
                    tooltipContent += `<div class="small text-danger opacity-75 mt-1"><i class="bi bi-x-circle me-1"></i>${notAttending.join(', ')}</div>`;
                }
                
                tooltipContent += `</div>`;

                // Instanciamos el Tooltip sobre el contenedor principal del evento
                new bootstrap.Tooltip(info.el, {
                    title: tooltipContent,
                    html: true,
                    placement: 'top',
                    trigger: 'hover',
                    container: 'body' // Crucial: Evita que la celda del calendario corte el tooltip visualmente
                });
            }
        },
        eventWillUnmount: function(info) {
            // 1. Destruimos el super-tooltip de la vista mensual (anclado al contenedor principal)
            const mainTooltip = bootstrap.Tooltip.getInstance(info.el);
            if (mainTooltip) {
                mainTooltip.dispose();
            }

            // 2. Destruimos también los mini-tooltips de los badges por seguridad (Vista semanal)
            info.el.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                const badgeTooltip = bootstrap.Tooltip.getInstance(el);
                if (badgeTooltip) {
                    badgeTooltip.dispose();
                }
            });
        },
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

    const openEventModal = (eventObj) => {
        document.getElementById('draft-title').value = eventObj.title === 'Nueva Propuesta' ? '' : eventObj.title;
        document.getElementById('draft-type').value = eventObj.extendedProps.type || 'ENSAYO';
        document.getElementById('draft-desc').value = eventObj.extendedProps.description || '';
        document.getElementById('draft-periodicity').value = eventObj.extendedProps.periodicity || 'SINGLE';
        
        // Inyectamos las horas extraídas del grid visual
        document.getElementById('draft-start-time').value = getLocalTimeString(eventObj.start);
        document.getElementById('draft-end-time').value = getLocalTimeString(eventObj.end || eventObj.start);
        
        const isSeries = eventObj.extendedProps.periodicity && eventObj.extendedProps.periodicity !== "SINGLE";
        const exists = eventObj.id !== 'draft-event';
        document.getElementById('btn-save-draft-all').style.display = (isSeries && exists) ? 'block' : 'none';

        draftModal.show();

        draftModalEl.addEventListener('hidden.bs.modal', () => {
            const draftEvent = calendar.getEventById('draft-event');
            if (draftEvent) draftEvent.remove();
        });
    }

    // --- REACTIVIDAD EN TIEMPO REAL ---
    document.getElementById('draft-title').addEventListener('input', (e) => {
        const draftEvent = calendar.getEventById('draft-event');
        if (draftEvent) draftEvent.setProp('title', e.target.value || 'Nueva Propuesta');
    });
    
    document.getElementById('draft-type').addEventListener('change', (e) => {
        const draftEvent = calendar.getEventById('draft-event');
        if (draftEvent) {
            const colors = getColorsForType(e.target.value);
            draftEvent.setProp('backgroundColor', colors.bg);
            draftEvent.setProp('borderColor', colors.border);
            draftEvent.setProp('textColor', colors.border);
        }
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
        const form = document.getElementById('draft-form');        
        const create = clickedEvent === null;
        
        if (create && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const baseEvent = create ? calendar.getEventById('draft-event') : clickedEvent;
        if (!baseEvent) return;
        const baseDate = baseEvent.start;
        const startTimeInput = document.getElementById('draft-start-time').value;
        const endTimeInput = document.getElementById('draft-end-time').value;
        const [startHours, startMins] = startTimeInput.split(':');
        const finalStartDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHours, startMins);
        let finalEndDate = finalStartDate;
        if (endTimeInput) {
            const [endHours, endMins] = endTimeInput.split(':');
            finalEndDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHours, endMins);            
            if (finalEndDate < finalStartDate) {
                finalEndDate = finalStartDate;
            }
        }

        
        try {
            if (create) {
                const payload = {
                    title: document.getElementById('draft-title').value,
                    start_time: finalStartDate.toISOString(),
                    end_time: finalEndDate.toISOString(),
                    type: document.getElementById('draft-type').value,
                    description: document.getElementById('draft-desc').value,
                    periodicity: document.getElementById('draft-periodicity').value
                };
                await createEvent(payload);
            } else {
                const calendarEvent = calendar.getEventById(clickedEvent.id);
                const payload = {
                    id: clickedEvent.id,
                    title: document.getElementById('draft-title').value,
                    start_time: finalStartDate.toISOString(),
                    end_time: finalEndDate.toISOString(),
                    type: document.getElementById('draft-type').value,
                    description: document.getElementById('draft-desc').value,
                    periodicity: document.getElementById('draft-periodicity').value
                };
                await updateEvent(clickedEvent.id, payload);
                calendarEvent.remove();
            }
            draftModal.hide();
            calendar.refetchEvents(); 
        } catch (error) {
            alert("Hubo un error al guardar el evento.");
            console.error(error);
        }
    });

    document.getElementById('btn-save-draft-all').addEventListener('click', async () => {
        const form = document.getElementById('draft-form');        
        const create = clickedEvent === null;
        
        if (create && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const baseEvent = create ? calendar.getEventById('draft-event') : clickedEvent;
        if (!baseEvent) return;
        const baseDate = baseEvent.start;
        const startTimeInput = document.getElementById('draft-start-time').value;
        const endTimeInput = document.getElementById('draft-end-time').value;
        const [startHours, startMins] = startTimeInput.split(':');
        const finalStartDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHours, startMins);
        let finalEndDate = finalStartDate;
        if (endTimeInput) {
            const [endHours, endMins] = endTimeInput.split(':');
            finalEndDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHours, endMins);            
            if (finalEndDate < finalStartDate) {
                finalEndDate = finalStartDate;
            }
        }

        try {
            const payload = {
                id: clickedEvent.id,
                title: document.getElementById('draft-title').value,
                start_time: finalStartDate.toISOString(),
                end_time: finalEndDate.toISOString(),
                type: document.getElementById('draft-type').value,
                description: document.getElementById('draft-desc').value,
                periodicity: document.getElementById('draft-periodicity').value
            };
            await updateEvent(clickedEvent.id, payload, true); // 🚨 true para la serie
            draftModal.hide();
            calendar.refetchEvents(); 
        } catch (error) {
            alert("Hubo un error al guardar la serie.");
        }
    });

    const callDeleteEvent = async (all) => {
        const baseEvent = clickedEvent;
        
        if (baseEvent) {
            try {
                await deleteEvent(baseEvent.id, all); 
                
                baseEvent.remove();
                confirmDeleteModal.hide();
                draftModal.hide();
                calendar.refetchEvents();
                
            } catch (error) {
                alert("Hubo un error al borrar.");
                console.error(error);
            }
        }
    }

    // BORRADO AQUÍ
    document.getElementById('btn-delete-draft').addEventListener('click', () => {
        const deleteAllButton = document.getElementById('btn-confirm-delete-all');
        const periodicity = clickedEvent ? clickedEvent.extendedProps.periodicity : "SINGLE";
        console.log("PERIODICITY DETECTED:", periodicity);
        deleteAllButton.classList.toggle('d-none', periodicity === "SINGLE");
        confirmDeleteModal.show();
    });

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
        await callDeleteEvent(false);
    });

    document.getElementById('btn-confirm-delete-all').addEventListener('click', async () => {
        await callDeleteEvent(true);
    });

    async function syncEventChange(info) {
        const payload = {
            id: info.event.id,
            title: info.event.title,
            start_time: info.event.start.toISOString(),
            end_time: info.event.end ? info.event.end.toISOString() : info.event.start.toISOString(),
            type: info.event.extendedProps.type,
            description: info.event.extendedProps.description,
            periodicity: info.event.extendedProps.periodicity
        };
        
        try {
            await updateEvent(info.event.id, payload);
        } catch (error) {
            info.revert();
            alert("No se pudo mover el evento.");
        }
    }

    const handleVote = async (eventId, vote) => {
        try {
            await voteEvent(eventId, vote);
            calendar.refetchEvents();
        } catch (error) {
            console.log("No se pudo registrar tu voto.");
        }
    }
}