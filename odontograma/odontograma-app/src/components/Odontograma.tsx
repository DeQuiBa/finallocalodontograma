import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Trash2, Save } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface TeethStatus {
  [key: string]: string | null;
}

interface TeethCodes {
  [key: string]: {
    text: string;
    color: 'red' | 'blue';
    description?: string | null;
  };
}

interface StatusColors {
  [key: string]: string;
}

interface StatusLabels {
  [key: string]: string;
}

interface ModalState {
  isOpen: boolean;
  toothNumber: number | null;
  area: string | null;
  isEditing: boolean;
}

interface Prosthesis {  
  id: string;
  type: 'fija' | 'removible';
  teeth: number[];
  position: 'superior' | 'inferior';
  color?: 'red' | 'blue';
}

interface Crown {
  tooth: number;
  type: 'corona';
  color: 'red' | 'blue';
}

interface Appliance {
  id: string;
  teeth: [number, number]; // dos extremos
  color: 'red' | 'blue';
}

interface RemovableAppliance {
  id: string;
  teeth: [number, number];
  color: 'red' | 'blue';
}

interface Diastema {
  id: string;
  teeth: [number, number];
  color: 'blue';
}

interface Edentulo {
  id: string;
  teeth: [number, number];
  color: 'blue';
}

interface Espigo {
  id: string;
  tooth: number;
  color: 'red' | 'blue';
}

interface Fractura {
  id: string;
  tooth: number;
  color: 'red';
}

interface Fusion {
  id: string;
  teeth: [number, number];
  color: 'blue';
}

interface Geminacion {
  id: string;
  tooth: number;
  color: 'blue';
}

interface Giroversion {
  id: string;
  tooth: number;
  color: 'blue';
  direction: 'cw' | 'ccw';
}

interface Clavija {
  id: string;
  tooth: number;
  position: 'above' | 'below';
  color: 'blue';
}

interface Erupcion {
  id: string;
  tooth: number;
  color: 'blue';
  // dirección implícita: hacia oclusal (flecha apuntando hacia el plano oclusal)
}

interface Extruida {
  id: string;
  tooth: number;
  color: 'blue';
}

interface Intrusion {
  id: string;
  tooth: number;
  color: 'blue';
}

interface Supernumeraria {
  id: string;
  teeth: [number, number];
  color: 'blue';
}

interface FullProsthesis {
  id: string;
  arch: 'superior' | 'inferior';
  color: 'red' | 'blue';
}
interface PartialRemovableProsthesis {
  id: string;
  teeth: [number, number]; // start and end tooth
  color: 'red' | 'blue';
}
interface TempRestoration {
  id: string;
  tooth: number;
  areas: string[]; // 'superior' | 'inferior' | 'derecha' | 'izquierda' | 'centro'
  color: 'red';
}
interface Transposition {
  id: string;
  teeth: [number, number];
  color: 'blue';
}

type FavoriteToolId =
  | 'absent'
  | 'extraction'
  | 'crown'
  | 'diastema'
  | 'fusion'
  | 'edentulo'
  | 'appliance'
  | 'removable'
  | 'transposition'
  | 'fullProsthesisUpper'
  | 'fullProsthesisLower'
  | 'espigo'
  | 'fractura'
  | 'geminacion'
  | 'giroversion'
  | 'erupcion'
  | 'extruida'
  | 'intrusion'
  | 'clavija';

const FAVORITE_TOOLS_STORAGE_KEY = 'odontograma.favoriteTools.v1';
const DEFAULT_FAVORITE_TOOL_IDS: FavoriteToolId[] = ['absent', 'extraction', 'crown', 'diastema', 'fusion', 'edentulo'];

const Odontograma: React.FC = () => {
  const toLocalDateInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Ajuste global para desplazar horizontalmente la X del diastema (positivo => derecha, negativo => izquierda)
  const DIASTEMA_H_OFFSET = -2; // mover un poco más a la izquierda
  // =============================
  // Persistencia / API
  // =============================
  const API_BASE = 'http://localhost:3088/api';
  const [odontogramaId, setOdontogramaId] = useState<number | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);

  const [, setErrorMsg] = useState<string | null>(null); // muestra errores de red
  
  // =============================
  // Búsqueda y activación por Historia Clínica (reemplaza búsqueda por nro_cuenta)
  // =============================
  const [accountInput, setAccountInput] = useState<string>('');
  const [accountCheckLoading, setAccountCheckLoading] = useState<boolean>(false);
  const [accountFound, setAccountFound] = useState<boolean>(false);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [activated, setActivated] = useState<boolean>(false);
  // Nuevo: mantener número de historia clínica ingresado para mostrarlo en banner
  const [historyValue, setHistoryValue] = useState<string | null>(null);
  
  // Histórico de odontogramas
  type HistoricoItem = {
    Id: number;
    Correlativo: string;
    Fecha_Creacion: string;
    VersionCount: number;
    Observaciones: string | null;
  };
  const [historicoList, setHistoricoList] = useState<HistoricoItem[]>([]);
  const [selectedHistoricoId, setSelectedHistoricoId] = useState<number | null>(null);
  const [selectedHistoricoCorrelativo, setSelectedHistoricoCorrelativo] = useState<string | null>(null);
  const [loadingHistorico, setLoadingHistorico] = useState<boolean>(false);
  const [historicoFilterDate, setHistoricoFilterDate] = useState<string>('');

  const filteredHistoricoList = useMemo(() => {
    if (!historicoFilterDate) return historicoList;
    return historicoList.filter((item) => toLocalDateInput(new Date(item.Fecha_Creacion)) === historicoFilterDate);
  }, [historicoList, historicoFilterDate]);

  useEffect(() => {
    if (selectedHistoricoId == null) return;
    const existsInFiltered = filteredHistoricoList.some(item => item.Id === selectedHistoricoId);
    if (!existsInFiltered) setSelectedHistoricoId(null);
  }, [filteredHistoricoList, selectedHistoricoId]);
  
  // Mensaje de guardado mejorado
  const [saveMessage, setSaveMessage] = useState<{
    show: boolean;
    text: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, text: '', type: 'info' });
  // Observaciones (máx 500 palabras)
  const [observaciones, setObservaciones] = useState<string>('');
  const handleObservacionesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let text = e.target.value;
    const words = text.trim().length === 0 ? [] : text.trim().split(/\s+/);
    if (words.length > 500) {
      text = words.slice(0, 500).join(' ');
    }
    setObservaciones(text);
  };
  const observacionesWordCount = observaciones.trim().length === 0 ? 0 : observaciones.trim().split(/\s+/).length;

  // Cargar histórico de odontogramas del paciente
  const loadHistorico = async (nroCuenta: string) => {
    try {
      setLoadingHistorico(true);
      setSelectedHistoricoId(null);
      setSelectedHistoricoCorrelativo(null);
      const resp = await fetch(`${API_BASE}/odontograma/historico/${nroCuenta}`);
      if (!resp.ok) throw new Error('Error cargando histórico');
      const data: HistoricoItem[] = await resp.json();
      setHistoricoList(data);
    } catch (e) {
      console.error('Error cargando histórico:', e);
      setHistoricoList([]);
    } finally {
      setLoadingHistorico(false);
    }
  };
  
  // Cargar odontograma específico del histórico
  const loadHistoricoOdontograma = async (correlativo: string) => {
    if (!accountNumber) return;
    try {
      setSaveMessage({ show: true, text: 'Cargando histórico...', type: 'info' });
      setSelectedHistoricoCorrelativo(correlativo);
      const resp = await fetch(`${API_BASE}/odontograma/historico/${accountNumber}/${correlativo}`);
      if (!resp.ok) throw new Error('Error cargando odontograma histórico');
      const odoData = await resp.json();

      // El endpoint devuelve el odontograma y la lista de versiones en odoData.versiones
      const latestVersion = Array.isArray(odoData.versiones) ? odoData.versiones[0] : null; // ya vienen ordenadas DESC
      const verId = latestVersion?.Id || null;

      setOdontogramaId(odoData.Id || odoData.odontograma?.Id || odoData.odontogramaId || odoData.odontograma?.Id);
      setVersionId(verId);
      setSelectedHistoricoId(odoData.Id || odoData.odontograma?.Id);

      // Intentar cargar snapshot completo de la versión más reciente
      if (verId) {
        try {
          const snapResp = await fetch(`${API_BASE}/version/${verId}/snapshot`);
          if (snapResp.ok) {
            const snapData = await snapResp.json();
            const snap = snapData.data || null;
            if (snap) {
              // Aplicar snapshot a todos los estados
              // Limpieza previa
              setTeethStatus(snap.teethStatus || {});
              setTeethCodes(snap.teethCodes || {});
              setProstheses(snap.prostheses || []);
              setCrowns(snap.crowns || []);
              setAppliances(snap.appliances || []);
              setRemovableAppliances(snap.removableAppliances || []);
              setDiastemas(snap.diastemas || []);
              setSupernumerarias(snap.supernumerarias || []);
              setFullProstheses(snap.fullProstheses || []);
              setPartialRemovables(snap.partialRemovables || []);
              setTempRestorations(snap.tempRestorations || []);
              setTranspositions(snap.transpositions || []);
              setEdentulos(snap.edentulos || []);
              setEspigos(snap.espigos || []);
              setFracturas(snap.fracturas || []);
              setFusiones(snap.fusiones || []);
              setGeminaciones(snap.geminaciones || []);
              setGiroversions(snap.giroversions || []);
              setClavijas(snap.clavijas || []);
              setErupciones(snap.erupciones || []);
              setExtruidas(snap.extruidas || []);
              setIntrusiones(snap.intrusiones || []);
              // Raíces y observaciones
              if (snap.rootTriangles) setRootTriangles(snap.rootTriangles);
              if (snap.singleRootTriangles) setSingleRootTriangles(snap.singleRootTriangles);
              if (snap.doubleRootTriangles) setDoubleRootTriangles(snap.doubleRootTriangles);
              if (typeof snap.observaciones === 'string') setObservaciones(snap.observaciones);
              setSaveMessage({ show: true, text: `Snapshot versión ${latestVersion.VersionNumber} cargado`, type: 'success' });
              setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
              return; // terminamos con éxito
            }
          }
          if (snapResp.status === 404) {
            setSaveMessage({ show: true, text: 'Sin snapshot previo para esta versión', type: 'info' });
            setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
            return;
          }
          // Si no hay snapshot, fallback a mensaje
          setSaveMessage({ show: true, text: 'No existe snapshot para esta versión', type: 'info' });
          setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
        } catch (snapErr) {
          console.error('Error obteniendo snapshot:', snapErr);
          setSaveMessage({ show: true, text: 'Error cargando snapshot', type: 'error' });
          setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
        }
      } else {
        setSaveMessage({ show: true, text: 'No hay versiones para este odontograma', type: 'info' });
        setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
      }
    } catch (e) {
      console.error('Error cargando odontograma del histórico:', e);
      setSaveMessage({ show: true, text: 'Error cargando odontograma', type: 'error' });
      setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 3000);
    }
  };
  
  // Buscar nro_cuenta y habilitar el odontograma
  const handleAccountSearch = async () => {
    // Ahora interpreta el input como número de historia clínica
    const raw = accountInput?.trim() || '';
    if (!raw) {
      setAccountMsg('Ingrese un número de historia clínica válido');
      setAccountFound(false);
      return;
    }
    try {
      setAccountCheckLoading(true);
      const resp = await fetch(`${API_BASE}/historia/${encodeURIComponent(raw)}/existe`);
      if (!resp.ok) throw new Error('Error verificando historia clínica');
      const data = await resp.json();
      if (data.exists) {
        setAccountFound(true);
        const nombre = data?.paciente?.nombresPaciente as string | undefined;
        setAccountMsg(nombre ? `Paciente encontrado: ${nombre}` : 'Paciente encontrado');
        setPatientName(nombre || null);
        setHistoryValue(raw);
        // Determinar nro_cuenta a usar para operaciones (tomar primero existente, si no usar IdPaciente)
        let nroCuentaAsignado: string | null = null;
        if (Array.isArray(data.odontogramas) && data.odontogramas.length > 0) {
          nroCuentaAsignado = String(data.odontogramas[0].Nro_Cuenta);
        } else if (data?.paciente?.idPaciente) {
          // Fallback: utilizar IdPaciente como nro_cuenta cuando no hay atenciones previas
          nroCuentaAsignado = String(data.paciente.idPaciente);
        }
        const numeroParaOperar = raw || nroCuentaAsignado || null;
        if (numeroParaOperar) {
          setAccountNumber(numeroParaOperar);
          try { localStorage.setItem('nro_cuenta', numeroParaOperar); } catch (err) { void err; }
          // Cargar histórico utilizando la historia clínica real, que es con la que se guardan los odontogramas
          loadHistorico(numeroParaOperar);
        } else {
          setAccountNumber(null);
        }
      } else {
        setAccountFound(false);
        setAccountMsg('Historia clínica no encontrada');
        setAccountNumber(null);
        setPatientName(null);
        setHistoryValue(null);
      }
    } catch (err) {
      console.error(err);
      setAccountFound(false);
      setAccountMsg('No se pudo verificar. Intente de nuevo.');
    } finally {
      setAccountCheckLoading(false);
    }
  };

  // Banner persistente dentro del sidebar; intenta colocarlo justo encima del título "Odontograma Digital"
  useEffect(() => {
    const id = 'odontograma-patient-banner';
    const selectSidebar = () => document.querySelector('#sidebar, .sidebar, [data-odontograma-sidebar], [data-sidebar]') as HTMLElement | null;
    const findHeader = () => {
      const nodes = Array.from(document.querySelectorAll('h1,h2,h3,.odonto-title,[data-odontograma-title]')) as HTMLElement[];
      for (const n of nodes) {
        const text = (n.textContent || '').trim().toLowerCase();
        if (text.includes('odontograma digital')) return n;
      }
      return null;
    };
    let el = document.getElementById(id);
    const sidebar = selectSidebar();
    const ensureEl = () => {
      if (!el) {
        el = document.createElement('div');
        el.id = id;
      }
      return el!;
    };

    if (activated && (accountNumber || patientName)) {
      const node = ensureEl();
      node.style.background = 'rgba(255,255,255,0.95)';
      node.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
      node.style.border = '1px solid #e5e7eb';
      node.style.borderRadius = '8px';
      node.style.padding = '8px 10px';
      node.style.margin = '8px 8px 12px 8px';
      node.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
      node.style.fontSize = '14px';
      node.style.color = '#111827';
      node.style.lineHeight = '1.35';
      const name = patientName ? `Paciente: ${patientName}` : '';
      const num = historyValue ? `Historia Clínica: ${historyValue}` : '';
      node.innerHTML = `${num}${name ? '<br/>' : ''}${name}`;

      const headerEl = findHeader();
      if (headerEl && headerEl.parentElement) {
        // Insertar justo antes del título
        if (node.parentElement !== headerEl.parentElement || headerEl.previousSibling !== node) {
          headerEl.parentElement.insertBefore(node, headerEl);
        }
        node.style.position = '';
        node.style.top = '';
        node.style.left = '';
        node.style.transform = '';
        node.style.zIndex = '';
      } else if (sidebar) {
        // Insertar al inicio del sidebar
        if (!sidebar.contains(node)) sidebar.prepend(node);
        // Asegurar que no quede fijo si estaba antes
        node.style.position = '';
        node.style.top = '';
        node.style.left = '';
        node.style.transform = '';
        node.style.zIndex = '';
      } else {
        // Fallback fijo superior si no hay sidebar
        if (!document.body.contains(node)) document.body.appendChild(node);
        node.style.position = 'fixed';
        node.style.top = '8px';
        node.style.left = '50%';
        node.style.transform = 'translateX(-50%)';
        node.style.zIndex = '9999';
      }
    } else if (el) {
      el.remove();
    }

    return () => {
      const ref = document.getElementById(id);
      if (ref) ref.remove();
    };
  }, [activated, accountNumber, patientName, historyValue]);

  // Inicializar ids desde query params (?oId=123&vId=45) o localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oParam = params.get('oId');
    const vParam = params.get('vId');
    const oStored = window.localStorage.getItem('odontogramaId');
    const vStored = window.localStorage.getItem('versionId');
    const oid = oParam ? parseInt(oParam, 10) : (oStored ? parseInt(oStored, 10) : null);
    const vid = vParam ? parseInt(vParam, 10) : (vStored ? parseInt(vStored, 10) : null);
    if (oid && !isNaN(oid)) setOdontogramaId(oid);
    if (vid && !isNaN(vid)) setVersionId(vid);
  }, []);

  useEffect(() => {
    if (odontogramaId) window.localStorage.setItem('odontogramaId', String(odontogramaId));
    if (versionId) window.localStorage.setItem('versionId', String(versionId));
  }, [odontogramaId, versionId]);

  const apiPost = async (url: string, body: Record<string, unknown>) => {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`POST ${url} ${resp.status}`);
      return await resp.json().catch(() => ({}));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      console.error(e);
      setErrorMsg(msg);
      throw e;
    }
  };

  const persistArea = async (tooth: number, area: string, estado: string, color?: string) => {
    if (!odontogramaId) return;
    await apiPost(`${API_BASE}/odontograma/${odontogramaId}/diente/area`, {
      nro_cuenta: null,
      numeroDiente: tooth,
      area,
      estado,
      color,
      observaciones: null,
      usuario: 'ui'
    });
  };

  const persistCodigo = async (tooth: number, codigo: string, color?: string) => {
    if (!odontogramaId || !codigo) return;
    await apiPost(`${API_BASE}/odontograma/${odontogramaId}/diente/codigo`, {
      nro_cuenta: null,
      numeroDiente: tooth,
      codigo,
      descripcion: null,
      color,
      usuario: 'ui'
    });
  };

  const persistExtraccion = async (tooth: number) => {
    if (!odontogramaId) return;
    await apiPost(`${API_BASE}/odontograma/${odontogramaId}/diente/extraccion`, {
      nro_cuenta: null,
      numeroDiente: tooth,
      usuario: 'ui'
    });
  };

  const persistDiastema = async (left: number, right: number) => {
    if (!odontogramaId) return;
    await apiPost(`${API_BASE}/odontograma/${odontogramaId}/diastema`, {
      nro_cuenta: null,
      diente_left: left,
      diente_right: right,
      tamano: null,
      observaciones: null,
      usuario: 'ui'
    });
  };

  const persistTransposicion = async (a: number, b: number) => {
    if (!odontogramaId) return;
    await apiPost(`${API_BASE}/odontograma/${odontogramaId}/transposicion`, {
      diente_from: a,
      diente_to: b,
      color: 'blue',
      observaciones: null,
      usuario: 'ui',
      nro_cuenta: null
    });
  };

  const persistCorona = async (tooth: number, tipoCodigo: string, color?: string) => {
    if (!versionId) return;
    await apiPost(`${API_BASE}/version/${versionId}/corona`, {
      numero: tooth,
      tipoCodigo,
      material: null,
      color: color || '#FFD700',
      usuario: 'ui'
    });
  };

  const persistAparatoRemovible = async (tipo: string, posicion: string, dienteInicio?: number, dienteFin?: number, color?: string) => {
    if (!versionId) return;
    await apiPost(`${API_BASE}/version/${versionId}/aparato-removible`, {
      tipo,
      posicion,
      dienteInicio,
      dienteFin,
      color: color || '#00CED1',
      usuario: 'ui'
    });
  };

  // Función principal de guardado: crea odontograma + versión y guarda todo
  const handleSaveOdontograma = async () => {
    if (!accountNumber) {
      setSaveMessage({ show: true, text: '✗ Debe buscar un paciente primero', type: 'error' });
      setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 3000);
      return;
    }

    // Mostrar confirmación antes de guardar
    const nombrePaciente = patientName || 'este paciente';
    showConfirm(
      `¿Desea guardar el odontograma de ${nombrePaciente}?`,
      async () => {
        // Usuario confirmó, proceder con el guardado
        await ejecutarGuardado();
      }
    );
  };

  // Función que ejecuta el guardado real
  const ejecutarGuardado = async () => {
    const historiaParaGuardar = (historyValue || accountNumber || '').toString().trim();
    if (!historiaParaGuardar) return;

    try {
      setSaveMessage({ show: true, text: '💾 Guardando odontograma...', type: 'info' });
      
      const nro = parseInt(historiaParaGuardar, 10);
      let currentOdoId = odontogramaId;
      let currentVerId = versionId;

      // PASO 1: Crear nuevo odontograma (siempre creamos uno nuevo por guardado)
      const createResp = await fetch(`${API_BASE}/odontograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nroHistoria: String(nro),
          nroCuenta: nro,
          fechaVisita: new Date().toISOString(),
          tipoVisita: 'revision',
          observaciones: observaciones || `Odontograma guardado el ${new Date().toLocaleString('es-ES')}`,
          usuario: 'ui'
        })
      });

      if (!createResp.ok) throw new Error('Error creando odontograma');
      const createData = await createResp.json();
      // API devuelve { id, versionId }
      currentOdoId = createData.id;
      currentVerId = createData.versionId;

      setOdontogramaId(currentOdoId);
      setVersionId(currentVerId);

      // PASO 2: Guardar todos los datos actuales del odontograma

      // 2.1 Guardar áreas de dientes (teethStatus)
      const areaPromises: Promise<unknown>[] = [];
      for (const key in teethStatus) {
        if (key.includes('-')) {
          const [toothStr, area] = key.split('-');
          const tooth = parseInt(toothStr, 10);
          const estado = teethStatus[key];
          const colorKey = `${key}-color`;
          const color = teethStatus[colorKey] || undefined;
          if (estado && !isNaN(tooth)) {
            areaPromises.push(
              apiPost(`${API_BASE}/odontograma/${currentOdoId}/diente/area`, {
                nro_cuenta: nro,
                numeroDiente: tooth,
                area,
                estado,
                color,
                observaciones: null,
                usuario: 'ui'
              }).catch(console.error)
            );
          }
        }
      }

      // 2.2 Guardar códigos de dientes (teethCodes)
      for (const toothStr in teethCodes) {
        const tooth = parseInt(toothStr, 10);
        const codeData = teethCodes[toothStr];
        if (!isNaN(tooth) && codeData?.text) {
          areaPromises.push(
            apiPost(`${API_BASE}/odontograma/${currentOdoId}/diente/codigo`, {
              nro_cuenta: nro,
              numeroDiente: tooth,
              codigo: codeData.text,
              descripcion: null,
              color: codeData.color || 'blue',
              usuario: 'ui'
            }).catch(console.error)
          );
        }
      }

      // 2.3 Guardar diastemas
      for (const d of diastemas) {
        areaPromises.push(
          persistDiastema(d.teeth[0], d.teeth[1]).catch(console.error)
        );
      }

      // 2.4 Guardar transposiciones
      for (const t of transpositions) {
        areaPromises.push(
          persistTransposicion(t.teeth[0], t.teeth[1]).catch(console.error)
        );
      }

      // 2.5 Guardar coronas
      for (const c of crowns) {
        areaPromises.push(
          persistCorona(c.tooth, 'corona', c.color).catch(console.error)
        );
      }

      // 2.6 Guardar prótesis fijas
      for (const p of prostheses) {
        if (p.type === 'fija' && p.teeth.length >= 2) {
          areaPromises.push(
            apiPost(`${API_BASE}/version/${currentVerId}/protesis`, {
              tipo: 'fija',
              posicion: p.position,
              teeth: p.teeth,
              color: p.color || 'blue',
              usuario: 'ui'
            }).catch(console.error)
          );
        }
      }

      // 2.7 Guardar prótesis parciales removibles
      for (const pr of partialRemovables) {
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/protesis`, {
            tipo: 'removible_parcial',
            posicion: pr.teeth[0] < 30 ? 'superior' : 'inferior',
            teeth: pr.teeth,
            color: pr.color || 'blue',
            usuario: 'ui'
          }).catch(console.error)
        );
      }

      // 2.8 Guardar prótesis completas
      for (const fp of fullProstheses) {
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/protesis`, {
            tipo: 'completa',
            posicion: fp.arch,
            teeth: [],
            color: fp.color || 'blue',
            usuario: 'ui'
          }).catch(console.error)
        );
      }

      // 2.9 Guardar aparatos removibles
      for (const ra of removableAppliances) {
        areaPromises.push(
          persistAparatoRemovible(
            'removible',
            ra.teeth[0] < 30 ? 'superior' : 'inferior',
            ra.teeth[0],
            ra.teeth[1],
            ra.color
          ).catch(console.error)
        );
      }

      // 2.10 Guardar espigos
      for (const e of espigos) {
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/espigo`, {
            numero: e.tooth,
            tipo: 'metalico',
            color: e.color || 'blue',
            usuario: 'ui'
          }).catch(console.error)
        );
      }

      // 2.11 Guardar fracturas
      for (const f of fracturas) {
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/fractura`, {
            numero: f.tooth,
            tipo: 'dental',
            severidad: 'moderada',
            color: 'red',
            usuario: 'ui'
          }).catch(console.error)
        );
      }

      // 2.12 Guardar raíces (triángulos) por diente
      // Tres triángulos
      for (const t of ROOT_TRIANGLE_TEETH) {
        const arr = rootTriangles[t] || [false,false,false];
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/raiz`, {
            numeroDiente: t,
            configuracion: 3,
            triangulo1Activo: arr[0],
            triangulo2Activo: arr[1],
            triangulo3Activo: arr[2],
            usuario: 'ui'
          }).catch(console.error)
        );
      }
      // Dos triángulos
      for (const t of DOUBLE_ROOT_TRIANGLE_TEETH) {
        const arr = doubleRootTriangles[t] || [false,false];
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/raiz`, {
            numeroDiente: t,
            configuracion: 2,
            triangulo1Activo: arr[0],
            triangulo2Activo: arr[1],
            triangulo3Activo: false,
            usuario: 'ui'
          }).catch(console.error)
        );
      }
      // Un triángulo
      for (const t of SINGLE_ROOT_TRIANGLE_TEETH) {
        // Evitar duplicar si también está en arrays de 3 o 2
        if (ROOT_TRIANGLE_TEETH.includes(t) || DOUBLE_ROOT_TRIANGLE_TEETH.includes(t)) continue;
        const active = singleRootTriangles[t] || false;
        areaPromises.push(
          apiPost(`${API_BASE}/version/${currentVerId}/raiz`, {
            numeroDiente: t,
            configuracion: 1,
            triangulo1Activo: active,
            triangulo2Activo: false,
            triangulo3Activo: false,
            usuario: 'ui'
          }).catch(console.error)
        );
      }

      // Esperar a que todas las operaciones terminen
      await Promise.all(areaPromises);

      // =============================
      // SNAPSHOT COMPLETO DE LA VERSION
      // =============================
      if (currentVerId) {
        try {
          const snapshot = {
            meta: {
              accountNumber: nro,
              savedAt: new Date().toISOString(),
              patientName: patientName || null
            },
            teethStatus,
            teethCodes,
            prostheses,
            crowns,
            appliances,
            removableAppliances,
            diastemas,
            supernumerarias,
            fullProstheses,
            partialRemovables,
            tempRestorations,
            transpositions,
            edentulos,
            espigos,
            fracturas,
            fusiones,
            geminaciones,
            giroversions,
            clavijas,
            erupciones,
            extruidas,
            intrusiones,
            rootTriangles,
            singleRootTriangles,
            doubleRootTriangles,
            observaciones
          };
          await apiPost(`${API_BASE}/version/${currentVerId}/snapshot`, { data: snapshot, usuario: 'ui' });
        } catch (snapErr) {
          console.error('Error guardando snapshot:', snapErr);
        }
      }

      // Actualizar Observaciones explícitamente (por si el usuario las modificó después de crear)
      if (currentOdoId) {
        try {
          await apiPost(`${API_BASE}/odontograma/${currentOdoId}/observaciones`, {
            observaciones,
            usuario: 'ui'
          });
        } catch (obsErr) {
          console.error('Error actualizando observaciones:', obsErr);
        }
      }

      setSaveMessage({ show: true, text: '✓ Odontograma guardado exitosamente', type: 'success' });

      // Actualizar histórico para reflejar el nuevo registro
      await loadHistorico(historiaParaGuardar);

      // Opcional: evitar recargar toda la página; comentar si prefieres mantener el reload
      setTimeout(() => {
        // window.location.reload(); // desactivado para permitir navegación inmediata entre snapshots
        setSaveMessage({ show: true, text: 'Snapshot almacenado', type: 'success' });
        setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
      }, 500);

    } catch (err) {
      console.error('Error guardando odontograma:', err);
      setSaveMessage({ show: true, text: '✗ Error al guardar odontograma', type: 'error' });
      setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 3000);
    }
  };

  // =============================
  // FIN Persistencia
  // =============================

  // Estilos de impresión (si se usa Ctrl+P manualmente)

useEffect(() => {
  const styleId = "odontograma-print-style";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.type = "text/css";
    document.head.appendChild(styleEl);
  }

  // CSS actualizado que sí evita el corte del odontograma
  styleEl.textContent = `
@media print {
  @page { 
    size: A4 landscape; 
    margin: 10mm; 
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Ocultar sidebar y controles */
  .odontograma-sidebar,
  #sidebar,
  .sidebar,
  [data-odontograma-sidebar] {
    display: none !important;
  }
  /* Ocultar resumen en impresión (solo visible en pantalla) */
  .odontograma-summary {
    display: none !important;
  }

  /* Contenedor que se imprime */
  .odontograma-print-wrapper {
    margin: 0 auto !important;
    padding: 0 !important;

    /* Cambio clave — NO transform */
    transform: none !important;
    transform-origin: initial !important;

    zoom: 1;

    width: auto !important;
    break-inside: avoid;
    page-break-inside: avoid;
    display: block;
  }

  .odontograma-print-wrapper * {
    box-shadow: none !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* Cabecera impresa con datos del paciente */
  .odontograma-print-header {
    display: block !important;
    margin-bottom: 8px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
    font-size: 14px;
    color: #111827;
    text-align: center;
  }
}
/* Ocultar cabecera en pantalla, mostrar sólo en impresión */
.odontograma-print-header { display: none; }
`;

  return () => {};
}, []);

const printPdfBlob = (blob: Blob) => {
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    URL.revokeObjectURL(blobUrl);
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }

    // Esperar a que el visor PDF termine de inicializar antes de invocar print().
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.error('Error al imprimir PDF:', err);
        cleanup();
      }
    }, 200);

    win.addEventListener('afterprint', cleanup, { once: true });
    // Fallback por si afterprint no dispara en algunos navegadores/visores.
    setTimeout(cleanup, 120000);
  };

  document.body.appendChild(iframe);
  iframe.src = blobUrl;
};

const exportPdf = async ({
  download,
  print,
}: {
  download: boolean;
  print: boolean;
}) => {
  const target = containerRef.current;
  if (!target) {
    setSaveMessage({ show: true, text: '✗ No se encontró contenido para exportar', type: 'error' });
    setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
    return;
  }

  const summaryNodes = Array.from(document.querySelectorAll('.odontograma-summary')) as HTMLElement[];
  const previousSummaryDisplay = summaryNodes.map((node) => node.style.display);

  try {
    setSaveMessage({ show: true, text: 'Generando PDF...', type: 'info' });

    // Ocultar resumen solo durante la captura del PDF
    summaryNodes.forEach((node) => {
      node.style.display = 'none';
    });

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f9fafb',
      logging: false,
    });

    // Exportar siempre en tamaño A4 para impresión.
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;

    // Ajustar a una sola página A4 y centrar (sin espacio del sidebar)
    let renderWidth = usableWidth;
    let renderHeight = (imgHeightPx * renderWidth) / imgWidthPx;

    if (renderHeight > usableHeight) {
      const scaleDown = usableHeight / renderHeight;
      renderWidth *= scaleDown;
      renderHeight *= scaleDown;
    }

    const xOffset = margin + (usableWidth - renderWidth) / 2;
    const yOffset = margin + (usableHeight - renderHeight) / 2;
    const imageData = canvas.toDataURL('image/png');
    pdf.addImage(imageData, 'PNG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');

    const fileDate = toLocalDateInput(new Date());
    const filePatient = (historyValue || accountNumber || 'odontograma').replace(/\s+/g, '-');
    const fileName = `${filePatient}-${fileDate}.pdf`;

    if (download) {
      pdf.save(fileName);
    }

    if (print) {
      const pdfBlob = pdf.output('blob');
      printPdfBlob(pdfBlob);
    }

    const messageText = download && print
      ? '✓ PDF descargado y enviado a impresión'
      : print
        ? '✓ Documento enviado a impresión'
        : '✓ PDF descargado correctamente';

    setSaveMessage({ show: true, text: messageText, type: 'success' });
    setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
  } catch (error) {
    console.error('Error generando PDF:', error);
    setSaveMessage({ show: true, text: '✗ Error al generar PDF', type: 'error' });
    setTimeout(() => setSaveMessage({ show: false, text: '', type: 'info' }), 2500);
  } finally {
    summaryNodes.forEach((node, idx) => {
      node.style.display = previousSummaryDisplay[idx];
    });
  }
};

const handleDownloadPdf = async () => {
  await exportPdf({ download: true, print: false });
};

const handlePrintPdf = async () => {
  await exportPdf({ download: false, print: true });
};

  const [teethStatus, setTeethStatus] = useState<TeethStatus>({});
  const [teethCodes, setTeethCodes] = useState<TeethCodes>({});
  const [selectedStatus,] = useState<string>('caries');
  const [modal, setModal] = useState<ModalState>({ isOpen: false, toothNumber: null, area: null, isEditing: false });
  const [codeInput, setCodeInput] = useState<string>('');
  const [codeColor, setCodeColor] = useState<'red' | 'blue'>('blue');
  const [selectedCodeDesc, setSelectedCodeDesc] = useState<string | null>(null);
  const [applyAreaColor, setApplyAreaColor] = useState<boolean>(true);
  const [areaColor, setAreaColor] = useState<'red' | 'blue'>('blue');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCodeSuggestions, setShowCodeSuggestions] = useState<boolean>(false);
  type CatalogCode = { code: string; description: string; category?: string | null; colorDefault?: string | null };
  const [catalogCodes, setCatalogCodes] = useState<CatalogCode[]>([]);

  // Carga de códigos de tratamientos desde el servidor (CatalogoProcedimiento)
  useEffect(() => {
    let cancelled = false;
    const q = searchQuery.trim();
    if (!q) { setCatalogCodes([]); return; }
    const handle = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_BASE}/codigos?q=${encodeURIComponent(q)}`);
        if (!resp.ok) throw new Error('Error buscando códigos');
        const data: Array<{ Codigo: string; Descripcion: string; Categoria?: string | null; ColorDefault?: string | null }>= await resp.json();
        if (!cancelled) {
          const mapped: CatalogCode[] = (data || []).map(row => ({
            code: row.Codigo,
            description: row.Descripcion,
            category: row.Categoria ?? null,
            colorDefault: row.ColorDefault ?? null,
          }));
          setCatalogCodes(mapped);
        }
      } catch {
        if (!cancelled) setCatalogCodes([]);
      } finally {
        // no-op
      }
    }, 250); // debounce
    return () => { cancelled = true; clearTimeout(handle); };
  }, [searchQuery, API_BASE]);

  // Resolver descripción del código seleccionado (preferir lista local; fallback a consulta)
  useEffect(() => {
    const c = codeInput.trim().toUpperCase();
    if (!c) { setSelectedCodeDesc(null); return; }
    const local = catalogCodes.find(x => x.code.toUpperCase() === c);
    if (local) { setSelectedCodeDesc(local.description || null); return; }
    let cancelled = false;
    const prev = selectedCodeDesc; // conservar valor previo en caso de error o falta de resultado
    const handle = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_BASE}/codigos?q=${encodeURIComponent(c)}`);
        if (!resp.ok) throw new Error();
        const data: Array<{ Codigo: string; Descripcion: string }> = await resp.json();
        const match = (data || []).find(row => (row.Codigo || '').toUpperCase() === c);
        if (!cancelled) setSelectedCodeDesc(match ? match.Descripcion : prev);
      } catch {
        // No sobreescribir con null si ya teníamos una descripción previa
        if (!cancelled) setSelectedCodeDesc(prev || null);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [codeInput, catalogCodes, API_BASE, selectedCodeDesc]);
  const [prostheses, setProstheses] = useState<Prosthesis[]>([]);
  const [crowns, setCrowns] = useState<Crown[]>([]);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [prosthesisMode, setProsthesisMode] = useState<'fija' | 'removible' | null>(null);
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  // Color/status for prosthesis (blue = buen estado, red = mal estado)
  const [prosthesisColor, setProsthesisColor] = useState<'red' | 'blue'>('blue');
  // Estado para crear aparato fijo
  const [applianceMode, setApplianceMode] = useState<boolean>(false);
  const [selectedApplianceTeeth, setSelectedApplianceTeeth] = useState<number[]>([]);
  const [applianceColor, setApplianceColor] = useState<'red' | 'blue'>('blue');
  // Estado para coronas
  const [crownMode, setCrownMode] = useState<boolean>(false);
  const [selectedCrowns, setSelectedCrowns] = useState<number[]>([]);
  const [crownColor, setCrownColor] = useState<'red' | 'blue'>('blue');
  // Estado para diastemas (X entre piezas)
  const [diastemas, setDiastemas] = useState<Diastema[]>([]);
  const [diastemaMode, setDiastemaMode] = useState<boolean>(false);
  const [selectedDiastemaTeeth, setSelectedDiastemaTeeth] = useState<number[]>([]);
  // Supernumeraria (círculo con 'S' entre dos dientes)
  const [supernumerarias, setSupernumerarias] = useState<Supernumeraria[]>([]);
  const [supernumerariaMode, setSupernumerariaMode] = useState<boolean>(false);
  const [selectedSuperTeeth, setSelectedSuperTeeth] = useState<number[]>([]);
  // Prótesis completa (superior / inferior)
  const [fullProstheses, setFullProstheses] = useState<FullProsthesis[]>([]);
  const [fullProsthesisMode, setFullProsthesisMode] = useState<'superior' | 'inferior' | null>(null);
  const [fullProsthesisColor, setFullProsthesisColor] = useState<'red' | 'blue'>('blue');
  // Prótesis parcial removible (seleccionar diente inicial y final)
  const [partialRemovables, setPartialRemovables] = useState<PartialRemovableProsthesis[]>([]);
  const [partialRemovableMode, setPartialRemovableMode] = useState<boolean>(false);
  const [selectedPartialRemovableTeeth, setSelectedPartialRemovableTeeth] = useState<number[]>([]);
  const [partialRemovableColor, setPartialRemovableColor] = useState<'red' | 'blue'>('blue');
  // Hover helper to show preview when selecting second tooth for partial removables
  const [hoverTooth, setHoverTooth] = useState<number | null>(null);
  // Restauración temporal: selección de superficies y almacenamiento
  const [restorationTempMode, setRestorationTempMode] = useState<boolean>(false);
  const [selectedTempAreas, setSelectedTempAreas] = useState<Record<number, string[]>>({});
  const [tempRestorations, setTempRestorations] = useState<TempRestoration[]>([]);
  // Para seleccionar áreas persistentes y marcarlas para eliminación antes de confirmar
  const [selectedTempToDelete, setSelectedTempToDelete] = useState<Record<number, string[]>>({});
  // Transposición dentaria: modo y datos
  const [transpositionMode, setTranspositionMode] = useState<boolean>(false);
  const [selectedTranspositionTeeth, setSelectedTranspositionTeeth] = useState<number[]>([]);
  const [transpositions, setTranspositions] = useState<Transposition[]>([]);
  // Edéntulo (línea horizontal que pasa por el medio de los dientes)
  const [edentulos, setEdentulos] = useState<Edentulo[]>([]);
  const [edentuloMode, setEdentuloMode] = useState<boolean>(false);
  const [selectedEdentuloTeeth, setSelectedEdentuloTeeth] = useState<number[]>([]);
  // Espigo / Muñón (línea vertical + cuadro en la corona)
  const [espigos, setEspigos] = useState<Espigo[]>([]);
  const [espigoMode, setEspigoMode] = useState<boolean>(false);
  const [selectedEspigoTooth, setSelectedEspigoTooth] = useState<number | null>(null);
  const [espigoColor, setEspigoColor] = useState<'red' | 'blue'>('blue');
  // Fractura dental (línea vertical roja + X en la corona)
  const [fracturas, setFracturas] = useState<Fractura[]>([]);
  const [fracturaMode, setFracturaMode] = useState<boolean>(false);
  const [selectedFracturaTooth, setSelectedFracturaTooth] = useState<number | null>(null);
  // Fusión (dos circunferencias interceptadas, azul)
  const [fusiones, setFusiones] = useState<Fusion[]>([]);
  const [fusionMode, setFusionMode] = useState<boolean>(false);
  const [selectedFusionTeeth, setSelectedFusionTeeth] = useState<number[]>([]);
  // Geminación (una circunferencia azul alrededor del número)
  const [geminaciones, setGeminaciones] = useState<Geminacion[]>([]);
  const [geminacionMode, setGeminacionMode] = useState<boolean>(false);
  const [selectedGeminTooth, setSelectedGeminTooth] = useState<number | null>(null);
  // Giroversión (flecha curva en oclusal, debajo del diente)
  const [giroversions, setGiroversions] = useState<Giroversion[]>([]);
  const [giroMode, setGiroMode] = useState<boolean>(false);
  const [selectedGiroTooth, setSelectedGiroTooth] = useState<number | null>(null);
  const [giroDirection, setGiroDirection] = useState<'cw' | 'ccw'>('cw');
  // Clavija / Pieza en clavija: triángulo azul encima o debajo de las raíces
  const [clavijas, setClavijas] = useState<Clavija[]>([]);
  const [clavijaMode, setClavijaMode] = useState<boolean>(false);
  const [selectedClavijaTooth, setSelectedClavijaTooth] = useState<number | null>(null);
  const [clavijaPosition, setClavijaPosition] = useState<'above' | 'below'>('below');
  // Pieza en erupción: flecha zigzag dirigida hacia el plano oclusal
  const [erupciones, setErupciones] = useState<Erupcion[]>([]);
  const [erupcionMode, setErupcionMode] = useState<boolean>(false);
  const [selectedErupcionTooth, setSelectedErupcionTooth] = useState<number | null>(null);
  // Pieza dentaria extruida/intrudida: flechas verticales fuera del diente
  const [extruidas, setExtruidas] = useState<Extruida[]>([]);
  const [extruidaMode, setExtruidaMode] = useState<boolean>(false);
  const [selectedExtruidaTooth, setSelectedExtruidaTooth] = useState<number | null>(null);

  const [intrusiones, setIntrusiones] = useState<Intrusion[]>([]);
  const [intrusionMode, setIntrusionMode] = useState<boolean>(false);
  const [selectedIntrusionTooth, setSelectedIntrusionTooth] = useState<number | null>(null);
  const resetAllToolModes = () => {
    setApplianceMode(false);
    setRemovableMode(false);
    setCrownMode(false);
    setProsthesisMode(null);
    setAbsentMode(false);
    setExtractionMode(false);
    setDiastemaMode(false);
    setSupernumerariaMode(false);
    setEdentuloMode(false);
    setTranspositionMode(false);
    setRestorationTempMode(false);
    setPartialRemovableMode(false);
    setFullProsthesisMode(null);
    setFusionMode(false);
    setGeminacionMode(false);
    setGiroMode(false);
    setClavijaMode(false);
    setErupcionMode(false);
    setExtruidaMode(false);
    setIntrusionMode(false);
    setEspigoMode(false);
    setFracturaMode(false);
    setSelectedTeeth([]);
    setSelectedApplianceTeeth([]);
    setSelectedCrowns([]);
    setSelectedDiastemaTeeth([]);
    setSelectedSuperTeeth([]);
    setSelectedEdentuloTeeth([]);
    setSelectedTranspositionTeeth([]);
    setSelectedFusionTeeth([]);
    setSelectedGeminTooth(null);
    setSelectedGiroTooth(null);
    setSelectedClavijaTooth(null);
    setSelectedErupcionTooth(null);
    setSelectedExtruidaTooth(null);
    setSelectedIntrusionTooth(null);
    setSelectedEspigoTooth(null);
    setSelectedFracturaTooth(null);
    setSelectedPartialRemovableTeeth([]);
    setSelectedRemovableTeeth([]);
    setSelectedTempAreas({});
    setSelectedTempToDelete({});
  };
  const activateTool = (setter: (value: any) => void, value: any) => {
    resetAllToolModes();
    setter(value);
  };

  const [favoriteToolIds, setFavoriteToolIds] = useState<FavoriteToolId[]>(DEFAULT_FAVORITE_TOOL_IDS);
  const [isEditingFavorites, setIsEditingFavorites] = useState<boolean>(false);
  const [favoritesHydrated, setFavoritesHydrated] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITE_TOOLS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return;

      const allowed = new Set<FavoriteToolId>([
        'absent',
        'extraction',
        'crown',
        'diastema',
        'fusion',
        'edentulo',
        'appliance',
        'removable',
        'transposition',
        'fullProsthesisUpper',
        'fullProsthesisLower',
        'espigo',
        'fractura',
        'geminacion',
        'giroversion',
        'erupcion',
        'extruida',
        'intrusion',
        'clavija',
      ]);
      const filtered = parsed.filter((id): id is FavoriteToolId => allowed.has(id as FavoriteToolId));
      setFavoriteToolIds(filtered);
    } catch (err) {
      console.error('No se pudieron cargar favoritas personalizadas', err);
    } finally {
      setFavoritesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesHydrated) return;
    try {
      localStorage.setItem(FAVORITE_TOOLS_STORAGE_KEY, JSON.stringify(favoriteToolIds));
    } catch (err) {
      console.error('No se pudieron guardar favoritas personalizadas', err);
    }
  }, [favoriteToolIds, favoritesHydrated]);

  const toggleFavoriteTool = (toolId: FavoriteToolId) => {
    setFavoriteToolIds((prev) => {
      if (prev.includes(toolId)) {
        return prev.filter((id) => id !== toolId);
      }
      return [...prev, toolId];
    });
  };

  const renderFavoriteToggle = (toolId: FavoriteToolId, label: string) => {
    if (!isEditingFavorites) return null;
    const isFavorite = favoriteToolIds.includes(toolId);

    return (
      <button
        onClick={() => toggleFavoriteTool(toolId)}
        aria-label={`${isFavorite ? 'Quitar' : 'Agregar'} ${label} ${isFavorite ? 'de' : 'a'} favoritas`}
        title={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
        style={{
          ...styles.favoriteStarButton,
          color: isFavorite ? '#eab308' : '#94a3b8',
        }}
      >
        {isFavorite ? '★' : '☆'}
      </button>
    );
  };

  // Raíces (triángulos) para múltiples dientes (representan raíces superiores)
  const ROOT_TRIANGLE_TEETH = [18,17,16,26,27,28,55,54,64,65];
  const [rootTriangles, setRootTriangles] = useState<Record<number, boolean[]>>(() => {
    const init: Record<number, boolean[]> = {};
    ROOT_TRIANGLE_TEETH.forEach(t => { init[t] = [false,false,false]; });
    return init;
  });
  const toggleRootTriangle = (tooth: number, idx: number) => {
    setRootTriangles(prev => {
      const current = prev[tooth] ? [...prev[tooth]] : [false,false,false];
      current[idx] = !current[idx];
      return { ...prev, [tooth]: current };
    });
  };
  // Triángulo único para dientes solicitados (una sola raíz visible)
  const SINGLE_ROOT_TRIANGLE_TEETH = [15,13,12,11,21,22,23,25,53,52,51,61,62,63,83,82,81,71,72,73,45,44,43,42,41,31,32,33,34,35];
  const [singleRootTriangles, setSingleRootTriangles] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    SINGLE_ROOT_TRIANGLE_TEETH.forEach(t => { init[t] = false; });
    return init;
  });
  const toggleSingleRootTriangle = (tooth: number) => {
    setSingleRootTriangles(prev => ({ ...prev, [tooth]: !prev[tooth] }));
  };
  // Raíces dobles (dos triángulos) para dientes especificados
  const DOUBLE_ROOT_TRIANGLE_TEETH = [14,24,85,84,74,75,48,47,46,36,37,38];
  const [doubleRootTriangles, setDoubleRootTriangles] = useState<Record<number, boolean[]>>(() => {
    const init: Record<number, boolean[]> = {};
    DOUBLE_ROOT_TRIANGLE_TEETH.forEach(t => { init[t] = [false,false]; });
    return init;
  });
  const toggleDoubleRootTriangle = (tooth: number, idx: number) => {
    setDoubleRootTriangles(prev => {
      const current = prev[tooth] ? [...prev[tooth]] : [false,false];
      current[idx] = !current[idx];
      return { ...prev, [tooth]: current };
    });
  };
  // Refs and overlay positions to render connectors (diastemas) on a separate layer
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toothRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [diastemaPositions, setDiastemaPositions] = useState<Record<string, { left: number; top: number; size: number }>>({});
  const [edentuloPositions, setEdentuloPositions] = useState<Record<string, { left: number; top: number; width: number }>>({});
  const [supernumerariaPositions, setSupernumerariaPositions] = useState<Record<string, { left: number; top: number; size: number }>>({});
  const overlayEnabled = true;
  // Modo pieza ausente (marcar diente como ausente con una X azul)
  const [absentMode, setAbsentMode] = useState<boolean>(false);
  // Modo extracción (marcar extracción indicada con una X roja)
  const [extractionMode, setExtractionMode] = useState<boolean>(false);

  // Modal de confirmación personalizado
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    title?: string;
    confirmLabel?: string;
    isDanger?: boolean;
  }>({ isOpen: false, message: '', onConfirm: () => {}, title: undefined, confirmLabel: undefined, isDanger: false });

  const showConfirm = (message: string, onConfirm: () => void, onCancel?: () => void) => {
    const isDeleteAction = /\b(eliminar|borrar|quitar)\b/i.test(message);
    setConfirmModal({
      isOpen: true,
      message,
      onConfirm,
      onCancel,
      title: isDeleteAction ? 'Eliminar elemento' : 'Guardar Odontograma',
      confirmLabel: isDeleteAction ? 'Eliminar' : 'Guardar',
      isDanger: isDeleteAction,
    });
  };

  const showInfoModal = (message: string, title = 'Aviso') => {
    setConfirmModal({
      isOpen: true,
      message,
      onConfirm: () => {},
      onCancel: () => {},
      title,
      confirmLabel: 'Entendido',
      isDanger: false,
    });
  };

  // Confirmación específica para limpiar todo el odontograma
  const showConfirmClear = () => {
    setConfirmModal({
      isOpen: true,
      message: 'Si se limpia puede que se pierda todo lo realizado si aún no se ha guardado. ¿Está seguro de continuar?',
      onConfirm: () => { clearAll(); setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} }); },
      onCancel: () => {},
      title: 'Limpiar Odontograma',
      confirmLabel: 'Limpiar',
      isDanger: true,
    });
  };

  const handleConfirmYes = () => {
    confirmModal.onConfirm();
    setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} });
  };

  const handleConfirmNo = () => {
    if (confirmModal.onCancel) confirmModal.onCancel();
    setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} });
  };

  // Recompute diastema positions using DOM coordinates so we can render them in an overlay
  useEffect(() => {
    const updatePositions = () => {
      const cont = containerRef.current;
      if (!cont) return;
      const containerRect = cont.getBoundingClientRect();
      const next: Record<string, { left: number; top: number; size: number }> = {};
      const nextEd: Record<string, { left: number; top: number; width: number }> = {};

        diastemas.forEach(d => {
        const [t1, t2] = d.teeth;
        const el1 = toothRefs.current[t1];
        const el2 = toothRefs.current[t2];
        if (!el1 || !el2) return;
        const r1 = el1.getBoundingClientRect();
        const r2 = el2.getBoundingClientRect();
        const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
        const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
        const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
        const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
        const midX = (cx1 + cx2) / 2;
        const midY = (cy1 + cy2) / 2 + 6; // ligero desplazamiento vertical
        const size = Math.max(20, Math.min(40, Math.abs(cx2 - cx1) * 0.18 || 24));
        // usar constante compartida para control del desplazamiento horizontal
        next[d.id] = { left: midX - size / 2 + DIASTEMA_H_OFFSET, top: midY - size / 2, size };
      });

      // calcular posiciones para supernumerarias (círculo con 'S' entre dos dientes)
      const nextSuper: Record<string, { left: number; top: number; size: number }> = {};
      supernumerarias.forEach(s => {
        const [t1, t2] = s.teeth;
        const el1 = toothRefs.current[t1];
        const el2 = toothRefs.current[t2];
        if (!el1 || !el2) return;
        const r1 = el1.getBoundingClientRect();
        const r2 = el2.getBoundingClientRect();
        const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
        const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
        const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
        const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
        const midX = (cx1 + cx2) / 2;
        const midY = (cy1 + cy2) / 2 + 6; // similar vertical placement as diastema
        const size = Math.max(20, Math.min(44, Math.abs(cx2 - cx1) * 0.18 || 28));
        nextSuper[s.id] = { left: midX - size / 2 + DIASTEMA_H_OFFSET, top: midY - size / 2, size };
      });

      // calcular posiciones para edéntulos
      edentulos.forEach(e => {
        const [t1, t2] = e.teeth;
        const el1 = toothRefs.current[t1];
        const el2 = toothRefs.current[t2];
        if (!el1 || !el2) return;
        const r1 = el1.getBoundingClientRect();
        const r2 = el2.getBoundingClientRect();
        const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
        const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
        const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
        const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
        const left = Math.min(cx1, cx2);
        const width = Math.abs(cx2 - cx1);
        const midY = (cy1 + cy2) / 2; // pasar por el medio vertical de los dientes
        nextEd[e.id] = { left, top: midY, width };
      });

  setDiastemaPositions(next);
  setEdentuloPositions(nextEd);
  setSupernumerariaPositions(nextSuper);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);
    const ro = new ResizeObserver(updatePositions);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
      ro.disconnect();
    };
  }, [diastemas, edentulos, DIASTEMA_H_OFFSET, supernumerarias]);
  // Estado para crear aparato removible (zigzag)
  const [removableAppliances, setRemovableAppliances] = useState<RemovableAppliance[]>([]);
  const [removableMode, setRemovableMode] = useState<boolean>(false);
  const [selectedRemovableTeeth, setSelectedRemovableTeeth] = useState<number[]>([]);
  const [removableColor, setRemovableColor] = useState<'red' | 'blue'>('blue');

  const favoriteToolDefinitions = useMemo(() => {
    return [
      {
        id: 'absent' as FavoriteToolId,
        label: '✖ Ausente',
        isActive: absentMode,
        onClick: () => activateTool(setAbsentMode, !absentMode),
      },
      {
        id: 'extraction' as FavoriteToolId,
        label: '✖ Extracción',
        isActive: extractionMode,
        onClick: () => activateTool(setExtractionMode, !extractionMode),
      },
      {
        id: 'crown' as FavoriteToolId,
        label: '👑 Corona',
        isActive: crownMode,
        onClick: () => {
          activateTool(setCrownMode, !crownMode);
          setSelectedCrowns([]);
        },
      },
      {
        id: 'diastema' as FavoriteToolId,
        label: '✖ Diastema',
        isActive: diastemaMode,
        onClick: () => {
          activateTool(setDiastemaMode, !diastemaMode);
          setSelectedDiastemaTeeth([]);
        },
      },
      {
        id: 'fusion' as FavoriteToolId,
        label: '⚪ Fusión',
        isActive: fusionMode,
        onClick: () => {
          activateTool(setFusionMode, !fusionMode);
          setSelectedFusionTeeth([]);
        },
      },
      {
        id: 'edentulo' as FavoriteToolId,
        label: '─ Edéntulo',
        isActive: edentuloMode,
        onClick: () => {
          activateTool(setEdentuloMode, !edentuloMode);
          setSelectedEdentuloTeeth([]);
        },
      },
      {
        id: 'appliance' as FavoriteToolId,
        label: '🛠 Aparato Fijo',
        isActive: applianceMode,
        onClick: () => {
          activateTool(setApplianceMode, !applianceMode);
          setSelectedApplianceTeeth([]);
        },
      },
      {
        id: 'removable' as FavoriteToolId,
        label: '🌀 Aparato Removible',
        isActive: removableMode,
        onClick: () => {
          activateTool(setRemovableMode, !removableMode);
          setSelectedRemovableTeeth([]);
        },
      },
      {
        id: 'transposition' as FavoriteToolId,
        label: '⇄ Transposición Dentaria',
        isActive: transpositionMode,
        onClick: () => {
          activateTool(setTranspositionMode, !transpositionMode);
          setSelectedTranspositionTeeth([]);
        },
      },
      {
        id: 'fullProsthesisUpper' as FavoriteToolId,
        label: '≡ Prótesis Completa Superior',
        isActive: fullProsthesisMode === 'superior',
        onClick: () => {
          activateTool(setFullProsthesisMode, fullProsthesisMode === 'superior' ? null : 'superior');
        },
      },
      {
        id: 'fullProsthesisLower' as FavoriteToolId,
        label: '≡ Prótesis Completa Inferior',
        isActive: fullProsthesisMode === 'inferior',
        onClick: () => {
          activateTool(setFullProsthesisMode, fullProsthesisMode === 'inferior' ? null : 'inferior');
        },
      },
      {
        id: 'espigo' as FavoriteToolId,
        label: '⤉ Espigo / Muñón',
        isActive: espigoMode,
        onClick: () => {
          activateTool(setEspigoMode, !espigoMode);
          setSelectedEspigoTooth(null);
        },
      },
      {
        id: 'fractura' as FavoriteToolId,
        label: '⚠️ Fractura Dental',
        isActive: fracturaMode,
        onClick: () => {
          activateTool(setFracturaMode, !fracturaMode);
          setSelectedFracturaTooth(null);
        },
      },
      {
        id: 'geminacion' as FavoriteToolId,
        label: '⭕ Geminación',
        isActive: geminacionMode,
        onClick: () => {
          activateTool(setGeminacionMode, !geminacionMode);
          setSelectedGeminTooth(null);
        },
      },
      {
        id: 'giroversion' as FavoriteToolId,
        label: '↻ Giroversión',
        isActive: giroMode,
        onClick: () => {
          activateTool(setGiroMode, !giroMode);
          setSelectedGiroTooth(null);
        },
      },
      {
        id: 'erupcion' as FavoriteToolId,
        label: '↗ Pieza en Erupción',
        isActive: erupcionMode,
        onClick: () => {
          activateTool(setErupcionMode, !erupcionMode);
          setSelectedErupcionTooth(null);
        },
      },
      {
        id: 'extruida' as FavoriteToolId,
        label: '⇧ Pieza Extruida',
        isActive: extruidaMode,
        onClick: () => {
          activateTool(setExtruidaMode, !extruidaMode);
          setSelectedExtruidaTooth(null);
        },
      },
      {
        id: 'intrusion' as FavoriteToolId,
        label: '⇩ Pieza Intruida',
        isActive: intrusionMode,
        onClick: () => {
          activateTool(setIntrusionMode, !intrusionMode);
          setSelectedIntrusionTooth(null);
        },
      },
      {
        id: 'clavija' as FavoriteToolId,
        label: '▲ Pieza en Clavija',
        isActive: clavijaMode,
        onClick: () => {
          activateTool(setClavijaMode, !clavijaMode);
          setSelectedClavijaTooth(null);
        },
      },
    ];
  }, [
    absentMode,
    extractionMode,
    crownMode,
    diastemaMode,
    fusionMode,
    edentuloMode,
    applianceMode,
    removableMode,
    transpositionMode,
    fullProsthesisMode,
    espigoMode,
    fracturaMode,
    geminacionMode,
    giroMode,
    erupcionMode,
    extruidaMode,
    intrusionMode,
    clavijaMode,
  ]);

  const favoriteToolsById = useMemo(() => {
    return new Map(favoriteToolDefinitions.map((tool) => [tool.id, tool]));
  }, [favoriteToolDefinitions]);

  const selectedFavoriteTools = useMemo(() => {
    return favoriteToolIds
      .map((toolId) => favoriteToolsById.get(toolId))
      .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));
  }, [favoriteToolIds, favoriteToolsById]);

  const displayedOdontogramaLabel = useMemo(() => {
    if (selectedHistoricoCorrelativo) return selectedHistoricoCorrelativo;

    const currentHistoricoId = selectedHistoricoId ?? odontogramaId;
    if (currentHistoricoId != null) {
      const historicoItem = historicoList.find((item) => item.Id === currentHistoricoId);
      if (historicoItem?.Correlativo) return historicoItem.Correlativo;
    }

    return odontogramaId ?? selectedHistoricoId ?? '—';
  }, [selectedHistoricoCorrelativo, selectedHistoricoId, odontogramaId, historicoList]);

  const statusColors: StatusColors = {
    caries: '#ef4444',
    ausente: '#1f2937',
    obturado: '#3b82f6',
    endodoncia: '#a855f7',
    corona: '#eab308',
    implante: '#22c55e',
    extraccion: '#b91c1c',
  };

  const statusLabels: StatusLabels = {
    caries: 'Patología o lesión',
    ausente: 'Diente ausente (X)',
    obturado: 'Tratamiento hecho',
    endodoncia: 'Endodoncia',
    corona: 'Corona (círculo)',
    implante: 'Caries radiográficas',
    extraccion: 'Extracción indicada',
  };

  // Si no está activado aún, mostrar buscador y estado
  if (!activated) {
    return (
      <div className="odontograma-activacion" style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>Odontograma Digital</h2>
        <div style={{ margin: '6px 0 12px 0', color: '#555' }}>32 Presentes · 0 Ausentes</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Número de historia clínica"
            value={accountInput}
            onChange={(e) => setAccountInput(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <button
            onClick={handleAccountSearch}
            disabled={accountCheckLoading || !accountInput}
            style={{ padding: '6px 10px', borderRadius: 4 }}
          >
            {accountCheckLoading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {accountMsg && (
          <div style={{ marginTop: 8, color: accountFound ? 'green' : 'crimson' }}>{accountMsg}</div>
        )}
        {accountFound && historyValue && (
          <div style={{ marginTop: 6 }}>Historia Clínica: {historyValue}</div>
        )}
        {accountFound && (
          <button
            style={{ marginTop: 10, padding: '6px 10px', borderRadius: 4 }}
            onClick={() => setActivated(true)}
          >
            Iniciar odontograma
          </button>
        )}
      </div>
    );
  }

  

  const cuadrante1 = [18, 17, 16, 15, 14, 13, 12, 11];
  const cuadrante2 = [21, 22, 23, 24, 25, 26, 27, 28];
  const cuadrante3 = [48, 47, 46, 45, 44, 43, 42, 41];
  const cuadrante4 = [31, 32, 33, 34, 35, 36, 37, 38];

  const cuadrante5 = [55, 54, 53, 52, 51];
  const cuadrante6 = [61, 62, 63, 64, 65];
  const cuadrante7 = [85, 84, 83, 82, 81];
  const cuadrante8 = [71, 72, 73, 74, 75];

  const toggleToothArea = (toothNumber: number, area: string): void => {
    const absentKey = `${toothNumber}-ausente`;
    const extractionKey = `${toothNumber}-extraccion`;

    // Permitir eliminar la X al primer clic aunque el modo no esté activo.
    if (!absentMode && !extractionMode) {
      const hasExtraction = Object.prototype.hasOwnProperty.call(teethStatus, extractionKey);
      const hasAbsent = Object.prototype.hasOwnProperty.call(teethStatus, absentKey);

      if (hasExtraction) {
        showConfirm('¿Eliminar marca de extracción?', () => {
          setTeethStatus(prev => {
            const copy = { ...prev };
            delete copy[extractionKey];
            return copy;
          });
          persistExtraccion(toothNumber).catch(()=>{});
        });
        return;
      }

      if (hasAbsent) {
        showConfirm('¿Eliminar marca de pieza ausente?', () => {
          setTeethStatus(prev => {
            const copy = { ...prev };
            delete copy[absentKey];
            return copy;
          });
        });
        return;
      }
    }

    // Si estamos en modo creación de aparato, seleccionar dientes (máx 2)
    if (applianceMode) {
      if (selectedApplianceTeeth.includes(toothNumber)) {
        setSelectedApplianceTeeth(selectedApplianceTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedApplianceTeeth.length < 2) {
          setSelectedApplianceTeeth([...selectedApplianceTeeth, toothNumber]);
        }
      }
      return;
    }

    // Modo transposición: seleccionar dos dientes que presentan transposición
    if (transpositionMode) {
      if (selectedTranspositionTeeth.includes(toothNumber)) {
        setSelectedTranspositionTeeth(selectedTranspositionTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedTranspositionTeeth.length < 2) {
          setSelectedTranspositionTeeth([...selectedTranspositionTeeth, toothNumber]);
        }
      }
      return;
    }

    // Modo Restauración Temporal: seleccionar superficies del diente (puede seleccionar varias piezas/áreas)
    if (restorationTempMode) {
      // Si la superficie ya está persistente, togglear selección para borrado
      const isPersistent = tempRestorations.some(r => r.tooth === toothNumber && r.areas.includes(area));
      if (isPersistent) {
        setSelectedTempToDelete(prev => {
          const copy: Record<number, string[]> = { ...prev };
          const arr = copy[toothNumber] ? [...copy[toothNumber]] : [];
          if (arr.includes(area)) {
            copy[toothNumber] = arr.filter(a => a !== area);
            if (copy[toothNumber].length === 0) delete copy[toothNumber];
          } else {
            arr.push(area);
            copy[toothNumber] = arr;
          }
          return copy;
        });
      } else {
        setSelectedTempAreas(prev => {
          const copy: Record<number, string[]> = { ...prev };
          const arr = copy[toothNumber] ? [...copy[toothNumber]] : [];
          if (arr.includes(area)) {
            copy[toothNumber] = arr.filter(a => a !== area);
            if (copy[toothNumber].length === 0) delete copy[toothNumber];
          } else {
            arr.push(area);
            copy[toothNumber] = arr;
          }
          return copy;
        });
      }
      return;
    }

    // Modo aparato removible (zigzag)
    if (removableMode) {
      if (selectedRemovableTeeth.includes(toothNumber)) {
        setSelectedRemovableTeeth(selectedRemovableTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedRemovableTeeth.length < 2) {
          setSelectedRemovableTeeth([...selectedRemovableTeeth, toothNumber]);
        }
      }
      return;
    }

    // Modo prótesis parcial removible: seleccionar diente inicial y final
    if (partialRemovableMode) {
      if (selectedPartialRemovableTeeth.includes(toothNumber)) {
        setSelectedPartialRemovableTeeth(selectedPartialRemovableTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedPartialRemovableTeeth.length < 2) {
          setSelectedPartialRemovableTeeth([...selectedPartialRemovableTeeth, toothNumber]);
        }
      }
      return;
    }

    if (prosthesisMode) {
      if (selectedTeeth.includes(toothNumber)) {
        setSelectedTeeth(selectedTeeth.filter(t => t !== toothNumber));
      } else {
        setSelectedTeeth([...selectedTeeth, toothNumber]);
      }
      return;
    }

    // Modo corona: seleccionar dientes para marcar como corona (permitir múltiples)
    if (crownMode) {
      if (selectedCrowns.includes(toothNumber)) {
        setSelectedCrowns(selectedCrowns.filter(t => t !== toothNumber));
      } else {
        setSelectedCrowns([...selectedCrowns, toothNumber]);
      }
      return;
    }

    // Modo diastema: seleccionar dos dientes entre los que se colocará la X
    if (diastemaMode) {
      if (selectedDiastemaTeeth.includes(toothNumber)) {
        setSelectedDiastemaTeeth(selectedDiastemaTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedDiastemaTeeth.length < 2) {
          setSelectedDiastemaTeeth([...selectedDiastemaTeeth, toothNumber]);
        }
      }
      return;
    }

    // Modo supernumeraria: seleccionar dos dientes entre los que se colocará el círculo con 'S'
    if (supernumerariaMode) {
      if (selectedSuperTeeth.includes(toothNumber)) {
        setSelectedSuperTeeth(selectedSuperTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedSuperTeeth.length < 2) {
          setSelectedSuperTeeth([...selectedSuperTeeth, toothNumber]);
        }
      }
      return;
    }

    // Modo espigo (agregar al instante al hacer click)
    if (espigoMode) {
      if (selectedEspigoTooth === toothNumber) {
        setSelectedEspigoTooth(null);
        setEspigoMode(false);
      } else {
        const exists = espigos.some(e => e.tooth === toothNumber);
        if (!exists) {
          setEspigos(prev => [...prev, { id: `espigo-${Date.now()}`, tooth: toothNumber, color: espigoColor }]);
        }
        setSelectedEspigoTooth(null);
        setEspigoMode(false);
      }
      return;
    }

    // Modo fractura dental: agregar al instante al hacer click
    if (fracturaMode) {
      if (selectedFracturaTooth === toothNumber) {
        setSelectedFracturaTooth(null);
        setFracturaMode(false);
      } else {
        const exists = fracturas.some(f => f.tooth === toothNumber);
        if (!exists) {
          setFracturas(prev => [...prev, { id: `fractura-${Date.now()}`, tooth: toothNumber, color: 'red' }]);
        }
        setSelectedFracturaTooth(null);
        setFracturaMode(false);
      }
      return;
    }

    // Modo fusión: al seleccionar el segundo diente se crea automáticamente
    if (fusionMode) {
      const nextSelection = selectedFusionTeeth.includes(toothNumber)
        ? selectedFusionTeeth.filter(t => t !== toothNumber)
        : [...selectedFusionTeeth, toothNumber];

      if (nextSelection.length >= 2) {
        const ordered = [...nextSelection].sort((a, b) => a - b) as [number, number];
        const exists = fusiones.some(f => f.teeth[0] === ordered[0] && f.teeth[1] === ordered[1]);
        if (!exists) {
          setFusiones(prev => [...prev, { id: `fusion-${Date.now()}`, teeth: ordered, color: 'blue' }]);
        }
        setSelectedFusionTeeth([]);
        setFusionMode(false);
      } else {
        setSelectedFusionTeeth(nextSelection);
      }
      return;
    }

    // Modo geminación: agregar al instante al hacer click
    if (geminacionMode) {
      if (selectedGeminTooth === toothNumber) {
        setSelectedGeminTooth(null);
        setGeminacionMode(false);
      } else {
        const exists = geminaciones.some(g => g.tooth === toothNumber);
        if (!exists) {
          setGeminaciones(prev => [...prev, { id: `gem-${Date.now()}`, tooth: toothNumber, color: 'blue' }]);
        }
        setSelectedGeminTooth(null);
        setGeminacionMode(false);
      }
      return;
    }

    // Modo giroversión: agregar al instante al hacer click
    if (giroMode) {
      if (selectedGiroTooth === toothNumber) {
        setSelectedGiroTooth(null);
        setGiroMode(false);
      } else {
        const exists = giroversions.some(g => g.tooth === toothNumber);
        if (!exists) {
          setGiroversions(prev => [...prev, { id: `giro-${Date.now()}`, tooth: toothNumber, color: 'blue', direction: giroDirection }]);
        }
        setSelectedGiroTooth(null);
        setGiroMode(false);
      }
      return;
    }

    // Modo clavija: agregar al instante al hacer click
    if (clavijaMode) {
      if (selectedClavijaTooth === toothNumber) {
        setSelectedClavijaTooth(null);
        setClavijaMode(false);
      } else {
        const exists = clavijas.some(c => c.tooth === toothNumber);
        if (!exists) {
          setClavijas(prev => [...prev, { id: `clavija-${Date.now()}`, tooth: toothNumber, position: clavijaPosition, color: 'blue' }]);
        }
        setSelectedClavijaTooth(null);
        setClavijaMode(false);
      }
      return;
    }

    // Modo extrusión: agregar al instante al hacer click
    if (extruidaMode) {
      if (selectedExtruidaTooth === toothNumber) {
        setSelectedExtruidaTooth(null);
        setExtruidaMode(false);
      } else {
        const exists = extruidas.some(e => e.tooth === toothNumber);
        if (!exists) {
          setExtruidas(prev => [...prev, { id: `extr-${Date.now()}`, tooth: toothNumber, color: 'blue' }]);
        }
        setSelectedExtruidaTooth(null);
        setExtruidaMode(false);
      }
      return;
    }

    // Modo intrusión: agregar al instante al hacer click
    if (intrusionMode) {
      if (selectedIntrusionTooth === toothNumber) {
        setSelectedIntrusionTooth(null);
        setIntrusionMode(false);
      } else {
        const exists = intrusiones.some(i => i.tooth === toothNumber);
        if (!exists) {
          setIntrusiones(prev => [...prev, { id: `intr-${Date.now()}`, tooth: toothNumber, color: 'blue' }]);
        }
        setSelectedIntrusionTooth(null);
        setIntrusionMode(false);
      }
      return;
    }

    // Modo erupción: agregar al instante al hacer click
    if (erupcionMode) {
      if (selectedErupcionTooth === toothNumber) {
        setSelectedErupcionTooth(null);
        setErupcionMode(false);
      } else {
        const exists = erupciones.some(e => e.tooth === toothNumber);
        if (!exists) {
          setErupciones(prev => [...prev, { id: `erup-${Date.now()}`, tooth: toothNumber, color: 'blue' }]);
        }
        setSelectedErupcionTooth(null);
        setErupcionMode(false);
      }
      return;
    }

    // Modo edéntulo: seleccionar dos dientes entre los que se colocará la línea
    if (edentuloMode) {
      if (selectedEdentuloTeeth.includes(toothNumber)) {
        setSelectedEdentuloTeeth(selectedEdentuloTeeth.filter(t => t !== toothNumber));
      } else {
        if (selectedEdentuloTeeth.length < 2) {
          setSelectedEdentuloTeeth([...selectedEdentuloTeeth, toothNumber]);
        }
      }
      return;
    }

    // Modo pieza ausente: agregar al instante, eliminar solo con confirmación
    if (extractionMode) {
      const exists = Object.prototype.hasOwnProperty.call(teethStatus, extractionKey);
      if (exists) {
        showConfirm('¿Eliminar marca de extracción?', () => {
          setTeethStatus(prev => {
            const copy = { ...prev };
            delete copy[extractionKey];
            return copy;
          });
          persistExtraccion(toothNumber).catch(()=>{});
        });
      } else {
        setTeethStatus(prev => ({ ...prev, [extractionKey]: 'extraccion' }));
        persistExtraccion(toothNumber).catch(()=>{});
      }
      return;
    }

    // Modo pieza ausente: agregar al instante, eliminar solo con confirmación
    if (absentMode) {
      const exists = Object.prototype.hasOwnProperty.call(teethStatus, absentKey);
      if (exists) {
        showConfirm('¿Eliminar marca de pieza ausente?', () => {
          setTeethStatus(prev => {
            const copy = { ...prev };
            delete copy[absentKey];
            return copy;
          });
        });
      } else {
        setTeethStatus(prev => ({ ...prev, [absentKey]: 'ausente' }));
      }
      return;
    }

      if (selectedStatus === 'corona') {
      if (crowns.some(c => c.tooth === toothNumber)) {
        setCrowns(crowns.filter(c => c.tooth !== toothNumber));
      } else {
        setCrowns([...crowns, { tooth: toothNumber, type: 'corona', color: crownColor }]);
      }
      return;
    }

    const key = `${toothNumber}-${area}`;
    const existingStatus = teethStatus[key];
    
    if (existingStatus) {
      setModal({ isOpen: true, toothNumber, area, isEditing: true });
      setCodeInput(teethCodes[toothNumber]?.text || '');
      setCodeColor(teethCodes[toothNumber]?.color || 'blue');
      setSelectedCodeDesc(teethCodes[toothNumber]?.description || null);
      
      // Cargar configuración de color del área
      if (existingStatus === 'caries' || existingStatus === 'obturado') {
        const colorKey = `${key}-color`;
        const savedColor = teethStatus[colorKey];
        const applyColorKey = `${key}-apply-color`;
        const shouldApplyColor = teethStatus[applyColorKey] !== 'false';
        
        setApplyAreaColor(shouldApplyColor);
        setAreaColor(savedColor === 'red' ? 'red' : 'blue');
      } else {
        setApplyAreaColor(false);
        setAreaColor('blue');
      }
      return;
    }

    const needsCode = !teethCodes[toothNumber];
    
    if (needsCode) {
      setModal({ isOpen: true, toothNumber, area, isEditing: false });
      setCodeInput('');
      setCodeColor('blue');
      setApplyAreaColor(true);
      setAreaColor('blue');
    } else {
      setTeethStatus(prev => ({
        ...prev,
        [key]: selectedStatus,
        ...(selectedStatus === 'caries' || selectedStatus === 'obturado' 
          ? { 
              [`${key}-color`]: 'blue',
              [`${key}-apply-color`]: 'true'
            } 
          : {})
      }));
    }
  };

  const handleModalConfirm = (): void => {
    if (modal.toothNumber && modal.area) {
      const key = `${modal.toothNumber}-${modal.area}`;
      
      // Actualizar estado del diente
      setTeethStatus(prev => ({
        ...prev,
        [key]: selectedStatus,
        ...(selectedStatus === 'caries' || selectedStatus === 'obturado' 
          ? { 
              [`${key}-color`]: areaColor,
              [`${key}-apply-color`]: applyAreaColor.toString()
            } 
          : {})
      }));

      // Persistir área (estado superficial)
      persistArea(modal.toothNumber, modal.area, selectedStatus, (selectedStatus === 'caries' || selectedStatus === 'obturado') ? areaColor : undefined).catch(()=>{});
      
      // Actualizar código y color
      if (codeInput.trim()) {
        setTeethCodes(prev => ({
          ...prev,
          [modal.toothNumber!]: {
            text: codeInput.trim().toUpperCase(),
            color: codeColor,
            description: selectedCodeDesc || null
          }
        }));
        persistCodigo(modal.toothNumber, codeInput.trim().toUpperCase(), codeColor).catch(()=>{});
      } else if (modal.isEditing && teethCodes[modal.toothNumber]) {
        // Si estamos en edición y el input quedó vacío, eliminar el código del diente
        if (!codeInput.trim()) {
          setTeethCodes(prev => {
            const copy = { ...prev };
            delete copy[modal.toothNumber!];
            return copy;
          });
        } else {
          setTeethCodes(prev => ({
            ...prev,
            [modal.toothNumber!]: {
              ...prev[modal.toothNumber!],
              color: codeColor,
              description: selectedCodeDesc ?? prev[modal.toothNumber!].description ?? null
            }
          }));
          if (teethCodes[modal.toothNumber]) {
            persistCodigo(modal.toothNumber, teethCodes[modal.toothNumber].text.toUpperCase(), codeColor).catch(()=>{});
          }
        }
      } else if (!modal.isEditing && codeColor !== 'blue') {
        setTeethCodes(prev => ({
          ...prev,
          [modal.toothNumber!]: {
            text: '',
            color: codeColor,
            description: null
          }
        }));
        // Código vacío sólo guarda color asociado al diente (usa placeholder C0?) si se requiere más tarde
      }
    }
    
    setModal({ isOpen: false, toothNumber: null, area: null, isEditing: false });
    setCodeInput('');
    setSelectedCodeDesc(null);
    setCodeColor('blue');
    setApplyAreaColor(true);
    setAreaColor('blue');
    setSearchQuery('');
    setShowCodeSuggestions(false);
  };

  // Coronas: confirm/cancel/delete
  const confirmCrown = (): void => {
    if (selectedCrowns.length > 0) {
      setCrowns(prev => {
        const copy = [...prev];
        selectedCrowns.forEach(t => {
          const existing = copy.find(c => c.tooth === t);
          if (existing) {
            existing.color = crownColor;
          } else {
            copy.push({ tooth: t, type: 'corona', color: crownColor });
          }
          // Persistir cada corona
          persistCorona(t, 'corona', crownColor).catch(console.error);
        });
        return copy;
      });
      setSelectedCrowns([]);
      setCrownMode(false);
    }
  };

  const cancelCrown = (): void => {
    setSelectedCrowns([]);
    setCrownMode(false);
  };

  const deleteCrown = (tooth: number): void => {
    setCrowns(prev => prev.filter(c => c.tooth !== tooth));
  };

  const handleModalDelete = (): void => {
    if (modal.toothNumber && modal.area) {
      const key = `${modal.toothNumber}-${modal.area}`;
      setTeethStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[key];
        delete newStatus[`${key}-color`];
        delete newStatus[`${key}-apply-color`];
        return newStatus;
      });
      // También eliminar cualquier código asociado a ese diente
      setTeethCodes(prev => {
        const copy = { ...prev };
        delete copy[modal.toothNumber!];
        return copy;
      });
    }
    
    setModal({ isOpen: false, toothNumber: null, area: null, isEditing: false });
    setCodeInput('');
    setSelectedCodeDesc(null);
    setCodeColor('blue');
    setApplyAreaColor(true);
    setAreaColor('blue');
    setSearchQuery('');
    setShowCodeSuggestions(false);
  };

  const handleModalCancel = (): void => {
    setModal({ isOpen: false, toothNumber: null, area: null, isEditing: false });
    setCodeInput('');
    setSelectedCodeDesc(null);
    setCodeColor('blue');
    setApplyAreaColor(true);
    setAreaColor('blue');
    setSearchQuery('');
    setShowCodeSuggestions(false);
  };

  const handleCodeSelect = (code: string, description?: string): void => {
    setCodeInput(code);
    if (description) setSelectedCodeDesc(description);
    setSearchQuery('');
    setShowCodeSuggestions(false);
  };

  const filteredCodes = catalogCodes;

  const confirmProsthesis = (): void => {
    if (prosthesisMode && selectedTeeth.length >= 2) {
      const findRow = (tooth: number): number | null => {
        if (cuadrante1.includes(tooth)) return 1;
        if (cuadrante2.includes(tooth)) return 2;
        if (cuadrante3.includes(tooth)) return 3;
        if (cuadrante4.includes(tooth)) return 4;
        if (cuadrante5.includes(tooth)) return 5;
        if (cuadrante6.includes(tooth)) return 6;
        if (cuadrante7.includes(tooth)) return 7;
        if (cuadrante8.includes(tooth)) return 8;
        return null;
      };

      const selectedRows = new Set<number>();
      for (const tooth of selectedTeeth) {
        const row = findRow(tooth);
        if (row === null) {
          showInfoModal('Error: uno de los dientes seleccionados no pertenece a una fila válida', 'Selección inválida');
          return;
        }
        selectedRows.add(row);
      }

      if (selectedRows.size > 1) {
        showInfoModal('Selecciona dientes de una sola fila para crear una prótesis dental parcial fija (misma arcada).', 'Selección inválida');
        return;
      }

      const sortedTeeth = [...selectedTeeth].sort((a, b) => a - b);
      const isUpper = sortedTeeth[0] < 40;
      
      const newProsthesis: Prosthesis = {
        id: `prosthesis-${Date.now()}`,
        type: prosthesisMode,
        teeth: sortedTeeth,
        position: isUpper ? 'superior' : 'inferior'
        , color: prosthesisColor
      };
      
      setProstheses([...prostheses, newProsthesis]);
      setSelectedTeeth([]);
      setProsthesisMode(null);
    }
  };

  const cancelProsthesis = (): void => {
    setSelectedTeeth([]);
    setProsthesisMode(null);
  };

  const confirmAppliance = (): void => {
    if (selectedApplianceTeeth.length === 2) {
      const sorted = [...selectedApplianceTeeth].sort((a, b) => a - b) as [number, number];

      // Verificar que ambos dientes estén en la misma fila/cuadrante para el render actual
      const findRow = (tooth: number): number | null => {
        if (cuadrante1.includes(tooth)) return 1;
        if (cuadrante2.includes(tooth)) return 2;
        if (cuadrante3.includes(tooth)) return 3;
        if (cuadrante4.includes(tooth)) return 4;
        if (cuadrante5.includes(tooth)) return 5;
        if (cuadrante6.includes(tooth)) return 6;
        if (cuadrante7.includes(tooth)) return 7;
        if (cuadrante8.includes(tooth)) return 8;
        return null;
      };

      const row1 = findRow(sorted[0]);
      const row2 = findRow(sorted[1]);

      if (row1 === null || row2 === null) {
        showInfoModal('Error: uno de los dientes seleccionados no pertenece a una fila válida', 'Selección inválida');
        return;
      }

      if (row1 !== row2) {
        // En la implementación actual solo renderizamos aparatos cuando ambos extremos están en la misma fila.
        // Evitamos crear el aparato y avisamos al usuario. Para soportar unión entre filas se necesita
        // renderizar en una capa global (ver sugerencias en comentarios).
        showInfoModal('Selecciona dos dientes que estén en la misma fila para crear un aparato fijo (misma arcada).', 'Selección inválida');
        return;
      }

      // Ordenar los dientes según su posición en la fila (índice dentro del arreglo de la fila)
      const getRowArray = (rowNum: number) => {
        switch (rowNum) {
          case 1: return cuadrante1;
          case 2: return cuadrante2;
          case 3: return cuadrante3;
          case 4: return cuadrante4;
          case 5: return cuadrante5;
          case 6: return cuadrante6;
          case 7: return cuadrante7;
          case 8: return cuadrante8;
          default: return cuadrante1;
        }
      };

      const rowArray = getRowArray(row1!);
      const orderedByPosition = [...sorted].sort((a, b) => rowArray.indexOf(a) - rowArray.indexOf(b)) as [number, number];

      const newApp: Appliance = {
        id: `appliance-${Date.now()}`,
        teeth: orderedByPosition,
        color: applianceColor,
      };
      setAppliances(prev => [...prev, newApp]);
      setSelectedApplianceTeeth([]);
      setApplianceMode(false);
    }
  };

  const cancelAppliance = (): void => {
    setSelectedApplianceTeeth([]);
    setApplianceMode(false);
  };

  const deleteAppliance = (id: string): void => {
    setAppliances(prev => prev.filter(a => a.id !== id));
  };

  // Diastema handlers
  const confirmDiastema = (): void => {
    if (selectedDiastemaTeeth.length === 2) {
      const ordered = [...selectedDiastemaTeeth].sort((a, b) => a - b) as [number, number];
      const newD: Diastema = {
        id: `diastema-${Date.now()}`,
        teeth: ordered,
        color: 'blue',
      };
      setDiastemas(prev => [...prev, newD]);
      setSelectedDiastemaTeeth([]);
      setDiastemaMode(false);
      // Persist
      persistDiastema(ordered[0], ordered[1]).catch(()=>{});
    }
  };

  const cancelDiastema = (): void => {
    setSelectedDiastemaTeeth([]);
    setDiastemaMode(false);
  };

  const deleteDiastema = (id: string): void => {
    setDiastemas(prev => prev.filter(d => d.id !== id));
  };

  // Supernumeraria handlers
  const confirmSupernumeraria = (): void => {
    if (selectedSuperTeeth.length === 2) {
      const ordered = [...selectedSuperTeeth].sort((a, b) => a - b) as [number, number];
      const newS: Supernumeraria = {
        id: `super-${Date.now()}`,
        teeth: ordered,
        color: 'blue',
      };
      setSupernumerarias(prev => [...prev, newS]);
      setSelectedSuperTeeth([]);
      setSupernumerariaMode(false);
    }
  };

  const cancelSupernumeraria = (): void => {
    setSelectedSuperTeeth([]);
    setSupernumerariaMode(false);
  };

  const deleteSupernumeraria = (id: string): void => {
    setSupernumerarias(prev => prev.filter(s => s.id !== id));
  };

  // Edéntulo handlers
  const confirmEdentulo = (): void => {
    if (selectedEdentuloTeeth.length === 2) {
      const ordered = [...selectedEdentuloTeeth].sort((a, b) => a - b) as [number, number];
      const newE: Edentulo = {
        id: `edentulo-${Date.now()}`,
        teeth: ordered,
        color: 'blue',
      };
      setEdentulos(prev => [...prev, newE]);
      setSelectedEdentuloTeeth([]);
      setEdentuloMode(false);
    }
  };

  const cancelEdentulo = (): void => {
    setSelectedEdentuloTeeth([]);
    setEdentuloMode(false);
  };

  // Full prosthesis handlers
  const confirmFullProsthesis = async (arch: 'superior' | 'inferior') => {
    const exists = fullProstheses.some(p => p.arch === arch);
    if (exists) return; // avoid duplicates
    const newP: FullProsthesis = { id: `full-${arch}-${Date.now()}`, arch, color: fullProsthesisColor };
    setFullProstheses(prev => [...prev, newP]);
    setFullProsthesisMode(null);
    // Persistir prótesis completa
    if (versionId) {
      try {
        await apiPost(`${API_BASE}/version/${versionId}/protesisV`, {
          tipoCodigo: arch === 'superior' ? 'protesis_completa_superior' : 'protesis_completa_inferior',
          color: fullProsthesisColor,
          usuario: 'ui'
        });
      } catch (e) {
        console.error('Error persistiendo prótesis completa:', e);
      }
    }
  };

  const cancelFullProsthesis = () => {
    setFullProsthesisMode(null);
  };

  const deleteFullProsthesis = (id: string) => {
    setFullProstheses(prev => prev.filter(p => p.id !== id));
  };

  // Partial removable prosthesis handlers (select start/end teeth)
  const confirmPartialRemovable = async (): Promise<void> => {
    if (selectedPartialRemovableTeeth.length === 2) {
      const ordered = [...selectedPartialRemovableTeeth].sort((a, b) => a - b) as [number, number];
      const newP: PartialRemovableProsthesis = { id: `partial-${ordered[0]}-${ordered[1]}-${Date.now()}`, teeth: ordered, color: partialRemovableColor };
      setPartialRemovables(prev => [...prev, newP]);
      setSelectedPartialRemovableTeeth([]);
      setPartialRemovableMode(false);
      // Persistir prótesis parcial removible
      if (versionId) {
        try {
          await apiPost(`${API_BASE}/version/${versionId}/protesisV`, {
            tipoCodigo: 'protesis_parcial_removible',
            color: partialRemovableColor,
            usuario: 'ui'
          });
        } catch (e) {
          console.error('Error persistiendo prótesis parcial:', e);
        }
      }
    }
  };

  const cancelPartialRemovable = (): void => {
    setSelectedPartialRemovableTeeth([]);
    setPartialRemovableMode(false);
  };

  const deletePartialRemovable = (id: string): void => {
    setPartialRemovables(prev => prev.filter(p => p.id !== id));
  };

  const deleteEdentulo = (id: string): void => {
    setEdentulos(prev => prev.filter(e => e.id !== id));
  };

  // Espigo handlers
  const confirmEspigo = (): void => {
    if (selectedEspigoTooth != null) {
      const newE: Espigo = {
        id: `espigo-${Date.now()}`,
        tooth: selectedEspigoTooth,
        color: espigoColor,
      };
      setEspigos(prev => [...prev, newE]);
      setSelectedEspigoTooth(null);
      setEspigoMode(false);
    }
  };

  const cancelEspigo = (): void => {
    setSelectedEspigoTooth(null);
    setEspigoMode(false);
  };

  const deleteEspigo = (tooth: number): void => {
    setEspigos(prev => prev.filter(e => e.tooth !== tooth));
  };

  // Fractura handlers
  const confirmFractura = (): void => {
    if (selectedFracturaTooth != null) {
      const newF: Fractura = {
        id: `fractura-${Date.now()}`,
        tooth: selectedFracturaTooth,
        color: 'red',
      };
      setFracturas(prev => [...prev, newF]);
      setSelectedFracturaTooth(null);
      setFracturaMode(false);
    }
  };

  const cancelFractura = (): void => {
    setSelectedFracturaTooth(null);
    setFracturaMode(false);
  };

  const deleteFractura = (tooth: number): void => {
    setFracturas(prev => prev.filter(f => f.tooth !== tooth));
  };

  // Fusión handlers
  const confirmFusion = (): void => {
    if (selectedFusionTeeth.length === 2) {
      const ordered = [...selectedFusionTeeth].sort((a,b) => a - b) as [number, number];
      const newF: Fusion = { id: `fusion-${Date.now()}`, teeth: ordered, color: 'blue' };
      setFusiones(prev => [...prev, newF]);
      setSelectedFusionTeeth([]);
      setFusionMode(false);
    }
  };

  const cancelFusion = (): void => {
    setSelectedFusionTeeth([]);
    setFusionMode(false);
  };

  const deleteFusion = (id: string): void => {
    setFusiones(prev => prev.filter(f => f.id !== id));
  };

  // Geminación handlers
  const confirmGeminacion = (): void => {
    if (selectedGeminTooth != null) {
      const newG: Geminacion = { id: `gem-${Date.now()}`, tooth: selectedGeminTooth, color: 'blue' };
      setGeminaciones(prev => [...prev, newG]);
      setSelectedGeminTooth(null);
      setGeminacionMode(false);
    }
  };

  const cancelGeminacion = (): void => {
    setSelectedGeminTooth(null);
    setGeminacionMode(false);
  };

  const deleteGeminacion = (tooth: number): void => {
    setGeminaciones(prev => prev.filter(g => g.tooth !== tooth));
  };

  // Giroversión handlers
  const confirmGiroversion = (): void => {
    if (selectedGiroTooth != null) {
      const newG: Giroversion = { id: `giro-${Date.now()}`, tooth: selectedGiroTooth, color: 'blue', direction: giroDirection };
      setGiroversions(prev => [...prev, newG]);
      setSelectedGiroTooth(null);
      setGiroMode(false);
    }
  };

  const cancelGiroversion = (): void => {
    setSelectedGiroTooth(null);
    setGiroMode(false);
  };

  const deleteGiroversion = (tooth: number): void => {
    setGiroversions(prev => prev.filter(g => g.tooth !== tooth));
  };

  // Clavija handlers
  const confirmClavija = (): void => {
    if (selectedClavijaTooth != null) {
      const newC: Clavija = { id: `clavija-${Date.now()}`, tooth: selectedClavijaTooth, position: clavijaPosition, color: 'blue' };
      setClavijas(prev => [...prev, newC]);
      setSelectedClavijaTooth(null);
      setClavijaMode(false);
    }
  };

  const cancelClavija = (): void => {
    setSelectedClavijaTooth(null);
    setClavijaMode(false);
  };

  const deleteClavija = (tooth: number): void => {
    setClavijas(prev => prev.filter(c => c.tooth !== tooth));
  };

  // Erupción handlers (Pieza en erupción: flecha zigzag apuntando hacia oclusal)
  const confirmErupcion = (): void => {
    if (selectedErupcionTooth != null) {
      const newE: Erupcion = { id: `erup-${Date.now()}`, tooth: selectedErupcionTooth, color: 'blue' };
      setErupciones(prev => [...prev, newE]);
      setSelectedErupcionTooth(null);
      setErupcionMode(false);
    }
  };

  // Transposición handlers
  const confirmTransposition = (): void => {
    if (selectedTranspositionTeeth.length === 2) {
      const ordered = [...selectedTranspositionTeeth].sort((a,b)=>a-b) as [number, number];
      const newT: Transposition = { id: `trans-${ordered[0]}-${ordered[1]}-${Date.now()}`, teeth: ordered, color: 'blue' };
      setTranspositions(prev => [...prev, newT]);
      setSelectedTranspositionTeeth([]);
      setTranspositionMode(false);
      persistTransposicion(ordered[0], ordered[1]).catch(()=>{});
    }
  };

  const cancelTransposition = (): void => {
    setSelectedTranspositionTeeth([]);
    setTranspositionMode(false);
  };

  const deleteTransposition = (id: string): void => {
    setTranspositions(prev => prev.filter(t => t.id !== id));
  };

  // Temp restoration handlers
  const confirmTempRestoration = (): void => {
    const entries = Object.entries(selectedTempAreas);
    if (entries.length === 0) return;
    const toAdd: TempRestoration[] = [];
    entries.forEach(([toothStr, areas]) => {
      const tooth = parseInt(toothStr, 10);
      if (!areas || areas.length === 0) return;
      toAdd.push({ id: `temp-${tooth}-${Date.now()}`, tooth, areas: [...areas], color: 'red' });
    });
    if (toAdd.length > 0) setTempRestorations(prev => [...prev, ...toAdd]);
    setSelectedTempAreas({});
    setRestorationTempMode(false);
  };

  const cancelTempRestoration = (): void => {
    setSelectedTempAreas({});
    setRestorationTempMode(false);
  };

  const deleteTempRestoration = (id: string): void => {
    setTempRestorations(prev => prev.filter(r => r.id !== id));
  };

  // Confirmar borrado de las áreas seleccionadas (selectedTempToDelete)
  const confirmDeleteTempRestoration = (): void => {
    const entries = Object.entries(selectedTempToDelete);
    if (entries.length === 0) return;
    setTempRestorations(prev => {
      const copy = [...prev];
      entries.forEach(([toothStr, areas]) => {
        const tooth = parseInt(toothStr, 10);
        areas.forEach(area => {
          for (let i = copy.length - 1; i >= 0; i--) {
            const r = copy[i];
            if (r.tooth === tooth) {
              // eliminar el área de este objeto
              r.areas = r.areas.filter(a => a !== area);
              if (r.areas.length === 0) {
                copy.splice(i, 1);
              }
            }
          }
        });
      });
      return copy;
    });
    setSelectedTempToDelete({});
  };

  const cancelDeleteTempRestoration = (): void => {
    setSelectedTempToDelete({});
  };

  const cancelErupcion = (): void => {
    setSelectedErupcionTooth(null);
    setErupcionMode(false);
  };

  const deleteErupcion = (tooth: number): void => {
    setErupciones(prev => prev.filter(e => e.tooth !== tooth));
  };

  // Extruida handlers (flecha vertical fuera del diente, dirigida hacia incisal/oclusal)
  const confirmExtruida = (): void => {
    if (selectedExtruidaTooth != null) {
      const newE: Extruida = { id: `extr-${Date.now()}`, tooth: selectedExtruidaTooth, color: 'blue' };
      setExtruidas(prev => [...prev, newE]);
      setSelectedExtruidaTooth(null);
      setExtruidaMode(false);
    }
  };

  const cancelExtruida = (): void => {
    setSelectedExtruidaTooth(null);
    setExtruidaMode(false);
  };

  const deleteExtruida = (tooth: number): void => {
    setExtruidas(prev => prev.filter(e => e.tooth !== tooth));
  };

  // Intrusión handlers (flecha vertical fuera del diente dirigida hacia incisal/oclusal)
  const confirmIntrusion = (): void => {
    if (selectedIntrusionTooth != null) {
      const newI: Intrusion = { id: `intr-${Date.now()}`, tooth: selectedIntrusionTooth, color: 'blue' };
      setIntrusiones(prev => [...prev, newI]);
      setSelectedIntrusionTooth(null);
      setIntrusionMode(false);
    }
  };

  const cancelIntrusion = (): void => {
    setSelectedIntrusionTooth(null);
    setIntrusionMode(false);
  };

  const deleteIntrusion = (tooth: number): void => {
    setIntrusiones(prev => prev.filter(i => i.tooth !== tooth));
  };

  const confirmRemovable = (): void => {
    if (selectedRemovableTeeth.length === 2) {
      const sorted = [...selectedRemovableTeeth].sort((a, b) => a - b) as [number, number];

      const findRow = (tooth: number): number | null => {
        if (cuadrante1.includes(tooth)) return 1;
        if (cuadrante2.includes(tooth)) return 2;
        if (cuadrante3.includes(tooth)) return 3;
        if (cuadrante4.includes(tooth)) return 4;
        if (cuadrante5.includes(tooth)) return 5;
        if (cuadrante6.includes(tooth)) return 6;
        if (cuadrante7.includes(tooth)) return 7;
        if (cuadrante8.includes(tooth)) return 8;
        return null;
      };

      const row1 = findRow(sorted[0]);
      const row2 = findRow(sorted[1]);
      if (row1 === null || row2 === null) {
        showInfoModal('Error: uno de los dientes seleccionados no pertenece a una fila válida', 'Selección inválida');
        return;
      }
      if (row1 !== row2) {
        showInfoModal('Selecciona dos dientes que estén en la misma fila para crear un aparato removible.', 'Selección inválida');
        return;
      }

      const getRowArray = (rowNum: number) => {
        switch (rowNum) {
          case 1: return cuadrante1;
          case 2: return cuadrante2;
          case 3: return cuadrante3;
          case 4: return cuadrante4;
          case 5: return cuadrante5;
          case 6: return cuadrante6;
          case 7: return cuadrante7;
          case 8: return cuadrante8;
          default: return cuadrante1;
        }
      };

      const rowArray = getRowArray(row1!);
      const orderedByPosition = [...sorted].sort((a, b) => rowArray.indexOf(a) - rowArray.indexOf(b)) as [number, number];

      const newRem: RemovableAppliance = {
        id: `rem-${Date.now()}`,
        teeth: orderedByPosition,
        color: removableColor,
      };
      setRemovableAppliances(prev => [...prev, newRem]);
      setSelectedRemovableTeeth([]);
      setRemovableMode(false);
      // Persistir aparato removible
      persistAparatoRemovible('retenedor', row1 <= 4 ? 'superior' : 'inferior', orderedByPosition[0], orderedByPosition[1], removableColor).catch(console.error);
    }
  };

  const cancelRemovable = (): void => {
    setSelectedRemovableTeeth([]);
    setRemovableMode(false);
  };

  const deleteRemovable = (id: string): void => {
    setRemovableAppliances(prev => prev.filter(r => r.id !== id));
  };

  const countExistingTeeth = (): number => {
    const allTeeth = [...cuadrante1, ...cuadrante2, ...cuadrante3, ...cuadrante4];
    let absentCount = 0;
    
    allTeeth.forEach(tooth => {
      const isMissing = Object.keys(teethStatus).some(key => 
        key.startsWith(`${tooth}-`) && (teethStatus[key] === 'ausente' || teethStatus[key] === 'extraccion')
      );
      if (isMissing) absentCount++;
    });
    
    return 32 - absentCount;
  };

  const clearAll = (): void => {
    // Estados por diente y áreas/códigos
    setTeethStatus({});
    setTeethCodes({});
    // Observaciones
    setObservaciones('');
    // Prótesis y coronas base
    setProstheses([]);
    setCrowns([]);
    setSelectedTeeth([]);
    setProsthesisMode(null);
    setCrownMode(false);
    setSelectedCrowns([]);
    // Aparatos fijos y removibles
    setAppliances([]);
    setApplianceMode(false);
    setSelectedApplianceTeeth([]);
    setRemovableAppliances([]);
    setRemovableMode(false);
    setSelectedRemovableTeeth([]);
    // Prótesis completas y parciales
    setFullProstheses([]);
    setFullProsthesisMode(null);
    setPartialRemovables([]);
    setPartialRemovableMode(false);
    setSelectedPartialRemovableTeeth([]);
    // Restauraciones temporales
    setTempRestorations([]);
    setSelectedTempAreas({});
    setSelectedTempToDelete({});
    setRestorationTempMode(false);
    // Diastemas / Supernumerarias / Edéntulos / Transposiciones
    setDiastemas([]);
    setSelectedDiastemaTeeth([]);
    setSupernumerarias([]);
    setSelectedSuperTeeth([]);
    setEdentulos([]);
    setSelectedEdentuloTeeth([]);
    setTranspositions([]);
    setSelectedTranspositionTeeth([]);
    setTranspositionMode(false);
    // Espigos / Fracturas / Fusiones / Geminaciones / Giroversiones / Clavijas
    setEspigos([]);
    setEspigoMode(false);
    setSelectedEspigoTooth(null);
    setFracturas([]);
    setFracturaMode(false);
    setSelectedFracturaTooth(null);
    setFusiones([]);
    setFusionMode(false);
    setSelectedFusionTeeth([]);
    setGeminaciones([]);
    setGeminacionMode(false);
    setSelectedGeminTooth(null);
    setGiroversions([]);
    setGiroMode(false);
    setSelectedGiroTooth(null);
    setClavijas([]);
    setClavijaMode(false);
    setSelectedClavijaTooth(null);
    // Erupciones / Extruídas / Intrusiones
    setErupciones([]);
    setErupcionMode(false);
    setSelectedErupcionTooth(null);
    setExtruidas([]);
    setExtruidaMode(false);
    setSelectedExtruidaTooth(null);
    setIntrusiones([]);
    setIntrusionMode(false);
    setSelectedIntrusionTooth(null);
    // Raíces (triángulos): limpiar todas las selecciones
    setRootTriangles(prev => {
      const next: Record<number, boolean[]> = {};
      Object.keys(prev).forEach(k => {
        const tooth = parseInt(k, 10);
        next[tooth] = [false, false, false];
      });
      // Asegurar también los dientes predefinidos
      ROOT_TRIANGLE_TEETH.forEach(t => { next[t] = [false, false, false]; });
      return next;
    });
    setSingleRootTriangles(prev => {
      const next: Record<number, boolean> = {};
      Object.keys(prev).forEach(k => {
        const tooth = parseInt(k, 10);
        next[tooth] = false;
      });
      SINGLE_ROOT_TRIANGLE_TEETH.forEach(t => { next[t] = false; });
      return next;
    });
    setDoubleRootTriangles(prev => {
      const next: Record<number, boolean[]> = {};
      Object.keys(prev).forEach(k => {
        const tooth = parseInt(k, 10);
        next[tooth] = [false, false];
      });
      DOUBLE_ROOT_TRIANGLE_TEETH.forEach(t => { next[t] = [false, false]; });
      return next;
    });
    // Ausentes / Extracción modes
    setAbsentMode(false);
    setExtractionMode(false);
    // Código / Modal
    setCodeInput('');
    setSelectedCodeDesc(null);
    setSearchQuery('');
    setShowCodeSuggestions(false);
    setModal({ isOpen: false, toothNumber: null, area: null, isEditing: false });
    // Posiciones overlay (recalcularán vacías)
    setDiastemaPositions({});
    setEdentuloPositions({});
    setSupernumerariaPositions({});
  };

  const styles: { [key: string]: CSSProperties } = {
    mainLayout: {
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
    },
    sidebar: {
      // Más compacta para ahorrar espacio vertical y horizontal
      width: '320px',
      backgroundColor: 'white',
      padding: '12px',
      borderRight: '1px solid #e5e7eb',
      boxShadow: '3px 0 10px rgba(15, 23, 42, 0.05)',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(148, 163, 184, 0.45) transparent',
      position: 'fixed',
      height: '100vh',
      left: 0,
      top: 0,
      zIndex: 200, // mantener la barra lateral por encima de overlays del contenido
    },
    mainContent: {
      flex: 1,
      // dejar un pequeño margen extra respecto a la side bar
      marginLeft: '340px',
      padding: '20px',
    },
    exportHeader: {
      width: '100%',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '14px',
      textAlign: 'center',
    },
    exportHospitalTitle: {
      fontSize: '28px',
      fontWeight: 800,
      lineHeight: 1.2,
      color: '#111827',
      letterSpacing: '0.2px',
      marginBottom: '8px',
    },
    exportMeta: {
      fontSize: '14px',
      color: '#374151',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      flexWrap: 'wrap',
    },
    container: {
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      position: 'relative', // necesario para la capa overlay
    },
    title: {
      fontSize: '20px',
      fontWeight: 700,
      textAlign: 'center',
      marginBottom: '18px',
      color: '#1f2937',
    },
    sidebarTitle: {
      fontSize: '16px',
      fontWeight: 800,
      marginBottom: '10px',
      color: '#0f172a',
      textAlign: 'center',
      letterSpacing: '0.2px',
    },
    sidebarSection: {
      marginBottom: '14px',
      padding: '12px',
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    },
    sidebarSectionTitle: {
      fontSize: '11px',
      fontWeight: '700',
      marginBottom: '10px',
      color: '#334155',
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      paddingBottom: '6px',
      borderBottom: '1px solid #e5e7eb',
    },
    counterContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '10px',
      marginBottom: '14px',
      padding: '0',
      backgroundColor: 'transparent',
      borderRadius: '8px',
    },
    counterBox: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '10px 8px',
      backgroundColor: 'white',
      borderRadius: '8px',
      flex: 1,
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    },
    counterNumber: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#1f2937',
      lineHeight: '22px',
    },
    counterLabel: {
      fontSize: '11px',
      color: '#6b7280',
      marginTop: '2px',
    },
    legendContainer: {
      marginBottom: '24px',
      padding: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    legendTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '10px',
      color: '#374151',
    },
    legendButtons: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginBottom: '12px',
    },
    statusButton: {
      padding: '9px 11px',
      borderRadius: '8px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.18s',
      fontSize: '12px',
      textAlign: 'left',
    },
    statusButtonInactive: {
      backgroundColor: '#e5e7eb',
      color: '#374151',
    },
    sidebarQuickActions: {
      position: 'sticky',
      top: '8px',
      zIndex: 30,
      marginBottom: '14px',
      padding: '10px',
      backgroundColor: '#ffffff',
      border: '1px solid #dbe3ee',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
    },
    sidebarQuickActionsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
    },
    favoriteToolsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
    },
    toolButtonRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      width: '100%',
    },
    toolButtonGrow: {
      flex: 1,
    },
    favoriteSectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      marginBottom: '10px',
    },
    favoriteEditButton: {
      borderRadius: '999px',
      border: '1px solid #cbd5e1',
      backgroundColor: 'white',
      color: '#334155',
      fontSize: '11px',
      fontWeight: 700,
      padding: '4px 10px',
      cursor: 'pointer',
    },
    favoriteStarButton: {
      width: '22px',
      minWidth: '22px',
      height: '22px',
      border: '1px solid #cbd5e1',
      borderRadius: '999px',
      background: 'white',
      padding: 0,
      cursor: 'pointer',
      fontSize: '12px',
      lineHeight: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    // Volver a una sola columna para los botones (lista vertical full-width)
    prosthesisButtons: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '6px',
      marginTop: '6px',
      width: '100%',
    },
    prosthesisButton: {
      padding: '9px 12px',
      borderRadius: '8px',
      fontWeight: '600',
      border: '1px solid',
      cursor: 'pointer',
      transition: 'all 0.14s',
      fontSize: '12px',
      textAlign: 'left',
      width: '100%',
      boxSizing: 'border-box',
    },
    controlsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '6px',
      alignItems: 'start',
    },
    legendSymbolsContainer: {
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: '1px solid #e5e7eb',
    },
    legendSymbolsTitle: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '8px',
      color: '#374151',
    },
    legendSymbolsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '6px',
    },
    legendSymbol: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 10px',
      backgroundColor: '#f9fafb',
      borderRadius: '6px',
      fontSize: '12px',
    },
    legendIcon: {
      width: '24px',
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    odontogramaSection: {
      marginBottom: '16px',
      padding: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '14px',
      textAlign: 'center',
      color: '#374151',
    },
    codeBoxesContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '8px',
      marginBottom: '8px',
    },
    codeBox: {
      width: '64px',
      height: '34px',
      border: '2px solid #1f2937',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: '700',
      backgroundColor: 'white',
    },
    quadrantContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '32px',
      marginBottom: '8px',
    },
    separator: {
      width: '2px',
      backgroundColor: '#1f2937',
    },
    horizontalLine: {
      height: '3px',
      backgroundColor: '#1f2937',
      marginBottom: '12px',
      marginTop: '12px',
    },
    toothContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
    },
    toothWrapper: {
      position: 'relative',
      width: '64px',
      height: '64px',
    },
    toothSquare: {
      position: 'absolute',
      inset: '0',
      border: '2px solid #1f2937',
    },
    centerSquare: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '20px',
      height: '20px',
      border: '1px solid #374151',
      cursor: 'pointer',
      transition: 'opacity 0.2s',
      zIndex: 10,
    },
    areaButton: {
      position: 'absolute',
      border: 'none',
      cursor: 'pointer',
      transition: 'opacity 0.2s',
      padding: 0,
    },
    toothNumber: {
      fontSize: '12px',
      marginTop: '4px',
      fontWeight: '700',
      color: '#1f2937',
    },
    rowContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '8px',
      position: 'relative',
    },
    rowLabel: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '8px',
      color: '#374151',
    },
    teethRow: {
      display: 'flex',
      gap: '8px',
      position: 'relative',
    },
    actionButtons: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    actionButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      borderRadius: '6px',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
      transition: 'background-color 0.16s',
      color: 'white',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    },
    clearButton: {
      backgroundColor: '#ef4444',
    },
    saveButton: {
      backgroundColor: '#22c55e',
    },
    summaryContainer: {
      marginTop: '24px',
      padding: '18px',
      backgroundColor: 'white',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
    },
    summaryTitle: {
      fontSize: '17px',
      fontWeight: '700',
      marginBottom: '12px',
      color: '#1f2937',
    },
    summaryContent: {
      fontSize: '14px',
      color: '#4b5563',
    },
    summaryStatsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: '10px',
      marginBottom: '14px',
    },
    summaryStatCard: {
      padding: '10px',
      background: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      textAlign: 'center',
    },
    summaryStatValue: {
      fontSize: '18px',
      fontWeight: 800,
      color: '#0f172a',
      lineHeight: 1.1,
    },
    summaryStatLabel: {
      fontSize: '11px',
      color: '#64748b',
      marginTop: '4px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    },
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '8px',
    },
    summaryItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    summaryColorBox: {
      width: '12px',
      height: '12px',
      borderRadius: '2px',
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
      maxWidth: '500px',
      width: '90%',
      border: '1px solid #e5e7eb',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
    modalHeader: {
      marginBottom: '20px',
      textAlign: 'center',
      backgroundColor: 'white',
    },
    modalTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '8px',
      backgroundColor: 'white',
    },
    modalSubtitle: {
      fontSize: '12px',
      color: '#6b7280',
      fontWeight: '500',
      backgroundColor: 'white',
    },
    modalBody: {
      marginBottom: '20px',
      backgroundColor: 'white',
    },
    modalSection: {
      marginBottom: '16px',
      backgroundColor: 'white',
    },
    modalLabel: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '8px',
      color: '#374151',
      display: 'block',
    },
    modalInput: {
      width: '100%',
      padding: '12px 16px',
      border: '2px solid #e5e7eb',
      borderRadius: '12px',
      fontSize: '24px',
      fontWeight: '700',
      textAlign: 'center',
      outline: 'none',
      transition: 'all 0.2s',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      backgroundColor: 'white',
      color: '#1f2937',
      boxSizing: 'border-box',
    },
    searchInput: {
      width: '100%',
      padding: '12px 16px',
      border: '2px solid #e5e7eb',
      borderRadius: '12px',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s',
      backgroundColor: 'white',
      color: '#1f2937',
      boxSizing: 'border-box',
    },
    suggestionsContainer: {
      position: 'relative',
      backgroundColor: 'white',
    },
    suggestionsList: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      maxHeight: '200px',
      overflowY: 'auto',
      backgroundColor: 'white',
      border: '2px solid #e5e7eb',
      borderTop: 'none',
      borderRadius: '0 0 12px 12px',
      zIndex: 1000,
      marginTop: '-10px',
    },
    suggestionItem: {
      padding: '10px 16px',
      cursor: 'pointer',
      borderBottom: '1px solid #f3f4f6',
      transition: 'background-color 0.2s',
    },
    suggestionCode: {
      fontWeight: '700',
      color: '#1f2937',
      fontSize: '13px',
    },
    suggestionDescription: {
      fontSize: '11px',
      color: '#6b7280',
      marginTop: '2px',
    },
    suggestionCategory: {
      fontSize: '10px',
      color: '#9ca3af',
      marginTop: '2px',
      fontStyle: 'italic',
    },
    modalSelect: {
      width: '100%',
      padding: '12px 16px',
      border: '2px solid #e5e7eb',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      outline: 'none',
      transition: 'all 0.2s',
      backgroundColor: 'white',
      color: '#1f2937',
      boxSizing: 'border-box',
    },
    colorOptions: {
      display: 'flex',
      gap: '8px',
      backgroundColor: 'white',
    },
    colorOption: {
      flex: 1,
      padding: '8px',
      border: '2px solid',
      borderRadius: '8px',
      cursor: 'pointer',
      textAlign: 'center',
      fontWeight: '600',
      fontSize: '12px',
      transition: 'all 0.2s',
    },
    modalButtons: {
      display: 'flex',
      gap: '8px',
      backgroundColor: 'white',
    },
    modalButton: {
      flex: 1,
      padding: '10px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    modalButtonCancel: {
      backgroundColor: '#e5e7eb',
      color: '#374151',
    },
    modalButtonConfirm: {
      backgroundColor: '#3b82f6',
      color: 'white',
    },
    modalButtonDelete: {
      backgroundColor: '#ef4444',
      color: 'white',
    },
    crownCircle: {
      // Ahora representa un recuadro alrededor de la corona clínica (cuadrado ligeramente redondeado)
      position: 'absolute',
      width: '76px',
      height: '76px',
      border: '4px solid #eab308',
      borderRadius: '8px',
      top: '-6px',
      left: '-6px',
      pointerEvents: 'none',
      zIndex: 20,
      backgroundColor: 'transparent',
    },
    absentX: {
      position: 'absolute',
      width: '64px',
      height: '64px',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      zIndex: 20,
    },
    selectedTooth: {
      outline: '3px solid',
      outlineOffset: '2px',
      borderRadius: '4px',
    },
    prosthesisLine: {
      position: 'absolute',
      height: '10px',
      top: '27px',
      zIndex: 15,
      pointerEvents: 'none',
      borderRadius: '2px',
    },
  };

  interface ToothProps {
    number: number;
    quadrantTeeth: number[];
  }

  const Tooth: React.FC<ToothProps> = ({ number }) => {
    // Helper para identificar dientes de arcada inferior (permanentes y temporales) donde se deben bajar símbolos
    const isLowerArchTarget = (n: number): boolean => (
      (n >= 31 && n <= 38) || // cuadrante 4 inferior izquierda permanente
      (n >= 41 && n <= 48) || // cuadrante 3 inferior derecha permanente
      (n >= 71 && n <= 75) || // cuadrante 8 inferior izquierda temporal
      (n >= 81 && n <= 85)    // cuadrante 7 inferior derecha temporal
    );
    const getAreaColor = (area: string): string => {
      const key = `${number}-${area}`;
      const status = teethStatus[key];
      if (!status) return 'white';
      
      // Si es caries u obturado, verificar si tiene color personalizado aplicado
      if (status === 'caries' || status === 'obturado') {
        const colorKey = `${key}-color`;
        const applyColorKey = `${key}-apply-color`;
        const shouldApplyColor = teethStatus[applyColorKey] !== 'false';
        const customColor = teethStatus[colorKey];

        if (shouldApplyColor) {
          if (customColor === 'red') {
            return status === 'caries' ? '#dc2626' : '#ef4444';
          } else {
            return status === 'caries' ? '#3b82f6' : '#60a5fa';
          }
        } else {
          // "Sin color" debe mostrar el área en blanco en lugar del color por defecto
          return 'white';
        }
      }
      
      // Para otros estados, usar el color por defecto
      return statusColors[status];
    };

  const crown = crowns.find(c => c.tooth === number);
  const isSelected = selectedTeeth.includes(number);
  const isCrownSelected = selectedCrowns.includes(number);
    const isAbsent = Object.keys(teethStatus).some(key => 
      key.startsWith(`${number}-`) && teethStatus[key] === 'ausente'
    );
    const isExtraction = Object.keys(teethStatus).some(key => 
      key.startsWith(`${number}-`) && teethStatus[key] === 'extraccion'
    );
    
    const outlineColor = prosthesisMode === 'fija' ? '#1f2937' : prosthesisMode === 'removible' ? '#6b7280' : '#3b82f6';

    return (
      <div style={styles.toothContainer}>
        <div
          ref={el => { toothRefs.current[number] = el; }}
          onMouseEnter={() => { if (partialRemovableMode) setHoverTooth(number); }}
          onMouseLeave={() => { if (partialRemovableMode) setHoverTooth(null); }}
          style={{
            ...styles.toothWrapper,
            ...(isSelected ? {...styles.selectedTooth, outlineColor} : {}),
            ...(isCrownSelected ? { outline: `4px solid ${crownColor === 'red' ? '#dc2626' : '#3b82f6'}`, outlineOffset: '4px' } : {}),
            // Resaltar dientes seleccionados en modo prótesis parcial removible
            ...(partialRemovableMode && selectedPartialRemovableTeeth.includes(number) ? { outline: `3px solid ${partialRemovableColor === 'red' ? '#dc2626' : '#3b82f6'}`, outlineOffset: '4px' } : {}),
            // Resaltar dientes seleccionados en modo edéntulo
            ...(edentuloMode && selectedEdentuloTeeth.includes(number) ? { outline: '3px solid #2563eb', outlineOffset: '4px' } : {}),
            // Resaltar dientes seleccionados en modo fusión
            ...(fusionMode && selectedFusionTeeth.includes(number) ? { outline: '3px solid #2563eb', outlineOffset: '4px' } : {}),
            // Mostrar hover suave sobre diente cuando estamos en modo selección parcial removible
            ...(partialRemovableMode && hoverTooth === number ? { boxShadow: `0 0 0 6px ${partialRemovableColor === 'red' ? 'rgba(220,38,38,0.08)' : 'rgba(59,130,246,0.08)'}` } : {}),
          }}
        >
          {crown && (
            <div
              onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar corona?', () => deleteCrown(number)); }}
              title="Eliminar corona"
              style={{
                ...styles.crownCircle,
                border: `4px solid ${crown.color === 'red' ? '#dc2626' : '#3b82f6'}`,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            />
          )}
          
          {isAbsent && (
            <svg style={styles.absentX} viewBox="0 0 64 64">
              <line x1="8" y1="8" x2="56" y2="56" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" />
              <line x1="56" y1="8" x2="8" y2="56" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" />
            </svg>
          )}

          {isExtraction && (
            <svg style={styles.absentX} viewBox="0 0 64 64">
              <line x1="8" y1="8" x2="56" y2="56" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
              <line x1="56" y1="8" x2="8" y2="56" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
            </svg>
          )}

          {/* Espigo persistente (cuadro en corona + línea vertical hasta el centro) */}
          {espigos.find(e => e.tooth === number) && (() => {
            const e = espigos.find(x => x.tooth === number)!;
            const colorHex = e.color === 'red' ? '#dc2626' : '#3b82f6';
            return (
              <>
                <div
                  onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar espigo?', () => deleteEspigo(number)); }}
                  title="Eliminar espigo"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    top: '-24px',
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${colorHex}`,
                    backgroundColor: 'white',
                    zIndex: 22,
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                />

                <div
                  onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar espigo?', () => deleteEspigo(number)); }}
                  title="Eliminar espigo"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    top: '0',
                    width: '4px',
                    height: '50%',
                    backgroundColor: colorHex,
                    zIndex: 21,
                    borderRadius: '2px',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                />
              </>
            );
          })()}

          {/* Espigo temporal (preview) cuando estamos en modo espigo */}
          {espigoMode && selectedEspigoTooth === number && (
            <>
              <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-24px', width: '16px', height: '16px', border: '2px dashed #bfdbfe', backgroundColor: '#eff6ff', zIndex: 12, borderRadius: '3px', pointerEvents: 'none'}} />
              <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '0', width: '4px', height: '50%', backgroundColor: '#93c5fd', zIndex: 11, borderRadius: '2px', pointerEvents: 'none'}} />
            </>
          )}

          {/* Fractura persistente (X en corona + línea vertical roja) */}
          {fracturas.find((f) => f.tooth === number) && (() => {
            const colorHex = '#dc2626';
            return (
              <>
                <div
                  onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar fractura?', () => deleteFractura(number)); }}
                  title="Eliminar fractura"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    top: '-24px',
                    width: '16px',
                    height: '16px',
                    zIndex: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <line x1="2" y1="2" x2="10" y2="10" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                    <line x1="10" y1="2" x2="2" y2="10" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>

                <div
                  onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar fractura?', () => deleteFractura(number)); }}
                  title="Eliminar fractura"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    top: '0',
                    width: '4px',
                    height: '50%',
                    backgroundColor: colorHex,
                    zIndex: 21,
                    borderRadius: '2px',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                />
              </>
            );
          })()}

          {/* Fractura temporal (preview X + vertical red line) */}
          {fracturaMode && selectedFracturaTooth === number && (
            <>
              <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-24px', width: '16px', height: '16px', zIndex: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <line x1="2" y1="2" x2="10" y2="10" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" />
                  <line x1="10" y1="2" x2="2" y2="10" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '0', width: '4px', height: '50%', backgroundColor: '#fca5a5', zIndex: 11, borderRadius: '2px', pointerEvents: 'none'}} />
            </>
          )}

          {/* Geminación persistente: bajar más para dientes inferiores (evitando solaparse con giroversión a 84px) */}
          {geminaciones.filter(g => g.tooth === number).map(g => (
            <div
              key={`gem-${g.id}`}
              onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar geminación?', () => deleteGeminacion(number)); }}
              title="Eliminar geminación"
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                top: isLowerArchTarget(number) ? '88px' : '64px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '2px solid #3b82f6',
                backgroundColor: 'transparent',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                cursor: 'pointer'
              }}
            />
          ))}

          {/* Fusión persistente: bajar más en dientes inferiores (sin alcanzar la giroversión a 84px) */}
          {fusiones.filter(f => f.teeth.includes(number)).map(f => {
            const partner = f.teeth[0] === number ? f.teeth[1] : f.teeth[0];
            const shift = partner > number ? 1 : -1; // desplazar hacia el compañero (más cerca)
            return (
              <div
                key={`fusion-${f.id}-t-${number}`}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: `translateX(${shift}px) translateX(-50%)`,
                  top: isLowerArchTarget(number) ? '98px' : '64px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '2px solid #3b82f6',
                  backgroundColor: 'transparent',
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'auto',
                  cursor: 'pointer'
                }}
                onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar fusión?', () => deleteFusion(f.id)); }}
              />
            );
          })}

          {/* Geminación temporal (preview) con ajuste inferior mayor */}
          {geminacionMode && selectedGeminTooth === number && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                top: isLowerArchTarget(number) ? '98px' : '64px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '2px dashed #bfdbfe',
                backgroundColor: 'transparent',
                zIndex: 12,
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Fusión temporal (previews) con ajuste inferior mayor */}
          {fusionMode && selectedFusionTeeth.includes(number) && (() => {
            const sel = selectedFusionTeeth;
            let shift = 0;
            if (sel.length === 2) {
              const partner = sel[0] === number ? sel[1] : sel[0];
              shift = partner > number ? 2 : -2;
            }
            return (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: `translateX(${shift}px) translateX(-50%)`,
                  top: isLowerArchTarget(number) ? '88px' : '64px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '2px dashed #bfdbfe',
                  backgroundColor: 'transparent',
                  zIndex: 12,
                  pointerEvents: 'none'
                }}
              />
            );
          })()}

          {/* Clavija persistente / preview */}
          {clavijas.filter(c => c.tooth === number).map(c => (
            <div key={`clav-${c.id}`} title="Eliminar clavija" onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar clavija?', () => deleteClavija(number)); }} style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: c.position === 'above' ? '-36px' : '88px', width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: c.position === 'above' ? '14px solid #3b82f6' : undefined, borderTop: c.position === 'below' ? '14px solid #3b82f6' : undefined, zIndex: 22, pointerEvents: 'auto', cursor: 'pointer'}} />
          ))}

          {clavijaMode && selectedClavijaTooth === number && (
            <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: clavijaPosition === 'above' ? '-36px' : '88px', width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: clavijaPosition === 'above' ? '14px dashed #bfdbfe' : undefined, borderTop: clavijaPosition === 'below' ? '14px dashed #bfdbfe' : undefined, zIndex: 12, pointerEvents: 'none'}} />
          )}

          {/* Erupción persistente: flecha zigzag apuntando hacia el plano oclusal (arriba) */}
          {erupciones.filter(e => e.tooth === number).map(e => (
            <div key={`erup-${e.id}`} title="Eliminar erupción" onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar erupción?', () => deleteErupcion(number)); }} style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '4px', zIndex: 21, pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width="22" height="44" viewBox="0 0 18 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="2,30 8,22 2,14 8,6 16,0" stroke="#3b82f6" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points="9,34 5,26 13,26" fill="#3b82f6" />
              </svg>
            </div>
          ))}

          {/* Erupción temporal (preview cuando estamos en modo erupción) */}
          {erupcionMode && selectedErupcionTooth === number && (
            <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '4px', zIndex: 12, pointerEvents: 'none'}}>
              <svg width="22" height="44" viewBox="0 0 18 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="2,30 8,22 2,14 8,6 16,0" stroke="#bfdbfe" strokeWidth="3.5" strokeDasharray="4 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points="9,34 5,26 13,26" fill="#bfdbfe" />
              </svg>
            </div>
          )}

          {/* Extruida persistente: flecha vertical fuera del diente (arriba) */}
          {extruidas.filter(e => e.tooth === number).map(e => (
            <div key={`extr-${e.id}`} title="Eliminar extrusión" onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar extrusión?', () => deleteExtruida(number)); }} style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-44px', zIndex: 22, pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width="12" height="36" viewBox="0 0 10 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="5" y1="30" x2="5" y2="6" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                <polygon points="0,6 10,6 5,0" fill="#3b82f6" />
              </svg>
            </div>
          ))}

          {/* Extruida temporal (preview) */}
          {extruidaMode && selectedExtruidaTooth === number && (
            <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-44px', zIndex: 12, pointerEvents: 'none'}}>
              <svg width="12" height="36" viewBox="0 0 10 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="5" y1="30" x2="5" y2="6" stroke="#bfdbfe" strokeWidth="3" strokeDasharray="4 3" strokeLinecap="round" />
                <polygon points="0,6 10,6 5,0" fill="#bfdbfe" />
              </svg>
            </div>
          )}

          {/* Intrusión persistente: flecha vertical fuera del diente (apunta hacia el diente) */}
          {intrusiones.filter(i => i.tooth === number).map(i => (
            <div key={`intr-${i.id}`} title="Eliminar intrusión" onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar intrusión?', () => deleteIntrusion(number)); }} style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-44px', zIndex: 22, pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width="12" height="36" viewBox="0 0 10 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* línea desde arriba hacia abajo */}
                <line x1="5" y1="6" x2="5" y2="30" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                {/* punta hacia abajo (apuntando al diente) */}
                <polygon points="0,30 10,30 5,36" fill="#3b82f6" />
              </svg>
            </div>
          ))}

          {/* Intrusión temporal (preview) */}
          {intrusionMode && selectedIntrusionTooth === number && (
            <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-44px', zIndex: 12, pointerEvents: 'none'}}>
              <svg width="12" height="36" viewBox="0 0 10 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="5" y1="6" x2="5" y2="30" stroke="#bfdbfe" strokeWidth="3" strokeDasharray="4 3" strokeLinecap="round" />
                <polygon points="0,30 10,30 5,36" fill="#bfdbfe" />
              </svg>
            </div>
          )}

          {/* Giroversión persistente: flecha curva debajo del diente */}
          {giroversions.filter(g => g.tooth === number).map(g => (
            <div key={`giro-${g.id}`} title="Eliminar giroversión" onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar giroversión?', () => deleteGiroversion(number)); }} style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '84px', width: '48px', height: '24px', zIndex: 20, pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {g.direction === 'cw' ? (
                  <>
                    <path d="M6 6 C18 18, 30 18, 42 6" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M38 6 L42 6 L40 2" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  <>
                    <path d="M42 6 C30 18, 18 18, 6 6" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 6 L6 6 L8 2" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
              </svg>
            </div>
          ))}

          {/* Giroversión temporal (preview) */}
          {giroMode && selectedGiroTooth === number && (
            <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '84px', width: '48px', height: '24px', zIndex: 12, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {giroDirection === 'cw' ? (
                  <>
                    <path d="M6 6 C18 18, 30 18, 42 6" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="4 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M38 6 L42 6 L40 2" stroke="#bfdbfe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  <>
                    <path d="M42 6 C30 18, 18 18, 6 6" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="4 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 6 L6 6 L8 2" stroke="#bfdbfe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
              </svg>
            </div>
          )}
          
          <div style={styles.toothSquare}>
            <button
              onClick={() => toggleToothArea(number, 'centro')}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              style={{
                ...styles.centerSquare,
                backgroundColor: getAreaColor('centro'),
              }}
              title="Centro"
            />

            <button
              onClick={() => toggleToothArea(number, 'superior')}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              style={{
                ...styles.areaButton,
                top: 0,
                left: 0,
                right: 0,
                height: '100%',
                clipPath: 'polygon(0 0, 100% 0, 68.75% 31.25%, 31.25% 31.25%)',
                backgroundColor: getAreaColor('superior'),
              }}
              title="Superior"
            />

            <button
              onClick={() => toggleToothArea(number, 'derecha')}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              style={{
                ...styles.areaButton,
                top: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                clipPath: 'polygon(100% 0, 100% 100%, 68.75% 68.75%, 68.75% 31.25%)',
                backgroundColor: getAreaColor('derecha'),
              }}
              title="Derecha"
            />

            <button
              onClick={() => toggleToothArea(number, 'inferior')}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              style={{
                ...styles.areaButton,
                bottom: 0,
                left: 0,
                right: 0,
                height: '100%',
                clipPath: 'polygon(0 100%, 100% 100%, 68.75% 68.75%, 31.25% 68.75%)',
                backgroundColor: getAreaColor('inferior'),
              }}
              title="Inferior"
            />

            <button
              onClick={() => toggleToothArea(number, 'izquierda')}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              style={{
                ...styles.areaButton,
                top: 0,
                left: 0,
                bottom: 0,
                width: '100%',
                clipPath: 'polygon(0 0, 0 100%, 31.25% 68.75%, 31.25% 31.25%)',
                backgroundColor: getAreaColor('izquierda'),
              }}
              title="Izquierda"
            />

            <svg style={{ position: 'absolute', inset: '0', pointerEvents: 'none' }} viewBox="0 0 64 64">
              <line x1="32" y1="32" x2="32" y2="0" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="64" y2="0" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="64" y2="32" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="64" y2="64" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="32" y2="64" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="0" y2="64" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="0" y2="32" stroke="#374151" strokeWidth="1" />
              <line x1="32" y1="32" x2="0" y2="0" stroke="#374151" strokeWidth="1" />
            </svg>
            {/* Restauración temporal: contornos (persistentes y preview) */}
            {(tempRestorations.filter(r => r.tooth === number).length > 0 || (restorationTempMode && selectedTempAreas[number])) && (
              <svg style={{ position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 22 }} viewBox="0 0 64 64">
                {/* helper to map area => polygon points (64x64) */}
                {(() => {
                  const shapes: Record<string, string> = {
                    superior: '0,0 64,0 44,20 20,20',
                    derecha: '64,0 64,64 44,44 44,20',
                    inferior: '0,64 64,64 44,44 20,44',
                    izquierda: '0,0 0,64 20,44 20,20',
                    centro: '22,22 42,22 42,42 22,42'
                  };

                  const nodes: React.ReactNode[] = [];

                  // persistent restorations
                  tempRestorations.filter(r => r.tooth === number).forEach(r => {
                    r.areas.forEach((area) => {
                      const pts = shapes[area];
                      if (!pts) return;
                      // si está seleccionado para borrado mostrar estilo distinto
                      const isMarkedForDelete = selectedTempToDelete[number] && selectedTempToDelete[number].includes(area);
                      nodes.push(
                        <polygon
                          key={`${r.id}-${area}`}
                          points={pts}
                          fill="none"
                          stroke={isMarkedForDelete ? '#7f1d1d' : '#dc2626'}
                          strokeWidth={isMarkedForDelete ? 3.5 : 2.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          pointerEvents="auto"
                          onClick={(ev)=>{
                            ev.stopPropagation();
                            if (restorationTempMode) {
                              // togglear selección para borrado al clickear el contorno cuando estamos en modo restauración
                              setSelectedTempToDelete(prev => {
                                const copy: Record<number,string[]> = { ...prev };
                                const arr = copy[number] ? [...copy[number]] : [];
                                if (arr.includes(area)) {
                                  copy[number] = arr.filter(a => a !== area);
                                  if (copy[number].length === 0) delete copy[number];
                                } else {
                                  arr.push(area);
                                  copy[number] = arr;
                                }
                                return copy;
                              });
                            } else {
                              showConfirm('¿Eliminar restauración temporal?', () => deleteTempRestoration(r.id));
                            }
                          }}
                        />
                      );
                    });
                  });

                  // preview (dashed) for currently selected areas on this tooth
                  if (restorationTempMode && selectedTempAreas[number]) {
                    selectedTempAreas[number].forEach((area, idx) => {
                      const pts = shapes[area];
                      if (!pts) return;
                      nodes.push(
                        <polygon key={`preview-${number}-${area}-${idx}`} points={pts} fill="none" stroke="rgba(220,38,38,0.45)" strokeWidth={2.5} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
                      );
                    });
                  }

                  return nodes;
                })()}
              </svg>
            )}

            {/* Triángulos (raíces) para dientes configurados (3 triángulos) */}
            {ROOT_TRIANGLE_TEETH.includes(number) && (
              <div style={{ position: 'absolute', top: ( (n:number)=>((n>=31&&n<=38)||(n>=41&&n<=48)||(n>=71&&n<=75)||(n>=81&&n<=85)) )(number) ? '64px' : '-22px', left: '5px', width: '54px', height: '22px' }}>
                <svg width="54" height="22" viewBox="0 0 54 22" style={{ overflow: 'visible' }}>
                  { [0,1,2].map(i => {
                      const xOffset = i * 20; // separación uniforme
                      const selectedArr = rootTriangles[number] || [false,false,false];
                      const selected = selectedArr[i];
                      const isLower = ((n:number)=>((n>=31&&n<=38)||(n>=41&&n<=48)||(n>=71&&n<=75)||(n>=81&&n<=85)))(number);
                      const transformStr = `translate(${xOffset},0) ${isLower ? 'rotate(180,7,11)' : ''}`;
                      return (
                        <g key={`root-${number}-${i}`} transform={transformStr} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleRootTriangle(number, i); }}>
                          <polygon points="0,20 14,20 7,2" fill="white" stroke="#374151" strokeWidth="1.75" strokeLinejoin="round" />
                          {selected && (
                            <line x1="7" y1="4" x2="7" y2="17" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
                          )}
                        </g>
                      );
                    }) }
                </svg>
              </div>
            )}
            {/* Triángulo único (una raíz) para dientes configurados */}
            {SINGLE_ROOT_TRIANGLE_TEETH.includes(number) && !ROOT_TRIANGLE_TEETH.includes(number) && (
              <div style={{ position: 'absolute', top: ( (n:number)=>((n>=31&&n<=38)||(n>=41&&n<=48)||(n>=71&&n<=75)||(n>=81&&n<=85)) )(number) ? '64px' : '-22px', left: '23px', width: '18px', height: '22px' }}>
                <svg width="18" height="22" viewBox="0 0 18 22" style={{ overflow: 'visible' }}>
                  <g style={{ cursor: 'pointer' }} transform={ ((n:number)=>((n>=31&&n<=38)||(n>=41&&n<=48)||(n>=71&&n<=75)||(n>=81&&n<=85)))(number) ? 'rotate(180,9,11)' : undefined } onClick={(e) => { e.stopPropagation(); toggleSingleRootTriangle(number); }}>
                    <polygon points="0,20 18,20 9,2" fill="white" stroke="#374151" strokeWidth="1.75" strokeLinejoin="round" />
                    {singleRootTriangles[number] && (
                      <line x1="9" y1="4" x2="9" y2="17" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
                    )}
                  </g>
                </svg>
              </div>
            )}
            {/* Triángulos dobles (dos raíces) para dientes configurados */}
            {DOUBLE_ROOT_TRIANGLE_TEETH.includes(number) && !ROOT_TRIANGLE_TEETH.includes(number) && !SINGLE_ROOT_TRIANGLE_TEETH.includes(number) && (
              <div style={{ position: 'absolute', top: ( (n:number)=>((n>=31&&n<=38)||(n>=41&&n<=48)||(n>=71&&n<=75)||(n>=81&&n<=85)) )(number) ? '64px' : '-22px', left: '12px', width: '40px', height: '22px' }}>
                <svg width="40" height="22" viewBox="0 0 40 22" style={{ overflow: 'visible' }}>
                  { [0,1].map(i => {
                      // Triángulo ancho 14, separación 12 -> segundo inicia en 26
                      const xOffset = i === 0 ? 0 : 26;
                      const selectedArr = doubleRootTriangles[number] || [false,false];
                      const selected = selectedArr[i];
                      const isLower = ((n:number)=>((n>=31&&n<=38)||(n>=41&&n<=48)||(n>=71&&n<=75)||(n>=81&&n<=85)))(number);
                      const transformStr = `translate(${xOffset},0) ${isLower ? 'rotate(180,7,11)' : ''}`;
                      return (
                        <g key={`root2-${number}-${i}`} transform={transformStr} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleDoubleRootTriangle(number, i); }}>
                          <polygon points="0,20 14,20 7,2" fill="white" stroke="#374151" strokeWidth="1.75" strokeLinejoin="round" />
                          {selected && (
                            <line x1="7" y1="4" x2="7" y2="17" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
                          )}
                        </g>
                      );
                    }) }
                </svg>
              </div>
            )}
          </div>
        </div>
        <span
          style={{
            ...styles.toothNumber,
            marginTop: ((n: number) => ((n >= 31 && n <= 38) || (n >= 41 && n <= 48) || (n >= 71 && n <= 75) || (n >= 81 && n <= 85)))(number)
              ? '36px'
              : '4px',
          }}
        >
          {number}
        </span>
      </div>
    );
  };

  interface ToothRowProps {
    teeth: number[];
    label?: string;
  }

  const ToothRow: React.FC<ToothRowProps> = ({ teeth, label }) => {
    const relevantProstheses = prostheses.filter(p => 
      p.teeth.some(t => teeth.includes(t))
    );

    const selectedInThisRow = selectedTeeth.filter(t => teeth.includes(t)).sort((a, b) => {
      return teeth.indexOf(a) - teeth.indexOf(b);
    });

    const connectionLines: Array<{left: number, width: number}> = [];
    for (let i = 0; i < selectedInThisRow.length - 1; i++) {
      const currentIndex = teeth.indexOf(selectedInThisRow[i]);
      const nextIndex = teeth.indexOf(selectedInThisRow[i + 1]);
      
      if (nextIndex === currentIndex + 1) {
        const left = currentIndex * 72 + 64;
        const width = 8;
        connectionLines.push({ left, width });
      }
    }

    return (
      <div style={styles.rowContainer}>
        {label && <div style={styles.rowLabel}>{label}</div>}
  {/* Keep teeth layout stable: prosthesis is rendered as absolute overlay so avoid changing padding */}
  <div style={{...styles.teethRow, paddingTop: '0'}}>
          
            {relevantProstheses.map(prosthesis => {
            const prosthesisTeeth = prosthesis.teeth.filter(t => teeth.includes(t));
            if (prosthesisTeeth.length < 2) return null;

            const sortedTeeth = [...prosthesisTeeth].sort((a, b) => teeth.indexOf(a) - teeth.indexOf(b));
            const segments = [];
            const colorHex = prosthesis.color === 'red' ? '#dc2626' : '#3b82f6';
            
            for (let i = 0; i < sortedTeeth.length - 1; i++) {
              const currentIndex = teeth.indexOf(sortedTeeth[i]);
              const nextIndex = teeth.indexOf(sortedTeeth[i + 1]);
              
              if (nextIndex === currentIndex + 1) {
                const left = currentIndex * 72 + 64;
                const width = 8;
                segments.push({ left, width, key: `${prosthesis.id}-seg-${i}` });
              }
            }

            const firstTooth = sortedTeeth[0];
            const lastTooth = sortedTeeth[sortedTeeth.length - 1];
            const firstIdx = teeth.indexOf(firstTooth);
            const lastIdx = teeth.indexOf(lastTooth);

            // Draw a clean horizontal bridge line above the teeth (no overlap)
            // and small pillar indicators at the endpoints pointing downwards.
            const left1 = firstIdx * 72 + 32; // center of first tooth
            const left2 = lastIdx * 72 + 32;  // center of last tooth
            const lineLeft = Math.min(left1, left2);
            const lineWidth = Math.max(2, Math.abs(left2 - left1));
            const lineTop = -12; // place above the teeth so it doesn't touch them
            const pillarTop = lineTop + 4; // start just below the line and point down
            const pillarHeight = 12; // small pillar

            return (
              <React.Fragment key={prosthesis.id}>
                {/* continuous bridge line */}
                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar prótesis?', () => setProstheses(prev => prev.filter(p => p.id !== prosthesis.id))); }}
                  title="Eliminar prótesis"
                  style={{
                    position: 'absolute',
                    left: `${lineLeft}px`,
                    top: `${lineTop}px`,
                    width: `${lineWidth}px`,
                    height: '4px',
                    backgroundColor: colorHex,
                    borderRadius: '2px',
                    zIndex: 15,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                />

                {/* small pillar indicators at endpoints (pointing down) */}
                {firstIdx !== -1 && (
                  <div
                    onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar prótesis?', () => setProstheses(prev => prev.filter(p => p.id !== prosthesis.id))); }}
                    title="Eliminar prótesis"
                    style={{
                      position: 'absolute',
                      left: `${left1 - 2}px`,
                      top: `${pillarTop}px`,
                      width: '4px',
                      height: `${pillarHeight}px`,
                      backgroundColor: colorHex,
                      zIndex: 16,
                      cursor: 'pointer',
                    }}
                  />
                )}

                {lastIdx !== -1 && (
                  <div
                    onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar prótesis?', () => setProstheses(prev => prev.filter(p => p.id !== prosthesis.id))); }}
                    title="Eliminar prótesis"
                    style={{
                      position: 'absolute',
                      left: `${left2 - 2}px`,
                      top: `${pillarTop}px`,
                      width: '4px',
                      height: `${pillarHeight}px`,
                      backgroundColor: colorHex,
                      zIndex: 16,
                      cursor: 'pointer',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Render aparatos fijos existentes en esta fila */}
          {appliances.filter(a => a.teeth.every(t => teeth.includes(t))).map(app => {
            const [t1, t2] = app.teeth;
            const idx1 = teeth.indexOf(t1);
            const idx2 = teeth.indexOf(t2);
            if (idx1 === -1 || idx2 === -1) return null;
            const left1 = idx1 * 72;
            const left2 = idx2 * 72;
            const center1 = left1 + 32;
            const center2 = left2 + 32;
            const squareLeft1 = left1 + 24; // center - 8
            const squareLeft2 = left2 + 24;
            const colorHex = app.color === 'red' ? '#dc2626' : '#3b82f6';

            return (
              <React.Fragment key={app.id}>
                {/* línea que une ambos cuadrados (clickable para eliminar) */}
                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar aparato fijo?', () => deleteAppliance(app.id)); }}
                  title="Eliminar aparato fijo"
                  style={{
                    position: 'absolute',
                    left: `${center1}px`,
                    top: `-12px`,
                    width: `${center2 - center1}px`,
                    height: '3px',
                    backgroundColor: colorHex,
                    zIndex: 14,
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />

                {/* cuadrados en los ápices con cruz (clickable para eliminar) */}
                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar aparato fijo?', () => deleteAppliance(app.id)); }}
                  title="Eliminar aparato fijo"
                  style={{
                    position: 'absolute',
                    left: `${squareLeft1}px`,
                    top: `-28px`,
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${colorHex}`,
                    backgroundColor: 'white',
                    zIndex: 15,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{display: 'block'}}>
                    <line x1="6" y1="2" x2="6" y2="10" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                    <line x1="2" y1="6" x2="10" y2="6" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>

                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar aparato fijo?', () => deleteAppliance(app.id)); }}
                  title="Eliminar aparato fijo"
                  style={{
                    position: 'absolute',
                    left: `${squareLeft2}px`,
                    top: `-28px`,
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${colorHex}`,
                    backgroundColor: 'white',
                    zIndex: 15,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{display: 'block'}}>
                    <line x1="6" y1="2" x2="6" y2="10" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                    <line x1="2" y1="6" x2="10" y2="6" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              </React.Fragment>
            );
          })}

          {/* Render aparatos removibles (zigzag) en esta fila */}
          {removableAppliances.filter(r => r.teeth.every(t => teeth.includes(t))).map(rem => {
            const [t1, t2] = rem.teeth;
            const idx1 = teeth.indexOf(t1);
            const idx2 = teeth.indexOf(t2);
            if (idx1 === -1 || idx2 === -1) return null;
            const left1 = idx1 * 72;
            const left2 = idx2 * 72;
            const center1 = left1 + 32;
            const center2 = left2 + 32;
            const width = center2 - center1;
            if (width <= 4) return null;
            const colorHex = rem.color === 'red' ? '#dc2626' : '#3b82f6';

            const nSegments = Math.max(4, Math.floor(width / 12));
            const step = width / nSegments;
            const amplitude = 6;
            const points: string[] = [];
            for (let i = 0; i <= nSegments; i++) {
              const x = i * step;
              const y = 8 + (i % 2 === 0 ? -amplitude : amplitude);
              points.push(`${x},${y}`);
            }

            const squareLeft1 = left1 + 24;
            const squareLeft2 = left2 + 24;

            return (
              <React.Fragment key={rem.id}>
                <svg
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar aparato removible?', () => deleteRemovable(rem.id)); }}
                  style={{ position: 'absolute', left: `${center1}px`, top: `-24px`, width: `${width}px`, height: '16px', zIndex: 14, overflow: 'visible', cursor: 'pointer' }}
                  viewBox={`0 0 ${width} 16`}
                >
                  <title>Eliminar aparato removible</title>
                  <polyline points={points.join(' ')} stroke={colorHex} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar aparato removible?', () => deleteRemovable(rem.id)); }}
                  title="Eliminar aparato removible"
                  style={{ position: 'absolute', left: `${squareLeft1}px`, top: `-34px`, width: '16px', height: '16px', border: `2px solid ${colorHex}`, backgroundColor: 'white', zIndex: 15, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{display: 'block'}}>
                    <circle cx="6" cy="6" r="1.5" fill={colorHex} />
                  </svg>
                </div>

                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar aparato removible?', () => deleteRemovable(rem.id)); }}
                  title="Eliminar aparato removible"
                  style={{ position: 'absolute', left: `${squareLeft2}px`, top: `-34px`, width: '16px', height: '16px', border: `2px solid ${colorHex}`, backgroundColor: 'white', zIndex: 15, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{display: 'block'}}>
                    <circle cx="6" cy="6" r="1.5" fill={colorHex} />
                  </svg>
                </div>
              </React.Fragment>
            );
          })}

          {/* Render diastemas (X) en esta fila */}
          {!overlayEnabled && diastemas.filter(d => d.teeth.every(t => teeth.includes(t))).map(d => {
            const [t1, t2] = d.teeth;
            const idx1 = teeth.indexOf(t1);
            const idx2 = teeth.indexOf(t2);
            if (idx1 === -1 || idx2 === -1) return null;
            const left1 = idx1 * 72;
            const left2 = idx2 * 72;
            const center1 = left1 + 32;
            const center2 = left2 + 32;
            const mid = (center1 + center2) / 2;
            const size = 32; // aumentar tamaño de la X
            const left = mid - size/3;
            const color = d.color === 'blue' ? '#3b82f6' : '#3b82f6';

            return (
              <div key={d.id}>
                <div
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar diastema?', () => deleteDiastema(d.id)); }}
                  title="Eliminar diastema"
                  style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: `27px`,
                    width: `${size}px`,
                    height: `${size}px`,
                    zIndex: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  <svg width={size} height={size} viewBox="0 0 24 24">
                    <line x1="3" y1="3" x2="21" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
                    <line x1="21" y1="3" x2="3" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            );
          })}

          {/* Si estamos en modo aparato, mostrar selección temporal */}
          {applianceMode && selectedApplianceTeeth.length > 0 && (() => {
            const sel = selectedApplianceTeeth.filter(t => teeth.includes(t));
            if (sel.length === 0) return null;
            const squares = sel.map(s => {
              const idx = teeth.indexOf(s);
              if (idx === -1) return null;
              const left = idx * 72 + 24;
              const colorHex = applianceColor === 'red' ? '#dc2626' : '#3b82f6';
              return (
                <div key={`temp-app-${s}`} style={{position: 'absolute', left: `${left}px`, top: '-28px', width: '16px', height: '16px', border: `2px dashed ${colorHex}`, backgroundColor: 'white', zIndex: 15, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <line x1="6" y1="2" x2="6" y2="10" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                    <line x1="2" y1="6" x2="10" y2="6" stroke={colorHex} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              );
            });

            if (sel.length === 2) {
              const idx1 = teeth.indexOf(sel[0]);
              const idx2 = teeth.indexOf(sel[1]);
              const center1 = idx1 * 72 + 32;
              const center2 = idx2 * 72 + 32;
              const colorHex = applianceColor === 'red' ? '#dc2626' : '#3b82f6';
              return (
                <>
                  <div style={{position: 'absolute', left: `${center1}px`, top: `-12px`, width: `${center2 - center1}px`, height: '3px', backgroundColor: colorHex, zIndex: 14, borderRadius: '2px'}} />
                    {squares}
                </>
              );
            }

            return <>{squares}</>;
          })()}

          {/* Si estamos en modo removible, mostrar selección temporal (zigzag) */}
          {removableMode && selectedRemovableTeeth.length > 0 && (() => {
            const sel = selectedRemovableTeeth.filter(t => teeth.includes(t));
            if (sel.length === 0) return null;
            const squares = sel.map(s => {
              const idx = teeth.indexOf(s);
              if (idx === -1) return null;
              const left = idx * 72 + 24;
              const colorHex = removableColor === 'red' ? '#dc2626' : '#3b82f6';
              return (
                <div key={`temp-rem-${s}`} style={{position: 'absolute', left: `${left}px`, top: '-34px', width: '16px', height: '16px', border: `2px dashed ${colorHex}`, backgroundColor: 'white', zIndex: 15, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="1.5" fill={colorHex} />
                  </svg>
                </div>
              );
            });

            if (sel.length === 2) {
              const idx1 = teeth.indexOf(sel[0]);
              const idx2 = teeth.indexOf(sel[1]);
              const center1 = idx1 * 72 + 32;
              const center2 = idx2 * 72 + 32;
              const width = center2 - center1;
              if (width > 4) {
                const nSegments = Math.max(4, Math.floor(width / 12));
                const step = width / nSegments;
                const amplitude = 6;
                const points: string[] = [];
                for (let i = 0; i <= nSegments; i++) {
                  const x = i * step;
                  const y = 8 + (i % 2 === 0 ? -amplitude : amplitude);
                  points.push(`${x},${y}`);
                }
                const colorHex = removableColor === 'red' ? '#dc2626' : '#3b82f6';
                return (
                  <>
                    <svg style={{position: 'absolute', left: `${center1}px`, top: `-24px`, width: `${width}px`, height: '16px', zIndex: 14}} viewBox={`0 0 ${width} 16`}>
                      <polyline points={points.join(' ')} stroke={colorHex} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {squares}
                  </>
                );
              }
            }

            return <>{squares}</>;
          })()}

          {/* Si estamos en modo diastema, mostrar selección temporal */}
          {diastemaMode && selectedDiastemaTeeth.length > 0 && (() => {
            const sel = selectedDiastemaTeeth.filter(t => teeth.includes(t));
            if (sel.length === 0) return null;
            const squares = sel.map(s => {
              const idx = teeth.indexOf(s);
              if (idx === -1) return null;
              const left = idx * 72 + 24;
              const color = '#3b82f6';
              return (
                <div key={`temp-dia-${s}`} style={{position: 'absolute', left: `${left}px`, top: '-20px', width: '16px', height: '16px', border: `2px dashed ${color}`, backgroundColor: 'white', zIndex: 15, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <line x1="2" y1="2" x2="10" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    <line x1="10" y1="2" x2="2" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              );
            });

            if (sel.length === 2) {
              const idx1 = teeth.indexOf(sel[0]);
              const idx2 = teeth.indexOf(sel[1]);
              const center1 = idx1 * 72 + 32;
              const center2 = idx2 * 72 + 32;
              const mid = (center1 + center2) / 2;
              const size = 16;
              const left = mid - size / 3 + DIASTEMA_H_OFFSET; // usar desplazamiento compartido
              const color = '#3b82f6';
              return (
                <>
                  <div style={{position: 'absolute', left: `${left}px`, top: `27px`, width: `${size}px`, height: `${size}px`, zIndex: 13}}>
                    <svg width={size} height={size} viewBox="0 0 24 24">
                      <line x1="3" y1="3" x2="21" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
                      <line x1="21" y1="3" x2="3" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                  {squares}
                </>
              );
            }

            return <>{squares}</>;
          })()}

          {prosthesisMode && connectionLines.map((line, index) => {
            const colorHex = prosthesisMode === 'fija' ? (prosthesisColor === 'red' ? '#dc2626' : '#3b82f6') : '#6b7280';
            return (
              <div
                key={`connection-${index}`}
                style={{
                  ...styles.prosthesisLine,
                  left: `${line.left}px`,
                  width: `${line.width}px`,
                  backgroundColor: colorHex,
                  border: `2px solid ${colorHex}`,
                }}
              />
            );
          })}

          {prosthesisMode && selectedInThisRow.map(tooth => {
            const toothIndex = teeth.indexOf(tooth);
            const colorHex = prosthesisMode === 'fija' ? (prosthesisColor === 'red' ? '#dc2626' : '#3b82f6') : '#6b7280';
            return (
              <div
                key={`temp-tooth-${tooth}`}
                style={{
                  position: 'absolute',
                  left: `${toothIndex * 72}px`,
                  width: '64px',
                  height: '10px',
                  top: '27px',
                  borderRadius: '2px',
                  zIndex: 15,
                  backgroundColor: colorHex,
                  border: `2px solid ${colorHex}`,
                  opacity: 0.7,
                }}
              />
            );
          })}
          
          {teeth.map(tooth => (
            <Tooth key={tooth} number={tooth} quadrantTeeth={teeth} />
          ))}
        </div>
      </div>
    );
  };

  const CodeBoxes: React.FC<{ teeth: number[] }> = ({ teeth }) => (
    <div style={styles.codeBoxesContainer}>
      {teeth.map(tooth => {
        const code = teethCodes[tooth];
        return (
          <div 
                key={tooth} 
                style={{
                  ...styles.codeBox,
                  // Mostrar rojo cuando el código es 'red', azul visible cuando es 'blue'
                  color: code?.color === 'red' ? '#dc2626' : '#3b82f6'
                }}
              >
            {code?.text || ''}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Estilos CSS para animación */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>

      <div style={styles.mainLayout}>
      {/* Mensaje de guardado en cabecera (flotante sobre todo el contenido) */}
      {saveMessage.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '14px 28px',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: '600',
          textAlign: 'center',
          backgroundColor: saveMessage.type === 'success' ? '#10b981' : saveMessage.type === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          animation: 'slideDown 0.3s ease-out',
        }}>
          {saveMessage.text}
        </div>
      )}

      {/* Sidebar */}
      <div style={styles.sidebar} className="odontograma-sidebar">
        <h1 style={styles.sidebarTitle}>Odontograma Digital</h1>
        
        <div style={styles.counterContainer}>
          <div style={styles.counterBox}>
            <div style={styles.counterNumber}>{countExistingTeeth()}</div>
            <div style={styles.counterLabel}>Presentes</div>
          </div>
          <div style={styles.counterBox}>
            <div style={styles.counterNumber}>{32 - countExistingTeeth()}</div>
            <div style={styles.counterLabel}>Ausentes</div>
          </div>
        </div>

        <div style={styles.sidebarQuickActions}>
          <div style={styles.sidebarQuickActionsGrid}>
            <button
              onClick={handleSaveOdontograma}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22c55e')}
              style={{
                ...styles.statusButton,
                backgroundColor: '#22c55e',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Save size={16} />
              Guardar
            </button>
            <button
              onClick={() => {
                showConfirmClear();
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
              style={{
                ...styles.statusButton,
                backgroundColor: '#ef4444',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Trash2 size={16} />
              Limpiar
            </button>
            {(odontogramaId || versionId) && (
              <>
                <button
                  onClick={handleDownloadPdf}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                  style={{
                    ...styles.statusButton,
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    gridColumn: '1 / -1',
                  }}
                >
                  🖨 Descargar PDF
                </button>
                <button
                  onClick={handlePrintPdf}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e40af')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                  style={{
                    ...styles.statusButton,
                    backgroundColor: '#1d4ed8',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    gridColumn: '1 / -1',
                  }}
                >
                  🖨 Imprimir
                </button>
              </>
            )}
          </div>
        </div>

        <div style={styles.sidebarSection}>
          <div style={styles.favoriteSectionHeader}>
            <h3 style={styles.sidebarSectionTitle}>Favoritas</h3>
            <button
              onClick={() => setIsEditingFavorites((prev) => !prev)}
              style={{
                ...styles.favoriteEditButton,
                backgroundColor: isEditingFavorites ? '#1d4ed8' : 'white',
                borderColor: isEditingFavorites ? '#1d4ed8' : '#cbd5e1',
                color: isEditingFavorites ? 'white' : '#334155',
              }}
            >
              {isEditingFavorites ? 'Listo' : 'Editar'}
            </button>
          </div>
          <div style={styles.favoriteToolsGrid}>
            {selectedFavoriteTools.map((tool) => (
              <div key={tool.id} style={styles.toolButtonRow}>
                <button
                  onClick={tool.onClick}
                  style={{
                    ...styles.prosthesisButton,
                    ...styles.toolButtonGrow,
                    borderColor: '#1f2937',
                    backgroundColor: tool.isActive ? '#1f2937' : 'white',
                    color: tool.isActive ? 'white' : '#1f2937',
                  }}
                >
                  {tool.label}
                </button>
                {renderFavoriteToggle(tool.id, tool.label)}
              </div>
            ))}
            {selectedFavoriteTools.length === 0 && (
              <div style={{gridColumn: '1 / -1', fontSize: '12px', color: '#6b7280'}}>
                No hay favoritas seleccionadas.
              </div>
            )}
          </div>
        </div>

        {/* 'Estado a marcar' removido por petición del usuario */}

        <div style={styles.sidebarSection}>
          <h3 style={styles.sidebarSectionTitle}>Más herramientas</h3>
          <div style={styles.prosthesisButtons}>
            {/* Prótesis fija/removible eliminadas del UI según solicitud */}
            <div style={{marginTop: '4px'}}>
              <button
                onClick={() => {
                  activateTool(setProsthesisMode, prosthesisMode === 'fija' ? null : 'fija');
                  setSelectedTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  borderColor: prosthesisMode === 'fija' ? '#1f2937' : '#1f2937',
                  backgroundColor: prosthesisMode === 'fija' ? '#1f2937' : 'white',
                  color: prosthesisMode === 'fija' ? 'white' : '#1f2937',
                }}
              >
               ≡ Prótesis Dental Parcial Fija
              </button>

              {prosthesisMode === 'fija' && (
                <div style={{display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center'}}>
                  <div style={{fontSize: '13px', color: '#6b7280'}}>Estado:</div>
                  <div onClick={() => setProsthesisColor('blue')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: prosthesisColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: prosthesisColor === 'blue' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Buen Estado</div>
                  <div onClick={() => setProsthesisColor('red')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: prosthesisColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db', backgroundColor: prosthesisColor === 'red' ? '#fef2f2' : 'white', color: '#dc2626'}}>Mal Estado</div>
                </div>
              )}
            </div>

            {prosthesisMode && selectedTeeth.length >= 2 && (
              <>
                <button
                  onClick={confirmProsthesis}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#22c55e',
                    backgroundColor: '#22c55e',
                    color: 'white',
                  }}
                >
                  ✓ Confirmar ({selectedTeeth.length})
                </button>
                <button
                  onClick={cancelProsthesis}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    color: 'white',
                  }}
                >
                  ✕ Cancelar
                </button>
              </>
            )}
            {/* Prótesis Dental Parcial Removible UI */}
            <div style={{marginTop: '8px'}}>
              <button
                onClick={() => {
                  activateTool(setPartialRemovableMode, !partialRemovableMode);
                  setSelectedPartialRemovableTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  borderColor: partialRemovableMode ? '#1f2937' : '#1f2937',
                  backgroundColor: partialRemovableMode ? '#1f2937' : 'white',
                  color: partialRemovableMode ? 'white' : '#1f2937',
                }}
              >
                ≡ Prótesis Dental Parcial Removible
              </button>

              {partialRemovableMode && (
                <div style={{display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center'}}>
                  <div style={{fontSize: '13px', color: '#6b7280'}}>Estado:</div>
                  <div onClick={() => setPartialRemovableColor('blue')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: partialRemovableColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: partialRemovableColor === 'blue' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Buen Estado</div>
                  <div onClick={() => setPartialRemovableColor('red')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: partialRemovableColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db', backgroundColor: partialRemovableColor === 'red' ? '#fef2f2' : 'white', color: '#dc2626'}}>Mal Estado</div>
                </div>
              )}

              {partialRemovableMode && selectedPartialRemovableTeeth.length === 2 && (
                <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                  <button
                    onClick={confirmPartialRemovable}
                    style={{
                      ...styles.prosthesisButton,
                      borderColor: '#22c55e',
                      backgroundColor: '#22c55e',
                      color: 'white',
                    }}
                  >
                    ✓ Confirmar
                  </button>
                  <button
                    onClick={cancelPartialRemovable}
                    style={{
                      ...styles.prosthesisButton,
                      borderColor: '#ef4444',
                      backgroundColor: '#ef4444',
                      color: 'white',
                    }}
                  >
                    ✕ Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Coronas UI */}
          <div style={styles.controlsGrid}>
            <div style={{marginTop: '8px'}}>
              <div style={styles.toolButtonRow}>
                <button
                  onClick={() => {
                    activateTool(setCrownMode, !crownMode);
                    setSelectedCrowns([]);
                  }}
                  style={{
                    ...styles.prosthesisButton,
                    ...styles.toolButtonGrow,
                    borderColor: crownMode ? '#1f2937' : '#1f2937',
                    backgroundColor: crownMode ? '#1f2937' : 'white',
                    color: crownMode ? 'white' : '#1f2937',
                  }}
                >
                  👑 Corona
                </button>
                {renderFavoriteToggle('crown', 'Corona')}
              </div>

            <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
              {crownMode && (
                <>
                  <div
                    onClick={() => setCrownColor('blue')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: crownColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db',
                      backgroundColor: crownColor === 'blue' ? '#eff6ff' : 'white',
                      color: '#3b82f6',
                    }}
                  >
                    Azul
                  </div>
                  <div
                    onClick={() => setCrownColor('red')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: crownColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db',
                      backgroundColor: crownColor === 'red' ? '#fef2f2' : 'white',
                      color: '#dc2626',
                    }}
                  >
                    Rojo
                  </div>
                </>
              )}
            </div>

            {crownMode && selectedCrowns.length > 0 && (
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button
                  onClick={confirmCrown}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#22c55e',
                    backgroundColor: '#22c55e',
                    color: 'white',
                  }}
                >
                  ✓ Confirmar ({selectedCrowns.length})
                </button>
                <button
                  onClick={cancelCrown}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    color: 'white',
                  }}
                >
                  ✕ Cancelar
                </button>
              </div>
            )}
          </div>
          {/* Aparato fijo UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setApplianceMode, !applianceMode);
                  setSelectedApplianceTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: applianceMode ? '#1f2937' : '#1f2937',
                  backgroundColor: applianceMode ? '#1f2937' : 'white',
                  color: applianceMode ? 'white' : '#1f2937',
                }}
              >
                🛠 Aparato Fijo
              </button>
              {renderFavoriteToggle('appliance', 'Aparato Fijo')}
            </div>

            <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
              {applianceMode && (
                <>
                  <div
                    onClick={() => setApplianceColor('blue')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: applianceColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db',
                      backgroundColor: applianceColor === 'blue' ? '#eff6ff' : 'white',
                      color: '#3b82f6',
                    }}
                  >
                    Azul
                  </div>
                  <div
                    onClick={() => setApplianceColor('red')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: applianceColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db',
                      backgroundColor: applianceColor === 'red' ? '#fef2f2' : 'white',
                      color: '#dc2626',
                    }}
                  >
                    Rojo
                  </div>
                </>
              )}
            </div>

            {applianceMode && selectedApplianceTeeth.length >= 2 && (
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button
                  onClick={confirmAppliance}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#22c55e',
                    backgroundColor: '#22c55e',
                    color: 'white',
                  }}
                >
                  ✓ Confirmar ({selectedApplianceTeeth.length})
                </button>
                <button
                  onClick={cancelAppliance}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    color: 'white',
                  }}
                >
                  ✕ Cancelar
                </button>
              </div>
            )}
          </div>
          {/* Pieza Dentaria Ausente UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setAbsentMode, !absentMode);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: absentMode ? '#1f2937' : '#1f2937',
                  backgroundColor: absentMode ? '#1f2937' : 'white',
                  color: absentMode ? 'white' : '#1f2937',
                }}
              >
                ✖ Pieza Ausente
              </button>
              {renderFavoriteToggle('absent', 'Pieza Ausente')}
            </div>

            {absentMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280'}}>Haz clic en el diente para marcarlo/ desmarcarlo como ausente (X azul)</div>
              </div>
            )}
          </div>
          {/* Aparato removible (zigzag) UI */}
          {/* Extracción dental UI (X roja) */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setExtractionMode, !extractionMode);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: extractionMode ? '#1f2937' : '#1f2937',
                  backgroundColor: extractionMode ? '#1f2937' : 'white',
                  color: extractionMode ? 'white' : '#1f2937',
                }}
              >
                ✖️ Extracción (X roja)
              </button>
              {renderFavoriteToggle('extraction', 'Extracción')}
            </div>

            {extractionMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280'}}>Haz clic en el diente para marcar/quitar extracción (X roja)</div>
              </div>
            )}
          </div>
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setRemovableMode, !removableMode);
                  setSelectedRemovableTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: removableMode ? '#1f2937' : '#1f2937',
                  backgroundColor: removableMode ? '#1f2937' : 'white',
                  color: removableMode ? 'white' : '#1f2937',
                }}
              >
                🌀 Aparato Removible
              </button>
              {renderFavoriteToggle('removable', 'Aparato Removible')}
            </div>

            <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
              {removableMode && (
                <>
                  <div
                    onClick={() => setRemovableColor('blue')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: removableColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db',
                      backgroundColor: removableColor === 'blue' ? '#eff6ff' : 'white',
                      color: '#3b82f6',
                    }}
                  >
                    Azul
                  </div>
                  <div
                    onClick={() => setRemovableColor('red')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: removableColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db',
                      backgroundColor: removableColor === 'red' ? '#fef2f2' : 'white',
                      color: '#dc2626',
                    }}
                  >
                    Rojo
                  </div>
                </>
              )}
            </div>

            {removableMode && selectedRemovableTeeth.length >= 2 && (
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button
                  onClick={confirmRemovable}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#22c55e',
                    backgroundColor: '#22c55e',
                    color: 'white',
                  }}
                >
                  ✓ Confirmar ({selectedRemovableTeeth.length})
                </button>
                <button
                  onClick={cancelRemovable}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    color: 'white',
                  }}
                >
                  ✕ Cancelar
                </button>
              </div>
            )}
          </div>
          {/* Diastema UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setDiastemaMode, !diastemaMode);
                  setSelectedDiastemaTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: diastemaMode ? '#1f2937' : '#1f2937',
                  backgroundColor: diastemaMode ? '#1f2937' : 'white',
                  color: diastemaMode ? 'white' : '#1f2937',
                }}
              >
                ✖️ Diastema
              </button>
              {renderFavoriteToggle('diastema', 'Diastema')}
            </div>

            {diastemaMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona dos dientes para colocar la X entre ellos</div>
                {selectedDiastemaTeeth.length >= 2 && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmDiastema} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedDiastemaTeeth.length})</button>
                    <button onClick={cancelDiastema} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Edéntulo UI */}

          {/* Supernumeraria UI */}
          <div style={{marginTop: '8px'}}>
            <button
              onClick={() => {
                activateTool(setSupernumerariaMode, !supernumerariaMode);
                setSelectedSuperTeeth([]);
              }}
              style={{
                ...styles.prosthesisButton,
                borderColor: supernumerariaMode ? '#1f2937' : '#1f2937',
                backgroundColor: supernumerariaMode ? '#1f2937' : 'white',
                color: supernumerariaMode ? 'white' : '#1f2937',
              }}
            >
              ⚪ Pieza Supernumeraria
            </button>

            {supernumerariaMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona dos dientes adyacentes para colocar la 'S' entre ellos</div>
                {selectedSuperTeeth.length >= 2 && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmSupernumeraria} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedSuperTeeth.length})</button>
                    <button onClick={cancelSupernumeraria} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Restauración temporal UI */}
          <div style={{marginTop: '8px'}}>
            <button
              onClick={() => {
                activateTool(setRestorationTempMode, !restorationTempMode);
                setSelectedTempAreas({});
              }}
              style={{
                ...styles.prosthesisButton,
                borderColor: restorationTempMode ? '#1f2937' : '#1f2937',
                backgroundColor: restorationTempMode ? '#1f2937' : 'white',
                color: restorationTempMode ? 'white' : '#1f2937',
              }}
            >
              🩺 Restauración Temporal
            </button>

            {restorationTempMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Haz clic en las superficies comprometidas de cada diente (puedes seleccionar varias superficies). Se dibujará un contorno rojo siguiendo la forma.</div>
                {Object.keys(selectedTempAreas).length > 0 && (
                  <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                    <button onClick={confirmTempRestoration} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({Object.values(selectedTempAreas).reduce((s,a)=>s+a.length,0)})</button>
                    <button onClick={cancelTempRestoration} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}

                {/* Controles para eliminar restauraciones persistentes seleccionadas */}
                {Object.keys(selectedTempToDelete).length > 0 && (
                  <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                    <button onClick={confirmDeleteTempRestoration} style={{...styles.prosthesisButton, borderColor: '#b91c1c', backgroundColor: '#ef4444', color: 'white'}}>🗑 Eliminar ({Object.values(selectedTempToDelete).reduce((s,a)=>s+a.length,0)})</button>
                    <button onClick={cancelDeleteTempRestoration} style={{...styles.prosthesisButton, borderColor: '#d1d5db', backgroundColor: 'white', color: '#374151'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
          {/* Transposición dental UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setTranspositionMode, !transpositionMode);
                  setSelectedTranspositionTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: transpositionMode ? '#1f2937' : '#1f2937',
                  backgroundColor: transpositionMode ? '#1f2937' : 'white',
                  color: transpositionMode ? 'white' : '#1f2937',
                }}
              >
                ⇄ Transposición Dentaria
              </button>
              {renderFavoriteToggle('transposition', 'Transposición Dentaria')}
            </div>

            {transpositionMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona dos dientes que presenten transposición (aparecerán dos flechas curvas cruzadas bajo sus números)</div>
                {selectedTranspositionTeeth.length === 2 && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmTransposition} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedTranspositionTeeth.join('-')})</button>
                    <button onClick={cancelTransposition} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Prótesis Dental Completa UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setFullProsthesisMode, fullProsthesisMode === 'superior' ? null : 'superior');
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: fullProsthesisMode === 'superior' ? '#1f2937' : '#1f2937',
                  backgroundColor: fullProsthesisMode === 'superior' ? '#1f2937' : 'white',
                  color: fullProsthesisMode === 'superior' ? 'white' : '#1f2937',
                }}
              >
                ≡ Prótesis Completa Superior
              </button>
              {renderFavoriteToggle('fullProsthesisUpper', 'Prótesis Completa Superior')}
            </div>

            <div style={{...styles.toolButtonRow, marginTop: '8px'}}>
              <button
                onClick={() => {
                  activateTool(setFullProsthesisMode, fullProsthesisMode === 'inferior' ? null : 'inferior');
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: fullProsthesisMode === 'inferior' ? '#1f2937' : '#1f2937',
                  backgroundColor: fullProsthesisMode === 'inferior' ? '#1f2937' : 'white',
                  color: fullProsthesisMode === 'inferior' ? 'white' : '#1f2937',
                }}
              >
                ≡ Prótesis Completa Inferior
              </button>
              {renderFavoriteToggle('fullProsthesisLower', 'Prótesis Completa Inferior')}
            </div>

            {fullProsthesisMode && (
              <div style={{display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center'}}>
                <div style={{fontSize: '13px', color: '#6b7280'}}>Estado:</div>
                <div onClick={() => setFullProsthesisColor('blue')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: fullProsthesisColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: fullProsthesisColor === 'blue' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Buen Estado</div>
                <div onClick={() => setFullProsthesisColor('red')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: fullProsthesisColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db', backgroundColor: fullProsthesisColor === 'red' ? '#fef2f2' : 'white', color: '#dc2626'}}>Mal Estado</div>
              </div>
            )}

            {fullProsthesisMode && (
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button
                  onClick={() => fullProsthesisMode && confirmFullProsthesis(fullProsthesisMode)}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#22c55e',
                    backgroundColor: '#22c55e',
                    color: 'white',
                  }}
                >
                  ✓ Confirmar
                </button>
                <button
                  onClick={cancelFullProsthesis}
                  style={{
                    ...styles.prosthesisButton,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    color: 'white',
                  }}
                >
                  ✕ Cancelar
                </button>
              </div>
            )}
          </div>
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setEdentuloMode, !edentuloMode);
                  setSelectedEdentuloTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: edentuloMode ? '#1f2937' : '#1f2937',
                  backgroundColor: edentuloMode ? '#1f2937' : 'white',
                  color: edentuloMode ? 'white' : '#1f2937',
                }}
              >
                ─ Edéntulo
              </button>
              {renderFavoriteToggle('edentulo', 'Edéntulo')}
            </div>

            {edentuloMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona dos dientes para colocar la línea entre ellos</div>
                {selectedEdentuloTeeth.length > 0 && (
                  <div style={{fontSize: '12px', color: '#1d4ed8', marginBottom: '8px', fontWeight: 600}}>
                    Seleccionados: {selectedEdentuloTeeth.join(' - ')}
                  </div>
                )}
                {selectedEdentuloTeeth.length >= 2 && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmEdentulo} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedEdentuloTeeth.length})</button>
                    <button onClick={cancelEdentulo} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Espigo / Muñón UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setEspigoMode, !espigoMode);
                  setSelectedEspigoTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: espigoMode ? '#1f2937' : '#1f2937',
                  backgroundColor: espigoMode ? '#1f2937' : 'white',
                  color: espigoMode ? 'white' : '#1f2937',
                }}
              >
                ⤉ Espigo / Muñón
              </button>
              {renderFavoriteToggle('espigo', 'Espigo / Muñón')}
            </div>

            {espigoMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para colocar el espigo</div>
                <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                  <div
                    onClick={() => setEspigoColor('blue')}
                    style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: espigoColor === 'blue' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: espigoColor === 'blue' ? '#eff6ff' : 'white', color: '#3b82f6'}}
                  >Azul</div>
                  <div
                    onClick={() => setEspigoColor('red')}
                    style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: espigoColor === 'red' ? '2px solid #dc2626' : '2px solid #d1d5db', backgroundColor: espigoColor === 'red' ? '#fef2f2' : 'white', color: '#dc2626'}}
                  >Rojo</div>
                </div>

                {selectedEspigoTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmEspigo} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedEspigoTooth})</button>
                    <button onClick={cancelEspigo} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Fractura Dental UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setFracturaMode, !fracturaMode);
                  setSelectedFracturaTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: fracturaMode ? '#1f2937' : '#1f2937',
                  backgroundColor: fracturaMode ? '#1f2937' : 'white',
                  color: fracturaMode ? 'white' : '#1f2937',
                }}
              >
                ⚠️ Fractura Dental
              </button>
              {renderFavoriteToggle('fractura', 'Fractura Dental')}
            </div>

            {fracturaMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para marcar la fractura (línea roja + X)</div>
                {selectedFracturaTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmFractura} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedFracturaTooth})</button>
                    <button onClick={cancelFractura} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Fusión UI */}
          <div style={{marginTop: '12px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setFusionMode, !fusionMode);
                  setSelectedFusionTeeth([]);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: fusionMode ? '#1f2937' : '#1f2937',
                  backgroundColor: fusionMode ? '#1f2937' : 'white',
                  color: fusionMode ? 'white' : '#1f2937',
                }}
              >
                ⚪ Fusión
              </button>
              {renderFavoriteToggle('fusion', 'Fusión')}
            </div>

            {fusionMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona dos dientes para marcar fusión (dos circunferencias interceptadas)</div>
                {selectedFusionTeeth.length > 0 && (
                  <div style={{fontSize: '12px', color: '#1d4ed8', marginBottom: '8px', fontWeight: 600}}>
                    Seleccionados: {selectedFusionTeeth.join(' - ')}
                  </div>
                )}
                {selectedFusionTeeth.length >= 2 && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmFusion} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedFusionTeeth.length})</button>
                    <button onClick={cancelFusion} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Geminación UI */}
          <div style={{marginTop: '12px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setGeminacionMode, !geminacionMode);
                  setSelectedGeminTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: geminacionMode ? '#1f2937' : '#1f2937',
                  backgroundColor: geminacionMode ? '#1f2937' : 'white',
                  color: geminacionMode ? 'white' : '#1f2937',
                }}
              >
                ⭕ Geminación
              </button>
              {renderFavoriteToggle('geminacion', 'Geminación')}
            </div>

            {geminacionMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para marcar geminación (una circunferencia)</div>
                {selectedGeminTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmGeminacion} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedGeminTooth})</button>
                    <button onClick={cancelGeminacion} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
                    {/* Giroversión UI (debajo de Geminación en la sección de prótesis) */}
          <div style={{marginTop: '12px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setGiroMode, !giroMode);
                  setSelectedGiroTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: giroMode ? '#1f2937' : '#1f2937',
                  backgroundColor: giroMode ? '#1f2937' : 'white',
                  color: giroMode ? 'white' : '#1f2937',
                }}
              >
                ↻ Giroversión
              </button>
              {renderFavoriteToggle('giroversion', 'Giroversión')}
            </div>

            {giroMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para marcar giroversión (flecha curva debajo del diente)</div>
                <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                  <div onClick={() => setGiroDirection('cw')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: giroDirection === 'cw' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: giroDirection === 'cw' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Horario</div>
                  <div onClick={() => setGiroDirection('ccw')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: giroDirection === 'ccw' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: giroDirection === 'ccw' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Antihorario</div>
                </div>

                {selectedGiroTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmGiroversion} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedGiroTooth})</button>
                    <button onClick={cancelGiroversion} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clavija / Pieza en clavija UI */}
          {/* Pieza en Erupción UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setErupcionMode, !erupcionMode);
                  setSelectedErupcionTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: erupcionMode ? '#1f2937' : '#1f2937',
                  backgroundColor: erupcionMode ? '#1f2937' : 'white',
                  color: erupcionMode ? 'white' : '#1f2937',
                }}
              >
                ↗ Pieza en Erupción
              </button>
              {renderFavoriteToggle('erupcion', 'Pieza en Erupción')}
            </div>

            {erupcionMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para colocar la flecha en erupción (zigzag hacia oclusal)</div>
                {selectedErupcionTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmErupcion} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedErupcionTooth})</button>
                    <button onClick={cancelErupcion} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Pieza Extruida UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setExtruidaMode, !extruidaMode);
                  setSelectedExtruidaTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: extruidaMode ? '#1f2937' : '#1f2937',
                  backgroundColor: extruidaMode ? '#1f2937' : 'white',
                  color: extruidaMode ? 'white' : '#1f2937',
                }}
              >
                ⇧ Pieza Extruida
              </button>
              {renderFavoriteToggle('extruida', 'Pieza Extruida')}
            </div>

            {extruidaMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para colocar la flecha de extrusión (fuera del gráfico)</div>
                {selectedExtruidaTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmExtruida} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedExtruidaTooth})</button>
                    <button onClick={cancelExtruida} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pieza Intrudida UI */}
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setIntrusionMode, !intrusionMode);
                  setSelectedIntrusionTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: intrusionMode ? '#1f2937' : '#1f2937',
                  backgroundColor: intrusionMode ? '#1f2937' : 'white',
                  color: intrusionMode ? 'white' : '#1f2937',
                }}
              >
                ⇩ Pieza Intruida
              </button>
              {renderFavoriteToggle('intrusion', 'Pieza Intruida')}
            </div>

            {intrusionMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente para colocar la flecha de intrusión (fuera del gráfico)</div>
                {selectedIntrusionTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmIntrusion} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedIntrusionTooth})</button>
                    <button onClick={cancelIntrusion} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{marginTop: '8px'}}>
            <div style={styles.toolButtonRow}>
              <button
                onClick={() => {
                  activateTool(setClavijaMode, !clavijaMode);
                  setSelectedClavijaTooth(null);
                }}
                style={{
                  ...styles.prosthesisButton,
                  ...styles.toolButtonGrow,
                  borderColor: clavijaMode ? '#1f2937' : '#1f2937',
                  backgroundColor: clavijaMode ? '#1f2937' : 'white',
                  color: clavijaMode ? 'white' : '#1f2937',
                }}
              >
                ▲ Pieza en Clavija
              </button>
              {renderFavoriteToggle('clavija', 'Pieza en Clavija')}
            </div>

            {clavijaMode && (
              <div style={{marginTop: '8px'}}>
                <div style={{fontSize: '13px', color: '#6b7280', marginBottom: '6px'}}>Selecciona un diente y la posición (encima/debajo de las raíces)</div>
                <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                  <div onClick={() => setClavijaPosition('above')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: clavijaPosition === 'above' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: clavijaPosition === 'above' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Encima</div>
                  <div onClick={() => setClavijaPosition('below')} style={{padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: clavijaPosition === 'below' ? '2px solid #3b82f6' : '2px solid #d1d5db', backgroundColor: clavijaPosition === 'below' ? '#eff6ff' : 'white', color: '#3b82f6'}}>Debajo</div>
                </div>

                {selectedClavijaTooth != null && (
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button onClick={confirmClavija} style={{...styles.prosthesisButton, borderColor: '#22c55e', backgroundColor: '#22c55e', color: 'white'}}>✓ Confirmar ({selectedClavijaTooth})</button>
                    <button onClick={cancelClavija} style={{...styles.prosthesisButton, borderColor: '#ef4444', backgroundColor: '#ef4444', color: 'white'}}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={styles.sidebarSection}>
          <h3 style={styles.sidebarSectionTitle}>Histórico ({filteredHistoricoList.length}/{historicoList.length})</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {/* Histórico de odontogramas */}
            {accountNumber && historicoList.length > 0 && (
              <div style={{marginTop: '12px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px'}}>
                  <label style={{fontSize: '12px', color: '#334155', fontWeight: 600}}>Fecha</label>
                  <input
                    type="date"
                    className="historico-date-input"
                    value={historicoFilterDate}
                    onChange={(e) => setHistoricoFilterDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '2px solid #94a3b8',
                      backgroundColor: 'white',
                      color: '#111827',
                      colorScheme: 'light',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setHistoricoFilterDate('')}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: 'white',
                      color: '#334155',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Mostrar todos
                  </button>
                </div>
                <select
                  value={selectedHistoricoId ? String(selectedHistoricoId) : ''}
                  size={5}
                  onChange={(e) => {
                    const selectedId = Number(e.target.value);
                    if (!selectedId) return;
                    const selectedItem = filteredHistoricoList.find((item) => item.Id === selectedId);
                    if (!selectedItem) return;
                    setSelectedHistoricoId(selectedItem.Id);
                    loadHistoricoOdontograma(selectedItem.Correlativo);
                  }}
                  disabled={loadingHistorico}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '2px solid #94a3b8',
                    backgroundColor: 'white',
                    color: '#111827', // fuerza color de texto para evitar que herede blanco en temas oscuros
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    outline: 'none',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; }}
                >
                  <option value="" disabled style={{ color: '#64748b', background: 'white' }}>
                    Selecciona un histórico...
                  </option>
                  {filteredHistoricoList.map((item) => (
                    <option
                      key={item.Id}
                      value={item.Id}
                      style={{ color: '#111827', background: 'white' }}
                    >
                      {item.Correlativo} - {new Date(item.Fecha_Creacion).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} ({item.VersionCount} versión{item.VersionCount !== 1 ? 'es' : ''})
                    </option>
                  ))}
                </select>
                {filteredHistoricoList.length === 0 && (
                  <div style={{marginTop: '8px', fontSize: '12px', color: '#6b7280'}}>
                    No hay registros para la fecha seleccionada.
                  </div>
                )}
                {loadingHistorico && (
                  <div style={{marginTop: '8px', fontSize: '13px', color: '#6b7280', textAlign: 'center'}}>
                    Cargando histórico...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div style={styles.mainContent} className="odontograma-print-wrapper">
        <div style={styles.container} ref={containerRef}>
        <div style={styles.exportHeader}>
          <div style={styles.exportHospitalTitle}>Hospital regional de cañete - REZOLA</div>
          <div style={styles.exportMeta}>
            <span>{patientName ? `Paciente: ${patientName}` : 'Paciente: —'}</span>
            <span>{`N. Odontograma: ${displayedOdontogramaLabel}`}</span>
          </div>
        </div>
        {/* Overlay layer for diastemas (rendered using real DOM positions so they don't affect layout) */}
        {overlayEnabled && (
          <div style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 50}}>
            {/* Diastemas (X) */}
            {diastemas.map(d => {
              const pos = diastemaPositions[d.id];
              if (!pos) return null;
              const color = d.color === 'blue' ? '#3b82f6' : '#3b82f6';
              return (
                <div
                  key={d.id}
                  title="Eliminar diastema"
                  onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar diastema?', () => deleteDiastema(d.id)); }}
                  style={{
                    position: 'absolute',
                    left: `${pos.left}px`,
                    top: `${pos.top}px`,
                    width: `${pos.size}px`,
                    height: `${pos.size}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  <svg width={pos.size} height={pos.size} viewBox="0 0 24 24">
                    <line x1="3" y1="3" x2="21" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
                    <line x1="21" y1="3" x2="3" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              );
            })}

            {/* Transposiciones dentarias (dos flechas curvas cruzadas entre dos dientes) */}
            {/* PREVIEW: mostrar flechas temporales mientras el usuario selecciona dientes para transposición */}
            {transpositionMode && selectedTranspositionTeeth.length > 0 && (() => {
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!containerRect) return null;
              // Si hay sólo un diente seleccionado, dibujar un marcador sutil sobre él
              if (selectedTranspositionTeeth.length === 1) {
                const t = selectedTranspositionTeeth[0];
                const el = toothRefs.current[t];
                if (!el) return null;
                const r = el.getBoundingClientRect();
                const cx = (r.left + r.right) / 2 - containerRect.left;
                const cy = (r.top + r.bottom) / 2 - containerRect.top;
                const size = Math.max(18, (r.right - r.left) * 0.6);
                return (
                  <div key={`preview-one-${t}`} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 88}}>
                    <svg style={{overflow: 'visible'}}>
                      <circle cx={cx} cy={cy - 10} r={size/2} fill="none" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" opacity={0.95} />
                    </svg>
                  </div>
                );
              }

              // Si hay dos dientes seleccionados, dibujar las dos flechas preview (A <-> B)
              if (selectedTranspositionTeeth.length >= 2) {
                const [a, b] = selectedTranspositionTeeth.slice(0,2);
                const el1 = toothRefs.current[a];
                const el2 = toothRefs.current[b];
                if (!el1 || !el2) return null;
                const r1 = el1.getBoundingClientRect();
                const r2 = el2.getBoundingClientRect();
                const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
                const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
                const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
                const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;

                const left1 = r1.left - containerRect.left;
                const right1 = r1.right - containerRect.left;
                const left2 = r2.left - containerRect.left;
                const right2 = r2.right - containerRect.left;

                const lift = Math.max(8, (r1.bottom - r1.top) * 0.45, (r2.bottom - r2.top) * 0.45);
                const startYA = cy1 - lift;
                const startYB = cy2 - lift;

                const margin = -1;
                const endX_AB = cx2 > cx1 ? left2 - margin : right2 + margin;
                const endX_BA = cx1 < cx2 ? right1 + margin : left1 - margin;

                const color = '#60a5fa';
                const dx = Math.max(14, Math.abs(cx2 - cx1) * 0.28);
                const dy = Math.max(20, Math.abs(cx2 - cx1) * 0.18 + 12);

                const pathA = `M ${cx1} ${startYA} C ${cx1 + dx} ${startYA - dy}, ${endX_AB - dx} ${startYB - dy}, ${endX_AB} ${startYB}`;
                const pathB = `M ${cx2} ${startYB} C ${cx2 - dx} ${startYB - dy}, ${endX_BA + dx} ${startYA - dy}, ${endX_BA} ${startYA}`;

                return (
                  <div key={`preview-trans-${a}-${b}`} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 88}}>
                    <svg style={{overflow: 'visible'}}>
                      <defs>
                        <marker id={`preview-arrow-a`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                          <path d="M0,0 L5,3 L0,6 L1.5,3 z" fill={color} opacity={0.95} />
                        </marker>
                        <marker id={`preview-arrow-b`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                          <path d="M0,0 L5,3 L0,6 L1.5,3 z" fill={color} opacity={0.95} />
                        </marker>
                      </defs>
                      <path d={pathA} stroke={color} strokeWidth={2} fill="none" strokeDasharray="6 6" opacity={0.95} markerEnd={`url(#preview-arrow-a)`} strokeLinecap="round" strokeLinejoin="round" />
                      <path d={pathB} stroke={color} strokeWidth={2} fill="none" strokeDasharray="6 6" opacity={0.95} markerEnd={`url(#preview-arrow-b)`} strokeLinecap="round" strokeLinejoin="round" />
                      {/* small circles on tooth centers to emphasize selection */}
                      <circle cx={cx1} cy={cy1} r={6} fill={color} opacity={0.9} />
                      <circle cx={cx2} cy={cy2} r={6} fill={color} opacity={0.9} />
                    </svg>
                  </div>
                );
              }

              return null;
            })()}
            {transpositions.map(t => {
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!containerRect) return null;
              const [a, b] = t.teeth;
              const el1 = toothRefs.current[a];
              const el2 = toothRefs.current[b];
              if (!el1 || !el2) return null;
              const r1 = el1.getBoundingClientRect();
              const r2 = el2.getBoundingClientRect();
              const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
              const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
              // We'll draw two arrows that start at the center of each tooth and end at the
              // horizontal edge (mesial/distal) of the opposite tooth. This makes each arrow
              // visually originate in the middle of its tooth and terminate at the other's edge.
              // Lift arrows above the teeth and lengthen endpoints so the arrowheads are visible
              const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
              const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
              const left1 = r1.left - containerRect.left;
              const right1 = r1.right - containerRect.left;
              const left2 = r2.left - containerRect.left;
              const right2 = r2.right - containerRect.left;

              // reduce lift so arrows sit closer above the tooth crowns (not too high)
              const lift = Math.max(10, (r1.bottom - r1.top) * 0.5, (r2.bottom - r2.top) * 0.5);
              const startYA = cy1 - lift; // start Y above A
              const startYB = cy2 - lift; // start Y above B

              const margin = -1; // increase margin to lengthen arrows beyond tooth edge

              // Determine end X positions at the edge of the target tooth (near edge, with margin)
              const endX_AB = cx2 > cx1 ? left2 - margin : right2 + margin; // A -> B ends at B's near edge
              const endX_BA = cx1 < cx2 ? right1 + margin : left1 - margin; // B -> A ends at A's near edge

              const color = '#3b82f6';

              // control offsets scaled with horizontal distance (longer distance => larger arc)
              const dx = Math.max(16, Math.abs(cx2 - cx1) * 0.30);
              const dy = Math.max(28, Math.abs(cx2 - cx1) * 0.20 + 14);

              // Arrow A -> B: start at center-top of A (cx1, startYA) and end at edge of B (endX_AB, startYB)
              const pathA = `M ${cx1} ${startYA} C ${cx1 + dx} ${startYA - dy}, ${endX_AB - dx} ${startYB - dy}, ${endX_AB} ${startYB}`;

              // Arrow B -> A: start at center-top of B (cx2, startYB) and end at edge of A (endX_BA, startYA)
              const pathB = `M ${cx2} ${startYB} C ${cx2 - dx} ${startYB - dy}, ${endX_BA + dx} ${startYA - dy}, ${endX_BA} ${startYA}`;

              return (
                <div key={t.id} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'auto', zIndex: 90}}>
                  <svg style={{overflow: 'visible'}}>
                    <defs>
                      <marker id={`arrow-head-a-${t.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L6,4 L0,8 L2,4 z" fill={color} />
                      </marker>
                      <marker id={`arrow-head-b-${t.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L6,4 L0,8 L2,4 z" fill={color} />
                      </marker>
                    </defs>
                    {/* Arrow from A -> B */}
                    <path d={pathA} stroke={color} strokeWidth={2.2} fill="none" markerEnd={`url(#arrow-head-a-${t.id})`} strokeLinecap="round" strokeLinejoin="round" onClick={(ev)=>{ ev.stopPropagation(); showConfirm('¿Eliminar transposición?', () => deleteTransposition(t.id)); }} />
                    {/* Arrow from B -> A */}
                    <path d={pathB} stroke={color} strokeWidth={2.2} fill="none" markerEnd={`url(#arrow-head-b-${t.id})`} strokeLinecap="round" strokeLinejoin="round" onClick={(ev)=>{ ev.stopPropagation(); showConfirm('¿Eliminar transposición?', () => deleteTransposition(t.id)); }} />
                  </svg>
                </div>
              );
            })}

              {/* Supernumerarias (círculo con S entre dos dientes) */}
              {supernumerarias.map(s => {
                const pos = supernumerariaPositions[s.id];
                if (!pos) return null;
                const color = s.color === 'blue' ? '#3b82f6' : '#3b82f6';
                return (
                  <div
                    key={s.id}
                    title="Eliminar supernumeraria"
                    onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar pieza supernumeraria?', () => deleteSupernumeraria(s.id)); }}
                    style={{
                      position: 'absolute',
                      left: `${pos.left}px`,
                      top: `${pos.top}px`,
                      width: `${pos.size}px`,
                      height: `${pos.size}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                    }}
                  >
                    <svg width={pos.size} height={pos.size} viewBox={`0 0 ${pos.size} ${pos.size}`}>
                      <circle cx={pos.size/2} cy={pos.size/2} r={Math.max(10, pos.size/2 - 2)} fill="white" stroke={color} strokeWidth={3} />
                      <text x="50%" y="54%" textAnchor="middle" fontSize={Math.max(10, pos.size/2)} fontWeight="700" fill={color} style={{dominantBaseline: 'middle'}}>
                        S
                      </text>
                    </svg>
                  </div>
                );
              })}

            {/* Edéntulos (líneas horizontales que pasan por el medio de los dientes) */}
            {edentulos.map(e => {
              const pos = edentuloPositions[e.id];
              if (!pos) return null;
              const color = '#3b82f6';
              return (
                <div
                  key={e.id}
                  title="Eliminar edéntulo"
                  onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar edéntulo?', () => deleteEdentulo(e.id)); }}
                  style={{
                    position: 'absolute',
                    left: `${pos.left}px`,
                    top: `${pos.top - 2}px`,
                    width: `${pos.width}px`,
                    height: '4px',
                    backgroundColor: color,
                    borderRadius: '2px',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                  }}
                />
              );
            })}

            {/* Prótesis completa (dos líneas paralelas por arcada) */}
            {fullProstheses.map(p => {
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!containerRect) return null;
              const teeth = Object.keys(toothRefs.current).map(k => {
                const id = parseInt(k, 10);
                const el = toothRefs.current[id];
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { id, cx: (r.left + r.right) / 2 - containerRect.left, cy: (r.top + r.bottom) / 2 - containerRect.top };
              }).filter(Boolean) as Array<{id:number,cx:number,cy:number}>;

              // Determine arch teeth by quadrant ids so the computation stays stable
              // even if container height changes (e.g., when adding codes or opening modals).
              const upperIds = [...cuadrante1, ...cuadrante2, ...cuadrante5, ...cuadrante6];
              const lowerIds = [...cuadrante3, ...cuadrante4, ...cuadrante7, ...cuadrante8];
              let archTeeth = teeth.filter(t => p.arch === 'superior' ? upperIds.includes(t.id) : lowerIds.includes(t.id));
              // Fallback: if no teeth found (edge cases), fall back to using vertical midpoint
              if (archTeeth.length === 0) {
                archTeeth = teeth.filter(t => p.arch === 'superior' ? t.cy < containerRect.height / 2 : t.cy >= containerRect.height / 2);
              }
              if (archTeeth.length === 0) return null;
              const minX = Math.min(...archTeeth.map(t => t.cx));
              const maxX = Math.max(...archTeeth.map(t => t.cx));
              const midY = archTeeth.reduce((s, t) => s + t.cy, 0) / archTeeth.length;
              const color = p.color === 'red' ? '#dc2626' : '#3b82f6';
              const gap = 4; // reducir para que las dos líneas queden más pegadas

              return (
                <React.Fragment key={p.id}>
                  <div
                    title="Eliminar prótesis completa"
                    onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar prótesis completa?', () => deleteFullProsthesis(p.id)); }}
                    style={{
                      position: 'absolute',
                      left: `${minX}px`,
                      top: `${midY - gap}px`,
                      width: `${Math.max(8, maxX - minX)}px`,
                      height: '4px',
                      backgroundColor: color,
                      borderRadius: '2px',
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                    }}
                  />
                  <div
                    title="Eliminar prótesis completa"
                    onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar prótesis completa?', () => deleteFullProsthesis(p.id)); }}
                    style={{
                      position: 'absolute',
                      left: `${minX}px`,
                      top: `${midY + gap}px`,
                      width: `${Math.max(8, maxX - minX)}px`,
                      height: '4px',
                      backgroundColor: color,
                      borderRadius: '2px',
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                    }}
                  />
                </React.Fragment>
              );
            })}

            {/* Prótesis parcial removible: render entre diente inicial y final (dos líneas paralelas) */}
            {partialRemovables.map(p => {
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!containerRect) return null;
              const start = Math.min(p.teeth[0], p.teeth[1]);
              const end = Math.max(p.teeth[0], p.teeth[1]);
              const elStart = toothRefs.current[start];
              const elEnd = toothRefs.current[end];
              if (!elStart || !elEnd) return null;
              const r1 = elStart.getBoundingClientRect();
              const r2 = elEnd.getBoundingClientRect();
              const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
              const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
              // colocar las líneas sobre la corona (parte superior del cuadro del diente)
              // colocar las líneas un poco por encima de la corona (levantar)
              const raiseBy = -30; // mover hacia arriba en px
              const y1 = r1.top - containerRect.top + Math.max(12, (r1.bottom - r1.top) * 0.28) + raiseBy;
              const y2 = r2.top - containerRect.top + Math.max(12, (r2.bottom - r2.top) * 0.28) + raiseBy;
              const left = Math.min(cx1, cx2);
              const width = Math.max(8, Math.abs(cx2 - cx1));
              const midY = (y1 + y2) / 2;
              const color = p.color === 'red' ? '#dc2626' : '#3b82f6';
              const gap = 3; // líneas más juntas

              return (
                <React.Fragment key={p.id}>
                  <div
                    title="Eliminar prótesis parcial removible"
                    onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar prótesis parcial removible?', () => deletePartialRemovable(p.id)); }}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: `${midY - gap}px`,
                      width: `${width}px`,
                      height: '2px',
                      backgroundColor: color,
                      borderRadius: '1px',
                      pointerEvents: 'auto',
                      zIndex: 30,
                      cursor: 'pointer',
                    }}
                  />
                  <div
                    title="Eliminar prótesis parcial removible"
                    onClick={(ev) => { ev.stopPropagation(); showConfirm('¿Eliminar prótesis parcial removible?', () => deletePartialRemovable(p.id)); }}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: `${midY + gap}px`,
                      width: `${width}px`,
                      height: '2px',
                      backgroundColor: color,
                      borderRadius: '1px',
                      pointerEvents: 'auto',
                      zIndex: 30,
                      cursor: 'pointer',
                    }}
                  />
                </React.Fragment>
              );
            })}

            {/* Preview while selecting partial removable: when one tooth is selected and the user hovers another */}
            {partialRemovableMode && selectedPartialRemovableTeeth.length === 1 && hoverTooth != null && (() => {
              const start = selectedPartialRemovableTeeth[0];
              const end = hoverTooth;
              if (start === end) return null;
              const elStart = toothRefs.current[start];
              const elEnd = toothRefs.current[end];
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!elStart || !elEnd || !containerRect) return null;
              const r1 = elStart.getBoundingClientRect();
              const r2 = elEnd.getBoundingClientRect();
              const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
              const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
              const raiseBy = -10;
              const y1 = r1.top - containerRect.top + Math.max(12, (r1.bottom - r1.top) * 0.28) + raiseBy;
              const y2 = r2.top - containerRect.top + Math.max(12, (r2.bottom - r2.top) * 0.28) + raiseBy;
              const left = Math.min(cx1, cx2);
              const width = Math.max(8, Math.abs(cx2 - cx1));
              const midY = (y1 + y2) / 2;
              const previewColor = partialRemovableColor === 'red' ? 'rgba(220,38,38,0.35)' : 'rgba(59,130,246,0.35)';
              const gap = 3;

              return (
                <React.Fragment>
                  <div style={{position: 'absolute', left: `${left}px`, top: `${midY - gap}px`, width: `${width}px`, height: '2px', backgroundColor: previewColor, borderRadius: '1px', pointerEvents: 'none', zIndex: 29}} />
                  <div style={{position: 'absolute', left: `${left}px`, top: `${midY + gap}px`, width: `${width}px`, height: '2px', backgroundColor: previewColor, borderRadius: '1px', pointerEvents: 'none', zIndex: 29}} />
                </React.Fragment>
              );
            })()}

            {/* Preview temporal de edéntulo cuando se seleccionan dos dientes */}
            {edentuloMode && selectedEdentuloTeeth.length === 2 && (() => {
              const [t1, t2] = selectedEdentuloTeeth;
              const el1 = toothRefs.current[t1];
              const el2 = toothRefs.current[t2];
              if (!el1 || !el2) return null;
              const r1 = el1.getBoundingClientRect();
              const r2 = el2.getBoundingClientRect();
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!containerRect) return null;
              const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
              const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
              const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
              const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
              const left = Math.min(cx1, cx2);
              const width = Math.abs(cx2 - cx1);
              const midY = (cy1 + cy2) / 2;
              return (
                <div style={{position: 'absolute', left: `${left}px`, top: `${midY - 2}px`, width: `${width}px`, height: '4px', backgroundColor: '#bfdbfe', borderRadius: '2px', pointerEvents: 'none'}} />
              );
            })()}
            {/* Marcadores guía temporales para edéntulo: cuadros sobre los dientes que quedan entre los extremos seleccionados */}
            {edentuloMode && selectedEdentuloTeeth.length === 2 && (() => {
              const [t1, t2] = selectedEdentuloTeeth;
              const el1 = toothRefs.current[t1];
              const el2 = toothRefs.current[t2];
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!el1 || !el2 || !containerRect) return null;
              const r1 = el1.getBoundingClientRect();
              const r2 = el2.getBoundingClientRect();
              const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
              const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
              const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
              const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
              const minX = Math.min(cx1, cx2);
              const maxX = Math.max(cx1, cx2);
              const midY = (cy1 + cy2) / 2;
              const markers: React.ReactNode[] = [];
              Object.keys(toothRefs.current).forEach(k => {
                const id = parseInt(k, 10);
                const el = toothRefs.current[id];
                if (!el) return;
                const r = el.getBoundingClientRect();
                const cx = (r.left + r.right) / 2 - containerRect.left;
                const cy = (r.top + r.bottom) / 2 - containerRect.top;
                // marcar si el centro horizontal está entre los extremos y la vertical está cerca (misma fila)
                if (cx >= minX - 2 && cx <= maxX + 2 && Math.abs(cy - midY) < 20) {
                  const size = 16;
                  const leftPos = cx - size / 2;
                  markers.push(
                    <div key={`ed-guide-${id}`} style={{position: 'absolute', left: `${leftPos}px`, top: `${cy - size/2}px`, width: `${size}px`, height: `${size}px`, zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
                      <div style={{width: '100%', height: '100%', border: '2px dashed #bfdbfe', backgroundColor: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <line x1="2" y1="2" x2="10" y2="10" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
                          <line x1="10" y1="2" x2="2" y2="10" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  );
                }
              });

              return <>{markers}</>;
            })()}

            {/* Preview temporal de Supernumeraria (círculo con S entre dos dientes) */}
            {supernumerariaMode && selectedSuperTeeth.length === 2 && (() => {
              const [t1, t2] = selectedSuperTeeth;
              const el1 = toothRefs.current[t1];
              const el2 = toothRefs.current[t2];
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!el1 || !el2 || !containerRect) return null;
              const r1 = el1.getBoundingClientRect();
              const r2 = el2.getBoundingClientRect();
              const cx1 = (r1.left + r1.right) / 2 - containerRect.left;
              const cx2 = (r2.left + r2.right) / 2 - containerRect.left;
              const cy1 = (r1.top + r1.bottom) / 2 - containerRect.top;
              const cy2 = (r2.top + r2.bottom) / 2 - containerRect.top;
              const midX = (cx1 + cx2) / 2;
              const midY = (cy1 + cy2) / 2;
              const size = Math.max(18, Math.min(64, Math.abs(cx2 - cx1) * 0.7));
              const left = midX - size / 2;
              const top = midY - size / 2;
              return (
                <div style={{position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={size/2} cy={size/2} r={Math.max(8, size/2 - 2)} fill="white" stroke="#bfdbfe" strokeWidth={2} strokeDasharray="4 3" />
                    <text x="50%" y="54%" textAnchor="middle" fontSize={Math.max(10, size/2)} fontWeight="700" fill="#3b82f6" style={{dominantBaseline: 'middle'}}>
                      S
                    </text>
                  </svg>
                </div>
              );
            })()}
          </div>
        )}
  
      {/*
        {prosthesisMode && (
          <div style={{
            padding: '12px',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: '500',
            color: '#1e40af',
          }}>
            🦷 Modo: {prosthesisMode === 'fija' ? 'Prótesis Fija' : 'Prótesis Removible'} - 
            Selecciona los dientes haciendo clic ({selectedTeeth.length} seleccionados)
          </div>
        )} */} 

        <div style={styles.odontogramaSection}>
          <div style={styles.quadrantContainer}>
            <CodeBoxes teeth={cuadrante1} />
            <div style={{width: '32px'}}></div>
            <CodeBoxes teeth={cuadrante2} />
          </div>
          
          <div style={{...styles.quadrantContainer, marginTop: '8px'}}>
            <CodeBoxes teeth={cuadrante5} />
            <div style={{width: '32px'}}></div>
            <CodeBoxes teeth={cuadrante6} />
          </div>
          
          <div style={{...styles.horizontalLine, margin: '16px auto', width: '80%'}}></div>
          
          <div style={styles.quadrantContainer}>
            <CodeBoxes teeth={cuadrante7} />
            <div style={{width: '32px'}}></div>
            <CodeBoxes teeth={cuadrante8} />
          </div>
          
          <div style={{...styles.quadrantContainer, marginTop: '8px'}}>
            <CodeBoxes teeth={cuadrante3} />
            <div style={{width: '32px'}}></div>
            <CodeBoxes teeth={cuadrante4} />
          </div>
        </div>

        <div style={styles.odontogramaSection}>
          <div style={styles.quadrantContainer}>
            <div>
              <ToothRow teeth={cuadrante1} label="Derecha" />
            </div>
            <div style={styles.separator}></div>
            <div>
              <ToothRow teeth={cuadrante2} label="Izquierda" />
            </div>
          </div>
        </div>

        <div style={styles.odontogramaSection}>
          <div style={styles.quadrantContainer}>
            <div>
              <ToothRow teeth={cuadrante5} />
            </div>
            <div style={styles.separator}></div>
            <div>
              <ToothRow teeth={cuadrante6} />
            </div>
          </div>
        </div>

        <div style={styles.horizontalLine}></div>

        <div style={styles.odontogramaSection}>
          <div style={styles.quadrantContainer}>
            <div>
              <ToothRow teeth={cuadrante7} />
            </div>
            <div style={styles.separator}></div>
            <div>
              <ToothRow teeth={cuadrante8} />
            </div>
          </div>
        </div>

        <div style={styles.odontogramaSection}>
          <div style={styles.quadrantContainer}>
            <div>
              <ToothRow teeth={cuadrante3} />
            </div>
            <div style={styles.separator}></div>
            <div>
              <ToothRow teeth={cuadrante4} />
            </div>
          </div>
        </div>

        {/* Bloque fijo de Observaciones */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px 14px',
          margin: '0 0 16px 0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          <label style={{
            display: 'block',
            fontSize: '16px',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '8px'
          }}>Observaciones <span style={{fontWeight:400,color:'#6b7280',fontSize:'14px'}}>(máx 500 palabras)</span></label>
          <textarea
            value={observaciones}
            onChange={handleObservacionesChange}
            style={{
              width: '100%',
              minHeight: '80px',
              resize: 'none',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '16px',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              outline: 'none',
              background: 'white',
              color: '#111827'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            placeholder="Ingrese observaciones clínicas relevantes..."
          />
          <div style={{
            marginTop: '6px',
            fontSize: '12px',
            color: observacionesWordCount > 500 ? '#dc2626' : '#6b7280',
            textAlign: 'right'
          }}>{observacionesWordCount} / 500 palabras</div>
        </div>

        <div className="odontograma-summary" style={styles.summaryContainer}>
          <h3 style={styles.summaryTitle}>Resumen:</h3>
          <div style={styles.summaryContent}>
            {Object.keys(teethStatus).filter(k => !k.includes('-color') && !k.includes('-apply-color')).length === 0 && prostheses.length === 0 && crowns.length === 0 && appliances.length === 0 && removableAppliances.length === 0 && Object.keys(teethCodes).length === 0 ? (
              <p>No hay áreas marcadas</p>
            ) : (
              <>
                <div style={styles.summaryStatsRow}>
                  <div style={styles.summaryStatCard}>
                    <div style={styles.summaryStatValue}>{Object.keys(teethStatus).filter(k => !k.includes('-color') && !k.includes('-apply-color')).length}</div>
                    <div style={styles.summaryStatLabel}>Áreas marcadas</div>
                  </div>
                  <div style={styles.summaryStatCard}>
                    <div style={styles.summaryStatValue}>{crowns.length}</div>
                    <div style={styles.summaryStatLabel}>Coronas</div>
                  </div>
                  <div style={styles.summaryStatCard}>
                    <div style={styles.summaryStatValue}>{appliances.length}</div>
                    <div style={styles.summaryStatLabel}>Aparatos fijos</div>
                  </div>
                  <div style={styles.summaryStatCard}>
                    <div style={styles.summaryStatValue}>{removableAppliances.length}</div>
                    <div style={styles.summaryStatLabel}>Aparatos removibles</div>
                  </div>
                  <div style={styles.summaryStatCard}>
                    <div style={styles.summaryStatValue}>{diastemas.length}</div>
                    <div style={styles.summaryStatLabel}>Diastemas</div>
                  </div>
                  <div style={styles.summaryStatCard}>
                    <div style={styles.summaryStatValue}>{Object.keys(teethCodes).length}</div>
                    <div style={styles.summaryStatLabel}>Códigos</div>
                  </div>
                </div>

                {/* Coronas detalladas */}
                {crowns.length > 0 && (
                  <div style={{marginTop: '8px'}}>
                    <div style={{fontWeight: 700, marginBottom: '6px'}}>Coronas</div>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      {crowns.map(c => (
                        <div key={`crown-${c.tooth}`} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#fff', borderRadius: '8px'}}>
                          <div style={{width: '12px', height: '12px', borderRadius: '2px', backgroundColor: c.color === 'red' ? '#dc2626' : '#3b82f6'}} />
                          <div>Diente {c.tooth}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Aparatos detallados */}
                {appliances.length > 0 && (
                  <div style={{marginTop: '8px'}}>
                    <div style={{fontWeight: 700, marginBottom: '6px'}}>Aparatos Fijos</div>
                    {appliances.map(a => (
                      <div key={a.id} style={{padding: '6px 8px', background: '#fff', borderRadius: '8px', marginBottom: '6px'}}>
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                          <div style={{width: '12px', height: '12px', backgroundColor: a.color === 'red' ? '#dc2626' : '#3b82f6', borderRadius: '2px'}} />
                          <div>{a.teeth.join(' — ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {removableAppliances.length > 0 && (
                  <div style={{marginTop: '8px'}}>
                    <div style={{fontWeight: 700, marginBottom: '6px'}}>Aparatos Removibles</div>
                    {removableAppliances.map(r => (
                      <div key={r.id} style={{padding: '6px 8px', background: '#fff', borderRadius: '8px', marginBottom: '6px'}}>
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                          <div style={{width: '12px', height: '12px', backgroundColor: r.color === 'red' ? '#dc2626' : '#3b82f6', borderRadius: '2px'}} />
                          <div>{r.teeth.join(' — ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Códigos por diente */}
                {Object.keys(teethCodes).length > 0 && (
                  <div style={{marginTop: '8px'}}>
                    <div style={{fontWeight: 700, marginBottom: '6px'}}>Códigos</div>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      {Object.entries(teethCodes).map(([tooth, c]) => (
                        <div key={`code-${tooth}`} style={{padding: '6px 8px', background: '#fff', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center'}}>
                          <div style={{width: '12px', height: '12px', backgroundColor: c.color === 'red' ? '#dc2626' : '#3b82f6', borderRadius: '2px'}} />
                          <div>Diente {tooth}: {c.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Áreas marcadas (detallado) */}
                {Object.entries(teethStatus).filter(([key]) => !key.includes('-color') && !key.includes('-apply-color')).length > 0 && (
                  <div style={{marginTop: '12px'}}>
                    <div style={{fontWeight: 700, marginBottom: '6px'}}>Áreas marcadas</div>
                    <div style={styles.summaryGrid}>
                      {Object.entries(teethStatus).filter(([key]) => !key.includes('-color') && !key.includes('-apply-color')).map(([key, status]) => {
                        const [tooth, area] = key.split('-');
                        return (
                          <div key={key} style={styles.summaryItem}>
                            <span style={{
                              ...styles.summaryColorBox,
                              backgroundColor: status ? statusColors[status] : 'white',
                            }}></span>
                            <span>Diente {tooth} - {area}: {status ? statusLabels[status] : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {modal.isOpen && (
          <div style={styles.modalOverlay} onClick={handleModalCancel}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={styles.modalTitle}>
                  {modal.isEditing ? 'Editar' : 'Nuevo'} - Diente {modal.toothNumber}
                </div>
                <div style={styles.modalSubtitle}>
                  {modal.area} • {statusLabels[selectedStatus]}
                </div>
              </div>
              
              <div style={styles.modalBody}>
                <div style={styles.modalSection}>
                  <label style={styles.modalLabel}>Buscar código:</label>
                  <div style={styles.suggestionsContainer}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowCodeSuggestions(e.target.value.length > 0);
                      }}
                      placeholder="Buscar por código, descripción o categoría..."
                      style={styles.searchInput}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        if (searchQuery.length > 0) setShowCodeSuggestions(true);
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        setTimeout(() => setShowCodeSuggestions(false), 200);
                      }}
                    />
                    {showCodeSuggestions && filteredCodes.length > 0 && (
                      <div style={styles.suggestionsList}>
                        {filteredCodes.map((item) => (
                          <div
                            key={item.code}
                            onClick={() => handleCodeSelect(item.code, item.description)}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                            style={styles.suggestionItem}
                          >
                            <div style={styles.suggestionCode}>{item.code}</div>
                            <div style={styles.suggestionDescription}>{item.description}</div>
                            <div style={styles.suggestionCategory}>{item.category}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.modalSection}>
                  <label style={styles.modalLabel}>Código seleccionado:</label>
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código"
                    maxLength={6}
                    style={styles.modalInput}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleModalConfirm();
                      if (e.key === 'Escape') handleModalCancel();
                    }}
                  />
                  {codeInput.trim() && selectedCodeDesc && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                      Descripción: {selectedCodeDesc}
                    </div>
                  )}
                </div>

                <div style={styles.modalSection}>
                  <label style={styles.modalLabel}>Color del Código:</label>
                  <div style={styles.colorOptions}>
                    <div
                      onClick={() => setCodeColor('blue')}
                      style={{
                        ...styles.colorOption,
                        borderColor: codeColor === 'blue' ? '#eff6ff' : '#d1d5db',
                        backgroundColor: codeColor === 'blue' ? '#eff6ff' : 'white',
                        color: '#3b82f6',
                      }}
                    >
                      Azul
                    </div>
                    <div
                      onClick={() => setCodeColor('red')}
                      style={{
                        ...styles.colorOption,
                        borderColor: codeColor === 'red' ? '#dc2626' : '#d1d5db',
                        backgroundColor: codeColor === 'red' ? '#fef2f2' : 'white',
                        color: '#dc2626',
                      }}
                    >
                      Rojo
                    </div>
                  </div>
                </div>

                {(selectedStatus === 'caries' || selectedStatus === 'obturado') && (
                  <>
                    <div style={styles.modalSection}>
                      <label style={styles.modalLabel}>¿Aplicar color al área?</label>
                      <div style={styles.colorOptions}>
                        <div
                          onClick={() => setApplyAreaColor(true)}
                          style={{
                            ...styles.colorOption,
                            borderColor: applyAreaColor ? '#3b82f6' : '#d1d5db',
                            backgroundColor: applyAreaColor ? '#eff6ff' : 'white',
                            color: '#1f2937',
                          }}
                        >
                          ✓ Con color
                        </div>
                        <div
                          onClick={() => setApplyAreaColor(false)}
                          style={{
                            ...styles.colorOption,
                            borderColor: !applyAreaColor ? '#3b82f6' : '#d1d5db',
                            backgroundColor: !applyAreaColor ? '#eff6ff' : 'white',
                            color: '#1f2937',
                          }}
                        >
                          Sin color
                        </div>
                      </div>
                    </div>

                    {applyAreaColor && (
                      <div style={styles.modalSection}>
                        <label style={styles.modalLabel}>Color del Área:</label>
                        <div style={styles.colorOptions}>
                          <div
                            onClick={() => setAreaColor('blue')}
                            style={{
                              ...styles.colorOption,
                              borderColor: areaColor === 'blue' ? '#3b82f6' : '#d1d5db',
                              backgroundColor: areaColor === 'blue' ? '#eff6ff' : 'white',
                              color: '#3b82f6',
                            }}
                          >
                            Azul
                          </div>
                          <div
                            onClick={() => setAreaColor('red')}
                            style={{
                              ...styles.colorOption,
                              borderColor: areaColor === 'red' ? '#dc2626' : '#d1d5db',
                              backgroundColor: areaColor === 'red' ? '#fef2f2' : 'white',
                              color: '#dc2626',
                            }}
                          >
                            Rojo
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div style={styles.modalButtons}>
                <button
                  onClick={handleModalCancel}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d1d5db')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
                  style={{...styles.modalButton, ...styles.modalButtonCancel}}
                >
                  Cancelar
                </button>
                {modal.isEditing && (
                  <button
                    onClick={handleModalDelete}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
                    style={{...styles.modalButton, ...styles.modalButtonDelete}}
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={handleModalConfirm}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                  style={{...styles.modalButton, ...styles.modalButtonConfirm}}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación personalizado */}
        {confirmModal.isOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '20px',
              }}>
                <div style={{
                  flexShrink: 0,
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: confirmModal.isDanger ? '#fee2e2' : '#d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px',
                }}>
                  {confirmModal.isDanger ? (
                    <svg style={{ width: '24px', height: '24px', color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M8 6V4h8v2m1 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V6h10z" />
                    </svg>
                  ) : (
                    <svg style={{ width: '24px', height: '24px', color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '8px',
                  }}>
                    {confirmModal.title || 'Confirmar Acción'}
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    lineHeight: '1.5',
                  }}>
                    {confirmModal.message}
                  </p>
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={handleConfirmNo}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmYes}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: confirmModal.isDanger ? '#dc2626' : '#10b981',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = confirmModal.isDanger ? '#b91c1c' : '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = confirmModal.isDanger ? '#dc2626' : '#10b981';
                  }}
                >
                  {confirmModal.confirmLabel || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
      </div>
    </>
  );
};

export default Odontograma;