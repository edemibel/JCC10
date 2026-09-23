/* =========================================================================
   PORTAL JUDICIAL PWA - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10
   Lógica Integral: PWA, Base de Datos IndexedDB, Consulta Ciudadana y Multi-Rol
   ========================================================================= */

// ── Estado Global de la Aplicación ─────────────────────────────────────────
const AppState = {
    currentTab: 'agendamiento',
    currentStep: 1,
    selectedType: null,
    selectedModalidad: 'presencial',
    selectedSlot: null,
    currentAdmin: null,
    hearings: [],
    admins: [],
    deferredPrompt: null
};

// ── Tipos de Audiencias Oficiales (Ley 439) ─────────────────────────────────
const HEARING_TYPES = {
    'remates': {
        label: 'Audiencia de Remate y Subasta Judicial',
        code: 'REM',
        icon: 'fa-gavel',
        articulo: 'Art. 419 Ley N° 439',
        instrucciones: 'Obligatorio empozo de garantía del 20% en Banco Unión. Presentar publicación original de prensa.',
        requisitos: [
            'Depósito judicial del 20% en el Banco Unión.',
            'C.I. original del postor o Poder Notariado con facultad especial de postura.',
            'Publicación de prensa en original conforme al Art. 419 del Código Procesal Civil.'
        ]
    },
    'ordinarios': {
        label: 'Proceso Ordinario (Audiencia Preliminar / Complementaria)',
        code: 'ORD',
        icon: 'fa-file-signature',
        articulo: 'Arts. 365 y 368 Ley N° 439',
        instrucciones: 'Comparecencia personal obligatoria de partes. Se resolverán excepciones previas y conciliación intra-procesal.',
        requisitos: [
            'Comparecencia personal de las partes procesales (Art. 365.I).',
            'Ratificación de demanda o contestación escrita.',
            'Credencial profesional vigente del abogado patrocinante (RPA / ICBA).'
        ]
    },
    'monitorio': {
        label: 'Proceso Monitorio Ejecutivo',
        code: 'MON',
        icon: 'fa-file-invoice-dollar',
        articulo: 'Art. 375 Ley N° 439',
        instrucciones: 'Cotejo de título ejecutivo con fuerza exigible líquida y citación previa debidamente practicada.',
        requisitos: [
            'Presentación del título ejecutivo original (pagaré, letra de cambio o escritura pública).',
            'Liquidación judicial actualizada de capital, intereses y costas.',
            'Cédula de citación personal diligenciada por el Oficial de Diligencias.'
        ]
    },
    'coactivos': {
        label: 'Procesos Coactivos Civiles',
        code: 'COA',
        icon: 'fa-scale-unbalanced-flip',
        articulo: 'Art. 404 Ley N° 439',
        instrucciones: 'Ejecución sobre garantía real hipotecaria o prendaria inscrita en Derechos Reales.',
        requisitos: [
            'Título coactivo con constancia de registro en Derechos Reales.',
            'Mandamiento de embargo o intimación de pago diligenciada.'
        ]
    },
    'conciliaciones': {
        label: 'Audiencia de Conciliación Previa',
        code: 'CON',
        icon: 'fa-handshake',
        articulo: 'Art. 292 Ley N° 439',
        instrucciones: 'Audiencia voluntaria y confidencial con carácter de cosa juzgada.',
        requisitos: [
            'Concurrencia personal obligatoria de ambas partes (no apoderados sin mandato especial para transigir).',
            'Cédula de Identidad original vigente.',
            'Cultura de paz y ánimo de transacción pacífica.'
        ]
    }
};

// ── Inicialización de la Aplicación ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    // 1. Detectar modo embebido (Google Sites, iframe)
    if (window.self !== window.top) {
        document.body.classList.add('embedded-mode');
    }

    // 2. Inicializar PWA (Service Worker & Eventos de Red)
    initPWA();

    // 3. Inicializar Base de Datos IndexedDB y Cargar Datos
    await reloadDataFromDB();

    // 4. Configurar Selector de Fecha (mínimo hoy)
    const dateInput = document.getElementById('hearing-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // 5. Cargar Código para Google Sites
    loadEmbedCode();

    // 6. Revisar parámetros en URL (ej. ?tab=consulta) para accesos directos PWA
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = urlParams.get('tab');
    if (requestedTab && ['agendamiento', 'consulta', 'requisitos', 'secretaria', 'embed-guide'].includes(requestedTab)) {
        switchTab(requestedTab);
    }

    // Si viene en consulta por defecto, realizar búsqueda inicial
    if (requestedTab === 'consulta') {
        searchHearingsCitizen();
    }
});

// ── Carga y Sincronización con Base de Datos IndexedDB ──────────────────────
async function reloadDataFromDB() {
    try {
        if (typeof JCC10_DB !== 'undefined') {
            AppState.hearings = await JCC10_DB.getAllHearings();
            AppState.admins = await JCC10_DB.getAllUsers();
        } else {
            // Fallback localStorage
            const savedHearings = localStorage.getItem('jcc10_hearings');
            const savedAdmins = localStorage.getItem('jcc10_admins');
            if (savedHearings) AppState.hearings = JSON.parse(savedHearings);
            if (savedAdmins) AppState.admins = JSON.parse(savedAdmins);
        }
    } catch (err) {
        console.error('Error cargando base de datos:', err);
    }

    updateStats();
    renderRoleWorkspace();
    renderAdminUsers();
    renderAuditLogs();
}

// ── PWA: Service Worker, Instalación y Estado de Red ───────────────────────
function initPWA() {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => {
                    console.log('✅ PWA Service Worker registrado con éxito en el scope:', reg.scope);
                })
                .catch((err) => {
                    console.warn('⚠️ No se pudo registrar el Service Worker (esperado si es iframe restringido):', err);
                });
        });
    }

    // Capturar evento de instalación
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        AppState.deferredPrompt = e;
        const btnInstall = document.getElementById('btn-pwa-install');
        if (btnInstall) {
            btnInstall.classList.remove('hidden');
        }
    });

    // Detectar cuando ya se instaló
    window.addEventListener('appinstalled', () => {
        console.log('🎉 PWA instalada exitosamente en el dispositivo.');
        const btnInstall = document.getElementById('btn-pwa-install');
        if (btnInstall) btnInstall.classList.add('hidden');
        AppState.deferredPrompt = null;
    });

    // Detección de conectividad (Online / Offline)
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
}

function updateNetworkStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) return;

    if (!navigator.onLine) {
        offlineIndicator.classList.remove('hidden');
    } else {
        offlineIndicator.classList.add('hidden');
    }
}

async function triggerPWAInstall() {
    if (!AppState.deferredPrompt) {
        alert('ℹ️ Para instalar esta PWA judicial:\n- En Google Chrome / Edge: Presione el ícono de "Instalar" en la barra de direcciones.\n- En teléfono móvil: Toque el menú (⋮) y elija "Agregar a la pantalla principal".');
        return;
    }

    AppState.deferredPrompt.prompt();
    const { outcome } = await AppState.deferredPrompt.userChoice;
    console.log(`Resultado de instalación PWA: ${outcome}`);
    AppState.deferredPrompt = null;
    const btnInstall = document.getElementById('btn-pwa-install');
    if (btnInstall) btnInstall.classList.add('hidden');
}

// ── Navegación entre Pestañas Principales ───────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.add('hidden');
        pane.classList.remove('active');
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetPane = document.getElementById('tab-' + tabId);
    if (targetPane) {
        targetPane.classList.remove('hidden');
        targetPane.classList.add('active');
    }

    const targetBtn = document.getElementById('nav-btn-' + tabId);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    AppState.currentTab = tabId;

    if (tabId === 'consulta' && !document.getElementById('citizen-hearing-details').innerHTML.trim()) {
        searchHearingsCitizen();
    } else if (tabId === 'secretaria') {
        renderRoleWorkspace();
    }
}

// ── Stepper de Agendamiento de Audiencias ───────────────────────────────────
function selectHearingType(typeKey, cardElement) {
    document.querySelectorAll('.hearing-card').forEach(card => card.classList.remove('selected'));
    cardElement.classList.add('selected');
    AppState.selectedType = typeKey;

    const btnNext = document.getElementById('btn-step-1-next');
    if (btnNext) btnNext.disabled = false;
}

function selectModalidad(modKey, cardElement) {
    document.querySelectorAll('.mod-card').forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    AppState.selectedModalidad = modKey;
}

function goToStep(stepNum) {
    if (stepNum === 2 && !AppState.selectedType) {
        alert('Por favor seleccione un tipo de audiencia primero.');
        return;
    }

    if (stepNum === 3) {
        const form = document.getElementById('form-case-details');
        if (form && !form.checkValidity()) {
            form.reportValidity();
            return;
        }
    }

    for (let i = 1; i <= 4; i++) {
        const stepContent = document.getElementById('step-' + i);
        if (stepContent) stepContent.classList.add('hidden');
        const indicator = document.getElementById('step-indicator-' + i);
        if (indicator) {
            if (i < stepNum) {
                indicator.classList.remove('active');
                indicator.classList.add('completed');
            } else if (i === stepNum) {
                indicator.classList.add('active');
                indicator.classList.remove('completed');
            } else {
                indicator.classList.remove('active', 'completed');
            }
        }
    }

    const target = document.getElementById('step-' + stepNum);
    if (target) target.classList.remove('hidden');
    AppState.currentStep = stepNum;
}

function loadAvailableSlots() {
    const dateInput = document.getElementById('hearing-date');
    const slotsGrid = document.getElementById('slots-grid');
    const finishBtn = document.getElementById('btn-finish-booking');

    if (!dateInput || !dateInput.value) return;

    const selectedDate = new Date(dateInput.value + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        slotsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 20px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; color: #991B1B; text-align: center;">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <strong>Día No Hábil Judicial:</strong> Las audiencias solo se programan de lunes a viernes en días laborables.
            </div>
        `;
        if (finishBtn) finishBtn.disabled = true;
        return;
    }

    const allSlots = ['08:30', '09:15', '10:00', '10:45', '11:30', '14:30', '15:15', '16:00', '16:45', '17:30'];
    const booked = AppState.hearings.filter(h => h.fecha === dateInput.value).map(h => h.hora);

    slotsGrid.innerHTML = allSlots.map(time => {
        const isBooked = booked.includes(time);
        if (isBooked) {
            return `<div class="slot-item slot-occupied" title="Turno judicial ocupado">
                <i class="fa-solid fa-ban"></i> ${time} (Ocupado)
            </div>`;
        } else {
            return `<div class="slot-item slot-available" onclick="selectSlot('${time}', this)">
                <i class="fa-solid fa-clock"></i> ${time}
            </div>`;
        }
    }).join('');

    AppState.selectedSlot = null;
    if (finishBtn) finishBtn.disabled = true;
}

function selectSlot(time, element) {
    document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    AppState.selectedSlot = time;

    const finishBtn = document.getElementById('btn-finish-booking');
    if (finishBtn) finishBtn.disabled = false;
}

// ── Procesamiento de Agendamiento y Guardado en Base de Datos ──────────────
async function processBooking() {
    if (!AppState.selectedSlot) {
        alert('Seleccione un turno de horario disponible.');
        return;
    }

    const nurej = document.getElementById('case-nurej').value.trim();
    const expediente = document.getElementById('case-expediente').value.trim() || ('EXP-' + Math.floor(100 + Math.random() * 900) + '/2026');
    const demandante = document.getElementById('case-demandante').value.trim();
    const demandado = document.getElementById('case-demandado').value.trim();
    const abogado = document.getElementById('case-abogado').value.trim();
    const matricula = document.getElementById('case-matricula').value.trim();
    const telefono = document.getElementById('case-telefono').value.trim();
    const email = document.getElementById('case-email').value.trim();
    const fecha = document.getElementById('hearing-date').value;
    const observaciones = document.getElementById('observaciones').value.trim();

    const typeConfig = HEARING_TYPES[AppState.selectedType] || {
        label: 'Audiencia Judicial',
        articulo: 'Ley N° 439',
        instrucciones: 'Presentarse con 15 minutos de anticipación.',
        requisitos: ['Cédula de Identidad original.']
    };

    const newHearing = {
        id: 'AUD-2026-' + Math.floor(10000 + Math.random() * 90000),
        nurej: nurej,
        expediente: expediente,
        tipo: AppState.selectedType,
        tipoLabel: typeConfig.label,
        demandante: demandante,
        demandado: demandado,
        abogado: abogado,
        matricula: matricula,
        telefono: telefono,
        email: email,
        modalidad: AppState.selectedModalidad,
        lugarFisico: AppState.selectedModalidad === 'presencial' ? 'Sala de Audiencias N° 10 - Piso 3, Edif. Judicial Central' : 'Sala Virtual N° 10 (Plataforma Judicial)',
        salaVirtualLink: AppState.selectedModalidad === 'virtual' ? `https://audiencias.organojudicial.bo/sala10-jcc?session=${encodeURIComponent(nurej)}` : '',
        fecha: fecha,
        hora: AppState.selectedSlot,
        estado: 'Pendiente',
        observaciones: observaciones,
        notificadaWA: false,
        fechaRegistro: new Date().toISOString(),
        instruccionesAudiencia: typeConfig.instrucciones,
        requisitosLegales: typeConfig.requisitos,
        diligencia: {
            estadoDiligencia: 'Pendiente de Citación',
            oficialNombre: 'Asignado a Oficial de Diligencias',
            fechaDiligencia: '',
            observacionDiligencia: 'En despacho para emisión de cédula de notificación.',
            constanciaNotificacion: 'PENDIENTE'
        },
        resolucionJuez: {
            estadoJudicial: 'Señalamiento en Trámite',
            actaResumen: 'Solicitud ingresada por secretaría. Pendiente de resolución de señalamiento.',
            juezNombre: 'Dr. Juan Carlos Medina Roca'
        }
    };

    // Guardar en Base de Datos IndexedDB
    try {
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.saveHearing(newHearing);
        } else {
            AppState.hearings.unshift(newHearing);
            localStorage.setItem('jcc10_hearings', JSON.stringify(AppState.hearings));
        }
    } catch (e) {
        console.error('Error al guardar audiencia:', e);
    }

    // Actualizar datos en memoria
    await reloadDataFromDB();

    // Rellenar comprobante oficial del Paso 4
    document.getElementById('ticket-id').textContent = newHearing.id;
    document.getElementById('t-nurej').textContent = `${newHearing.nurej} (${newHearing.expediente})`;
    document.getElementById('t-tipo').textContent = newHearing.tipoLabel;
    document.getElementById('t-demandante').textContent = newHearing.demandante;
    document.getElementById('t-demandado').textContent = newHearing.demandado;
    document.getElementById('t-abogado').textContent = newHearing.abogado;
    document.getElementById('t-mat').textContent = newHearing.matricula;
    document.getElementById('t-modalidad').textContent = newHearing.modalidad.toUpperCase();
    document.getElementById('t-fecha').textContent = formatDateES(newHearing.fecha);
    document.getElementById('t-hora').textContent = newHearing.hora + ' hrs';
    document.getElementById('t-lugar').textContent = newHearing.lugarFisico;

    // Generar QR en el ticket
    generateInlineQR('ticket-qr-box', `${newHearing.id}|${newHearing.nurej}|${newHearing.fecha}|${newHearing.hora}`);

    // Ir al paso 4
    goToStep(4);
}

function resetForm() {
    const form = document.getElementById('form-case-details');
    if (form) form.reset();
    document.getElementById('hearing-date').value = '';
    document.getElementById('observaciones').value = '';
    document.querySelectorAll('.hearing-card').forEach(c => c.classList.remove('selected'));
    AppState.selectedType = null;
    AppState.selectedSlot = null;
    goToStep(1);
}

// ── =======================================================================
//    CONSULTA CIUDADANA (EXCLUSIVA PARA EFECTOS DE AUDIENCIA)
//    ======================================================================= ──
async function searchHearingsCitizen() {
    const query = (document.getElementById('search-query').value || '').trim();
    const container = document.getElementById('citizen-hearing-details');
    const listContainer = document.getElementById('citizen-results-box');
    const resultsList = document.getElementById('results-list');

    let results = [];
    if (typeof JCC10_DB !== 'undefined') {
        results = await JCC10_DB.searchHearings(query);
    } else {
        results = AppState.hearings;
    }

    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="citizen-card" style="padding: 40px; text-align:center; color:#64748B;">
                <i class="fa-solid fa-magnifying-glass" style="font-size:3rem; color:#CBD5E1; margin-bottom:14px;"></i>
                <h3 style="font-size:1.2rem; color:#0F172A; margin-bottom:6px;">No se encontraron audiencias con ese criterio</h3>
                <p>Verifique que el <strong>NUREJ</strong> o número de expediente esté correctamente escrito, o consulte con Secretaría Judicial.</p>
            </div>
        `;
        listContainer.classList.add('hidden');
        return;
    }

    // Si hay una coincidencia exacta o es la primera, renderizamos la ficha completa
    const mainHearing = results[0];
    renderCitizenAudienceCard(mainHearing);

    // Si hay más de un resultado, listar las demás abajo
    if (results.length > 1) {
        listContainer.classList.remove('hidden');
        resultsList.innerHTML = results.map(h => `
            <div class="hearing-result-card" onclick="renderCitizenAudienceCardById('${h.id}')" style="cursor:pointer;" title="Click para ver ficha de audiencia">
                <div class="result-icon">
                    <i class="fa-solid fa-scale-balanced"></i>
                </div>
                <div class="result-info">
                    <h4>${h.tipoLabel} — <span style="color:#D97706;">NUREJ: ${h.nurej}</span></h4>
                    <p><strong>Causa:</strong> ${h.demandante} vs. ${h.demandado}</p>
                    <p><strong>Audiencia:</strong> ${formatDateES(h.fecha)} a las ${h.hora} hrs | <strong>Modalidad:</strong> ${h.modalidad}</p>
                </div>
                <span class="result-status ${getStatusClass(h.estado)}">${h.estado}</span>
            </div>
        `).join('');
    } else {
        listContainer.classList.add('hidden');
    }
}

function quickSearchNurej(nurej) {
    const input = document.getElementById('search-query');
    if (input) {
        input.value = nurej;
        searchHearingsCitizen();
    }
}

async function renderCitizenAudienceCardById(hearingId) {
    let hearing = null;
    if (typeof JCC10_DB !== 'undefined') {
        hearing = await JCC10_DB.getHearingById(hearingId);
    } else {
        hearing = AppState.hearings.find(h => h.id === hearingId);
    }
    if (hearing) {
        renderCitizenAudienceCard(hearing);
        window.scrollTo({ top: document.getElementById('tab-consulta').offsetTop - 60, behavior: 'smooth' });
    }
}

function renderCitizenAudienceCard(h) {
    const container = document.getElementById('citizen-hearing-details');
    if (!container) return;

    const typeInfo = HEARING_TYPES[h.tipo] || {
        label: h.tipoLabel,
        articulo: 'Código Procesal Civil (Ley 439)',
        instrucciones: h.instruccionesAudiencia || 'Presentarse con 15 minutos de anticipación.',
        requisitos: h.requisitosLegales || ['Cédula de Identidad original.']
    };

    const statusBadgeClasses = {
        'Confirmada': 'background:#D1FAE5; color:#065F46; border:1px solid #10B981;',
        'Pendiente': 'background:#FEF3C7; color:#92400E; border:1px solid #F59E0B;',
        'Celebrada': 'background:#E2E8F0; color:#334155; border:1px solid #94A3B8;',
        'Concluida': 'background:#E2E8F0; color:#334155; border:1px solid #94A3B8;',
        'Suspendida': 'background:#FEE2E2; color:#991B1B; border:1px solid #EF4444;',
        'Reprogramada': 'background:#E0E7FF; color:#3730A3; border:1px solid #6366F1;'
    };

    const diligenciaStatus = h.diligencia ? h.diligencia.estadoDiligencia : 'Pendiente de Citación';
    const diligenciaOficial = h.diligencia ? (h.diligencia.oficialNombre || 'Oficial de Diligencias') : 'Asignado a Oficial de Diligencias';
    const diligenciaConstancia = h.diligencia ? (h.diligencia.constanciaNotificacion || 'En trámite') : 'En trámite';

    container.innerHTML = `
        <div class="citizen-card" id="citizen-card-${h.id}">
            <div class="citizen-card-header">
                <div class="citizen-title-wrap">
                    <span class="citizen-nurej-pill"><i class="fa-solid fa-hashtag"></i> NUREJ: ${h.nurej}</span>
                    <h3 style="margin-top:6px;">${h.tipoLabel}</h3>
                    <small style="color:#CBD5E1;"><i class="fa-solid fa-folder"></i> Causa / Exp: ${h.expediente || 'S/N'} | Base Legal: ${typeInfo.articulo}</small>
                </div>
                <div>
                    <span class="citizen-status-badge" style="${statusBadgeClasses[h.estado] || statusBadgeClasses['Pendiente']}">
                        <i class="fa-solid fa-circle-dot"></i> Audiencia ${h.estado}
                    </span>
                </div>
            </div>

            <div class="citizen-card-body">
                <!-- Grid de Información Oficial de Audiencia -->
                <div class="citizen-grid">
                    <!-- Box 1: Convocatoria & Estrado -->
                    <div class="citizen-box">
                        <h4><i class="fa-solid fa-calendar-check"></i> Señalamiento de Audiencia</h4>
                        <div class="citizen-info-row">
                            <strong>Fecha de Audiencia</strong>
                            <span style="font-size:1.05rem; font-weight:700; color:#0B192C;">${formatDateES(h.fecha)}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Hora de Instalación</strong>
                            <span style="font-size:1.05rem; font-weight:700; color:#D97706;"><i class="fa-solid fa-clock"></i> ${h.hora} hrs</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Modalidad</strong>
                            <span style="font-weight:600; text-transform:uppercase;">${h.modalidad}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Lugar / Sala</strong>
                            <span>${h.lugarFisico}</span>
                        </div>
                        ${h.modalidad === 'virtual' && h.salaVirtualLink ? `
                            <div style="margin-top:12px;">
                                <a href="${h.salaVirtualLink}" target="_blank" class="btn btn-sm btn-primary" style="display:inline-flex; align-items:center; gap:6px;">
                                    <i class="fa-solid fa-video"></i> Ingresar a Sala Virtual de Audiencia
                                </a>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Box 2: Partes Procesales Intervinientes -->
                    <div class="citizen-box">
                        <h4><i class="fa-solid fa-users"></i> Partes Procesales Intervinientes</h4>
                        <div class="citizen-info-row">
                            <strong>Parte Demandante / Solicitante</strong>
                            <span>${h.demandante}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Parte Demandada / Requerida</strong>
                            <span>${h.demandado}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Abogado Patrocinante</strong>
                            <span>${h.abogado} (Matrícula: ${h.matricula})</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Contacto de Notificación</strong>
                            <span>${h.telefono}</span>
                        </div>
                    </div>

                    <!-- Box 3: Estado de Notificación por Oficial de Diligencias -->
                    <div class="citizen-box">
                        <h4><i class="fa-solid fa-envelope-circle-check"></i> Estado de Citación & Notificaciones</h4>
                        <div class="citizen-info-row">
                            <strong>Diligenciamiento de Citación</strong>
                            <span class="diligencia-badge ${getDiligenciaBadgeClass(diligenciaStatus)}">${diligenciaStatus}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Oficial Encargado</strong>
                            <span>${diligenciaOficial}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>N° de Cédula / Acta de Notificación</strong>
                            <span>${diligenciaConstancia}</span>
                        </div>
                        <div class="citizen-info-row">
                            <strong>Aviso por WhatsApp Oficial</strong>
                            <span>${h.notificadaWA ? '✅ Notificado debidamente' : '⏳ Pendiente de aviso telefónico'}</span>
                        </div>
                    </div>
                </div>

                <!-- Efectos Procesales de la Audiencia (Ley 439) -->
                <div class="citizen-instructions-box">
                    <h4><i class="fa-solid fa-gavel"></i> Efectos Procesales e Instrucciones de Comparecencia</h4>
                    <p style="margin-bottom:10px; font-size:0.88rem; color:#78350F;">
                        <strong>Objeto de la Audiencia:</strong> ${h.observaciones || typeInfo.instrucciones}
                    </p>
                    <p style="font-size:0.82rem; font-weight:700; color:#92400E; margin-bottom:6px;">Requisitos Obligatorios para la Audiencia:</p>
                    <ul>
                        ${(h.requisitosLegales || typeInfo.requisitos).map(req => `<li>${req}</li>`).join('')}
                        <li><strong>Tolerancia:</strong> Se otorga una tolerancia estricta de 10 minutos conforme a norma procesal.</li>
                    </ul>
                </div>

                <!-- Barra de Acciones Ciudadanas -->
                <div class="citizen-actions-bar">
                    <button class="btn btn-whatsapp" onclick="sendWhatsAppHearingCitizen('${h.id}')">
                        <i class="fa-brands fa-whatsapp"></i> Recibir Recordatorio Oficial por WhatsApp
                    </button>
                    <button class="btn btn-gold" onclick="printCitizenAudienceCard('${h.id}')">
                        <i class="fa-solid fa-print"></i> Imprimir Pase Oficial de Audiencia
                    </button>
                    <button class="btn btn-secondary" onclick="switchTab('requisitos')">
                        <i class="fa-solid fa-book-bookmark"></i> Ver Protocolos Ley 439
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getDiligenciaBadgeClass(status) {
    if (!status) return 'diligencia-pendiente';
    if (status.includes('Entregada')) return 'diligencia-entregada';
    if (status.includes('Estrados')) return 'diligencia-estrados';
    if (status.includes('WhatsApp') || status.includes('Electrónica')) return 'diligencia-wa';
    return 'diligencia-pendiente';
}

function getStatusClass(status) {
    const map = {
        'Confirmada': 'status-confirmada',
        'Pendiente': 'status-pendiente',
        'Celebrada': 'status-concluida',
        'Concluida': 'status-concluida',
        'Suspendida': 'status-pendiente'
    };
    return map[status] || 'status-pendiente';
}

function printCitizenAudienceCard(hearingId) {
    window.print();
}

async function sendWhatsAppHearingCitizen(hearingId) {
    let hearing = null;
    if (typeof JCC10_DB !== 'undefined') {
        hearing = await JCC10_DB.getHearingById(hearingId);
    } else {
        hearing = AppState.hearings.find(h => h.id === hearingId);
    }
    if (hearing) {
        sendWhatsAppMessage(hearing, 'recordatorio');
    }
}

// ── =======================================================================
//    PANEL ADMINISTRATIVO JUDICIAL CON 4 ROLES
//    (Juez Titular, Secretario de Cámara, Auxiliar, Oficial de Diligencias)
//    ======================================================================= ──
function openLoginModal() {
    document.getElementById('modal-login').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('modal-login').classList.add('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
}

function fillLoginForm(user, pass) {
    document.getElementById('login-user').value = user;
    document.getElementById('login-pass').value = pass;
}

async function processLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    let admin = null;
    if (typeof JCC10_DB !== 'undefined') {
        admin = await JCC10_DB.authenticateUser(user, pass);
    } else {
        admin = AppState.admins.find(a => a.user === user && a.pass === pass && a.active);
    }

    if (!admin) {
        alert('❌ Credenciales inválidas o funcionario no habilitado en el sistema.');
        return;
    }

    AppState.currentAdmin = admin;
    closeLoginModal();
    updateUserSessionUI();
    renderRoleWorkspace();
    renderAdminUsers();
    renderAuditLogs();
}

async function quickLoginRole(username) {
    let admin = null;
    if (typeof JCC10_DB !== 'undefined') {
        const users = await JCC10_DB.getAllUsers();
        admin = users.find(u => u.user === username);
    } else {
        admin = AppState.admins.find(u => u.user === username);
    }

    if (admin) {
        AppState.currentAdmin = admin;
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.addAuditLog('CAMBIO_ROL_DEMO', `Sesión cambiada a: ${admin.name} (${admin.role})`, '', admin);
        }
        updateUserSessionUI();
        renderRoleWorkspace();
        renderAdminUsers();
        renderAuditLogs();
    }
}

function logoutAdmin() {
    AppState.currentAdmin = null;
    updateUserSessionUI();
    renderRoleWorkspace();
    renderAdminUsers();
    renderAuditLogs();
}

function updateUserSessionUI() {
    const admin = AppState.currentAdmin;
    const rolePill = document.getElementById('current-role-pill');
    const userInfo = document.getElementById('current-user-info');
    const btnLogin = document.getElementById('btn-login-modal');
    const btnLogout = document.getElementById('btn-logout-admin');
    const badge = document.getElementById('admin-status-badge');
    const btnAddAdmin = document.getElementById('btn-add-admin');

    if (admin) {
        const roleClassMap = {
            'Juez Titular': 'role-juez',
            'Secretario de Cámara': 'role-secretario',
            'Auxiliar Judicial': 'role-auxiliar',
            'Oficial de Diligencias': 'role-diligencias'
        };

        if (rolePill) {
            rolePill.className = 'role-pill ' + (roleClassMap[admin.role] || '');
            rolePill.textContent = admin.role.toUpperCase();
        }

        if (userInfo) {
            userInfo.innerHTML = `<strong>${admin.name}</strong> <small style="color:#64748B;">(${admin.matriculaJudicial || admin.user})</small>`;
        }

        if (btnLogin) btnLogin.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (btnAddAdmin) btnAddAdmin.disabled = (admin.role !== 'Juez Titular');

        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-user-shield"></i> ${admin.role}: ${admin.name.split(' ')[0]}`;
            badge.style.borderColor = '#059669';
        }
    } else {
        if (rolePill) {
            rolePill.className = 'role-pill';
            rolePill.textContent = 'PÚBLICO';
        }

        if (userInfo) {
            userInfo.textContent = 'Modo Consulta (Sesión no iniciada)';
        }

        if (btnLogin) btnLogin.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        if (btnAddAdmin) btnAddAdmin.disabled = true;

        if (badge) {
            badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Modo Consulta Pública';
            badge.style.borderColor = 'rgba(217, 119, 6, 0.3)';
        }
    }
}

// ── Renderizado del Espacio de Trabajo por Rol ──────────────────────────────
function renderRoleWorkspace() {
    const container = document.getElementById('role-workspace-container');
    if (!container) return;

    const admin = AppState.currentAdmin;
    const role = admin ? admin.role : 'Público';

    switch (role) {
        case 'Oficial de Diligencias':
            container.innerHTML = renderOficialDiligenciasWorkspace();
            break;
        case 'Juez Titular':
            container.innerHTML = renderJuezWorkspace();
            break;
        case 'Secretario de Cámara':
            container.innerHTML = renderSecretarioWorkspace();
            break;
        case 'Auxiliar Judicial':
            container.innerHTML = renderAuxiliarWorkspace();
            break;
        default:
            container.innerHTML = renderPublicWorkspace();
            break;
    }
}

// 1. Espacio de Trabajo: Oficial de Diligencias
function renderOficialDiligenciasWorkspace() {
    return `
        <div class="role-banner role-banner-ofic">
            <div>
                <h3><i class="fa-solid fa-envelope-circle-check"></i> Oficialía de Diligencias — Cédulas & Notificaciones</h3>
                <p>Control estricto de citaciones a demandantes, demandados y abogados para audiencias señaladas.</p>
            </div>
            <div>
                <button class="btn btn-sm btn-gold" onclick="reloadDataFromDB()">
                    <i class="fa-solid fa-rotate"></i> Actualizar Pendientes
                </button>
            </div>
        </div>

        <div class="admin-table-container">
            <div class="table-header" style="display:flex; justify-content:space-between; padding:18px 22px; align-items:center;">
                <h3><i class="fa-solid fa-list-check text-gold"></i> Causas con Audiencia para Notificar</h3>
                <small style="color:#64748B;">Cumpla la citación al menos 24 horas antes de la audiencia</small>
            </div>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>NUREJ / Causa</th>
                        <th>Tipo & Fecha</th>
                        <th>Partes Procesales</th>
                        <th>Teléfono WhatsApp</th>
                        <th>Estado Diligencia</th>
                        <th>Acciones de Oficial</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.hearings.map((h, index) => {
                        const dil = h.diligencia || {};
                        const dilState = dil.estadoDiligencia || 'Pendiente de Citación';
                        return `
                            <tr>
                                <td>
                                    <strong>${h.nurej}</strong><br>
                                    <small style="color:#64748B;">${h.id}</small>
                                </td>
                                <td>
                                    <strong class="text-gold">${h.tipoLabel}</strong><br>
                                    <span>${formatDateES(h.fecha)} - ${h.hora} hrs</span>
                                </td>
                                <td>
                                    <strong>Dem:</strong> ${h.demandante}<br>
                                    <small><strong>Req:</strong> ${h.demandado}</small>
                                </td>
                                <td>
                                    <span>${h.telefono}</span><br>
                                    <small>${h.notificadaWA ? '✅ Notificada WA' : '⏳ Sin WA'}</small>
                                </td>
                                <td>
                                    <span class="diligencia-badge ${getDiligenciaBadgeClass(dilState)}">${dilState}</span><br>
                                    <small style="color:#64748B;">${dil.constanciaNotificacion || 'Sin acta'}</small>
                                </td>
                                <td>
                                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                        <button class="btn btn-xs btn-primary" onclick="openDiligenciaModal('${h.id}')" title="Registrar entrega o fijación de cédula">
                                            <i class="fa-solid fa-stamp"></i> Diligenciar
                                        </button>
                                        <button class="btn btn-xs btn-whatsapp" onclick="sendWhatsAppMessageByHearingId('${h.id}', 'citacion')" title="Enviar cédula por WhatsApp">
                                            <i class="fa-brands fa-whatsapp"></i> Cédula WA
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 2. Espacio de Trabajo: Juez Titular
function renderJuezWorkspace() {
    return `
        <div class="role-banner role-banner-juez">
            <div>
                <h3><i class="fa-solid fa-gavel"></i> Despacho del Juez Titular — Resoluciones & Conducción</h3>
                <p>Dictamen de resoluciones, providencias de señalamiento, suspensiones (Art. 209 CPC) y conclusión de causas.</p>
            </div>
            <div>
                <button class="btn btn-sm btn-gold" onclick="reloadDataFromDB()">
                    <i class="fa-solid fa-rotate"></i> Actualizar Despacho
                </button>
            </div>
        </div>

        <div class="admin-table-container">
            <div class="table-header" style="display:flex; justify-content:space-between; padding:18px 22px; align-items:center;">
                <h3><i class="fa-solid fa-scale-balanced text-gold"></i> Agenda de Causas para Despacho Judicial</h3>
                <small style="color:#64748B;">Resoluciones firmadas y registradas con validez procesal</small>
            </div>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>NUREJ / Exp</th>
                        <th>Tipo Audiencia</th>
                        <th>Partes Procesales</th>
                        <th>Fecha y Hora</th>
                        <th>Estado Procesal</th>
                        <th>Providencia Judicial</th>
                        <th>Acciones de Juez</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.hearings.map(h => {
                        const res = h.resolucionJuez || {};
                        return `
                            <tr>
                                <td><strong>${h.nurej}</strong><br><small style="color:#64748B;">${h.expediente || h.id}</small></td>
                                <td><strong class="text-gold">${h.tipoLabel}</strong></td>
                                <td>${h.demandante}<br><small style="color:#64748B;">vs. ${h.demandado}</small></td>
                                <td><strong>${formatDateES(h.fecha)}</strong><br>${h.hora} hrs</td>
                                <td><span class="result-status ${getStatusClass(h.estado)}">${h.estado}</span></td>
                                <td><small style="color:#334155;">${res.actaResumen || 'Proveído pendiente'}</small></td>
                                <td>
                                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                        <button class="btn btn-xs btn-primary" onclick="openResolucionModal('${h.id}')" title="Dictar resolución o providencia">
                                            <i class="fa-solid fa-gavel"></i> Dictaminar
                                        </button>
                                        <button class="btn btn-xs btn-secondary" onclick="markHearingConcluded('${h.id}')" title="Concluir audiencia">
                                            <i class="fa-solid fa-check"></i> Concluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 3. Espacio de Trabajo: Secretario de Cámara
function renderSecretarioWorkspace() {
    return `
        <div class="role-banner role-banner-sec">
            <div>
                <h3><i class="fa-solid fa-pen-nib"></i> Secretaría de Cámara — Agenda Oficial & Actas de Audiencia</h3>
                <p>Gestión del calendario de sala, emisión de actas y certificaciones de comparecencia.</p>
            </div>
            <div>
                <button class="btn btn-sm btn-gold" onclick="reloadDataFromDB()">
                    <i class="fa-solid fa-rotate"></i> Actualizar Agenda
                </button>
            </div>
        </div>

        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>NUREJ</th>
                        <th>Tipo Audiencia</th>
                        <th>Partes Procesales</th>
                        <th>Fecha / Hora</th>
                        <th>Modalidad / Sala</th>
                        <th>Estado</th>
                        <th>Acciones Actuario</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.hearings.map(h => `
                        <tr>
                            <td><strong>${h.nurej}</strong><br><small>${h.id}</small></td>
                            <td><span class="text-gold font-bold">${h.tipoLabel}</span></td>
                            <td>${h.demandante}<br><small>vs. ${h.demandado}</small></td>
                            <td><strong>${formatDateES(h.fecha)}</strong><br>${h.hora} hrs</td>
                            <td>${h.modalidad.toUpperCase()}<br><small>${h.lugarFisico}</small></td>
                            <td><span class="result-status ${getStatusClass(h.estado)}">${h.estado}</span></td>
                            <td>
                                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                    <button class="btn btn-xs btn-outline" style="color:#0B192C; border-color:#0B192C;" onclick="emitirCertificadoComparecencia('${h.id}')">
                                        <i class="fa-solid fa-certificate"></i> Certificar
                                    </button>
                                    <button class="btn btn-xs btn-whatsapp" onclick="sendWhatsAppMessageByHearingId('${h.id}', 'recordatorio')">
                                        <i class="fa-brands fa-whatsapp"></i> Aviso WA
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 4. Espacio de Trabajo: Auxiliar Judicial
function renderAuxiliarWorkspace() {
    return `
        <div class="role-banner role-banner-aux">
            <div>
                <h3><i class="fa-solid fa-user-gear"></i> Auxiliaría Judicial — Mesa de Entrada & Verificación</h3>
                <p>Recepción formal de solicitudes de agendamiento, control de requisitos y cotejo de expedientes.</p>
            </div>
            <div>
                <button class="btn btn-sm btn-gold" onclick="switchTab('agendamiento')">
                    <i class="fa-solid fa-plus"></i> Agendar Causa
                </button>
            </div>
        </div>

        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>NUREJ</th>
                        <th>Tipo</th>
                        <th>Partes</th>
                        <th>Abogado & Matrícula</th>
                        <th>Fecha Fijada</th>
                        <th>Estado</th>
                        <th>Control</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.hearings.map(h => `
                        <tr>
                            <td><strong>${h.nurej}</strong></td>
                            <td>${h.tipoLabel}</td>
                            <td>${h.demandante} vs. ${h.demandado}</td>
                            <td>${h.abogado}<br><small>${h.matricula}</small></td>
                            <td>${formatDateES(h.fecha)} (${h.hora})</td>
                            <td><span class="result-status ${getStatusClass(h.estado)}">${h.estado}</span></td>
                            <td>
                                <button class="btn btn-xs btn-outline" style="color:#059669; border-color:#059669;" onclick="verificarCausaAuxiliar('${h.id}')">
                                    <i class="fa-solid fa-check-double"></i> Verificado
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 5. Espacio de Consulta Pública (Sin Sesión Iniciada)
function renderPublicWorkspace() {
    return `
        <div class="admin-table-container">
            <div class="table-header" style="display:flex; justify-content:space-between; padding:20px; align-items:center;">
                <div>
                    <h3>Agenda Judicial de Audiencias (Modo Consulta)</h3>
                    <small style="color:#64748B;">Para realizar modificaciones, inicie sesión con su usuario judicial asignado.</small>
                </div>
                <button class="btn btn-sm btn-gold" onclick="openLoginModal()">
                    <i class="fa-solid fa-key"></i> Iniciar Sesión de Funcionario
                </button>
            </div>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>NUREJ / Exp</th>
                        <th>Tipo de Audiencia</th>
                        <th>Partes Procesales</th>
                        <th>Fecha y Hora</th>
                        <th>Modalidad</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.hearings.map(h => `
                        <tr>
                            <td><strong>${h.nurej}</strong><br><small style="color:#64748B;">${h.id}</small></td>
                            <td><span class="text-gold font-bold">${h.tipoLabel}</span></td>
                            <td>${h.demandante}<br><small style="color:#64748B;">vs. ${h.demandado}</small></td>
                            <td><strong>${formatDateES(h.fecha)}</strong><br>${h.hora} hrs</td>
                            <td>${h.modalidad.toUpperCase()}</td>
                            <td><span class="result-status ${getStatusClass(h.estado)}">${h.estado}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ── Modales de Diligencias y Resoluciones ────────────────────────────────────
function openDiligenciaModal(hearingId) {
    const hearing = AppState.hearings.find(h => h.id === hearingId);
    if (!hearing) return;

    document.getElementById('diligencia-hearing-id').value = hearingId;
    document.getElementById('diligencia-case-summary').innerHTML = `
        <strong>NUREJ:</strong> ${hearing.nurej} | <strong>Audiencia:</strong> ${hearing.tipoLabel}<br>
        <strong>Partes:</strong> ${hearing.demandante} vs. ${hearing.demandado}<br>
        <strong>Fecha Fijada:</strong> ${formatDateES(hearing.fecha)} a las ${hearing.hora} hrs | <strong>Tel:</strong> ${hearing.telefono}
    `;

    document.getElementById('modal-diligencia').classList.remove('hidden');
}

function closeDiligenciaModal() {
    document.getElementById('modal-diligencia').classList.add('hidden');
}

async function processSaveDiligencia() {
    const hearingId = document.getElementById('diligencia-hearing-id').value;
    const estado = document.getElementById('diligencia-estado').value;
    const constancia = document.getElementById('diligencia-constancia').value.trim();
    const observacion = document.getElementById('diligencia-observacion').value.trim();
    const sendWA = document.getElementById('diligencia-notif-wa').checked;

    const diligenciaData = {
        estadoDiligencia: estado,
        constanciaNotificacion: constancia,
        observacionDiligencia: observacion,
        notificadaWA: sendWA
    };

    try {
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.updateDiligencia(hearingId, diligenciaData, AppState.currentAdmin);
        } else {
            const h = AppState.hearings.find(x => x.id === hearingId);
            if (h) {
                h.diligencia = {
                    estadoDiligencia: estado,
                    constanciaNotificacion: constancia,
                    observacionDiligencia: observacion,
                    oficialNombre: AppState.currentAdmin ? AppState.currentAdmin.name : 'Oficial de Diligencias',
                    fechaDiligencia: new Date().toLocaleString('es-BO')
                };
                if (sendWA) h.notificadaWA = true;
                localStorage.setItem('jcc10_hearings', JSON.stringify(AppState.hearings));
            }
        }

        closeDiligenciaModal();
        await reloadDataFromDB();
        alert('✅ Diligencia registrada exitosamente en la base de datos judicial.');

        if (sendWA) {
            sendWhatsAppMessageByHearingId(hearingId, 'citacion');
        }
    } catch (e) {
        console.error('Error al guardar diligencia:', e);
        alert('Error al guardar diligencia: ' + e.message);
    }
}

// Juez: Modal de Resolución
function openResolucionModal(hearingId) {
    const hearing = AppState.hearings.find(h => h.id === hearingId);
    if (!hearing) return;

    document.getElementById('resolucion-hearing-id').value = hearingId;
    document.getElementById('resolucion-case-summary').innerHTML = `
        <strong>NUREJ:</strong> ${hearing.nurej} | <strong>Audiencia:</strong> ${hearing.tipoLabel}<br>
        <strong>Partes:</strong> ${hearing.demandante} vs. ${hearing.demandado}<br>
        <strong>Fecha:</strong> ${formatDateES(hearing.fecha)} - ${hearing.hora} hrs
    `;

    document.getElementById('modal-resolucion-juez').classList.remove('hidden');
}

function closeResolucionModal() {
    document.getElementById('modal-resolucion-juez').classList.add('hidden');
}

async function processSaveResolucion() {
    const hearingId = document.getElementById('resolucion-hearing-id').value;
    const estado = document.getElementById('resolucion-estado').value;
    const motivo = document.getElementById('resolucion-motivo').value.trim();

    try {
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.updateResolucionJuez(hearingId, estado, motivo, AppState.currentAdmin);
        } else {
            const h = AppState.hearings.find(x => x.id === hearingId);
            if (h) {
                h.estado = estado;
                h.resolucionJuez = {
                    estadoJudicial: estado,
                    actaResumen: motivo,
                    juezNombre: AppState.currentAdmin ? AppState.currentAdmin.name : 'Juez Titular',
                    fechaResolucion: new Date().toLocaleString('es-BO')
                };
                localStorage.setItem('jcc10_hearings', JSON.stringify(AppState.hearings));
            }
        }

        closeResolucionModal();
        await reloadDataFromDB();
        alert(`✅ Dictamen judicial [${estado}] registrado en la causa.`);
    } catch (e) {
        alert('Error al registrar resolución: ' + e.message);
    }
}

async function markHearingConcluded(hearingId) {
    if (!confirm('¿Confirma dar por CONCLUIDA la audiencia en estrados?')) return;
    try {
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.updateResolucionJuez(hearingId, 'Concluida', 'Audiencia celebrada y concluida formalmente.', AppState.currentAdmin);
        }
        await reloadDataFromDB();
    } catch (e) {
        console.error(e);
    }
}

function emitirCertificadoComparecencia(hearingId) {
    const h = AppState.hearings.find(x => x.id === hearingId);
    if (!h) return;
    alert(`📜 CERTIFICACIÓN DE SECRETARÍA DE CÁMARA:\n\nSe certifica que la audiencia señalada para el NUREJ ${h.nurej} (${h.tipoLabel}) cuenta con señalamiento válido para el día ${formatDateES(h.fecha)} a las ${h.hora} hrs.`);
}

function verificarCausaAuxiliar(hearingId) {
    alert(`✅ AUXILIARÍA JUDICIAL: Expediente y formalidades procesales cotejados conforme a la Ley N° 439.`);
}

// ── Gestión de Personal Judicial (Users) ───────────────────────────────────
function openAddAdminModal() {
    if (!AppState.currentAdmin || AppState.currentAdmin.role !== 'Juez Titular') {
        alert('Solo el Juez Titular está facultado para dar de alta funcionarios en el juzgado.');
        return;
    }
    document.getElementById('modal-add-admin').classList.remove('hidden');
}

function closeAddAdminModal() {
    document.getElementById('modal-add-admin').classList.add('hidden');
    document.getElementById('new-admin-name').value = '';
    document.getElementById('new-admin-matricula').value = '';
    document.getElementById('new-admin-user').value = '';
    document.getElementById('new-admin-pass').value = '';
}

async function processAddAdmin() {
    const name = document.getElementById('new-admin-name').value.trim();
    const role = document.getElementById('new-admin-role').value;
    const matricula = document.getElementById('new-admin-matricula').value.trim();
    const user = document.getElementById('new-admin-user').value.trim();
    const pass = document.getElementById('new-admin-pass').value;

    if (!name || !user || !pass) {
        alert('Complete todos los datos obligatorios.');
        return;
    }

    if (pass.length < 4) {
        alert('La contraseña debe tener al menos 4 caracteres.');
        return;
    }

    const newUser = {
        name,
        role,
        matriculaJudicial: matricula || 'OJ-LPZ-GEN-001',
        user,
        pass,
        active: true
    };

    try {
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.saveUser(newUser);
        } else {
            AppState.admins.push(newUser);
            localStorage.setItem('jcc10_admins', JSON.stringify(AppState.admins));
        }

        closeAddAdminModal();
        await reloadDataFromDB();
        alert(`✅ Funcionario "${name}" (${role}) registrado con éxito.`);
    } catch (e) {
        alert('Error al registrar funcionario: ' + e.message);
    }
}

function renderAdminUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    const roleIcons = {
        'Juez Titular': { icon: 'fa-gavel', color: '#DC2626' },
        'Secretario de Cámara': { icon: 'fa-pen-nib', color: '#2563EB' },
        'Auxiliar Judicial': { icon: 'fa-user-gear', color: '#059669' },
        'Oficial de Diligencias': { icon: 'fa-envelope-circle-check', color: '#D97706' }
    };

    container.innerHTML = AppState.admins.filter(a => a.active).map(admin => {
        const info = roleIcons[admin.role] || { icon: 'fa-user', color: '#475569' };
        return `
            <div class="admin-user-card" style="border-left: 4px solid ${info.color};">
                <div class="user-avatar" style="background:${info.color}; color:#FFF;">
                    <i class="fa-solid ${info.icon}"></i>
                </div>
                <div class="user-info" style="flex:1;">
                    <h4>${admin.name}</h4>
                    <p><strong>${admin.role}</strong></p>
                    <small style="color:#64748B;">Matrícula: ${admin.matriculaJudicial || 'OJ-BOL'} | Usuario: ${admin.user}</small>
                </div>
                ${AppState.currentAdmin && AppState.currentAdmin.role === 'Juez Titular' && admin.user !== AppState.currentAdmin.user ? `
                    <button class="btn btn-sm btn-danger" onclick="revokeAdmin('${admin.user}')" style="padding:4px 10px; font-size:0.75rem;">
                        <i class="fa-solid fa-ban"></i> Revocar
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function revokeAdmin(username) {
    if (!AppState.currentAdmin || AppState.currentAdmin.role !== 'Juez Titular') {
        alert('Solo el Juez Titular puede revocar funcionarios.');
        return;
    }

    const admin = AppState.admins.find(a => a.user === username);
    if (!admin) return;

    if (confirm(`¿Confirma REVOCAR las credenciales judiciales de "${admin.name}" (${admin.role})?`)) {
        admin.active = false;
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.saveUser(admin);
            await JCC10_DB.addAuditLog('REVOCAR_FUNCIONARIO', `Acceso revocado para: ${admin.name} (${admin.role})`, '', AppState.currentAdmin);
        }
        await reloadDataFromDB();
        alert('Acceso revocado para: ' + admin.name);
    }
}

// ── Auditoría Judicial & Trazabilidad ──────────────────────────────────────
async function renderAuditLogs() {
    const container = document.getElementById('audit-logs-container');
    if (!container) return;

    let logs = [];
    if (typeof JCC10_DB !== 'undefined') {
        logs = await JCC10_DB.getAuditLogs(15);
    }

    if (!logs || logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:15px; color:#94A3B8;">No hay registros de auditoría recientes.</div>`;
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="audit-item">
            <div class="audit-item-info">
                <strong>[${log.action}]</strong> ${log.details}
                ${log.nurej ? `<span style="color:#D97706; margin-left:6px;">(NUREJ: ${log.nurej})</span>` : ''}
            </div>
            <div class="audit-item-meta">
                <span><i class="fa-solid fa-user"></i> ${log.user} (${log.role})</span> • 
                <span>${log.fechaTexto || log.fecha.slice(0, 16)}</span>
            </div>
        </div>
    `).join('');
}

// ── Estadísticas Judiciales en Tiempo Real ──────────────────────────────────
function updateStats() {
    const today = new Date().toISOString().split('T')[0];

    const total = AppState.hearings.length;
    const hoy = AppState.hearings.filter(h => h.fecha === today).length;
    const pendNotif = AppState.hearings.filter(h => !h.diligencia || h.diligencia.estadoDiligencia === 'Pendiente de Citación').length;
    const notificadas = AppState.hearings.filter(h => h.notificadaWA).length;

    const elTotal = document.getElementById('stat-total');
    const elHoy = document.getElementById('stat-hoy');
    const elPend = document.getElementById('stat-pendientes-notif');
    const elNotif = document.getElementById('stat-notificadas');

    if (elTotal) elTotal.textContent = total;
    if (elHoy) elHoy.textContent = hoy;
    if (elPend) elPend.textContent = pendNotif;
    if (elNotif) elNotif.textContent = notificadas;
}

// ── Herramientas de Base de Datos (Exportar, Restaurar, Reiniciar) ───────────
async function exportDatabase() {
    if (typeof JCC10_DB !== 'undefined') {
        await JCC10_DB.exportDatabaseJSON();
    } else {
        alert('Base de datos no disponible.');
    }
}

async function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const content = e.target.result;
            if (typeof JCC10_DB !== 'undefined') {
                await JCC10_DB.importDatabaseJSON(content);
                await reloadDataFromDB();
                alert('✅ Base de datos judicial restaurada exitosamente.');
            }
        } catch (err) {
            alert('❌ Error al importar archivo: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function resetDatabaseSeeds() {
    if (!confirm('⚠️ ¿Confirma restablecer la base de datos a los datos oficiales iniciales?')) return;
    try {
        if (typeof JCC10_DB !== 'undefined') {
            await JCC10_DB.resetToSeeds();
            await reloadDataFromDB();
            alert('✅ Base de datos restablecida con datos oficiales.');
        }
    } catch (e) {
        console.error(e);
    }
}

// ── WhatsApp Notificaciones Judiciales ──────────────────────────────────────
function sendWhatsAppConfirmation() {
    if (!AppState.hearings.length) return;
    sendWhatsAppMessage(AppState.hearings[0], 'confirmacion');
}

function sendWhatsAppMessageByHearingId(hearingId, type) {
    const h = AppState.hearings.find(x => x.id === hearingId);
    if (!h) return;
    sendWhatsAppMessage(h, type);
}

function sendWhatsAppMessage(hearing, messageType = 'confirmacion') {
    const phoneClean = (hearing.telefono || '').replace(/[^\d]/g, '');
    if (!phoneClean) {
        alert('La causa no tiene un número de celular registrado.');
        return;
    }

    let phoneParam = phoneClean;
    if (phoneClean.length === 8) {
        phoneParam = '591' + phoneClean; // Bolivia prefix
    }

    let message = '';
    if (messageType === 'citacion') {
        message = `🏛️ *ÓRGANO JUDICIAL - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10*
📋 *CÉDULA DE NOTIFICACIÓN Y CITACIÓN JUDICIAL*

Se hace saber a las partes procesales que en el proceso judicial:
🔹 *NUREJ:* ${hearing.nurej}
🔹 *Causa:* ${hearing.demandante} vs. ${hearing.demandado}
🔹 *Tipo de Audiencia:* ${hearing.tipoLabel}

Se ha fijado formalmente audiencia para:
📅 *Fecha:* ${formatDateES(hearing.fecha)}
⏰ *Hora:* ${hearing.hora} hrs
📍 *Modalidad / Sala:* ${hearing.lugarFisico}
${hearing.modalidad === 'virtual' && hearing.salaVirtualLink ? `🔗 *Enlace Virtual:* ${hearing.salaVirtualLink}\n` : ''}
⚖️ *Oficial de Diligencias:* ${hearing.diligencia ? hearing.diligencia.oficialNombre : 'Juzgado N° 10'}
📜 *Constancia:* ${hearing.diligencia ? hearing.diligencia.constanciaNotificacion : 'Cédula N° ' + hearing.id}

⚠️ *Advertencia Legal:* Deberán comparecer munidos de C.I. original y credencial profesional 15 minutos antes.`;
    } else {
        message = `🏛️ *JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10*
📌 *CONSTANCIA OFICIAL DE AUDIENCIA JUDICIAL*

Estimado(a) *${hearing.demandante}* / Abg. *${hearing.abogado}*:

Su audiencia se encuentra registrada en el sistema oficial:
🔹 *NUREJ:* ${hearing.nurej}
🔹 *Tipo:* ${hearing.tipoLabel}
📅 *Fecha:* ${formatDateES(hearing.fecha)}
⏰ *Horario:* ${hearing.hora} hrs
📍 *Lugar:* ${hearing.lugarFisico}
${hearing.modalidad === 'virtual' && hearing.salaVirtualLink ? `🔗 *Enlace:* ${hearing.salaVirtualLink}\n` : ''}
🎫 *Código de Comprobante:* ${hearing.id}

Consulte sus efectos procesales en cualquier momento con su NUREJ en el portal oficial del Juzgado.`;
    }

    const waUrl = `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

// ── Generador de QR Inline (Sin dependencias externas) ─────────────────────
function generateInlineQR(targetElementId, dataString) {
    const el = document.getElementById(targetElementId);
    if (!el) return;

    // Generador de matriz SVG decorativa representativa del hash
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
        hash = ((hash << 5) - hash) + dataString.charCodeAt(i);
        hash |= 0;
    }

    const matrixSize = 21;
    let cells = '';
    for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
            // Posicionamiento de ojos QR estándar
            const inTopLeftEye = (r < 7 && c < 7);
            const inTopRightEye = (r < 7 && c >= matrixSize - 7);
            const inBottomLeftEye = (r >= matrixSize - 7 && c < 7);

            let isFilled = false;
            if (inTopLeftEye || inTopRightEye || inBottomLeftEye) {
                const lr = inBottomLeftEye ? r - (matrixSize - 7) : r;
                const lc = inTopRightEye ? c - (matrixSize - 7) : c;
                if (lr === 0 || lr === 6 || lc === 0 || lc === 6) isFilled = true;
                else if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) isFilled = true;
            } else {
                // Pseudo aleatorio determinista basado en el hash
                isFilled = (((hash ^ (r * 31 + c * 17)) & 3) === 0);
            }

            if (isFilled) {
                cells += `<rect x="${c * 4}" y="${r * 4}" width="4" height="4" fill="#0B192C"/>`;
            }
        }
    }

    el.innerHTML = `
        <svg viewBox="0 0 84 84" width="70" height="70" style="background:#FFF; padding:4px; border-radius:4px;">
            ${cells}
        </svg>
        <small style="display:block; margin-top:4px; font-size:0.65rem; color:#64748B;">VALIDACIÓN QR</small>
    `;
}

// ── Formateo de Fechas en Español ──────────────────────────────────────────
function formatDateES(dateStr) {
    if (!dateStr) return '-';
    try {
        const [y, m, d] = dateStr.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formatted = date.toLocaleDateString('es-BO', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
        return dateStr;
    }
}

// ── Acordeón de Requisitos Legales ─────────────────────────────────────────
function toggleAccordion(headerElement) {
    const body = headerElement.nextElementSibling;
    const isOpen = body.classList.contains('open');

    document.querySelectorAll('.req-body').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.req-header').forEach(h => h.classList.remove('open'));

    if (!isOpen) {
        body.classList.add('open');
        headerElement.classList.add('open');
    }
}

// ── Código Embed para Google Sites & PWA ────────────────────────────────────
function loadEmbedCode() {
    const textarea = document.getElementById('embed-code-textarea');
    if (!textarea) return;

    const embedCode = `<!-- SISTEMA PWA DE AUDIENCIAS - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10 -->
<!-- Pegue este código en Google Sites: Insertar > Incorporar > Código HTML -->
<!-- IMPORTANTE: Extienda el marco al ancho completo y fije altura mínima de 1100px -->

<div style="width:100%; min-height:1050px; overflow:hidden; border-radius:14px; box-shadow:0 8px 30px rgba(0,0,0,0.12); border:1px solid #CBD5E1;">
    <iframe 
        src="https://edemibel.github.io/JCC10/" 
        width="100%" 
        height="1100" 
        style="border:none; border-radius:14px;" 
        loading="lazy"
        allow="clipboard-write; fullscreen"
        title="Juzgado Público Civil y Comercial N° 10 - Sistema de Audiencias">
    </iframe>
</div>

<!-- Instalable como App PWA en computadoras y teléfonos móviles -->`;

    textarea.value = embedCode;
}

function copyEmbedCode() {
    const textarea = document.getElementById('embed-code-textarea');
    if (!textarea) return;

    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        showCopyFeedback();
    }).catch(() => {
        document.execCommand('copy');
        showCopyFeedback();
    });
}

function showCopyFeedback() {
    const btn = document.querySelector('.code-box-header .btn');
    if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado con Éxito!';
        btn.style.backgroundColor = '#059669';
        setTimeout(() => {
            btn.innerHTML = orig;
            btn.style.backgroundColor = '';
        }, 2200);
    }
}
