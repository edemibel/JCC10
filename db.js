/* =========================================================================
   BASE DE DATOS JUDICIAL - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10
   Motor IndexedDB Persistente y Offline-First (JCC10_JUDICIAL_DB)
   ========================================================================= */

const JCC10_DB = (function () {
    const DB_NAME = 'JCC10_JUDICIAL_DB';
    const DB_VERSION = 1;
    let dbInstance = null;

    // ── Usuarios Iniciales por Roles Judiciales ───────────────────────────
    const DEFAULT_USERS = [
        {
            user: 'juez10',
            pass: 'admin123',
            name: 'Dr. Juan Carlos Medina Roca',
            role: 'Juez Titular',
            cargoCode: 'JUEZ',
            matriculaJudicial: 'OJ-LPZ-J10-449',
            active: true
        },
        {
            user: 'secretaria10',
            pass: 'sec123',
            name: 'Dra. María Elena Torrez Valdivia',
            role: 'Secretario de Cámara',
            cargoCode: 'SECRETARIO',
            matriculaJudicial: 'OJ-LPZ-SEC-892',
            active: true
        },
        {
            user: 'auxiliar10',
            pass: 'aux123',
            name: 'Lic. Pedro Quispe Mamani',
            role: 'Auxiliar Judicial',
            cargoCode: 'AUXILIAR',
            matriculaJudicial: 'OJ-LPZ-AUX-310',
            active: true
        },
        {
            user: 'diligencias10',
            pass: 'dilig123',
            name: 'Sr. Carlos Condori Quisbert',
            role: 'Oficial de Diligencias',
            cargoCode: 'DILIGENCIAS',
            matriculaJudicial: 'OJ-LPZ-OD-105',
            active: true
        }
    ];

    // ── Audiencias Iniciales Semilla (Casos Judiciales Representativos) ───
    const DEFAULT_HEARINGS = [
        {
            id: 'AUD-2026-10245',
            nurej: '10245/2026',
            expediente: 'EXP-104/2026',
            tipo: 'remates',
            tipoLabel: 'Audiencia de Remate y Subasta Judicial',
            demandante: 'Banco Unión S.A.',
            demandado: 'Inversiones y Construcciones Los Andes S.R.L.',
            abogado: 'Dr. Roberto Siles Morales',
            matricula: 'ICBA-45129',
            telefono: '+59171234567',
            email: 'abg.siles@judicial.bo',
            modalidad: 'presencial',
            lugarFisico: 'Sala de Audiencias N° 10 - Piso 3, Edif. Judicial Central',
            salaVirtualLink: '',
            fecha: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // En 2 días
            hora: '09:30',
            estado: 'Confirmada',
            observaciones: 'Subasta de inmueble registrado bajo matrícula computarizada 2.01.0.99.0041285. Base: $us. 85,000.',
            notificadaWA: true,
            fechaRegistro: new Date(Date.now() - 86400000 * 3).toISOString(),
            instruccionesAudiencia: 'Los postores deben presentar empozo previo del 20% de la base mediante Certificado de Depósito Judicial (Art. 419 Ley 439) y C.I. original 15 minutos antes de la subasta.',
            requisitosLegales: [
                'Empozo del 20% en Banco Unión.',
                'C.I. original del postor o Poder Notariado expreso.',
                'Publicación de prensa en original.'
            ],
            diligencia: {
                estadoDiligencia: 'Citación Personal Entregada',
                oficialNombre: 'Sr. Carlos Condori Quisbert',
                fechaDiligencia: '2026-09-20 11:15',
                observacionDiligencia: 'Citación personal al representante legal de la empresa demandada en su domicilio procesal.',
                constanciaNotificacion: 'ACTA-NOTIF-091'
            },
            resolucionJuez: {
                estadoJudicial: 'Señalamiento Firme',
                actaResumen: 'Proveído de señalamiento de primer remate público con habilitación de martillero.',
                juezNombre: 'Dr. Juan Carlos Medina Roca'
            }
        },
        {
            id: 'AUD-2026-20984',
            nurej: '20984/2026',
            expediente: 'EXP-230/2026',
            tipo: 'ordinarios',
            tipoLabel: 'Proceso Ordinario (Audiencia Preliminar)',
            demandante: 'Carmen Rosa Mamani Gutierrez',
            demandado: 'Gonzalo Vacaflor Mendez',
            abogado: 'Dra. Patricia Arze Ramos',
            matricula: 'ICBA-18492',
            telefono: '+59178965412',
            email: 'parze.abogada@gmail.com',
            modalidad: 'virtual',
            lugarFisico: 'Sala Virtual N° 10 (Plataforma Judicial)',
            salaVirtualLink: 'https://audiencias.organojudicial.bo/sala10-jcc?session=20984',
            fecha: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0], // En 4 días
            hora: '10:30',
            estado: 'Confirmada',
            observaciones: 'Cumplimiento de contrato civil y resarcimiento de daños. Se intentará conciliación previa conforme Art. 365.',
            notificadaWA: true,
            fechaRegistro: new Date(Date.now() - 86400000 * 2).toISOString(),
            instruccionesAudiencia: 'Conexión obligatoria con cámara encendida, C.I. a la mano para acreditación por el Secretario. Tolerar máximo 10 minutos de retraso.',
            requisitosLegales: [
                'Comparecencia personal de las partes o con poder especial (Art. 365.I).',
                'Ratificación escrita de la demanda o excepciones previas.',
                'Cédula de identidad y matrícula profesional vigente.'
            ],
            diligencia: {
                estadoDiligencia: 'Notificación Electrónica / WhatsApp',
                oficialNombre: 'Sr. Carlos Condori Quisbert',
                fechaDiligencia: '2026-09-21 15:40',
                observacionDiligencia: 'Notificado formalmente mediante mensaje institucional y cédula a buzón electrónico.',
                constanciaNotificacion: 'ACTA-NOTIF-094'
            },
            resolucionJuez: {
                estadoJudicial: 'Convocatoria Formal',
                actaResumen: 'Auto interlocutorio de señalamiento de audiencia preliminar.',
                juezNombre: 'Dr. Juan Carlos Medina Roca'
            }
        },
        {
            id: 'AUD-2026-30412',
            nurej: '30412/2026',
            expediente: 'EXP-389/2026',
            tipo: 'monitorio',
            tipoLabel: 'Proceso Monitorio Ejecutivo',
            demandante: 'Cooperativa de Ahorro y Crédito San Pedro Ltda.',
            demandado: 'Walter Fernández Castro',
            abogado: 'Dr. Fernando Rios Claure',
            matricula: 'ICBA-33100',
            telefono: '+59170112233',
            email: 'frios@juridico.bo',
            modalidad: 'presencial',
            lugarFisico: 'Sala de Audiencias N° 10 - Piso 3, Edif. Judicial Central',
            salaVirtualLink: '',
            fecha: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
            hora: '15:00',
            estado: 'Pendiente',
            observaciones: 'Ejecución de pagaré mercantil con intimación de pago líquida y exigible.',
            notificadaWA: false,
            fechaRegistro: new Date().toISOString(),
            instruccionesAudiencia: 'Presentar documento ejecutivo original en secretaría antes del inicio para cotejo de firmas por el actuario de sala.',
            requisitosLegales: [
                'Título ejecutivo en original.',
                'Liquidación judicial actualizada con intereses.',
                'Acreditación de personería jurídica del ejecutante.'
            ],
            diligencia: {
                estadoDiligencia: 'Pendiente de Citación',
                oficialNombre: 'Asignado a Oficial de Diligencias',
                fechaDiligencia: '',
                observacionDiligencia: 'En despacho para emisión de cédula de notificación.',
                constanciaNotificacion: 'PENDIENTE'
            },
            resolucionJuez: {
                estadoJudicial: 'Señalamiento en Trámite',
                actaResumen: 'Pendiente de informe del oficial de diligencias.',
                juezNombre: 'Dr. Juan Carlos Medina Roca'
            }
        },
        {
            id: 'AUD-2026-10850',
            nurej: '10850/2026',
            expediente: 'EXP-055/2026',
            tipo: 'conciliaciones',
            tipoLabel: 'Audiencia de Conciliación Previa',
            demandante: 'Marcela Choque Villena',
            demandado: 'Javier Loza Mercado',
            abogado: 'Dra. Verónica Salazar Paz',
            matricula: 'ICBA-22894',
            telefono: '+59176543210',
            email: 'vsalazar.paz@gmail.com',
            modalidad: 'presencial',
            lugarFisico: 'Sala de Conciliación Judicial N° 10 - Mezzanine',
            salaVirtualLink: '',
            fecha: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0], // Mañana
            hora: '11:00',
            estado: 'Confirmada',
            observaciones: 'Deslinde voluntario y división pacífica de bien inmueble familiar proindiviso.',
            notificadaWA: true,
            fechaRegistro: new Date(Date.now() - 86400000 * 4).toISOString(),
            instruccionesAudiencia: 'La audiencia es de carácter estrictamente confidencial. La presencia personal de las partes es obligatoria (no se admiten apoderados sin mandato expreso para transigir).',
            requisitosLegales: [
                'Asistencia personal obligatoria de ambas partes.',
                'Cédula de Identidad original.',
                'Disposición de resolver el conflicto por vía pacífica.'
            ],
            diligencia: {
                estadoDiligencia: 'Citación Personal Entregada',
                oficialNombre: 'Sr. Carlos Condori Quisbert',
                fechaDiligencia: '2026-09-19 16:20',
                observacionDiligencia: 'Notificación personal efectuada con entrega de volante informativo de conciliación.',
                constanciaNotificacion: 'ACTA-CONC-012'
            },
            resolucionJuez: {
                estadoJudicial: 'Convocatoria con Conciliador/a',
                actaResumen: 'Audiencia de conciliación intra-procesal programada.',
                juezNombre: 'Dr. Juan Carlos Medina Roca'
            }
        }
    ];

    // ── Inicialización de IndexedDB ───────────────────────────────────────
    function initDB() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            if (!window.indexedDB) {
                console.warn('IndexedDB no está disponible en este entorno. Se usará localStorage de respaldo.');
                resolve(null);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {
                const db = event.target.result;

                // Almacén: hearings
                if (!db.objectStoreNames.contains('hearings')) {
                    const hearingStore = db.createObjectStore('hearings', { keyPath: 'id' });
                    hearingStore.createIndex('nurej', 'nurej', { unique: false });
                    hearingStore.createIndex('fecha', 'fecha', { unique: false });
                    hearingStore.createIndex('estado', 'estado', { unique: false });
                    hearingStore.createIndex('tipo', 'tipo', { unique: false });
                }

                // Almacén: users
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'user' });
                    userStore.createIndex('role', 'role', { unique: false });
                    userStore.createIndex('active', 'active', { unique: false });
                }

                // Almacén: audit_logs
                if (!db.objectStoreNames.contains('audit_logs')) {
                    const auditStore = db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
                    auditStore.createIndex('fecha', 'fecha', { unique: false });
                    auditStore.createIndex('user', 'user', { unique: false });
                    auditStore.createIndex('nurej', 'nurej', { unique: false });
                }
            };

            request.onsuccess = async function (event) {
                dbInstance = event.target.result;
                await seedInitialDataIfEmpty();
                resolve(dbInstance);
            };

            request.onerror = function (event) {
                console.error('Error al abrir IndexedDB:', event.target.error);
                resolve(null); // Continuar con fallback
            };
        });
    }

    // ── Poblar Datos Semilla Si la Base de Datos está Vacía ───────────────
    async function seedInitialDataIfEmpty() {
        try {
            const users = await getAllUsers();
            if (!users || users.length === 0) {
                for (const u of DEFAULT_USERS) {
                    await saveUser(u, false);
                }
            }

            const hearings = await getAllHearings();
            if (!hearings || hearings.length === 0) {
                for (const h of DEFAULT_HEARINGS) {
                    await saveHearing(h, false);
                }
            }
        } catch (e) {
            console.error('Error al poblar datos semilla:', e);
        }
    }

    // ── Operaciones CRUD: Audiencias (Hearings) ───────────────────────────
    async function getAllHearings() {
        const db = await initDB();
        if (!db) {
            const raw = localStorage.getItem('jcc10_hearings');
            return raw ? JSON.parse(raw) : DEFAULT_HEARINGS;
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['hearings'], 'readonly');
            const store = tx.objectStore('hearings');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function getHearingById(id) {
        const db = await initDB();
        if (!db) {
            const list = await getAllHearings();
            return list.find(h => h.id === id) || null;
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['hearings'], 'readonly');
            const store = tx.objectStore('hearings');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function searchHearings(query) {
        const list = await getAllHearings();
        if (!query || !query.trim()) return list;

        const q = query.trim().toLowerCase();
        return list.filter(h => {
            const nurejMatch = h.nurej && h.nurej.toLowerCase().includes(q);
            const expMatch = h.expediente && h.expediente.toLowerCase().includes(q);
            const demMatch = h.demandante && h.demandante.toLowerCase().includes(q);
            const reqMatch = h.demandado && h.demandado.toLowerCase().includes(q);
            const idMatch = h.id && h.id.toLowerCase().includes(q);
            const abgMatch = h.abogado && h.abogado.toLowerCase().includes(q);
            return nurejMatch || expMatch || demMatch || reqMatch || idMatch || abgMatch;
        });
    }

    async function saveHearing(hearing, logAction = true) {
        const db = await initDB();
        if (!hearing.id) {
            hearing.id = 'AUD-2026-' + Math.floor(10000 + Math.random() * 90000);
        }
        if (!hearing.fechaRegistro) {
            hearing.fechaRegistro = new Date().toISOString();
        }

        if (!db) {
            let list = await getAllHearings();
            const idx = list.findIndex(h => h.id === hearing.id);
            if (idx >= 0) list[idx] = hearing;
            else list.unshift(hearing);
            localStorage.setItem('jcc10_hearings', JSON.stringify(list));
            return hearing;
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['hearings'], 'readwrite');
            const store = tx.objectStore('hearings');
            const req = store.put(hearing);
            req.onsuccess = async () => {
                if (logAction) {
                    await addAuditLog('REGISTRO/ACTUALIZACION_AUDIENCIA', `Audiencia ${hearing.id} (NUREJ ${hearing.nurej}) guardada.`, hearing.nurej);
                }
                // Sincronizar espejo localStorage para compatibilidad
                syncToLocalStorage();
                resolve(hearing);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteHearing(id) {
        const db = await initDB();
        if (!db) {
            let list = await getAllHearings();
            list = list.filter(h => h.id !== id);
            localStorage.setItem('jcc10_hearings', JSON.stringify(list));
            return true;
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['hearings'], 'readwrite');
            const store = tx.objectStore('hearings');
            const req = store.delete(id);
            req.onsuccess = async () => {
                await addAuditLog('ELIMINAR_AUDIENCIA', `Audiencia ${id} eliminada.`);
                syncToLocalStorage();
                resolve(true);
            };
            req.onerror = () => reject(req.error);
        });
    }

    // ── Operaciones de Diligencias (Oficial de Diligencias) ────────────────
    async function updateDiligencia(hearingId, diligenciaData, currentUser) {
        const hearing = await getHearingById(hearingId);
        if (!hearing) throw new Error('Audiencia no encontrada');

        hearing.diligencia = {
            estadoDiligencia: diligenciaData.estadoDiligencia || 'Citación Personal Entregada',
            oficialNombre: currentUser ? currentUser.name : (diligenciaData.oficialNombre || 'Oficial de Diligencias'),
            fechaDiligencia: new Date().toLocaleString('es-BO'),
            observacionDiligencia: diligenciaData.observacionDiligencia || '',
            constanciaNotificacion: diligenciaData.constanciaNotificacion || ('NOTIF-' + Date.now().toString().slice(-4))
        };

        if (diligenciaData.notificadaWA) {
            hearing.notificadaWA = true;
        }

        // Si la citación fue entregada, pasar a confirmada si estaba pendiente
        if (diligenciaData.estadoDiligencia === 'Citación Personal Entregada' && hearing.estado === 'Pendiente') {
            hearing.estado = 'Confirmada';
        }

        await saveHearing(hearing, false);
        await addAuditLog('DILIGENCIA_ACTUALIZADA', `Oficial ${hearing.diligencia.oficialNombre} registró: ${hearing.diligencia.estadoDiligencia} para ${hearing.id}`, hearing.nurej, currentUser);
        return hearing;
    }

    // ── Operaciones de Despacho (Juez Titular) ─────────────────────────────
    async function updateResolucionJuez(hearingId, estadoJudicial, motivoResolucion, currentUser) {
        const hearing = await getHearingById(hearingId);
        if (!hearing) throw new Error('Audiencia no encontrada');

        hearing.estado = estadoJudicial; // 'Confirmada', 'Celebrada', 'Suspendida', 'Reprogramada'
        hearing.resolucionJuez = {
            estadoJudicial: estadoJudicial,
            actaResumen: motivoResolucion || 'Providencia dictada en despacho judicial.',
            juezNombre: currentUser ? currentUser.name : 'Juez Titular',
            fechaResolucion: new Date().toLocaleString('es-BO')
        };

        await saveHearing(hearing, false);
        await addAuditLog('RESOLUCION_JUDICIAL', `Juez dictó resolución: [${estadoJudicial}] para causa ${hearing.id}. Motivo: ${motivoResolucion}`, hearing.nurej, currentUser);
        return hearing;
    }

    // ── Operaciones CRUD: Usuarios Judiciales (Users) ─────────────────────
    async function getAllUsers() {
        const db = await initDB();
        if (!db) {
            const raw = localStorage.getItem('jcc10_admins');
            return raw ? JSON.parse(raw) : DEFAULT_USERS;
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['users'], 'readonly');
            const store = tx.objectStore('users');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveUser(user, logAction = true) {
        const db = await initDB();
        if (!db) {
            let list = await getAllUsers();
            const idx = list.findIndex(u => u.user === user.user);
            if (idx >= 0) list[idx] = user;
            else list.push(user);
            localStorage.setItem('jcc10_admins', JSON.stringify(list));
            return user;
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['users'], 'readwrite');
            const store = tx.objectStore('users');
            const req = store.put(user);
            req.onsuccess = async () => {
                if (logAction) {
                    await addAuditLog('ALTA_FUNCIONARIO', `Funcionario judicial ${user.name} (${user.role}) registrado.`);
                }
                syncToLocalStorage();
                resolve(user);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function authenticateUser(username, password) {
        const users = await getAllUsers();
        const found = users.find(u => u.user === username && u.pass === password && u.active);
        if (found) {
            await addAuditLog('INICIO_SESION', `Funcionario ${found.name} (${found.role}) inició sesión en el sistema.`, '', found);
        }
        return found || null;
    }

    // ── Trazabilidad y Auditoría (Audit Logs) ──────────────────────────────
    async function addAuditLog(action, details, nurej = '', userObj = null) {
        const db = await initDB();
        const logEntry = {
            fecha: new Date().toISOString(),
            fechaTexto: new Date().toLocaleString('es-BO'),
            user: userObj ? userObj.user : 'sistema',
            role: userObj ? userObj.role : 'Sistema',
            action: action,
            details: details,
            nurej: nurej
        };

        if (!db) return;

        try {
            const tx = db.transaction(['audit_logs'], 'readwrite');
            const store = tx.objectStore('audit_logs');
            store.add(logEntry);
        } catch (e) {
            console.warn('No se pudo guardar log:', e);
        }
    }

    async function getAuditLogs(limit = 50) {
        const db = await initDB();
        if (!db) return [];

        return new Promise((resolve) => {
            const tx = db.transaction(['audit_logs'], 'readonly');
            const store = tx.objectStore('audit_logs');
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result || [];
                results.reverse();
                resolve(results.slice(0, limit));
            };
            req.onerror = () => resolve([]);
        });
    }

    // ── Sincronización en Espejo (LocalStorage) ────────────────────────────
    async function syncToLocalStorage() {
        try {
            const hearings = await getAllHearings();
            const users = await getAllUsers();
            localStorage.setItem('jcc10_hearings', JSON.stringify(hearings));
            localStorage.setItem('jcc10_admins', JSON.stringify(users));
        } catch (e) { /* ignore */ }
    }

    // ── Exportación y Respaldo Oficial (Backup) ────────────────────────────
    async function exportDatabaseJSON() {
        const hearings = await getAllHearings();
        const users = await getAllUsers();
        const logs = await getAuditLogs(100);

        const backupData = {
            version: '1.0.0',
            juzgado: 'Juzgado Público Civil y Comercial N° 10',
            fechaExportacion: new Date().toISOString(),
            fechaExportacionTexto: new Date().toLocaleString('es-BO'),
            totalHearings: hearings.length,
            totalUsers: users.length,
            hearings: hearings,
            users: users,
            audit_logs: logs
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `JCC10_Respaldo_Judicial_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        await addAuditLog('RESPALDO_EXPORTADO', 'Se generó y descargó un archivo de respaldo JSON completo de la base de datos.');
        return true;
    }

    // ── Importación de Respaldo ───────────────────────────────────────────
    async function importDatabaseJSON(jsonContent) {
        try {
            const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
            if (!parsed.hearings || !Array.isArray(parsed.hearings)) {
                throw new Error('Formato de archivo de respaldo inválido.');
            }

            for (const h of parsed.hearings) {
                await saveHearing(h, false);
            }

            if (parsed.users && Array.isArray(parsed.users)) {
                for (const u of parsed.users) {
                    await saveUser(u, false);
                }
            }

            await addAuditLog('RESPALDO_RESTAURADO', `Base de datos restaurada con ${parsed.hearings.length} causas.`);
            return true;
        } catch (err) {
            console.error('Error al importar base de datos:', err);
            throw err;
        }
    }

    // ── Reiniciar a Datos Semilla ─────────────────────────────────────────
    async function resetToSeeds() {
        const db = await initDB();
        if (db) {
            const tx = db.transaction(['hearings', 'users', 'audit_logs'], 'readwrite');
            tx.objectStore('hearings').clear();
            tx.objectStore('users').clear();
            tx.objectStore('audit_logs').clear();
            await new Promise(r => tx.oncomplete = r);
        }
        localStorage.removeItem('jcc10_hearings');
        localStorage.removeItem('jcc10_admins');
        await seedInitialDataIfEmpty();
        return true;
    }

    // ── Interfaz Pública del Módulo ───────────────────────────────────────
    return {
        initDB,
        getAllHearings,
        getHearingById,
        searchHearings,
        saveHearing,
        deleteHearing,
        updateDiligencia,
        updateResolucionJuez,
        getAllUsers,
        saveUser,
        authenticateUser,
        addAuditLog,
        getAuditLogs,
        exportDatabaseJSON,
        importDatabaseJSON,
        resetToSeeds,
        DEFAULT_USERS
    };
})();
