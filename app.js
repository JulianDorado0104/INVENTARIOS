// App Inventarios — JS básico (login + tabs + selects + preview imagen)
(function(){
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const g = id => document.getElementById(id);
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');

  // Usuarios (hash SHA-256 de PIN; no se guardan PINs en claro)
  const USERS_KEY = 'users_v1';
  const DEFAULT_USERS = [
    { name:'operador', rol:'Operador', pinHash:'0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c' }, // 1111
    { name:'lider', rol:'Admin', pinHash:'edee29f882543b956620b26d0ee0e7e950399b1c4222f5de05e06425b4c995e9' }  // 2222
  ];
  const hex = buf => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  async function sha256Hex(str){
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return hex(digest);
  }
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY)||'[]') }catch{ return [] } }
  function setUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }
  function ensureUsers(){ if(!getUsers().length){ setUsers(DEFAULT_USERS); } }

  const CATALOGOS = {
    ubicaciones: ['CALLE 127','CALLE 120','FONTIBON','BARRANCABERMEJA','PUERTO SALGAR','SANTA MARTA','PUERTO BERRIO','BUENAVENTURA'],
    lineas: ['LABORATORIO','INSPECCION','METROLOGIA','INGENIERIA'],
    clases: ['ACTIVO FIJO','MUEBLES Y ENSERES','EQUIPO AL GASTO','ENTRE OTROS'],
  };
  const CATALOGOS_KEY = 'catalogos_v1';
  function getCatalogos(){
    try{ const v = JSON.parse(localStorage.getItem(CATALOGOS_KEY)||'null'); if(v && v.ubicaciones && v.lineas){ if(!Array.isArray(v.clases)) v.clases = CATALOGOS.clases.slice(); return v; } }catch{}
    return CATALOGOS; // fallback
  }
  function setCatalogos(obj){ localStorage.setItem(CATALOGOS_KEY, JSON.stringify(obj)); }
  function ensureCatalogos(){ const v = getCatalogos(); if(!v || !Array.isArray(v.ubicaciones) || !Array.isArray(v.lineas)) setCatalogos(CATALOGOS); else if(!Array.isArray(v.clases)){ v.clases = CATALOGOS.clases.slice(); setCatalogos(v); } }

  let state = {
    user: null,
    activeTab: localStorage.getItem('activeTab') || 'inventario',
  };

  function renderUserBox(){
    const box = g('userBox');
    if(!state.user){ box.innerHTML = ''; return; }
    box.innerHTML = `Sesión: <b>${state.user.name}</b> <span class="badge">${state.user.rol}</span> <button class="btn ghost" id="btnLogout">Salir</button>`;
    $('#btnLogout')?.addEventListener('click', () => {
      state.user = null; localStorage.removeItem('sessionUser');
      hide(g('appView')); show(g('loginView'));
      resetLoginForm();
      renderUserBox();
      g('lg_user').focus();
    });
    updateAdminVisibility?.();
  }

  function resetLoginForm(){
    if(g('lg_user')) g('lg_user').value = '';
    if(g('lg_pin')) g('lg_pin').value = '';
    if(g('lg_msg')) g('lg_msg').textContent = '';
  }

  async function login(){
    const u = g('lg_user').value.trim();
    const p = g('lg_pin').value.trim();
    const users = getUsers();
    const rec = users.find(x => x.name === u);
    if(!rec){ g('lg_msg').textContent = 'Usuario o PIN incorrectos'; return; }
    const h = await sha256Hex(p);
    if(h !== rec.pinHash){ g('lg_msg').textContent = 'Usuario o PIN incorrectos'; return; }
    state.user = { name: u, rol: rec.rol };
    localStorage.setItem('sessionUser', JSON.stringify(state.user));
    hide(g('loginView'));
    show(g('appView'));
    renderUserBox();
    activateTab(state.activeTab);
    updateAdminVisibility?.();
  }

  function mountLogin(){
    g('lg_btn').addEventListener('click', login);
    g('lg_pin').addEventListener('keydown', (e)=>{ if(e.key==='Enter') login(); });
  }

  function activateTab(tab){
    // tabs header
    $$('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    // sections
    const ids = ['inventario','tras','toma','buscar','rep','admin'];
    ids.forEach(id => {
      const sec = g(id);
      if(!sec) return;
      if(id === tab) sec.classList.remove('hidden'); else sec.classList.add('hidden');
    });
    state.activeTab = tab; localStorage.setItem('activeTab', tab);
  }

  function mountTabs(){
    $$('#tabs .tab').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
  }

  function fillSelect(el, items){
    el.innerHTML = items.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  function mountCatalogos(){
    const cat = getCatalogos();
    // Inventario
    if(g('invUbic')) fillSelect(g('invUbic'), cat.ubicaciones||[]);
    if(g('invLinea')) fillSelect(g('invLinea'), cat.lineas||[]);
    if(g('invClase')) fillSelect(g('invClase'), cat.clases||[]);
    // Traslados / Toma (por ahora reutilizamos "lineas")
    if(g('trasBodegaDestino')) fillSelect(g('trasBodegaDestino'), cat.ubicaciones||[]);
    if(g('tomaBodega')) fillSelect(g('tomaBodega'), cat.lineas||[]);
    if(g('tomaObj')) fillSelect(g('tomaObj'), cat.ubicaciones||[]);
    // Buscar - filtro clase (con opción vacía)
    if(g('qClase')) g('qClase').innerHTML = ['<option value="">Todas</option>'].concat((cat.clases||[]).map(v=>`<option value="${v}">${v}</option>`)).join('');
  }
  function refreshCatalogSelects(){ mountCatalogos(); }

  function mountImagePreview(){
    const file = g('invImgFile');
    const prev = g('invPreview');
    if(!file || !prev) return;
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if(!f){ prev.textContent = 'Sin imagen'; prev.style.backgroundImage=''; return; }
      const reader = new FileReader();
      reader.onload = () => {
        prev.innerHTML = '';
        prev.style.backgroundImage = `url('${reader.result}')`;
        prev.style.backgroundSize = 'cover';
        prev.style.backgroundPosition = 'center';
        prev.style.minHeight = '140px';
        prev.style.borderStyle = 'solid';
        // guardar dataURL para persistir
        const url = String(reader.result || '');
        const hidden = g('invImgUrl');
        if(hidden) hidden.value = url;
      };
      reader.readAsDataURL(f);
    });
  }

  // ===== Inventario (mínimo: crear y listar) =====
  const INV_KEY = 'inventario';
  function getInventario(){
    try{ return JSON.parse(localStorage.getItem(INV_KEY) || '[]') }catch{ return [] }
  }
  function setInventario(list){ localStorage.setItem(INV_KEY, JSON.stringify(list)); }
  const strip = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function toCSV(rows, headers){
    const esc = v => {
      if(v === null || v === undefined) return '';
      const s = strip(String(v));
      if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const filtered = headers.filter(h => h.key !== 'imgUrl' && strip(h.label).toLowerCase().indexOf('imagen') === -1);
    const head = filtered.map(h => esc(h.label)).join(',');
    const body = rows.map(r => filtered.map(h => {
      let v = r[h.key];
      if(h.key === 'linea' && (v === undefined || v === '')) v = r['lineaNegocio'] ?? r['bodega'] ?? '';
      if(h.key === 'ubic' && (v === undefined || v === '')) v = r['ubicacion'] ?? '';
      return esc(v);
    }).join(',')).join('\n');
    return head + '\n' + body;
  }
  function downloadCSV(content, filename){
    const BOM = '\ufeff'; // UTF-8 BOM para Excel
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display='none';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  let selectedCode = null;
  function renderInventario(){
    const tbody = g('tablaInv')?.querySelector('tbody');
    if(!tbody) return;
    const data = getInventario().map(it => ({...it, bodega: it.linea || it.bodega || '' }));
    tbody.innerHTML = data.map(it => {
      const img = it.imgUrl ? `<img src="${it.imgUrl}" alt="img" style="width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #233043">` : '<span class="muted">—</span>';
      const selClass = (selectedCode && selectedCode === it.codigo) ? ' class="selected"' : '';
      return `<tr data-code="${it.codigo}"${selClass}>
        <td>${img}</td>
        <td>${it.codigo || ''}</td>
        <td>${it.nombre || ''}</td>
        <td>${it.marca || ''}</td>
        <td>${it.modelo || ''}</td>
        <td>${it.clase || ''}</td>
        <td>${it.fechaIngreso || ''}</td>
        <td>${it.fechaFactura || ''}</td>
        <td>${it.numeroFactura || ''}</td>
        <td>${(it.vida || 0)}${it.vida? ' años':''}</td>
        <td>${it.ubic || ''}</td>
        <td>${it.bodega || ''}</td>
      </tr>`;
    }).join('');
    // Nota: el listener se instala en mountInventario (delegación en tbody)
    // Refrescar filtros de Buscar (nombres/ubicaciones/clases)
    populateBuscarFilters?.();
  }
  function clearInvMsg(){ const m = g('invMsg'); if(m) m.textContent = ''; }
  function setInvMsg(text, ok=false){ const m = g('invMsg'); if(m){ m.textContent = text; m.style.color = ok ? '#10b981' : '#fca5a5'; } }
  function clearInvForm(){
    ['invNombre','invMarca','invModelo','invVida','invCodigo','invImgFile','invImgUrl','invFechaIng','invFechaFac','invNumFac'].forEach(id => { const el = g(id); if(!el) return; if(el.tagName==='INPUT') el.value = el.type==='number' ? '0' : ''; });
    const prev = g('invPreview'); if(prev){ prev.textContent = 'Sin imagen'; prev.style.backgroundImage=''; prev.style.borderStyle='dashed'; prev.style.minHeight=''; }
  }
  function onAddInventario(){
    clearInvMsg();
    const nombre = g('invNombre').value.trim();
    const marca  = g('invMarca').value.trim();
    const modelo = g('invModelo').value.trim();
    const fechaIngreso = g('invFechaIng').value;
    const fechaFactura = g('invFechaFac').value;
    const numeroFactura = g('invNumFac').value.trim();
    const vida   = parseInt(g('invVida').value || '0', 10) || 0;
    const codigo = g('invCodigo').value.trim();
    const ubic   = g('invUbic').value;
    const linea  = g('invLinea').value;
    const clase  = g('invClase') ? g('invClase').value : '';
    const imgUrl = g('invImgUrl').value || '';

    if(!codigo){ setInvMsg('Ingresa el código de activo'); return; }
    const list = getInventario();
    if(list.some(x => (x.codigo||'').toLowerCase() === codigo.toLowerCase())){
      setInvMsg('Ya existe un equipo con ese código');
      return;
    }

    const item = { codigo, nombre, marca, modelo, clase, fechaIngreso, fechaFactura, numeroFactura, vida, ubic, linea, imgUrl };
    list.push(item);
    setInventario(list);
    renderInventario();
    clearInvForm();
    setInvMsg('Equipo agregado', true);
  }
  function populateForm(it){
    g('invNombre').value = it.nombre || '';
    g('invMarca').value = it.marca || '';
    g('invModelo').value = it.modelo || '';
    g('invFechaIng').value = it.fechaIngreso || '';
    g('invFechaFac').value = it.fechaFactura || '';
    g('invNumFac').value = it.numeroFactura || '';
    g('invVida').value = String(it.vida || 0);
    g('invCodigo').value = it.codigo || '';
    g('invUbic').value = it.ubic || '';
    if(g('invLinea')) g('invLinea').value = it.linea || it.bodega || '';
    if(g('invClase')) g('invClase').value = it.clase || '';
    g('invImgUrl').value = it.imgUrl || '';
    const prev = g('invPreview');
    if(it.imgUrl){
      prev.innerHTML = '';
      prev.style.backgroundImage = `url('${it.imgUrl}')`;
      prev.style.backgroundSize = 'cover';
      prev.style.backgroundPosition = 'center';
      prev.style.minHeight = '140px';
      prev.style.borderStyle = 'solid';
    }else{
      prev.textContent = 'Sin imagen';
      prev.style.backgroundImage = '';
      prev.style.borderStyle = 'dashed';
      prev.style.minHeight = '';
    }
  }
  function toggleEditMode(editing){
    g('btnAddInv').style.display = editing ? 'none' : '';
    g('btnUpdateInv').style.display = editing ? '' : 'none';
    g('btnDeleteInv').style.display = editing ? '' : 'none';
    g('btnCancelEdit').style.display = editing ? '' : 'none';
  }
  function onSelectRow(e){
    const tr = e.target.closest('tr');
    if(!tr) return;
    const code = tr.getAttribute('data-code');
    if(!code) return;
    const list = getInventario();
    const it = list.find(x => x.codigo === code);
    if(!it) return;
    selectedCode = code;
    populateForm(it);
    toggleEditMode(true);
    renderInventario(); // re-render para marcar selección
    setInvMsg('Elemento seleccionado para edición');
  }
  function onCancelEdit(){
    selectedCode = null; clearInvForm(); toggleEditMode(false); clearInvMsg(); renderInventario();
  }
  function onUpdateInventario(){
    if(!selectedCode){ setInvMsg('No hay elemento seleccionado'); return; }
    const list = getInventario();
    const idx = list.findIndex(x => x.codigo === selectedCode);
    if(idx === -1){ setInvMsg('No se encontró el elemento'); return; }
    const codigoNuevo = g('invCodigo').value.trim();
    if(!codigoNuevo){ setInvMsg('Ingresa el código de activo'); return; }
    // Validar duplicidad excluyendo el propio elemento
    const dup = list.some((x,i) => i!==idx && (x.codigo||'').toLowerCase() === codigoNuevo.toLowerCase());
    if(dup){ setInvMsg('Ya existe un equipo con ese código'); return; }
    list[idx] = {
      codigo: codigoNuevo,
      nombre: g('invNombre').value.trim(),
      marca: g('invMarca').value.trim(),
      modelo: g('invModelo').value.trim(),
      fechaIngreso: g('invFechaIng').value,
      fechaFactura: g('invFechaFac').value,
      numeroFactura: g('invNumFac').value.trim(),
      vida: parseInt(g('invVida').value||'0',10)||0,
      ubic: g('invUbic').value,
      linea: (g('invLinea')?.value)||'',
      clase: (g('invClase')?.value)||'',
      imgUrl: g('invImgUrl').value || ''
    };
    setInventario(list);
    selectedCode = codigoNuevo;
    renderInventario();
    setInvMsg('Equipo actualizado', true);
  }
  function onDeleteInventario(){
    if(!selectedCode){ setInvMsg('No hay elemento seleccionado'); return; }
    const list = getInventario();
    const idx = list.findIndex(x => x.codigo === selectedCode);
    if(idx === -1){ setInvMsg('No se encontró el elemento'); return; }
    // Confirmación simple
    if(!confirm('¿Eliminar el equipo seleccionado?')) return;
    list.splice(idx,1);
    setInventario(list);
    onCancelEdit();
    setInvMsg('Equipo eliminado', true);
  }
  function mountInventario(){
    const btn = g('btnAddInv');
    if(btn) btn.addEventListener('click', onAddInventario);
    g('btnCancelEdit')?.addEventListener('click', onCancelEdit);
    g('btnUpdateInv')?.addEventListener('click', onUpdateInventario);
    g('btnDeleteInv')?.addEventListener('click', onDeleteInventario);
    // Delegación de clic en filas
    const tbody = g('tablaInv')?.querySelector('tbody');
    if(tbody){ tbody.addEventListener('click', onSelectRow); }
    // Exportar inventario completo a CSV
    g('btnExportInv')?.addEventListener('click', () => {
      const data = getInventario().map(x => ({
        codigo: x.codigo || '',
        nombre: x.nombre || '',
        marca: x.marca || '',
        modelo: x.modelo || '',
        clase: x.clase || '',
        fechaIngreso: x.fechaIngreso || '',
        fechaFactura: x.fechaFactura || '',
        numeroFactura: x.numeroFactura || '',
        vida: x.vida || '',
        ubicacion: x.ubic || '',
        lineaNegocio: x.linea || x.bodega || ''
      }));
      const headers = [
        { key:'codigo', label:'Codigo' },
        { key:'nombre', label:'Nombre' },
        { key:'marca', label:'Marca' },
        { key:'modelo', label:'Modelo' },
        { key:'clase', label:'Clase' },
      { key:'fechaIngreso', label:'Fecha ingreso' },
      { key:'fechaFactura', label:'Fecha factura' },
      { key:'numeroFactura', label:'Numero factura' },
      { key:'vida', label:'Vida util (anios)' },
      { key:'ubicacion', label:'Ubicacion' },
      { key:'lineaNegocio', label:'Linea de negocio' },
      ];
      const csv = toCSV(data, headers);
      downloadCSV(csv, 'inventario.csv');
    });
    renderInventario();
  }

  // ===== Buscar (filtros en vivo + export) =====
  let currentSearch = [];
  const norm = (s) => strip(String(s||'')).toLowerCase();
  function filterInventario({codigo, nombre, ubic, clase, linea}){
    const qCod = norm(codigo);
    const selNom = norm(nombre);
    const selUbi = norm(ubic);
    const selCla = norm(clase);
    const selLin = norm(linea);
    return getInventario().filter(x =>
      (!qCod || norm(x.codigo).includes(qCod)) &&
      (!selNom || norm(x.nombre) === selNom) &&
      (!selUbi || norm(x.ubic) === selUbi) &&
      (!selCla || norm(x.clase) === selCla) &&
      (!selLin || norm(x.linea || x.bodega) === selLin)
    );
  }
  function renderBusqueda(rows){
    const tbody = g('tablaBusq')?.querySelector('tbody');
    if(!tbody) return;
    const view = rows.map(it => ({...it, bodega: it.linea || it.bodega || '' }));
    tbody.innerHTML = view.map(it => {
      const img = it.imgUrl ? `<img src="${it.imgUrl}" alt="img" style="width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">` : '<span class="muted">—</span>';
      return `<tr>
        <td>${img}</td>
        <td>${it.codigo || ''}</td>
        <td>${it.nombre || ''}</td>
        <td>${it.marca || ''}</td>
        <td>${it.modelo || ''}</td>
        <td>${it.clase || ''}</td>
        <td>${it.ubic || ''}</td>
        <td>${it.bodega || ''}</td>
      </tr>`;
    }).join('');
  }
  function performSearch(){
    currentSearch = filterInventario({
      codigo: g('qCodigo').value,
      nombre: g('qNombre')?.value || '',
      ubic: g('qUbic')?.value || '',
      clase: g('qClase')?.value || '',
      linea: g('qLinea')?.value || ''
    });
    renderBusqueda(currentSearch);
  }
  function mountBuscar(){
    populateBuscarFilters();
    const inputs = ['qCodigo','qNombre','qUbic','qClase','qLinea'];
    inputs.forEach(id => { const el=g(id); if(!el) return; const evt=(el.tagName==='SELECT')?'change':'input'; el.addEventListener(evt, performSearch); });
    g('btnBuscar')?.addEventListener('click', performSearch);
    g('btnExportBusq')?.addEventListener('click', () => {
      const data = (currentSearch.length ? currentSearch : getInventario()).map(x => ({
        codigo: x.codigo || '', nombre: x.nombre || '', marca: x.marca || '', modelo: x.modelo || '', ubic: x.ubic || '', linea: x.bodega || '', imgUrl: x.imgUrl || ''
      }));
      const headers = [
        { key:'codigo', label:'Código' },
        { key:'nombre', label:'Nombre' },
        { key:'marca', label:'Marca' },
        { key:'modelo', label:'Modelo' },
        { key:'ubic', label:'Ubicación' },
        { key:'linea', label:'Línea de negocio' },
        { key:'imgUrl', label:'Imagen (dataURL)' },
      ];
      const csv = toCSV(data, headers);
      downloadCSV(csv, 'consulta_inventario.csv');
    });
    // Primer render
    currentSearch = getInventario();
    renderBusqueda(currentSearch);
  }

  function populateBuscarFilters(){
    const inv = getInventario();
    const cats = getCatalogos();
    const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
    const byAlpha = (a,b)=> a.localeCompare(b,'es',{sensitivity:'base'});
    const nombres = uniq(inv.map(x=>x.nombre||'')).sort(byAlpha);
    const ubic = uniq([...(cats.ubicaciones||[]), ...inv.map(x=>x.ubic||'')]).sort(byAlpha);
    const clases = uniq([...(cats.clases||[]), ...inv.map(x=>x.clase||'')]).sort(byAlpha);
    const lineas = uniq([...(cats.lineas||[]), ...inv.map(x=>x.linea||x.bodega||'')]).sort(byAlpha);
    const fillDL = (listId, list) => { const el=g(listId); if(!el) return; el.innerHTML=['<option value="">'].concat(list.map(v=>`<option value="${v}">`)).join(''); };
    fillDL('qNombreList', nombres);
    fillDL('qUbicList', ubic);
    fillDL('qClaseList', clases);
    fillDL('qLineaList', lineas);
  }

  function restoreSession(){
    try{
      const raw = localStorage.getItem('sessionUser');
      if(raw){ state.user = JSON.parse(raw); }
    }catch{}
    if(state.user){ hide(g('loginView')); show(g('appView')); renderUserBox(); activateTab(state.activeTab); }
    else { show(g('loginView')); hide(g('appView')); resetLoginForm(); }
  }

  // ===== Backups (export/import JSON) =====
  function exportBackup(){
    const payload = { inventario: getInventario(), usuarios: getUsers() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'backup_inventario.json'; a.style.display='none';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function importBackup(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(String(reader.result||'{}'));
        if(Array.isArray(data)){
          setInventario(data);
        }else if(data && (Array.isArray(data.inventario) || Array.isArray(data.usuarios))){
          if(Array.isArray(data.inventario)) setInventario(data.inventario);
          if(Array.isArray(data.usuarios)) setUsers(data.usuarios);
        }else{
          alert('Archivo de backup inválido');
          return;
        }
        selectedCode = null; renderInventario(); performSearch(); setInvMsg('Backup importado', true);
      }catch(e){ alert('No se pudo leer el backup'); }
    };
    reader.readAsText(file);
  }
  function mountReportes(){
    g('btnExportBackup')?.addEventListener('click', exportBackup);
    g('btnImportBackup')?.addEventListener('click', () => g('fileImportBackup')?.click());
    g('fileImportBackup')?.addEventListener('change', (e)=>{
      const f = e.target.files?.[0]; if(f) importBackup(f);
      e.target.value = '';
    });
    // Plantilla CSV
    g('btnTemplateCSV')?.addEventListener('click', () => {
      const headers = [
        { key:'codigo', label:'Codigo' },
        { key:'nombre', label:'Nombre' },
        { key:'marca', label:'Marca' },
        { key:'modelo', label:'Modelo' },
        { key:'fechaIngreso', label:'Fecha ingreso' },
        { key:'fechaFactura', label:'Fecha factura' },
        { key:'numeroFactura', label:'Numero factura' },
        { key:'vida', label:'Vida util (anios)' },
        { key:'ubicacion', label:'Ubicacion' },
        { key:'lineaNegocio', label:'Linea de negocio' },
        { key:'imagen', label:'Imagen' }
      ];
      const csv = toCSV([], headers);
      downloadCSV(csv, 'plantilla_inventario.csv');
    });
    // Directorio de imágenes (opcional)
    g('dirImages')?.addEventListener('change', (e)=>{
      const files = Array.from(e.target.files||[]);
      loadImagesDirectory(files).then(count => setRepMsg(`Imagenes cargadas: ${count}`, true));
    });
    // Import CSV
    g('btnImportCSV')?.addEventListener('click', ()=> g('fileImportCSV')?.click());
    g('fileImportCSV')?.addEventListener('change', (e)=>{
      const f = e.target.files?.[0]; if(f) importCSV(f, g('chkReplace')?.checked);
      e.target.value='';
    });
  }

  // ===== Admin UI =====
  function setAdmMsg(t, ok=false){ const el = g('admMsg'); if(el){ el.textContent = t; el.style.color = ok ? '#16a34a' : '#ef4444'; } }
  function renderAdmin(){
    const c = getCatalogos();
    const ubT = g('tablaUbic')?.querySelector('tbody');
    if(ubT) ubT.innerHTML = (c.ubicaciones||[]).map(u => `<tr><td>${u}</td><td class="right"><button class="btn danger btnDelUbic" data-u="${u}">Eliminar</button></td></tr>`).join('');
    const liT = g('tablaLinea')?.querySelector('tbody');
    if(liT) liT.innerHTML = (c.lineas||[]).map(l => `<tr><td>${l}</td><td class="right"><button class="btn danger btnDelLinea" data-l="${l}">Eliminar</button></td></tr>`).join('');
    const clT = g('tablaClase')?.querySelector('tbody');
    if(clT) clT.innerHTML = (c.clases||[]).map(cl => `<tr><td>${cl}</td><td class="right"><button class="btn danger btnDelClase" data-c="${cl}">Eliminar</button></td></tr>`).join('');
    const usersT = g('tablaUsers')?.querySelector('tbody');
    if(usersT){
      const users = getUsers();
      usersT.innerHTML = users.map(u => `<tr data-user="${u.name}"><td>${u.name}</td><td>${u.rol}</td><td class="right">
        <button class="btn" data-act="pin">Cambiar PIN</button> <button class="btn danger" data-act="del">Eliminar</button>
      </td></tr>`).join('');
    }
    // Bind delete buttons and user actions
    ubT?.querySelectorAll('.btnDelUbic').forEach(b => b.addEventListener('click', () => delUbic(b.getAttribute('data-u'))));
    liT?.querySelectorAll('.btnDelLinea').forEach(b => b.addEventListener('click', () => delLinea(b.getAttribute('data-l'))));
    clT?.querySelectorAll('.btnDelClase').forEach(b => b.addEventListener('click', () => delClase(b.getAttribute('data-c'))));
    usersT?.querySelectorAll('button').forEach(btn => btn.addEventListener('click', onUserAction));
  }
  function addUbic(){
    const v = strip(g('newUbic').value).trim().toUpperCase();
    if(!v){ setAdmMsg('Ingresa una ubicacion'); return; }
    const c = getCatalogos(); c.ubicaciones = c.ubicaciones||[];
    if(c.ubicaciones.includes(v)){ setAdmMsg('La ubicacion ya existe'); return; }
    c.ubicaciones.push(v); setCatalogos(c); g('newUbic').value=''; setAdmMsg('Ubicacion agregada', true); renderAdmin(); refreshCatalogSelects();
  }
  function delUbic(v){
    const c = getCatalogos(); c.ubicaciones = (c.ubicaciones||[]).filter(x => x !== v); setCatalogos(c); setAdmMsg('Ubicacion eliminada', true); renderAdmin(); refreshCatalogSelects();
  }
  function addLinea(){
    const v = strip(g('newLinea').value).trim().toUpperCase();
    if(!v){ setAdmMsg('Ingresa una linea'); return; }
    const c = getCatalogos(); c.lineas = c.lineas||[];
    if(c.lineas.includes(v)){ setAdmMsg('La linea ya existe'); return; }
    c.lineas.push(v); setCatalogos(c); g('newLinea').value=''; setAdmMsg('Linea agregada', true); renderAdmin(); refreshCatalogSelects();
  }
  function delLinea(v){
    const c = getCatalogos(); c.lineas = (c.lineas||[]).filter(x => x !== v); setCatalogos(c); setAdmMsg('Linea eliminada', true); renderAdmin(); refreshCatalogSelects();
  }
  function addClase(){
    const v = strip(g('newClase').value).trim().toUpperCase();
    if(!v){ setAdmMsg('Ingresa una clase'); return; }
    const c = getCatalogos(); c.clases = c.clases||[];
    if(c.clases.includes(v)){ setAdmMsg('La clase ya existe'); return; }
    c.clases.push(v); setCatalogos(c); g('newClase').value=''; setAdmMsg('Clase agregada', true); renderAdmin(); refreshCatalogSelects();
  }
  function delClase(v){
    const c = getCatalogos(); c.clases = (c.clases||[]).filter(x => x !== v); setCatalogos(c); setAdmMsg('Clase eliminada', true); renderAdmin(); refreshCatalogSelects();
  }
  async function addUser(){
    setAdmMsg('');
    const name = g('admUser').value.trim();
    const rol = g('admRol').value;
    const p1 = g('admPin').value; const p2 = g('admPin2').value;
    if(!name || !p1){ setAdmMsg('Usuario y PIN son obligatorios'); return; }
    if(p1 !== p2){ setAdmMsg('Los PIN no coinciden'); return; }
    const users = getUsers();
    if(users.some(u => u.name.toLowerCase() === name.toLowerCase())){ setAdmMsg('El usuario ya existe'); return; }
    const pinHash = await sha256Hex(p1);
    users.push({ name, rol, pinHash }); setUsers(users);
    g('admUser').value=''; g('admPin').value=''; g('admPin2').value='';
    setAdmMsg('Usuario creado', true); renderAdmin();
  }
  async function onUserAction(e){
    const tr = e.target.closest('tr'); const user = tr?.getAttribute('data-user'); if(!user) return;
    const action = e.target.getAttribute('data-act');
    let users = getUsers();
    if(action==='del'){
      if(state.user && state.user.name === user){ setAdmMsg('No puedes eliminar tu propio usuario'); return; }
      if(!confirm('¿Eliminar usuario?')) return;
      users = users.filter(u => u.name !== user); setUsers(users); setAdmMsg('Usuario eliminado', true); renderAdmin(); return;
    }
    if(action==='pin'){
      const p1 = prompt('Nuevo PIN:'); if(p1===null) return; const p2 = prompt('Confirmar PIN:'); if(p2===null) return;
      if(p1 !== p2){ alert('Los PIN no coinciden'); return; }
      const u = users.find(u => u.name===user); if(!u) return;
      u.pinHash = await sha256Hex(p1); setUsers(users); setAdmMsg('PIN actualizado', true); renderAdmin(); return;
    }
  }
  function updateAdminVisibility(){
    const tabBtn = g('tabAdmin'); const sec = g('admin');
    const role = state.user ? String(state.user.rol).toLowerCase() : '';
    const isAdmin = role==='admin' || role==='lider'; // compatibilidad con datos antiguos
    if(tabBtn){ tabBtn.style.display = isAdmin ? '' : 'none'; }
    if(sec && !isAdmin){ sec.classList.add('hidden'); }
  }
  function mountAdmin(){
    g('btnAddUbic')?.addEventListener('click', addUbic);
    g('btnAddLinea')?.addEventListener('click', addLinea);
    g('btnAddClase')?.addEventListener('click', addClase);
    g('btnAddUser')?.addEventListener('click', addUser);
    renderAdmin();
    updateAdminVisibility();
    mountLogoAdmin();
  }

  // ===== Import CSV + imágenes =====
  let imagesMap = {};
  function setRepMsg(t, ok=false){ const el = g('repMsg'); if(el){ el.textContent = t; el.style.color = ok ? '#16a34a' : '#ef4444'; } }
  function loadImagesDirectory(files){
    imagesMap = {};
    const images = files.filter(f => (f.type||'').startsWith('image/'));
    const tasks = images.map(f => new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => {
        const name = (f.name||'').replace(/\.[^.]+$/,'');
        const key = strip(name).toLowerCase();
        imagesMap[key] = String(reader.result||'');
        res(true);
      };
      reader.onerror = () => res(false);
      reader.readAsDataURL(f);
    }));
    return Promise.all(tasks).then(() => Object.keys(imagesMap).length);
  }
  function parseCSV(text){
    const out = [];
    const rows = [];
    let cur = '';
    let inQ = false;
    const pushCell = () => { rows[rows.length-1].push(cur); cur=''; };
    const pushRow = () => { rows.push([]); };
    pushRow();
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      if(inQ){
        if(ch==='"'){
          if(text[i+1]==='"'){ cur+='"'; i++; }
          else { inQ=false; }
        } else { cur+=ch; }
      } else {
        if(ch==='"'){ inQ=true; }
        else if(ch===','){ pushCell(); }
        else if(ch==='\n' || ch==='\r'){
          // handle CRLF/LF
          // if we have content or previous cells, close row
          if(cur!=='' || (rows[rows.length-1] && rows[rows.length-1].length)) { pushCell(); }
          if(rows[rows.length-1] && rows[rows.length-1].length){ pushRow(); }
        } else { cur+=ch; }
      }
    }
    // flush
    if(cur!=='' || (rows[rows.length-1] && rows[rows.length-1].length)) { pushCell(); }
    // remove possible last empty row
    if(rows.length && rows[rows.length-1].length===1 && rows[rows.length-1][0]===''){ rows.pop(); }
    if(!rows.length) return out;
    const header = rows.shift().map(h => strip(h).toLowerCase().replace(/[^a-z0-9]+/g,''));
    const map = {
      codigo:'codigo', nombre:'nombre', marca:'marca', modelo:'modelo', clase:'clase', clases:'clase',
      fechaingreso:'fechaIngreso', fechafactura:'fechaFactura', numerofactura:'numeroFactura',
      vidautil:'vida', vida:'vida', ubicacion:'ubic', ubic:'ubic',
      lineadenegocio:'linea', lineanegocio:'linea', linea:'linea',
      imagen:'imagen'
    };
    for(const row of rows){
      const obj = {};
      for(let i=0;i<header.length;i++){
        const key = map[header[i]];
        if(!key) continue;
        obj[key] = row[i] ?? '';
      }
      out.push(obj);
    }
    return out;
  }
  function importCSV(file, replace){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const rows = parseCSV(String(reader.result||''));
        if(!rows.length){ setRepMsg('CSV vacio o sin encabezados'); return; }
        let current = getInventario();
        if(replace) current = [];
        const byCode = new Map(current.map(x => [String(x.codigo).toLowerCase(), x]));
        let added=0, updated=0;
        for(const r of rows){
          const codigo = String(r.codigo||'').trim(); if(!codigo) continue;
          const nombre = r.nombre||''; const marca=r.marca||''; const modelo=r.modelo||'';
          const fechaIngreso=r.fechaIngreso||''; const fechaFactura=r.fechaFactura||''; const numeroFactura=r.numeroFactura||'';
          const vida = parseInt(r.vida||'0',10)||0; const ubic=r.ubic||''; const linea=r.linea||''; const clase=r.clase||'';
          let imgUrl = '';
          const imgCell = String(r.imagen||'').trim();
          if(imgCell){
            if(imgCell.startsWith('data:')) imgUrl = imgCell;
            else {
              const key = strip(imgCell.replace(/\.[^.]+$/,'')).toLowerCase();
              imgUrl = imagesMap[key] || '';
            }
          } else {
            const key = strip(codigo).toLowerCase();
            imgUrl = imagesMap[key] || '';
          }
          const item = { codigo, nombre, marca, modelo, clase, fechaIngreso, fechaFactura, numeroFactura, vida, ubic, linea, imgUrl };
          const k = codigo.toLowerCase();
          if(byCode.has(k)){ Object.assign(byCode.get(k), item); updated++; }
          else { current.push(item); byCode.set(k, item); added++; }
        }
        setInventario(current); renderInventario(); performSearch();
        setRepMsg(`Importacion CSV completa. Agregados: ${added}, Actualizados: ${updated}`, true);
      }catch(e){ setRepMsg('Error al importar CSV'); }
    };
    reader.readAsText(file);
  }

  // ===== Traslados =====
  const TRAS_KEY = 'tras_hist';
  const TRAS_DOCS_KEY = 'tras_docs';
  const TRAS_SEQ_KEY = 'tras_seq';
  function getTrasHist(){ try{ return JSON.parse(localStorage.getItem(TRAS_KEY)||'[]') }catch{ return [] } }
  function setTrasHist(list){ localStorage.setItem(TRAS_KEY, JSON.stringify(list)); }
  function getTrasDocs(){ try{ return JSON.parse(localStorage.getItem(TRAS_DOCS_KEY)||'[]') }catch{ return [] } }
  function setTrasDocs(list){ localStorage.setItem(TRAS_DOCS_KEY, JSON.stringify(list)); }
  function nextTrasId(){
    let n = 0; try{ n = parseInt(localStorage.getItem(TRAS_SEQ_KEY)||'0',10)||0 }catch{}
    n += 1; localStorage.setItem(TRAS_SEQ_KEY, String(n));
    const d = new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
    return `TR-${y}${m}${day}-${String(n).padStart(4,'0')}`;
  }
  let trasSeleccion = [];
  let trasSearchList = [];
  function findItemByCode(code){
    const c = String(code||'').trim().toLowerCase();
    if(!c) return null;
    return getInventario().find(x => String(x.codigo||'').toLowerCase() === c) || null;
  }
  function renderTrasPreview(item){
    const box = g('trasPreview');
    if(!box) return;
    if(!item){ box.textContent = 'Ingresa un código para ver el equipo.'; return; }
    const img = item.imgUrl ? `<img src="${item.imgUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border);margin-right:12px">` : '';
    box.innerHTML = `<div style="display:flex;align-items:center;gap:12px">${img}<div>
      <div><b>${item.nombre||''}</b> (${item.marca||''} ${item.modelo||''})</div>
      <div class="muted">Linea: ${item.linea || item.bodega || ''} • Ubicacion: ${item.ubic||''}</div>
    </div></div>`;
  }
  function renderTrasSel(){
    const tbody = g('tablaTrasSel')?.querySelector('tbody'); if(!tbody) return;
    tbody.innerHTML = trasSeleccion.map(t => `<tr data-code="${t.codigo}"><td>${t.codigo}</td><td>${t.nombre||''}</td><td>${t.origen||''}</td><td>${t.destino||''}</td><td class="right"><button class="btn danger btnDelSel">Quitar</button></td></tr>`).join('');
    tbody.querySelectorAll('.btnDelSel').forEach(btn => btn.addEventListener('click', (e)=>{
      const tr = e.target.closest('tr'); const code = tr?.getAttribute('data-code');
      trasSeleccion = trasSeleccion.filter(x => x.codigo !== code); renderTrasSel();
    }));
  }
  function renderTrasResults(list){
    const box = g('trasResults'); if(!box) return;
    const rows = (list||[]).slice(0,50);
    if(!rows.length){ box.textContent = 'Sin resultados'; return; }
    const html = `
      <table style="width:100%;border-collapse:collapse" class="table">
        <thead><tr><th style="width:32px"></th><th>Código</th><th>Nombre</th><th>Ubicación</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td><input type="checkbox" class="trasPick" data-code="${r.codigo}"></td>
            <td>${r.codigo}</td>
            <td>${r.nombre||''}</td>
            <td>${r.ubic||''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    box.innerHTML = html;
  }
  function trasSearch(){
    const q = strip(g('trasSearch').value||'').toLowerCase();
    if(!q){ trasSearchList = []; renderTrasResults([]); return; }
    const inv = getInventario();
    trasSearchList = inv.filter(it => strip(it.codigo).toLowerCase().includes(q) || strip(it.nombre).toLowerCase().includes(q));
    renderTrasResults(trasSearchList);
  }
  function onAgregarSeleccion(){
    const dest = g('trasBodegaDestino').value;
    if(!dest){ g('trasPreview').textContent='Selecciona ubicación destino'; return; }
    const checks = Array.from(g('trasResults')?.querySelectorAll('.trasPick')||[]).filter(ch => ch.checked);
    if(!checks.length){ g('trasPreview').textContent='No hay seleccionados'; return; }
    const inv = getInventario();
    let added = 0, skippedSame = 0, updated = 0;
    checks.forEach(ch => {
      const code = ch.getAttribute('data-code');
      const item = inv.find(x => String(x.codigo).toLowerCase() === String(code).toLowerCase());
      if(!item) return;
      const origen = item.ubic || '';
      if(strip(origen).toLowerCase() === strip(dest).toLowerCase()){ skippedSame++; return; }
      const existing = trasSeleccion.find(x => x.codigo.toLowerCase() === item.codigo.toLowerCase());
      if(existing){ existing.destino = dest; updated++; }
      else { trasSeleccion.push({ codigo:item.codigo, nombre:item.nombre, origen, destino:dest }); added++; }
    });
    renderTrasSel();
    const parts = [];
    if(added) parts.push(`Agregados ${added}`);
    if(updated) parts.push(`Actualizados ${updated}`);
    if(skippedSame) parts.push(`Omitidos ${skippedSame} (ya en destino)`);
    g('trasPreview').textContent = parts.length ? parts.join(' • ') : 'Sin cambios';
  }
  function renderTrasHist(rows){
    const tbody = g('tablaTras')?.querySelector('tbody'); if(!tbody) return;
    const hist = rows || getTrasHist();
    tbody.innerHTML = hist.map(h => `<tr><td>${h.fecha}</td><td>${h.doc||''}</td><td>${h.codigo}</td><td>${h.nombre||''}</td><td>${h.de||''}</td><td>${h.para||''}</td></tr>`).join('');
  }
  function renderTrasDocs(){
    const tbody = g('tablaTrasDocs')?.querySelector('tbody'); if(!tbody) return;
    const docs = getTrasDocs();
    tbody.innerHTML = docs.map(d => `<tr data-doc="${d.id}"><td>${d.id}</td><td>${d.fecha}</td><td>${d.items?.length||0}</td><td>${d.usuario||''}</td><td class="right"><button class="btn" data-act="print">Imprimir</button></td></tr>`).join('');
    tbody.querySelectorAll('button[data-act="print"]').forEach(btn => btn.addEventListener('click', (e)=>{
      const tr = e.target.closest('tr'); const id = tr?.getAttribute('data-doc'); if(id) printDocById(id);
    }));
  }
  const LOGO_KEY = 'app_logo';
  function getLogo(){ try{ return String(localStorage.getItem(LOGO_KEY)||'') }catch{ return '' } }
  function setLogo(v){ localStorage.setItem(LOGO_KEY, v||''); }
  function onTrasCodigoInput(){
    const code = g('trasCodigo').value; const item = findItemByCode(code);
    if(item){ if(g('trasBodegaActual')) g('trasBodegaActual').value = item.ubic || '';
      renderTrasPreview(item);
    } else { if(g('trasBodegaActual')) g('trasBodegaActual').value = ''; g('trasPreview').textContent='No se encontró el equipo.'; }
  }
  function onAgregarTras(){
    const code = g('trasCodigo').value.trim();
    const item = findItemByCode(code);
    if(!item){ g('trasPreview').textContent = 'Código no válido'; return; }
    const destinoSel = g('trasBodegaDestino').value;
    const origen = item.ubic || '';
    if(!destinoSel){ g('trasPreview').textContent = 'Selecciona la ubicación destino'; return; }
    if(strip(destinoSel).toLowerCase() === strip(origen).toLowerCase()){
      g('trasPreview').textContent = 'La ubicación destino es igual a la actual'; return;
    }
    const existing = trasSeleccion.find(x => x.codigo.toLowerCase() === item.codigo.toLowerCase());
    if(existing){ existing.destino = destinoSel; }
    else { trasSeleccion.push({ codigo: item.codigo, nombre: item.nombre, origen, destino: destinoSel }); }
    renderTrasSel();
    g('trasPreview').textContent = 'Agregado a la lista';
  }
  let lastTrasId = null;
  function setPrintBtnEnabled(flag){ const b=g('btnImprimirTraslado'); if(b) b.disabled = !flag; }
  function onImprimirTrasladoSafe(){
    if(!lastTrasId){ g('trasPreview').textContent = 'Confirma el traslado antes de imprimir'; return; }
    printDocById(lastTrasId);
  }
  function onGenerarTraslado(){
    if(!trasSeleccion.length){ g('trasPreview').textContent='No hay elementos en la lista'; return; }
    const inv = getInventario();
    const hist = getTrasHist();
    const docs = getTrasDocs();
    const fecha = new Date().toLocaleString();
    const docId = nextTrasId();
    trasSeleccion.forEach(t => {
      const idx = inv.findIndex(x => String(x.codigo||'').toLowerCase() === String(t.codigo).toLowerCase());
      if(idx>-1){ inv[idx].ubic = t.destino; hist.push({ fecha, doc:docId, codigo:t.codigo, nombre:inv[idx].nombre||'', de:t.origen, para:t.destino }); }
    });
    setInventario(inv); setTrasHist(hist);
    docs.push({ id:docId, fecha, usuario: state.user?.name || '', items: JSON.parse(JSON.stringify(trasSeleccion)) });
    setTrasDocs(docs);
    lastTrasId = docId;
    renderInventario(); renderTrasHist();
    g('trasDocInfo').textContent = `Traslado confirmado • Doc: ${docId}`;
    g('trasPreview').textContent = 'Traslado generado';
    trasSeleccion = []; renderTrasSel();
    g('trasCodigo').value=''; g('trasBodegaActual').value='';
  }
  function onImprimirTraslado(){
    const area = g('printArea'); if(!area) return;
    let rows = trasSeleccion.length ? trasSeleccion : [];
    let docId = null;
    if(!rows.length && lastTrasId){
      const docs = getTrasDocs(); const doc = docs.find(d => d.id === lastTrasId);
      if(doc){ rows = doc.items; docId = doc.id; }
    }
    if(!rows.length){ g('trasPreview').textContent = 'No hay elementos para imprimir'; return; }
    const html = buildPrintHTML({ id: docId, fecha: new Date().toLocaleString(), items: rows, usuario: state.user?.name || '' });
    area.innerHTML = html; area.classList.remove('hidden');
    window.print();
    area.classList.add('hidden'); area.innerHTML='';
  }
  function buildPrintHTML(doc){
    const logo = getLogo();
    return `
      <div class="print-doc">
        <div class="head">
          ${logo ? `<img src="${logo}" alt="logo" style="height:42px">` : ''}
          <div class="info">
            <h1>Traslado de equipos</h1>
            <div class="meta">${doc.id? 'Doc: '+doc.id+' • ' : ''}Fecha: ${doc.fecha || new Date().toLocaleString()}${doc.usuario? ' • Usuario: '+doc.usuario:''}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>De</th><th>Para</th></tr></thead>
          <tbody>
            ${doc.items.map(r => `<tr><td>${r.codigo}</td><td>${r.nombre||''}</td><td>${r.origen}</td><td>${r.destino}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="signs">
          <div class="sign"><div>Entregado por</div><div class="line"></div></div>
          <div class="sign"><div>Recibido por</div><div class="line"></div></div>
        </div>
      </div>`;
  }
function printDocById(id){
  const docs = getTrasDocs(); const doc = docs.find(d => d.id === id);
  if(!doc){ g('trasPreview').textContent = 'Doc no encontrado'; return; }
  const area = g('printArea'); if(!area) return;
  const html = buildPrintHTML(doc);
  area.innerHTML = html; area.classList.remove('hidden');
  // Cambiar temporalmente el título para sugerir nombre del PDF
  const safe = s=>String(s||'').replace(/[^\w\-\.]+/g,'_');
  const destinos = doc.destino || (doc.items && doc.items.length ? Array.from(new Set(doc.items.map(i=>i.destino))).join('_') : '');
  const prevTitle = document.title; document.title = `Traslado-${safe(doc.id||'')}${destinos? '-'+safe(destinos):''}`;
  const restore=()=>{ document.title = prevTitle; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
  area.classList.add('hidden'); area.innerHTML='';
}
  function buscarTras(){
    const q = strip(g('trasQCodigo').value||'').toLowerCase();
    const hist = getTrasHist();
    const rows = !q ? hist : hist.filter(h => strip(h.codigo).toLowerCase().includes(q));
    renderTrasHist(rows);
  }
  function mountTraslados(){
    // Subtabs dentro de Traslados
    const subTabs = g('trasTabs');
    if(subTabs){
      subTabs.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', ()=>{
        subTabs.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b===btn));
        const target = btn.getAttribute('data-subtab');
        ['trasNuevo','trasHist','trasDocs'].forEach(id => {
          const sec = g(id); if(!sec) return; if(id===target) sec.classList.remove('hidden'); else sec.classList.add('hidden');
        });
      }));
    }
    g('trasCodigo')?.addEventListener('input', ()=>{ onTrasCodigoInput(); setPrintBtnEnabled(false); });
    g('trasCodigo')?.addEventListener('change', ()=>{ onTrasCodigoInput(); setPrintBtnEnabled(false); });
    g('btnAgregarAMasivo')?.addEventListener('click', ()=>{ onAgregarTras(); setPrintBtnEnabled(false); });
    g('btnGenerarTraslado')?.addEventListener('click', ()=>{ onGenerarTraslado(); setPrintBtnEnabled(!!lastTrasId); if(lastTrasId){ // limpiar búsqueda
      if(g('trasSearch')) g('trasSearch').value='';
      if(g('trasResults')) g('trasResults').textContent='Escribe para ver resultados';
      printDocById(lastTrasId);
    } });
    g('btnImprimirTraslado')?.addEventListener('click', onImprimirTrasladoSafe);
    g('trasSearch')?.addEventListener('input', trasSearch);
    g('btnAgregarSeleccion')?.addEventListener('click', onAgregarSeleccion);
    g('btnImprimirDoc')?.addEventListener('click', ()=>{ const id = g('trasQDoc').value.trim(); if(id) printDocById(id); });
    g('btnBuscarTras')?.addEventListener('click', buscarTras);
    g('trasQCodigo')?.addEventListener('input', buscarTras);
    renderTrasSel(); renderTrasHist(); renderTrasDocs();
    setPrintBtnEnabled(false);
  }

  // ===== Toma de inventario =====
  const TOMA_KEY = 'toma_hist';
  function getToma(){ try{ return JSON.parse(localStorage.getItem(TOMA_KEY)||'[]') }catch{ return [] } }
  function setToma(list){ localStorage.setItem(TOMA_KEY, JSON.stringify(list)); }
  // Sesión de toma en memoria
  let tomaSession = { objetivo: '', ok:new Set(), extra:new Set() };
  let tomaViewMode = 'scans'; // 'scans' | 'faltantes'

  function renderToma(rows){
    const tbody = g('tablaToma')?.querySelector('tbody'); if(!tbody) return;
    const data = rows || getToma();
    if(tomaViewMode==='faltantes'){
      tbody.innerHTML = data.map((r,i) => `<tr class="row-miss" data-idx="${i}"><td></td><td>${r.fecha||''}</td><td>FALTANTE</td><td>${r.codigo}</td><td>${r.nombre||''}</td><td>${r.ubic||''}</td></tr>`).join('');
    } else {
      tbody.innerHTML = data.map((r,i) => `<tr class="${r.estado==='OK'?'row-ok':(r.estado==='FUERA'?'row-out':'')}" data-idx="${i}"><td><input type="checkbox" class="tomaPick" data-idx="${i}"/></td><td>${r.fecha}</td><td>${r.estado||''}</td><td>${r.codigo}</td><td>${r.nombre||''}</td><td>${r.ubic||''}</td></tr>`).join('');
      const pickAll = g('tomaPickAll');
      pickAll?.addEventListener('change', ()=>{ tbody.querySelectorAll('.tomaPick')?.forEach(ch => ch.checked = pickAll.checked); });
    }
  }
  // Sonido corto para feedback de escaneo
  let ACtx = null;
  function beep(freq=440, dur=0.1){
    try{
      ACtx = ACtx || new (window.AudioContext||window.webkitAudioContext)();
      const o = ACtx.createOscillator(); const gnode = ACtx.createGain();
      o.frequency.value = freq; o.type='sine';
      o.connect(gnode); gnode.connect(ACtx.destination);
      const now = ACtx.currentTime;
      gnode.gain.setValueAtTime(0.0001, now);
      gnode.gain.exponentialRampToValueAtTime(0.2, now+0.01);
      gnode.gain.exponentialRampToValueAtTime(0.0001, now+dur);
      o.start(); o.stop(now+dur+0.02);
    }catch{}
  }
  function renderTomaPreview(item){
    const box = g('tomaPreview'); if(!box) return;
    if(!item){ box.textContent = 'Ingresa un código para ver el equipo.'; return; }
    const img = item.imgUrl ? `<img src="${item.imgUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border);margin-right:12px">` : '';
    box.innerHTML = `<div style="display:flex;align-items:center;gap:12px">${img}<div>
      <div><b>${item.nombre||''}</b> (${item.marca||''} ${item.modelo||''})</div>
      <div class="muted">Codigo: ${item.codigo} • Ubicacion actual: ${item.ubic||''} • Linea: ${item.linea||item.bodega||''}</div>
    </div></div>`;
  }
  function onTomaCodigoInput(){
    const code = g('tomaCodigo').value; const item = findItemByCode(code);
    if(item){ renderTomaPreview(item); }
    else { g('tomaPreview').textContent = 'No se encontró el equipo.'; }
  }
  function updateTomaStats(){
    const stats = g('tomaStats'); if(!stats) return;
    const objetivo = tomaSession.objetivo;
    const totalEsperado = objetivo ? getInventario().filter(it => (it.ubic||'')===objetivo).length : 0;
    const ok = tomaSession.ok.size;
    const extra = tomaSession.extra.size;
    const faltantes = totalEsperado - ok;
    stats.textContent = objetivo? `Objetivo: ${objetivo} • Esperados: ${totalEsperado} • OK: ${ok} • Extras: ${extra} • Faltantes: ${faltantes}` : 'Selecciona una ubicación objetivo';
  }
  function onTomar(){
    const code = g('tomaCodigo').value.trim(); if(!code){ g('tomaPreview').textContent='Ingresa un código'; return; }
    const invItem = findItemByCode(code); if(!invItem){ g('tomaPreview').textContent='Código no existe en inventario'; return; }
    const objetivo = g('tomaObj').value;
    if(!objetivo){ g('tomaPreview').textContent='Selecciona una ubicación objetivo'; return; }
    tomaSession.objetivo = objetivo;
    // evitar relecturas en la misma sesión
    if(tomaSession.ok.has(invItem.codigo) || tomaSession.extra.has(invItem.codigo)){
      g('tomaPreview').textContent = 'REPETIDO: ya registrado en esta sesión';
      g('tomaCodigo').value=''; g('tomaCodigo').focus();
      return;
    }
    const fecha = new Date().toLocaleString();
    const estado = (invItem.ubic||'') === objetivo ? 'OK' : 'FUERA';
    if(estado==='OK') tomaSession.ok.add(invItem.codigo); else tomaSession.extra.add(invItem.codigo);
    const reg = { fecha, estado, codigo: invItem.codigo, nombre: invItem.nombre||'', ubic: invItem.ubic||'' };
    const data = getToma(); data.push(reg); setToma(data);
    if(tomaViewMode==='scans') renderToma(); updateTomaStats();
    g('tomaCodigo').value=''; g('tomaPreview').textContent= estado==='OK' ? 'OK en ubicación' : `Fuera de ubicación (actual: ${invItem.ubic||''})`;
    g('tomaCodigo').focus();
  }
  function onExportToma(){
    const data = getToma().map(r => ({ fecha:r.fecha, estado:r.estado||'', codigo:r.codigo, nombre:r.nombre||'', ubicacion:r.ubic||'' }));
    const headers = [
      { key:'fecha', label:'Fecha' },
      { key:'estado', label:'Estado' },
      { key:'codigo', label:'Codigo' },
      { key:'nombre', label:'Nombre' },
      { key:'ubicacion', label:'Ubicacion' },
    ];
    const csv = toCSV(data, headers); downloadCSV(csv, 'toma_inventario.csv');
  }
  function exportFaltantes(){
    const objetivo = g('tomaObj')?.value || '';
    if(!objetivo){ alert('Selecciona una ubicación objetivo'); return; }
    const inv = getInventario();
    const esperados = inv.filter(it => (it.ubic||'')===objetivo).map(it => it.codigo.toLowerCase());
    const okSet = new Set(getToma().filter(r => r.estado==='OK').map(r => r.codigo.toLowerCase()));
    const falt = esperados.filter(c => !okSet.has(c));
    const rows = inv.filter(it => falt.includes((it.codigo||'').toLowerCase())).map(it => ({ codigo:it.codigo, nombre:it.nombre||'', ubicacion:it.ubic||'' }));
    const headers = [ {key:'codigo',label:'Codigo'}, {key:'nombre',label:'Nombre'}, {key:'ubicacion',label:'Ubicacion'} ];
    const csv = toCSV(rows, headers); downloadCSV(csv, 'faltantes_toma.csv');
  }
  function buildTomaPrintHTML(rows, objetivo){
    const logo = getLogo();
    const fecha = new Date().toLocaleString();
    return `
      <div class="print-doc">
        <div class="head">
          ${logo ? `<img src="${logo}" alt="logo" style="height:42px">` : ''}
          <div class="info">
            <h1>Toma de inventario</h1>
            <div class="meta">${objetivo? 'Ubicación objetivo: '+objetivo+' • ': ''}Fecha: ${fecha}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th>Ubicación actual</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr><td>${r.codigo}</td><td>${r.nombre||''}</td><td>${r.estado||''}</td><td>${r.ubic||''}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="signs">
          <div class="sign"><div>Tomado por</div><div class="line"></div></div>
          <div class="sign"><div>Responsable del inventario</div><div class="line"></div></div>
        </div>
      </div>`;
  }
  function printToma(){
    const objetivo = g('tomaObj')?.value || '';
    const rows = getToma();
    if(!rows.length){ alert('No hay registros de toma para imprimir'); return; }
    const area = g('printArea'); if(!area) return;
    const html = buildTomaPrintHTML(rows, objetivo);
    area.innerHTML = html; area.classList.remove('hidden');
    const safe = s=>String(s||'').replace(/[^\w\-\.]+/g,'_');
    const prevTitle = document.title; document.title = `Toma-${safe(objetivo||'GENERAL')}-${new Date().toISOString().slice(0,10)}`;
    const restore=()=>{ document.title = prevTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
    area.classList.add('hidden'); area.innerHTML='';
  }
  function deleteTomaSelected(){
    const tbody = g('tablaToma')?.querySelector('tbody'); if(!tbody) return;
    const checks = Array.from(tbody.querySelectorAll('.tomaPick')).filter(ch => ch.checked);
    if(!checks.length) return;
    let data = getToma();
    const idxs = checks.map(ch => parseInt(ch.getAttribute('data-idx')||'-1',10)).filter(x=>x>=0).sort((a,b)=>b-a);
    idxs.forEach(i => { data.splice(i,1); });
    setToma(data); renderToma(); updateTomaStats();
  }
  function actualizarUbicDesdeToma(){
    const objetivo = g('tomaObj')?.value || '';
    if(!objetivo){ alert('Selecciona una ubicación objetivo'); return; }
    const data = getToma().filter(r => r.estado==='FUERA');
    if(!data.length){ alert('No hay registros FUERA para actualizar'); return; }
    if(!confirm(`Actualizar ubicacion de ${data.length} equipos a ${objetivo}?`)) return;
    const inv = getInventario();
    let updated=0;
    data.forEach(r => {
      const idx = inv.findIndex(x => (x.codigo||'').toLowerCase() === (r.codigo||'').toLowerCase());
      if(idx>-1){ inv[idx].ubic = objetivo; updated++; }
    });
    setInventario(inv); renderInventario();
    alert(`Ubicaciones actualizadas: ${updated}`);
  }
  function showFaltantesView(){
    const objetivo = g('tomaObj')?.value || '';
    if(!objetivo){ alert('Selecciona una ubicación objetivo'); return; }
    const inv = getInventario();
    const esperados = inv.filter(it => (it.ubic||'')===objetivo);
    const okSet = tomaSession.ok;
    const faltRows = esperados.filter(it => !okSet.has(it.codigo)).map(it => ({ fecha:'', estado:'FALTANTE', codigo:it.codigo, nombre:it.nombre||'', ubic:it.ubic||'' }));
    tomaViewMode = 'faltantes'; renderToma(faltRows); updateTomaStats();
  }
  function showEscaneosView(){ tomaViewMode='scans'; renderToma(); updateTomaStats(); }
  function onBorrarToma(){ if(!confirm('¿Borrar todos los registros de toma?')) return; setToma([]); renderToma(); }
  function mountToma(){
    g('tomaCodigo')?.addEventListener('input', onTomaCodigoInput);
    g('tomaCodigo')?.addEventListener('change', onTomaCodigoInput);
    g('btnTomar')?.addEventListener('click', onTomar);
    g('btnExportToma')?.addEventListener('click', onExportToma);
    g('btnExportFaltantes')?.addEventListener('click', exportFaltantes);
    g('btnTomaDeleteSel')?.addEventListener('click', deleteTomaSelected);
    g('btnActualizarUbic')?.addEventListener('click', actualizarUbicDesdeToma);
    g('btnSoloFaltantes')?.addEventListener('click', showFaltantesView);
    g('btnVerEscaneos')?.addEventListener('click', showEscaneosView);
    g('btnImprimirToma')?.addEventListener('click', printToma);
    g('btnBorrarToma')?.addEventListener('click', onBorrarToma);
    g('tomaObj')?.addEventListener('change', ()=>{ tomaSession={ objetivo:g('tomaObj').value, ok:new Set(), extra:new Set() }; updateTomaStats(); });
    renderToma(); updateTomaStats();
  }

  // ===== Admin: logo empresa =====
  function mountLogoAdmin(){
    const prev = g('logoPreview'); const curLogo = getLogo();
    if(prev){
      if(curLogo){ prev.innerHTML=''; prev.style.backgroundImage=`url('${curLogo}')`; prev.style.backgroundSize='contain'; prev.style.backgroundRepeat='no-repeat'; prev.style.backgroundPosition='left center'; prev.style.minHeight='60px'; }
      else { prev.textContent = 'Sin logo'; prev.style.backgroundImage=''; prev.style.minHeight=''; }
    }
    g('fileLogo')?.addEventListener('change', (e)=>{
      const f = e.target.files?.[0]; if(!f) return;
      const reader = new FileReader(); reader.onload = ()=>{ setLogo(String(reader.result||'')); mountLogoAdmin(); }; reader.readAsDataURL(f);
      e.target.value='';
    });
    g('btnClearLogo')?.addEventListener('click', ()=>{ setLogo(''); mountLogoAdmin(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureCatalogos();
    ensureUsers();
    mountLogin();
    mountTabs();
    mountCatalogos();
    mountImagePreview();
    mountInventario();
    mountTraslados();
    mountToma();
    mountBuscar();
    mountReportes();
    mountAdmin();
    restoreSession();
  });
})();
