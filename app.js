/* =========================================================================
   PORTAL DE AUDIENCIAS - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10
   Lógica Principal de la Aplicación
   ========================================================================= */

// ── Estado Global de la Aplicación ──────────────────────────────────────
const AppState = {
    currentTab: 'agendamiento',
    currentStep: 1,
    selectedType: null,
    selectedModalidad: 'presencial',
    selectedSlot: null,
    currentAdmin: null,
    hearings: [],
    admins: [
        { name: 'Dr. Juan Carlos Medina', role: 'Juez Titular', user: 'juez10', pass: 'admin123', active: true },
        { name: 'Lic. María Elena Torrez', role: 'Secretario de Cámara', user: 'secretaria10', pass: 'sec123', active: true },
        { name: 'Sr. Pedro Quispe Mamani', role: 'Auxiliar Judicial', user: 'auxiliar10', pass: 'aux123', active: true }
    ]
};

// ── Inicialización ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    loadFromStorage();
    renderAdminTable();
    renderAdminUsers();
    updateStats();
    loadEmbedCode();

    // Establecer fecha mínima del selector de fecha (hoy)
    const dateInput = document.getElementById('hearing-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }
});

// ── Persistencia Local (localStorage) ───────────────────────────────────
function saveToStorage() {
    localStorage.setItem('jcc10_hearings', JSON.stringify(AppState.hearings));
    localStorage.setItem('jcc10_admins', JSON.stringify(AppState.admins));
}

function loadFromStorage() {
    const savedHearings = localStorage.getItem('jcc10_hearings');
    const savedAdmins = localStorage.getItem('jcc10_admins');
    if (savedHearings) {
        try { AppState.hearings = JSON.parse(savedHearings); } catch (e) { /* ignore */ }
    }
    if (savedAdmins) {
        try { AppState.admins = JSON.parse(savedAdmins); } catch (e) { /* ignore */ }
    }
}

// ── Navegación por Tabs ─────────────────────────────────────────────────
function switchTab(tabId) {
    // Ocultar todos los paneles
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.add('hidden');
        pane.classList.remove('active');
    });

    // Desactivar todos los botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar el panel seleccionado
    const targetPane = document.getElementById('tab-' + tabId);
    if (targetPane) {
        targetPane.classList.remove('hidden');
        targetPane.classList.add('active');
    }

    // Activar el botón correspondiente
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabIndex = {
        'agendamiento': 0,
        'consulta': 1,
        'requisitos': 2,
        'secretaria': 3,
        'embed-guide': 4
    };
    if (navButtons[tabIndex[tabId]] !== undefined) {
        navButtons[tabIndex[tabId]].classList.add('active');
    }

    AppState.currentTab = tabId;
}

// ── Stepper de Pasos (Agendamiento) ─────────────────────────────────────
function goToStep(stepNum) {
    // Validar paso 2 antes de avanzar
    if (stepNum === 2 && !AppState.selectedType) {
        alert('Por favor seleccione un tipo de audiencia primero.');
        return;
    }

    // Validar formulario del paso 2 antes de avanzar al 3
    if (stepNum === 3) {
        const form = document.getElementById('form-case-details');
        if (form && !form.checkValidity()) {
            form.reportValidity();
            return;
        }
    }

    // Ocultar todos los pasos
    for (let i = 1; i <= 4; i++) {
        const stepContent = document.getElementById('step-' + i);
        if (stepContent) stepContent.classList.add('hidden');
    }

    // Mostrar el paso seleccionado
    const target = document.getElementById('step-' + stepNum);
    if (target) target.classList.remove('hidden');

    // Actualizar indicadores del stepper
    updateStepperIndicators(stepNum);

    AppState.currentStep = stepNum;
}

function updateStepperIndicators(activeStep) {
    for (let i = 1; i <= 4; i++) {
        const indicator = document.getElementById('step-indicator-' + i);
        if (!indicator) continue;

        indicator.classList.remove('active', 'completed');

        if (i < activeStep) {
            indicator.classList.add('completed');
        } else if (i === activeStep) {
            indicator.classList.add('active');
        }
    }

    // Actualizar líneas conectoras
    const lines = document.querySelectorAll('.step-line');
    lines.forEach((line, index) => {
        if (index < activeStep - 1) {
            line.classList.add('active');
        } else {
            line.classList.remove('active');
        }
    });
}

// ── Selección de Tipo de Audiencia ──────────────────────────────────────
function selectHearingType(type, cardElement) {
    // Remover selección anterior
    document.querySelectorAll('.hearing-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Seleccionar la nueva card
    cardElement.classList.add('selected');
    AppState.selectedType = type;

    // Habilitar botón de siguiente
    const btnNext = document.getElementById('btn-to-step-2');
    if (btnNext) btnNext.disabled = false;
}

// ── Selección de Modalidad ──────────────────────────────────────────────
function selectModalidad(tipo, cardElement) {
    document.querySelectorAll('.mod-card').forEach(card => {
        card.classList.remove('selected');
    });
    cardElement.classList.add('selected');
    AppState.selectedModalidad = tipo;
}

// ── Carga de Turnos Disponibles ─────────────────────────────────────────
function loadAvailableSlots() {
    const dateInput = document.getElementById('hearing-date');
    const slotsGrid = document.getElementById('slots-grid');

    if (!dateInput || !slotsGrid) return;

    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    // Verificar que no sea fin de semana
    const dateObj = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        slotsGrid.innerHTML = `<p class="select-prompt" style="color: #DC2626;">
            <i class="fa-solid fa-triangle-exclamation"></i> 
            No se programan audiencias los fines de semana. Seleccione un día hábil (Lunes a Viernes).
        </p>`;
        return;
    }

    // Generar turnos del día (simulados)
    const morningSlots = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
    const afternoonSlots = ['14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'];
    const allSlots = [...morningSlots, ...afternoonSlots];

    // Determinar turnos ocupados (simulados basados en audiencias existentes)
    const occupiedSlots = AppState.hearings
        .filter(h => h.fecha === selectedDate && h.estado !== 'Concluida')
        .map(h => h.hora);

    slotsGrid.innerHTML = '';

    allSlots.forEach(slot => {
        const isOccupied = occupiedSlots.includes(slot);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn' + (isOccupied ? ' occupied' : '');
        btn.textContent = slot;
        btn.disabled = isOccupied;

        if (!isOccupied) {
            btn.onclick = function () {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                AppState.selectedSlot = slot;
                document.getElementById('btn-finish-booking').disabled = false;
            };
        }

        slotsGrid.appendChild(btn);
    });
}

// ── Procesar Reserva de Audiencia ───────────────────────────────────────
function processBooking() {
    const nurej = document.getElementById('nurej').value.trim();
    const demandante = document.getElementById('demandante').value.trim();
    const demandado = document.getElementById('demandado').value.trim();
    const abogado = document.getElementById('abogado-nombre').value.trim();
    const matricula = document.getElementById('abogado-mat').value.trim();
    const telefono = document.getElementById('contacto-telefono').value.trim();
    const email = document.getElementById('contacto-email').value.trim();
    const fecha = document.getElementById('hearing-date').value;
    const observaciones = document.getElementById('observaciones')
        ? document.getElementById('observaciones').value.trim()
        : '';

    if (!nurej || !demandante || !demandado || !abogado || !telefono || !fecha || !AppState.selectedSlot) {
        alert('Por favor complete todos los datos obligatorios y seleccione un turno.');
        return;
    }

    // Generar ID único
    const ticketId = 'AUD-' + new Date().getFullYear() + '-' + (10000 + Math.floor(Math.random() * 90000));

    // Mapeo de tipos
    const tipoLabels = {
        'remates': 'Audiencia de Remate',
        'ordinarios': 'Proceso Ordinario',
        'monitorio': 'Monitorio Ejecutivo',
        'coactivos': 'Proceso Coactivo',
        'conciliaciones': 'Conciliación'
    };

    // Crear registro de audiencia
    const hearing = {
        id: ticketId,
        nurej: nurej,
        tipo: AppState.selectedType,
        tipoLabel: tipoLabels[AppState.selectedType] || AppState.selectedType,
        demandante: demandante,
        demandado: demandado,
        abogado: abogado,
        matricula: matricula,
        telefono: telefono,
        email: email,
        fecha: fecha,
        hora: AppState.selectedSlot,
        modalidad: AppState.selectedModalidad,
        observaciones: observaciones,
        estado: 'Pendiente',
        notificadaWA: false,
        fechaRegistro: new Date().toISOString()
    };

    AppState.hearings.push(hearing);
    saveToStorage();

    // Poblar el ticket
    document.getElementById('ticket-id').textContent = ticketId;
    document.getElementById('t-nurej').textContent = nurej;
    document.getElementById('t-tipo').textContent = hearing.tipoLabel.toUpperCase();
    document.getElementById('t-demandante').textContent = demandante;
    document.getElementById('t-demandado').textContent = demandado;
    document.getElementById('t-abogado').textContent = abogado;
    document.getElementById('t-mat').textContent = matricula;
    document.getElementById('t-modalidad').textContent = AppState.selectedModalidad === 'presencial'
        ? 'PRESENCIAL - Sala N° 10'
        : 'VIRTUAL (Zoom/Teams)';
    document.getElementById('t-fecha').textContent = formatDateES(fecha);
    document.getElementById('t-hora').textContent = AppState.selectedSlot + ' hrs';
    document.getElementById('t-lugar').textContent = AppState.selectedModalidad === 'presencial'
        ? 'Sala N° 10 (Piso 3)'
        : 'Enlace Virtual';

    // Ir al paso 4 (ticket)
    goToStep(4);

    // Actualizar tabla de admin y estadísticas
    renderAdminTable();
    updateStats();
}

// ── Formateo de Fecha en Español ────────────────────────────────────────
function formatDateES(dateStr) {
    if (!dateStr) return '-';
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1];
    const year = parts[0];
    return day + ' de ' + month + ' de ' + year;
}

// ── Enviar Confirmación por WhatsApp ────────────────────────────────────
function sendWhatsAppConfirmation() {
    const lastHearing = AppState.hearings[AppState.hearings.length - 1];
    if (!lastHearing) return;

    sendWhatsAppMessage(lastHearing, 'confirmacion');

    // Marcar como notificada
    lastHearing.notificadaWA = true;
    saveToStorage();
    updateStats();
}

function sendWhatsAppMessage(hearing, tipo) {
    let phoneClean = hearing.telefono.replace(/[^0-9]/g, '');
    if (!phoneClean.startsWith('591') && phoneClean.length === 8) {
        phoneClean = '591' + phoneClean;
    }

    let message = '';

    if (tipo === 'confirmacion') {
        message = `🏛️ *JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10*\n` +
            `*CONFIRMACIÓN OFICIAL DE AUDIENCIA*\n\n` +
            `🔢 *ID:* ${hearing.id}\n` +
            `📋 *NUREJ / Expediente:* ${hearing.nurej}\n` +
            `⚖️ *Tipo de Audiencia:* ${hearing.tipoLabel}\n` +
            `👤 *Demandante:* ${hearing.demandante}\n` +
            `👤 *Demandado:* ${hearing.demandado}\n` +
            `👔 *Abogado:* ${hearing.abogado} (${hearing.matricula})\n\n` +
            `📅 *Fecha:* ${formatDateES(hearing.fecha)}\n` +
            `🕐 *Hora:* ${hearing.hora} hrs\n` +
            `📍 *Modalidad:* ${hearing.modalidad === 'presencial' ? 'PRESENCIAL - Sala N° 10 (Piso 3)' : 'VIRTUAL (Zoom/Teams)'}\n\n` +
            `📌 *Importante:* Presentarse 15 min antes con C.I. y Matrícula Profesional.\n` +
            `✅ Recibirá un recordatorio 24 horas antes de la audiencia.`;
    } else if (tipo === 'recordatorio') {
        message = `⏰ *RECORDATORIO DE AUDIENCIA - 24 HORAS*\n` +
            `🏛️ *JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10*\n\n` +
            `📋 *NUREJ:* ${hearing.nurej}\n` +
            `⚖️ *Audiencia:* ${hearing.tipoLabel}\n` +
            `👥 *Partes:* ${hearing.demandante} vs. ${hearing.demandado}\n` +
            `📅 *MAÑANA:* ${formatDateES(hearing.fecha)} a las ${hearing.hora} hrs\n` +
            `📍 *Lugar:* ${hearing.modalidad === 'presencial' ? 'Sala N° 10 (Piso 3, Edificio Judicial)' : 'Enlace virtual enviado por correo'}\n\n` +
            `⚠️ Su comparecencia es OBLIGATORIA conforme al Art. 365 de la Ley N° 439.`;
    }

    const waUrl = 'https://api.whatsapp.com/send?phone=' + phoneClean + '&text=' + encodeURIComponent(message);
    window.open(waUrl, '_blank');
}

// ── Resetear Formulario ─────────────────────────────────────────────────
function resetForm() {
    AppState.selectedType = null;
    AppState.selectedSlot = null;
    AppState.selectedModalidad = 'presencial';
    AppState.currentStep = 1;

    // Limpiar campos
    const fields = ['nurej', 'demandante', 'demandado', 'abogado-nombre', 'abogado-mat', 'contacto-telefono', 'contacto-email', 'hearing-date', 'observaciones'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Resetear cards
    document.querySelectorAll('.hearing-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.mod-card').forEach(c => c.classList.remove('selected'));
    const firstMod = document.querySelector('.mod-card');
    if (firstMod) firstMod.classList.add('selected');

    // Resetear slots
    const slotsGrid = document.getElementById('slots-grid');
    if (slotsGrid) {
        slotsGrid.innerHTML = '<p class="select-prompt">Seleccione una fecha válida para cargar los turnos judiciales disponibles.</p>';
    }

    // Deshabilitar botones
    const btnStep2 = document.getElementById('btn-to-step-2');
    if (btnStep2) btnStep2.disabled = true;
    const btnFinish = document.getElementById('btn-finish-booking');
    if (btnFinish) btnFinish.disabled = true;

    goToStep(1);
}

// ── Búsqueda de Audiencias ──────────────────────────────────────────────
function searchHearings() {
    const query = document.getElementById('search-query').value.trim().toLowerCase();
    const resultsList = document.getElementById('results-list');

    if (!query) {
        resultsList.innerHTML = '<p style="text-align:center; color:#94A3B8; padding:30px;"><i class="fa-solid fa-search" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Ingrese un NUREJ, nombre o expediente para buscar.</p>';
        return;
    }

    const results = AppState.hearings.filter(h =>
        h.nurej.toLowerCase().includes(query) ||
        h.demandante.toLowerCase().includes(query) ||
        h.demandado.toLowerCase().includes(query) ||
        h.abogado.toLowerCase().includes(query) ||
        h.id.toLowerCase().includes(query)
    );

    if (results.length === 0) {
        resultsList.innerHTML = `<p style="text-align:center; color:#94A3B8; padding:30px;">
            <i class="fa-solid fa-folder-open" style="font-size:2rem; display:block; margin-bottom:10px; color:#CBD5E1;"></i>
            No se encontraron audiencias para: <strong>"${query}"</strong>
        </p>`;
        return;
    }

    const statusClasses = {
        'Pendiente': 'status-pendiente',
        'Confirmada': 'status-confirmada',
        'Concluida': 'status-concluida'
    };

    const typeIcons = {
        'remates': 'fa-gavel',
        'ordinarios': 'fa-file-signature',
        'monitorio': 'fa-file-invoice-dollar',
        'coactivos': 'fa-scale-unbalanced-flip',
        'conciliaciones': 'fa-handshake'
    };

    resultsList.innerHTML = results.map(h => `
        <div class="hearing-result-card">
            <div class="result-icon">
                <i class="fa-solid ${typeIcons[h.tipo] || 'fa-calendar'}"></i>
            </div>
            <div class="result-info">
                <h4>${h.tipoLabel} — <span style="color:#D97706;">${h.id}</span></h4>
                <p><strong>NUREJ:</strong> ${h.nurej} | <strong>Partes:</strong> ${h.demandante} vs. ${h.demandado}</p>
                <p><strong>Fecha:</strong> ${formatDateES(h.fecha)} a las ${h.hora} hrs | <strong>Modalidad:</strong> ${h.modalidad}</p>
            </div>
            <span class="result-status ${statusClasses[h.estado] || 'status-pendiente'}">${h.estado}</span>
        </div>
    `).join('');
}

// También buscar al presionar Enter
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'search-query') {
        searchHearings();
    }
});

// ── Acordeón de Requisitos ──────────────────────────────────────────────
function toggleAccordion(headerElement) {
    const body = headerElement.nextElementSibling;
    const isOpen = body.classList.contains('open');

    // Cerrar todos
    document.querySelectorAll('.req-body').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.req-header').forEach(h => h.classList.remove('open'));

    // Toggle el clickeado
    if (!isOpen) {
        body.classList.add('open');
        headerElement.classList.add('open');
    }
}

// ── Sistema de Login de Administradores ─────────────────────────────────
function openLoginModal() {
    document.getElementById('modal-login').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('modal-login').classList.add('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
}

function processLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    const admin = AppState.admins.find(a =>
        a.user === user && a.pass === pass && a.active
    );

    if (!admin) {
        alert('❌ Credenciales inválidas o usuario deshabilitado. Verifique e intente nuevamente.');
        return;
    }

    AppState.currentAdmin = admin;

    // Actualizar UI
    document.getElementById('current-user-info').innerHTML =
        `<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Sesión activa: <strong>${admin.name}</strong> (${admin.role})`;
    document.getElementById('btn-login-modal').classList.add('hidden');
    document.getElementById('btn-logout-admin').classList.remove('hidden');
    document.getElementById('btn-add-admin').disabled = false;

    // Actualizar badge del header
    const badge = document.getElementById('admin-status-badge');
    if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-user-shield"></i> Administrador: ${admin.name}`;
        badge.style.borderColor = '#059669';
    }

    closeLoginModal();
    renderAdminTable();
    renderAdminUsers();
}

function logoutAdmin() {
    AppState.currentAdmin = null;

    document.getElementById('current-user-info').innerHTML =
        '<span class="text-gold font-bold">Sesión no iniciada (Modo Consulta)</span>';
    document.getElementById('btn-login-modal').classList.remove('hidden');
    document.getElementById('btn-logout-admin').classList.add('hidden');
    document.getElementById('btn-add-admin').disabled = true;

    const badge = document.getElementById('admin-status-badge');
    if (badge) {
        badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Portal Oficial de Audiencias';
        badge.style.borderColor = 'rgba(217, 119, 6, 0.3)';
    }

    renderAdminTable();
    renderAdminUsers();
}

// ── Tabla de Causas del Panel de Admin ──────────────────────────────────
function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    if (AppState.hearings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#94A3B8;">
            <i class="fa-solid fa-inbox" style="font-size:2rem; display:block; margin-bottom:10px;"></i>
            No hay audiencias registradas aún.
        </td></tr>`;
        return;
    }

    const statusColors = {
        'Pendiente': '#FEF3C7; color: #92400E',
        'Confirmada': '#D1FAE5; color: #065F46',
        'Concluida': '#E2E8F0; color: #475569'
    };

    tbody.innerHTML = AppState.hearings.map((h, index) => `
        <tr>
            <td><strong>${h.nurej}</strong><br><small style="color:#94A3B8;">${h.id}</small></td>
            <td><span style="color:#D97706; font-weight:600;">${h.tipoLabel}</span></td>
            <td>${h.demandante}<br><small style="color:#94A3B8;">vs. ${h.demandado}</small></td>
            <td><strong>${formatDateES(h.fecha)}</strong><br>${h.hora} hrs</td>
            <td>${h.telefono}<br><small>${h.notificadaWA ? '✅ Notificada' : '⏳ Sin notificar'}</small></td>
            <td><span style="background:${statusColors[h.estado] || statusColors['Pendiente']}; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:700;">${h.estado}</span></td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn-whatsapp" onclick="sendReminder(${index})" style="padding:6px 12px; font-size:0.78rem;">
                        <i class="fa-brands fa-whatsapp"></i> Recordatorio
                    </button>
                    ${AppState.currentAdmin ? `
                        <button class="btn btn-sm btn-secondary" onclick="markConcluded(${index})" style="padding:6px 12px; font-size:0.78rem;" ${h.estado === 'Concluida' ? 'disabled' : ''}>
                            <i class="fa-solid fa-check"></i> Concluir
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// ── Enviar Recordatorio WhatsApp ────────────────────────────────────────
function sendReminder(index) {
    const hearing = AppState.hearings[index];
    if (!hearing) return;
    sendWhatsAppMessage(hearing, 'recordatorio');
}

// ── Marcar Audiencia como Concluida ─────────────────────────────────────
function markConcluded(index) {
    if (!AppState.currentAdmin) {
        alert('Debe iniciar sesión como administrador para realizar esta acción.');
        return;
    }

    const hearing = AppState.hearings[index];
    if (!hearing) return;

    if (confirm(`¿Confirma dar por CONCLUIDA la audiencia ${hearing.id} (${hearing.tipoLabel})?`)) {
        hearing.estado = 'Concluida';
        saveToStorage();
        renderAdminTable();
        updateStats();
    }
}

// ── Estadísticas ────────────────────────────────────────────────────────
function updateStats() {
    const today = new Date().toISOString().split('T')[0];

    const hoy = AppState.hearings.filter(h => h.fecha === today).length;
    const pendientes = AppState.hearings.filter(h => h.estado === 'Pendiente').length;
    const notificadas = AppState.hearings.filter(h => h.notificadaWA).length;

    const elHoy = document.getElementById('stat-hoy');
    const elPend = document.getElementById('stat-pendientes');
    const elNotif = document.getElementById('stat-notificadas');

    if (elHoy) elHoy.textContent = hoy;
    if (elPend) elPend.textContent = pendientes;
    if (elNotif) elNotif.textContent = notificadas;
}

// ── Gestión de Administradores ──────────────────────────────────────────
function openAddAdminModal() {
    if (!AppState.currentAdmin) {
        alert('Debe iniciar sesión primero.');
        return;
    }
    document.getElementById('modal-add-admin').classList.remove('hidden');
}

function closeAddAdminModal() {
    document.getElementById('modal-add-admin').classList.add('hidden');
    document.getElementById('new-admin-name').value = '';
    document.getElementById('new-admin-user').value = '';
    document.getElementById('new-admin-pass').value = '';
}

function processAddAdmin() {
    const name = document.getElementById('new-admin-name').value.trim();
    const role = document.getElementById('new-admin-role').value;
    const user = document.getElementById('new-admin-user').value.trim();
    const pass = document.getElementById('new-admin-pass').value;

    if (!name || !user || !pass) {
        alert('Complete todos los campos requeridos.');
        return;
    }

    if (pass.length < 4) {
        alert('La contraseña debe tener al menos 4 caracteres.');
        return;
    }

    // Verificar que el usuario no exista
    if (AppState.admins.find(a => a.user === user)) {
        alert('El nombre de usuario "' + user + '" ya existe. Elija otro.');
        return;
    }

    AppState.admins.push({
        name: name,
        role: role,
        user: user,
        pass: pass,
        active: true
    });

    saveToStorage();
    closeAddAdminModal();
    renderAdminUsers();
    alert('✅ Administrador "' + name + '" registrado exitosamente.');
}

function renderAdminUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    const roleAvatars = {
        'Juez Titular': { class: 'avatar-juez', icon: 'fa-gavel' },
        'Secretario de Cámara': { class: 'avatar-secretario', icon: 'fa-pen-nib' },
        'Auxiliar Judicial': { class: 'avatar-auxiliar', icon: 'fa-user-gear' },
        'Conciliador/a': { class: 'avatar-conciliador', icon: 'fa-handshake' }
    };

    container.innerHTML = AppState.admins.filter(a => a.active).map((admin, index) => {
        const avatar = roleAvatars[admin.role] || { class: 'avatar-auxiliar', icon: 'fa-user' };
        return `
            <div class="admin-user-card">
                <div class="user-avatar ${avatar.class}">
                    <i class="fa-solid ${avatar.icon}"></i>
                </div>
                <div class="user-info" style="flex:1;">
                    <h4>${admin.name}</h4>
                    <p>${admin.role}</p>
                    <small>Usuario: ${admin.user}</small>
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

function revokeAdmin(username) {
    if (!AppState.currentAdmin || AppState.currentAdmin.role !== 'Juez Titular') {
        alert('Solo el Juez Titular puede revocar accesos.');
        return;
    }

    const admin = AppState.admins.find(a => a.user === username);
    if (!admin) return;

    if (confirm(`¿Confirma REVOCAR el acceso de "${admin.name}" (${admin.role})?`)) {
        admin.active = false;
        saveToStorage();
        renderAdminUsers();
        alert('Acceso revocado para: ' + admin.name);
    }
}

// ── Código Embed para Google Sites ──────────────────────────────────────
function loadEmbedCode() {
    const textarea = document.getElementById('embed-code-textarea');
    if (!textarea) return;

    // El código embed ahora será un iframe que apunte a GitHub Pages
    // Se actualizará después de publicar
    const embedCode = `<!-- PORTAL DE AUDIENCIAS - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10 -->
<!-- Pegue este código en Google Sites: Insertar > Incorporar > Código HTML -->
<!-- IMPORTANTE: Estire el recuadro a ancho completo y fije altura mínima de 1100px -->

<div style="width:100%; min-height:1000px; overflow:hidden; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <iframe 
        src="https://edemibel.github.io/JCC10/" 
        width="100%" 
        height="1100" 
        style="border:none; border-radius:12px;" 
        loading="lazy"
        allow="clipboard-write"
        title="Portal de Audiencias - Juzgado N° 10">
    </iframe>
</div>

<!-- Portal publicado en: https://edemibel.github.io/JCC10/ -->`;

    textarea.value = embedCode;
}

function copyEmbedCode() {
    const textarea = document.getElementById('embed-code-textarea');
    if (!textarea) return;

    textarea.select();
    textarea.setSelectionRange(0, 99999);

    try {
        navigator.clipboard.writeText(textarea.value).then(() => {
            showCopyFeedback();
        }).catch(() => {
            document.execCommand('copy');
            showCopyFeedback();
        });
    } catch (e) {
        document.execCommand('copy');
        showCopyFeedback();
    }
}

function showCopyFeedback() {
    const btn = document.querySelector('.code-box-header .btn');
    if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Código Copiado!';
        btn.style.backgroundColor = '#059669';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.backgroundColor = '';
        }, 2500);
    }
}
