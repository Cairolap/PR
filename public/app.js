const $ = (id) => document.getElementById(id);
const formatter = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });

const state = {
  records: [],
  loading: false,
  editingId: null,
  archiveView: false,
  quickFilter: 'all', // 'all' | 'soon' | 'overdue'
  selectedIds: new Set(),
  editingRowIds: new Set()
};

let toastTimer;

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now - offset).toISOString().slice(0, 10);
}

function setTodayLabel() {
  if ($('today-label')) {
    $('today-label').textContent = `ทะเบียนงานจัดซื้อ · ${dateFormatter.format(new Date())}`;
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

function setConnectionStatus(status, text) {
  const el = $('connection-status');
  const txt = $('connection-text');
  if (txt) txt.textContent = text;
  if (el) {
    el.dataset.status = status;
    el.className = `status-indicator-badge ${status}`;
  }
}

function setLoading(loading) {
  state.loading = loading;
  $('records').setAttribute('aria-busy', String(loading));
  $('loading-state').hidden = !loading;
  $('add-record').disabled = loading;
  if (loading) {
    setConnectionStatus('loading', 'กำลังโหลด');
  } else {
    setConnectionStatus('ready', 'พร้อมใช้งาน');
  }
}

function apiError(message) {
  setConnectionStatus('error', 'เชื่อมต่อไม่ได้');
  $('error-message').textContent = message;
  $('error-state').hidden = false;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'คำขอไม่สำเร็จ');
    error.fields = data.fields || {};
    throw error;
  }
  return data;
}

function deliveryStatus(value) {
  if (!value) return '';
  const today = localDate();
  if (value < today) return 'overdue';
  if (value <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)) return 'soon';
  return 'normal';
}

function filteredRecords() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const from = $('date-from').value;
  const to = $('date-to').value;
  const areaFilter = $('filter-area')?.value || '';

  return state.records.filter((record) => {
    const matchesText = !query || [record.orderNumber, record.description, record.area, record.requestRef, record.poNumber]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    
    const matchesFrom = !from || record.createdDate >= from;
    const matchesTo = !to || record.createdDate <= to;
    const matchesArea = !areaFilter || record.area === areaFilter;

    let matchesQuick = true;
    const status = deliveryStatus(record.deliveryDate);
    if (state.quickFilter === 'soon') {
      matchesQuick = status === 'soon';
    } else if (state.quickFilter === 'overdue') {
      matchesQuick = status === 'overdue';
    }

    return matchesText && matchesFrom && matchesTo && matchesArea && matchesQuick;
  });
}

function formatDate(value) {
  if (!value) return '—';
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function actionButton(label, className, action, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = String(id);
  return button;
}

function cell(value, className = '') {
  const element = document.createElement('td');
  if (className) element.className = className;
  element.textContent = value || '—';
  return element;
}

const AREA_GROUPS = {
  'CC': ['CC CENTER', 'CC Line 1', 'CC Line 2', 'CC Line 4', 'CC Line 5', 'CC Line 6'],
  'PP': ['PP CENTER', 'PP 28IR', 'PP 22STD', 'PP 28SHL1', 'PP 28SHL2', 'PP 28STD2', 'PP 28IR2', 'PP 28STD7', 'PP 28STD6', 'PP 28STD5', 'PP 30ED15DIE', 'PP 28SHL4', 'PP 28DEEP', 'PP COMPOSITE 1', 'PP COMPOSITE 2'],
  'MX': ['MX CENTER', 'MX MX301', 'MX MX302', 'MX MX303', 'MX XP331', 'MX XP332', 'MX XC362', 'MX XC364', 'MX XC361', 'MX Scroll Shear'],
  'PC': ['PC CENTER', 'PC CP01', 'PC CP02', 'PC CP03', 'PC CP04', 'PC CP05', 'PC CP06', 'PC CP07', 'PC CP08', 'PC CP09', 'PC CP10', 'PC INJ'],
  'PR': ['PR CENTER', 'PR Line 1', 'PR Line 2', 'PR Line 3', 'PR Line 5', 'PR Line 8', 'PR Line 9', 'PR Line 6', 'PR Line 10', 'PR Line 7', 'PR อื่นๆ']
};

function createAreaSelect(currentValue = '') {
  const select = document.createElement('select');
  select.className = 'grid-select';
  select.name = 'area';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- พื้นที่ --';
  select.appendChild(defaultOption);

  for (const [groupName, areas] of Object.entries(AREA_GROUPS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupName;
    for (const area of areas) {
      const option = document.createElement('option');
      option.value = area;
      option.textContent = area;
      if (area === currentValue) option.selected = true;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  return select;
}

function makeRow(record) {
  const row = document.createElement('tr');
  row.dataset.id = String(record.id);

  const isEditing = state.editingRowIds.has(record.id);

  if (isEditing) {
    row.classList.add('editing-row');
  } else if (state.selectedIds.has(record.id)) {
    row.classList.add('row-selected');
  }

  // Checkbox column
  const selectTd = document.createElement('td');
  selectTd.className = 'select-cell';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'row-checkbox';
  checkbox.checked = state.selectedIds.has(record.id);
  checkbox.dataset.id = String(record.id);
  checkbox.setAttribute('aria-label', `เลือก ${record.orderNumber}`);
  if (isEditing) checkbox.disabled = true;
  selectTd.appendChild(checkbox);

  if (isEditing) {
    // 1. Date
    const dateTd = document.createElement('td');
    dateTd.className = 'date-cell';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'grid-input grid-date';
    dateInput.name = 'createdDate';
    dateInput.value = record.createdDate || localDate();
    dateInput.required = true;
    dateTd.appendChild(dateInput);

    // 2. Order
    const orderTd = document.createElement('td');
    orderTd.className = 'order-cell';
    const orderInput = document.createElement('input');
    orderInput.type = 'text';
    orderInput.className = 'grid-input';
    orderInput.name = 'orderNumber';
    orderInput.value = record.orderNumber || '';
    orderInput.required = true;
    orderTd.appendChild(orderInput);

    // 3. Area
    const areaTd = document.createElement('td');
    areaTd.className = 'area-cell';
    const areaSelect = createAreaSelect(record.area || '');
    areaTd.appendChild(areaSelect);

    // 4. Description
    const descTd = document.createElement('td');
    descTd.className = 'description-cell';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'grid-input';
    descInput.name = 'description';
    descInput.value = record.description || '';
    descInput.required = true;
    descTd.appendChild(descInput);

    // 5. Qty
    const qtyTd = document.createElement('td');
    qtyTd.className = 'number data-cell';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'grid-input grid-num';
    qtyInput.name = 'quantity';
    qtyInput.min = '1';
    qtyInput.value = record.quantity || 1;
    qtyInput.required = true;
    qtyTd.appendChild(qtyInput);

    // 6. Price
    const priceTd = document.createElement('td');
    priceTd.className = 'number data-cell';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.className = 'grid-input grid-num';
    priceInput.name = 'price';
    priceInput.step = '0.01';
    priceInput.min = '0';
    priceInput.placeholder = '0.00';
    priceInput.value = record.priceSatang > 0 ? (record.priceSatang / 100).toFixed(2) : '';
    priceTd.appendChild(priceInput);

    // 7. PR
    const prTd = document.createElement('td');
    prTd.className = 'code-cell';
    const prInput = document.createElement('input');
    prInput.type = 'text';
    prInput.className = 'grid-input';
    prInput.name = 'requestRef';
    prInput.placeholder = 'PR';
    prInput.value = record.requestRef || '';
    prTd.appendChild(prInput);

    // 8. PO
    const poTd = document.createElement('td');
    poTd.className = 'code-cell';
    const poInput = document.createElement('input');
    poInput.type = 'text';
    poInput.className = 'grid-input';
    poInput.name = 'poNumber';
    poInput.placeholder = 'PO';
    poInput.value = record.poNumber || '';
    poTd.appendChild(poInput);

    // 9. Delivery Date
    const deliveryTd = document.createElement('td');
    deliveryTd.className = 'delivery-cell';
    const deliveryInput = document.createElement('input');
    deliveryInput.type = 'date';
    deliveryInput.className = 'grid-input grid-date';
    deliveryInput.name = 'deliveryDate';
    deliveryInput.value = record.deliveryDate || '';
    deliveryTd.appendChild(deliveryInput);

    // 10. Row Actions
    const actionsTd = document.createElement('td');
    actionsTd.className = 'row-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action-btn-pill';
    cancelBtn.textContent = '✕ ปิด';
    cancelBtn.title = 'ยกเลิกการแก้ไขแถวนี้';
    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      state.editingRowIds.delete(record.id);
      updateBulkActionBar(filteredRecords().length);
      render();
    };
    actionsTd.appendChild(cancelBtn);

    row.append(selectTd, dateTd, orderTd, areaTd, descTd, qtyTd, priceTd, prTd, poTd, deliveryTd, actionsTd);
    return row;
  }

  // Date
  const dateTd = cell(formatDate(record.createdDate), 'date-cell');

  // Order
  const orderTd = cell(record.orderNumber, 'order-cell');

  // Area Badge
  const areaTd = document.createElement('td');
  areaTd.className = 'area-cell';
  if (record.area) {
    const badge = document.createElement('span');
    badge.className = 'badge-area';
    badge.textContent = record.area;
    badge.title = record.area;
    areaTd.appendChild(badge);
  } else {
    areaTd.textContent = '—';
  }

  // Description
  const descTd = cell(record.description, 'description-cell');
  descTd.title = record.description;

  // Qty
  const qtyTd = cell(String(record.quantity), 'number data-cell');

  // Price
  const priceTd = cell(`฿${formatter.format(record.priceSatang / 100)}`, 'number data-cell');

  // PR / Ref Badge
  const prTd = document.createElement('td');
  prTd.className = 'code-cell';
  if (record.requestRef) {
    const span = document.createElement('span');
    span.className = 'badge-code';
    span.textContent = record.requestRef;
    prTd.appendChild(span);
  } else {
    prTd.textContent = '—';
  }

  // PO Badge
  const poTd = document.createElement('td');
  poTd.className = 'code-cell';
  if (record.poNumber) {
    const span = document.createElement('span');
    span.className = 'badge-code';
    span.textContent = record.poNumber;
    poTd.appendChild(span);
  } else {
    poTd.textContent = '—';
  }

  // Delivery status chip
  const deliveryTd = document.createElement('td');
  deliveryTd.className = 'delivery-cell';
  if (record.deliveryDate) {
    const status = deliveryStatus(record.deliveryDate);
    const tag = document.createElement('span');
    tag.className = `delivery-tag ${status}`;
    tag.textContent = formatDate(record.deliveryDate);
    deliveryTd.appendChild(tag);
  } else {
    deliveryTd.textContent = '—';
  }

  // Row Hover Actions
  const actionsTd = document.createElement('td');
  actionsTd.className = 'row-actions';
  const group = document.createElement('div');
  group.className = 'row-action-group';

  if (state.archiveView) {
    group.append(actionButton('นำกลับ', 'action-btn-pill restore-btn', 'restore', record.id));
  } else {
    group.append(
      actionButton('แก้ไข', 'action-btn-pill', 'edit', record.id),
      actionButton('จัดเก็บ', 'action-btn-pill archive-btn', 'archive', record.id)
    );
  }
  actionsTd.appendChild(group);

  row.append(selectTd, dateTd, orderTd, areaTd, descTd, qtyTd, priceTd, prTd, poTd, deliveryTd, actionsTd);
  return row;
}

function makeCard(record) {
  const card = document.createElement('article');
  card.className = 'record-card';

  const top = document.createElement('div');
  top.className = 'card-top';
  const order = document.createElement('span');
  order.className = 'card-order';
  order.textContent = record.orderNumber;
  const date = document.createElement('span');
  date.className = 'card-date';
  date.textContent = formatDate(record.createdDate);
  top.append(order, date);

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = record.description;

  const pills = document.createElement('div');
  pills.className = 'card-pills';
  
  if (record.area) {
    const aPill = document.createElement('span');
    aPill.className = 'badge-area';
    aPill.textContent = `พื้นที่: ${record.area}`;
    pills.append(aPill);
  }

  const qtyPill = document.createElement('span');
  qtyPill.className = 'badge-code';
  qtyPill.textContent = `จำนวน: ${record.quantity}`;
  
  const pricePill = document.createElement('span');
  pricePill.className = 'badge-code';
  pricePill.textContent = `฿${formatter.format(record.priceSatang / 100)}`;

  pills.append(qtyPill, pricePill);

  if (record.requestRef) {
    const refPill = document.createElement('span');
    refPill.className = 'badge-code';
    refPill.textContent = `PR: ${record.requestRef}`;
    pills.append(refPill);
  }

  if (record.deliveryDate) {
    const status = deliveryStatus(record.deliveryDate);
    const dPill = document.createElement('span');
    dPill.className = `delivery-tag ${status}`;
    dPill.textContent = `ส่งมอบ: ${formatDate(record.deliveryDate)}`;
    pills.append(dPill);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions-bar';
  if (state.archiveView) {
    actions.append(actionButton('นำกลับสู่รายการหลัก', 'button ghost', 'restore', record.id));
  } else {
    actions.append(
      actionButton('แก้ไข', 'button ghost', 'edit', record.id),
      actionButton('จัดเก็บ', 'button ghost', 'archive', record.id)
    );
  }

  card.append(top, desc, pills, actions);
  return card;
}

function updateStats(records) {
  let totalSatang = 0;
  let totalItems = 0;

  records.forEach((r) => {
    totalSatang += (r.priceSatang || 0);
    totalItems += (Number(r.quantity) || 0);
  });

  if ($('stat-total-amount')) {
    $('stat-total-amount').textContent = `฿${formatter.format(totalSatang / 100)}`;
  }
  if ($('stat-total-items')) {
    $('stat-total-items').textContent = `${totalItems.toLocaleString('th-TH')} ชิ้น`;
  }
}

function updateBulkActionBar(visibleCount) {
  const selectedCount = state.selectedIds.size;
  const editingCount = state.editingRowIds.size;
  const bar = $('bulk-action-bar');
  const countText = $('bulk-selected-count');
  const normalActions = $('bulk-normal-actions');
  const editActions = $('bulk-edit-actions');
  const selectAll = $('select-all-checkbox');

  if (editingCount > 0) {
    if (bar) bar.hidden = false;
    if (countText) countText.textContent = `กำลังแก้ไขข้อมูล ${editingCount} รายการ`;
    if (normalActions) normalActions.hidden = true;
    if (editActions) editActions.hidden = false;
  } else if (selectedCount > 0) {
    if (bar) bar.hidden = false;
    if (countText) countText.textContent = `เลือกแล้ว ${selectedCount} รายการ`;
    if (normalActions) normalActions.hidden = false;
    if (editActions) editActions.hidden = true;
  } else {
    if (bar) bar.hidden = true;
    if (normalActions) normalActions.hidden = false;
    if (editActions) editActions.hidden = true;
  }

  if (selectAll) {
    if (selectedCount === 0) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    } else if (selectedCount === visibleCount && visibleCount > 0) {
      selectAll.checked = true;
      selectAll.indeterminate = false;
    } else {
      selectAll.checked = false;
      selectAll.indeterminate = true;
    }
  }
}

function render() {
  const records = filteredRecords();
  const isFiltered = Boolean(
    $('search').value || $('date-from').value || $('date-to').value ||
    ($('filter-area')?.value) || state.quickFilter !== 'all'
  );

  $('clear-search').hidden = !$('search').value;

  const hasAdvancedFilter = Boolean($('date-from').value || $('date-to').value || ($('filter-area')?.value));
  if ($('active-filter-tag')) {
    $('active-filter-tag').hidden = !hasAdvancedFilter;
  }

  const listName = state.archiveView ? 'รายการที่เก็บ' : 'รายการหลัก';
  $('result-summary').textContent = isFiltered
    ? `พบ ${records.length} จาก ${state.records.length} รายการ`
    : `${listName} ${state.records.length} รายการ`;

  // Update counts on sidebar
  if (!state.archiveView) {
    $('inbox-count').textContent = state.records.length;
  } else {
    $('archive-count').textContent = state.records.length;
  }

  updateStats(records);

  $('record-rows').replaceChildren(...records.map(makeRow));
  $('record-cards').replaceChildren(...records.map(makeCard));

  const empty = records.length === 0;
  $('empty-state').hidden = !empty;
  $('table-scroll').hidden = empty;
  $('record-cards').hidden = empty;

  $('empty-title').textContent = state.records.length
    ? 'ไม่พบรายการที่ตรงกัน'
    : state.archiveView
      ? 'ยังไม่มีรายการที่เก็บ'
      : 'ยังไม่มีรายการ';

  $('empty-copy').textContent = state.records.length
    ? 'ลองล้างคำค้นหรือช่วงวันที่ แล้วตรวจสอบอีกครั้ง'
    : state.archiveView
      ? 'รายการที่จัดเก็บจะปรากฏที่นี่ และนำกลับสู่รายการหลักได้ทุกเมื่อ'
      : 'เริ่มบันทึกใบเสนอซื้อหรือการเบิกสโตร์รายการแรกได้เลย';

  $('empty-add').textContent = state.records.length
    ? 'ล้างตัวกรอง'
    : state.archiveView
      ? 'กลับไปยังรายการหลัก'
      : '+ เพิ่มรายการแรก';

  // Toggle active sidebar item style
  $('nav-inbox').classList.toggle('active', !state.archiveView);
  $('nav-archive').classList.toggle('active', state.archiveView);

  // Hide add record button in archive view
  $('add-record').hidden = state.archiveView;

  updateBulkActionBar(records.length);
}

async function loadRecords(showSuccess = false) {
  setLoading(true);
  $('error-state').hidden = true;
  try {
    const data = await request(`/api/records?archived=${state.archiveView}`);
    state.records = data.records || [];
    state.selectedIds.clear();
    render();
    if (showSuccess) showToast('อัปเดตรายการล่าสุดแล้ว');
  } catch (error) {
    if (!state.records.length) apiError(error.message || 'ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    else showToast('โหลดข้อมูลล่าสุดไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function clearFormErrors() {
  document.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
}

function setFormErrors(errors) {
  clearFormErrors();
  Object.entries(errors).forEach(([name, message]) => {
    const element = $(`error-${name}`);
    if (element) element.textContent = message;
  });
}

function makeSplitRow(record) {
  const row = document.createElement('tr');
  row.dataset.id = String(record.id);
  if (state.editingId === record.id) {
    row.classList.add('active-edit-row');
  }

  const dateTd = cell(formatDate(record.createdDate), 'date-cell');
  const orderTd = cell(record.orderNumber, 'order-cell');

  const areaTd = document.createElement('td');
  areaTd.className = 'area-cell';
  if (record.area) {
    const badge = document.createElement('span');
    badge.className = 'badge-area';
    badge.textContent = record.area;
    areaTd.appendChild(badge);
  } else {
    areaTd.textContent = '—';
  }

  const descTd = cell(record.description, 'description-cell');
  descTd.title = record.description;

  const qtyTd = cell(String(record.quantity), 'number data-cell');
  const priceVal = record.priceSatang > 0 ? `฿${formatter.format(record.priceSatang / 100)}` : '—';
  const priceTd = cell(priceVal, 'number data-cell');

  const prTd = cell(record.requestRef || '—', 'code-cell');
  const poTd = cell(record.poNumber || '—', 'code-cell');

  const deliveryTd = document.createElement('td');
  deliveryTd.className = 'delivery-cell';
  if (record.deliveryDate) {
    const status = deliveryStatus(record.deliveryDate);
    const tag = document.createElement('span');
    tag.className = `delivery-tag ${status}`;
    tag.textContent = formatDate(record.deliveryDate);
    deliveryTd.appendChild(tag);
  } else {
    deliveryTd.textContent = '—';
  }

  row.append(dateTd, orderTd, areaTd, descTd, qtyTd, priceTd, prTd, poTd, deliveryTd);
  return row;
}

function renderSplitTable() {
  const rowsEl = $('split-record-rows');
  const countEl = $('split-table-count');
  if (!rowsEl) return;
  const records = state.records || [];
  if (countEl) countEl.textContent = `${records.length} รายการ`;
  rowsEl.replaceChildren(...records.map(makeSplitRow));
}

function recordToForm(record) {
  return {
    orderNumber: record.orderNumber,
    description: record.description,
    quantity: record.quantity,
    price: record.priceSatang > 0 ? (record.priceSatang / 100).toFixed(2) : '',
    requestRef: record.requestRef || '',
    poNumber: record.poNumber || '',
    deliveryDate: record.deliveryDate || '',
    area: record.area || '',
    createdDate: record.createdDate
  };
}

function resetDialogForm() {
  state.editingId = null;
  const form = $('record-form');
  form.reset();
  clearFormErrors();
  form.elements.createdDate.value = localDate();
  if ($('dialog-kicker')) $('dialog-kicker').textContent = 'NEW ENTRY';
  if ($('dialog-title')) $('dialog-title').textContent = 'เพิ่มรายการจัดซื้อ / เบิกสโตร์';
  if ($('form-mode-title')) $('form-mode-title').textContent = 'กรอกข้อมูลรายการใหม่';
  if ($('save-record')) $('save-record').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>บันทึกรายการ</span>';
  renderSplitTable();
  $('order-number').focus();
}

function openDialog(record = null) {
  state.editingId = record?.id || null;
  const form = $('record-form');
  form.reset();
  clearFormErrors();
  const values = record ? recordToForm(record) : { createdDate: localDate() };
  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value;
  });
  if ($('dialog-kicker')) $('dialog-kicker').textContent = record ? `EDIT / #${record.id}` : 'NEW ENTRY';
  if ($('dialog-title')) $('dialog-title').textContent = record ? `แก้ไขรายการ: ${record.orderNumber}` : 'เพิ่มรายการจัดซื้อ / เบิกสโตร์';
  if ($('form-mode-title')) $('form-mode-title').textContent = record ? `กำลังแก้ไข: ${record.orderNumber}` : 'กรอกข้อมูลรายการใหม่';
  if ($('save-record')) $('save-record').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${record ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}</span>`;
  
  renderSplitTable();

  if (window.innerWidth <= 900) toggleSidebar(false);
  document.body.classList.add('workspace-entry-active');
  if ($('view-ledger')) $('view-ledger').hidden = true;
  if ($('view-entry')) $('view-entry').hidden = false;
  $('order-number').focus();
}

function closeDialog(force = false) {
  document.body.classList.remove('workspace-entry-active');
  if ($('view-entry')) $('view-entry').hidden = true;
  if ($('view-ledger')) $('view-ledger').hidden = false;
  state.editingId = null;
}

function formData() {
  return Object.fromEntries(new FormData($('record-form')).entries());
}

async function saveRecord(event) {
  event.preventDefault();
  const save = $('save-record');
  save.disabled = true;
  clearFormErrors();
  try {
    const isEditing = Boolean(state.editingId);
    await request(isEditing ? `/api/records/${state.editingId}` : '/api/records', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(formData())
    });
    showToast(isEditing ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการใหม่สำเร็จ');
    await loadRecords();
    
    // Live update right table without clearing left form for next entry
    if (isEditing) {
      state.editingId = null;
      if ($('dialog-kicker')) $('dialog-kicker').textContent = 'NEW ENTRY';
      if ($('dialog-title')) $('dialog-title').textContent = 'เพิ่มรายการจัดซื้อ / เบิกสโตร์';
      if ($('form-mode-title')) $('form-mode-title').textContent = 'กรอกข้อมูลรายการใหม่';
      if ($('save-record')) $('save-record').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>บันทึกรายการ</span>';
    }
    renderSplitTable();
  } catch (error) {
    setFormErrors(error.fields || {});
    if (!error.fields || !Object.keys(error.fields).length) showToast(error.message || 'บันทึกไม่สำเร็จ');
  } finally {
    save.disabled = false;
  }
}

async function archiveRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record || !window.confirm(`จัดเก็บรายการ ${record.orderNumber} ใช่หรือไม่?\nรายการจะไม่แสดงบนหน้าหลัก แต่ยังนำกลับมาได้`)) return;
  try {
    await request(`/api/records/${id}/archive`, { method: 'POST' });
    await loadRecords();
    showToast('จัดเก็บรายการแล้ว');
  } catch (error) {
    showToast(error.message || 'จัดเก็บรายการไม่สำเร็จ');
  }
}

async function restoreRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record || !window.confirm(`นำรายการ ${record.orderNumber} กลับสู่รายการหลักใช่หรือไม่?`)) return;
  try {
    await request(`/api/records/${id}/restore`, { method: 'POST' });
    await loadRecords();
    showToast('นำรายการกลับสู่รายการหลักแล้ว');
  } catch (error) {
    showToast(error.message || 'นำรายการกลับไม่สำเร็จ');
  }
}

// Bulk Actions Logic
function openBatchAreaDialog() {
  if (!state.selectedIds.size) return;
  $('batch-dialog-desc').textContent = `เลือกพื้นที่ใหม่สำหรับ ${state.selectedIds.size} รายการที่เลือก:`;
  $('batch-area-select').value = '';
  $('batch-area-dialog').showModal();
}

async function handleBatchSaveArea(event) {
  event.preventDefault();
  const newArea = $('batch-area-select').value;
  if (!newArea) return;

  const btn = $('save-batch-area');
  btn.disabled = true;
  try {
    await request('/api/records/batch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateArea',
        ids: Array.from(state.selectedIds),
        area: newArea
      })
    });
    $('batch-area-dialog').close();
    showToast(`อัปเดตพื้นที่เป็น "${newArea}" ให้ ${state.selectedIds.size} รายการแล้ว`);
    await loadRecords();
  } catch (error) {
    showToast(error.message || 'อัปเดตพื้นที่ไม่สำเร็จ');
  } finally {
    btn.disabled = false;
  }
}

function enterTableEditMode() {
  if (!state.selectedIds.size) return;
  state.editingRowIds = new Set(state.selectedIds);
  updateBulkActionBar(filteredRecords().length);
  render();
}

function cancelTableEditMode() {
  state.editingRowIds.clear();
  updateBulkActionBar(filteredRecords().length);
  render();
}

async function saveTableEdits() {
  const saveBtn = $('bulk-save-edits-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>กำลังบันทึก...</span>';
  }

  try {
    const updates = [];
    const rows = document.querySelectorAll('#record-rows tr.editing-row[data-id]');

    for (const row of rows) {
      const id = Number(row.dataset.id);
      const createdDate = row.querySelector('[name="createdDate"]')?.value;
      const orderNumber = row.querySelector('[name="orderNumber"]')?.value?.trim();
      const area = row.querySelector('[name="area"]')?.value?.trim();
      const description = row.querySelector('[name="description"]')?.value?.trim();
      const quantity = row.querySelector('[name="quantity"]')?.value;
      const price = row.querySelector('[name="price"]')?.value;
      const requestRef = row.querySelector('[name="requestRef"]')?.value?.trim();
      const poNumber = row.querySelector('[name="poNumber"]')?.value?.trim();
      const deliveryDate = row.querySelector('[name="deliveryDate"]')?.value;

      if (!orderNumber || !description || !createdDate || !quantity) {
        throw new Error(`กรุณากรอก วันที่, ORDER, รายละเอียดสินค้า และจำนวน ให้ครบถ้วน`);
      }

      updates.push({
        id,
        createdDate,
        orderNumber,
        area: area || null,
        description,
        quantity: Number(quantity),
        price: price ? String(price) : '',
        requestRef: requestRef || null,
        poNumber: poNumber || null,
        deliveryDate: deliveryDate || null
      });
    }

    if (!updates.length) {
      cancelTableEditMode();
      return;
    }

    await request('/api/records/batch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'batchUpdate',
        updates
      })
    });

    showToast(`บันทึกข้อมูล ${updates.length} รายการเรียบร้อยแล้ว`);
    state.editingRowIds.clear();
    state.selectedIds.clear();
    await loadRecords();
  } catch (error) {
    showToast(error.message || 'บันทึกข้อมูลไม่สำเร็จ');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>บันทึกข้อมูลที่แก้ไข</span>';
    }
  }
}

async function handleBatchArchive() {
  const count = state.selectedIds.size;
  if (!count) return;
  if (!window.confirm(`ยืนยันการจัดเก็บ ${count} รายการที่เลือกใช่หรือไม่?`)) return;

  try {
    await request('/api/records/batch', {
      method: 'POST',
      body: JSON.stringify({
        action: state.archiveView ? 'restore' : 'archive',
        ids: Array.from(state.selectedIds)
      })
    });
    showToast(`${state.archiveView ? 'นำกลับ' : 'จัดเก็บ'} ${count} รายการเรียบร้อยแล้ว`);
    await loadRecords();
  } catch (error) {
    showToast(error.message || 'ดำเนินการไม่สำเร็จ');
  }
}

function toggleSelectAll(checked) {
  const visible = filteredRecords();
  if (checked) {
    visible.forEach((r) => state.selectedIds.add(r.id));
  } else {
    visible.forEach((r) => state.selectedIds.delete(r.id));
  }
  render();
}

function handleTableClick(event) {
  // If clicking inside input or select in an editing row, ignore click navigation
  if (event.target.closest('.grid-input') || event.target.closest('.grid-select')) {
    return;
  }

  // Checkbox toggle
  const checkbox = event.target.closest('.row-checkbox');
  if (checkbox) {
    const id = Number(checkbox.dataset.id);
    if (checkbox.checked) {
      state.selectedIds.add(id);
    } else {
      state.selectedIds.delete(id);
    }
    const row = event.target.closest('tr');
    if (row) row.classList.toggle('row-selected', checkbox.checked);
    updateBulkActionBar(filteredRecords().length);
    return;
  }

  // Action button (Edit, Archive, Restore)
  const button = event.target.closest('button[data-action]');
  if (button) {
    const id = Number(button.dataset.id);
    const record = state.records.find((item) => item.id === id);
    if (button.dataset.action === 'edit' && record) {
      state.editingRowIds.add(record.id);
      updateBulkActionBar(filteredRecords().length);
      render();
      return;
    }
    if (button.dataset.action === 'archive') archiveRecord(id);
    if (button.dataset.action === 'restore') restoreRecord(id);
    return;
  }

  // If this row is currently editing, do nothing on row click
  const tr = event.target.closest('tr[data-id]');
  if (tr && state.editingRowIds.has(Number(tr.dataset.id))) {
    return;
  }

  // Clicking anywhere else on row opens edit (if not archived)
  if (tr && !state.archiveView) {
    const id = Number(tr.dataset.id);
    const record = state.records.find((item) => item.id === id);
    if (record) openDialog(record);
  }
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv() {
  const records = filteredRecords();
  const header = ['วันที่สร้าง', 'ORDER', 'พื้นที่', 'Description', 'Qty', 'Price (บาท)', 'PR / เบิกสโตร์', 'PO', 'Delivery'];
  const lines = [
    header,
    ...records.map((record) => [
      record.createdDate,
      record.orderNumber,
      record.area || '',
      record.description,
      record.quantity,
      (record.priceSatang / 100).toFixed(2),
      record.requestRef,
      record.poNumber,
      record.deliveryDate
    ])
  ].map((row) => row.map(csvCell).join(','));

  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `purchase-requisition-${localDate()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`ส่งออก ${records.length} รายการแล้ว`);
}

function clearFilters() {
  $('search').value = '';
  $('date-from').value = '';
  $('date-to').value = '';
  if ($('filter-area')) $('filter-area').value = '';
  state.quickFilter = 'all';
  updateQuickFilterChips();
  render();
  $('search').focus();
}

function updateQuickFilterChips() {
  $('filter-chip-all')?.classList.toggle('active', state.quickFilter === 'all');
  $('filter-chip-soon')?.classList.toggle('active', state.quickFilter === 'soon');
  $('filter-chip-overdue')?.classList.toggle('active', state.quickFilter === 'overdue');
}

function toggleDatePopover(show) {
  const popover = $('filter-popover');
  const toggleBtn = $('filter-dropdown-toggle');
  if (!popover) return;
  const isHidden = typeof show === 'boolean' ? !show : !popover.hidden;
  popover.hidden = isHidden;
  toggleBtn?.setAttribute('aria-expanded', String(!isHidden));
}

function bindEvents() {
  $('add-record').onclick = () => openDialog();
  $('empty-add').onclick = () => (state.records.length ? clearFilters() : state.archiveView ? switchToInbox() : openDialog());
  $('close-dialog').onclick = closeDialog;
  $('cancel-dialog').onclick = closeDialog;
  $('record-form').addEventListener('submit', saveRecord);
  
  $('record-rows').onclick = handleTableClick;
  $('record-cards').onclick = handleTableClick;
  
  $('retry-load').onclick = () => loadRecords(true);
  $('refresh-btn').onclick = () => loadRecords(true);
  $('export-csv').onclick = exportCsv;

  // Select all checkbox
  $('select-all-checkbox')?.addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });

  // Bulk action buttons
  $('bulk-edit-table-btn')?.addEventListener('click', enterTableEditMode);
  $('bulk-save-edits-btn')?.addEventListener('click', saveTableEdits);
  $('bulk-cancel-edits-btn')?.addEventListener('click', cancelTableEditMode);
  $('bulk-edit-area-btn')?.addEventListener('click', openBatchAreaDialog);
  $('bulk-archive-btn')?.addEventListener('click', handleBatchArchive);
  $('bulk-clear-selection-btn')?.addEventListener('click', () => {
    state.selectedIds.clear();
    state.editingRowIds.clear();
    render();
  });

  // Batch dialog
  $('close-batch-dialog')?.addEventListener('click', () => $('batch-area-dialog').close());
  $('cancel-batch-dialog')?.addEventListener('click', () => $('batch-area-dialog').close());
  $('batch-area-form')?.addEventListener('submit', handleBatchSaveArea);

  // Navigation tabs
  $('nav-inbox').onclick = () => switchToInbox();
  $('nav-archive').onclick = () => switchToArchive();

  // Search & Filters
  $('search').addEventListener('input', render);
  $('date-from').addEventListener('change', render);
  $('date-to').addEventListener('change', render);
  $('filter-area')?.addEventListener('change', render);
  $('clear-search').onclick = () => {
    $('search').value = '';
    render();
    $('search').focus();
  };

  // Date Popover controls
  $('filter-dropdown-toggle')?.addEventListener('click', () => toggleDatePopover());
  $('apply-filters-btn')?.addEventListener('click', () => {
    toggleDatePopover(false);
    render();
  });
  $('clear-filters-btn')?.addEventListener('click', () => {
    $('date-from').value = '';
    $('date-to').value = '';
    if ($('filter-area')) $('filter-area').value = '';
    toggleDatePopover(false);
    render();
  });
  $('clear-filters-chip')?.addEventListener('click', () => {
    $('date-from').value = '';
    $('date-to').value = '';
    if ($('filter-area')) $('filter-area').value = '';
    render();
  });

  // Quick Filter Chips
  $('filter-chip-all')?.addEventListener('click', () => {
    state.quickFilter = 'all';
    updateQuickFilterChips();
    render();
  });
  $('filter-chip-soon')?.addEventListener('click', () => {
    state.quickFilter = 'soon';
    updateQuickFilterChips();
    render();
  });
  $('filter-chip-overdue')?.addEventListener('click', () => {
    state.quickFilter = 'overdue';
    updateQuickFilterChips();
    render();
  });

  // Split Screen Controls
  $('reset-form-btn')?.addEventListener('click', resetDialogForm);
  $('clear-form-btn')?.addEventListener('click', resetDialogForm);
  $('split-record-rows')?.addEventListener('click', (event) => {
    const tr = event.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    const record = state.records.find((r) => r.id === id);
    if (record) openDialog(record);
  });

  // Sidebar toggle (desktop collapse / mobile drawer)
  $('menu-toggle')?.addEventListener('click', () => toggleSidebar());
  $('sidebar-backdrop')?.addEventListener('click', () => toggleSidebar(false));

  // Escape key to close entry view, mobile sidebar, or cancel table editing
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (window.innerWidth <= 900 && $('app-sidebar')?.classList.contains('open')) {
        toggleSidebar(false);
        return;
      }
      if (state.editingRowIds.size > 0) {
        cancelTableEditMode();
        return;
      }
      if ($('view-entry') && !$('view-entry').hidden) {
        closeDialog();
      }
    }
  });
}

function toggleSidebar(isOpen) {
  const isMobile = window.innerWidth <= 900;
  const sidebar = $('app-sidebar');
  const backdrop = $('sidebar-backdrop');
  const toggleBtn = $('menu-toggle');
  if (!sidebar) return;

  if (isMobile) {
    const shouldOpen = typeof isOpen === 'boolean' ? isOpen : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', shouldOpen);
    if (backdrop) {
      backdrop.hidden = !shouldOpen;
      backdrop.classList.toggle('active', shouldOpen);
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(shouldOpen));
      toggleBtn.title = shouldOpen ? 'ปิดแถบเมนูด้านข้าง' : 'เปิดแถบเมนูด้านข้าง';
    }
  } else {
    const isCollapsed = typeof isOpen === 'boolean'
      ? !isOpen
      : !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
      toggleBtn.title = isCollapsed ? 'แสดงแถบเมนูด้านข้าง' : 'ซ่อนแถบเมนูด้านข้าง';
    }
    try {
      localStorage.setItem('pr_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    } catch (_) {}
  }
}

function initSidebarState() {
  try {
    if (window.innerWidth > 900 && localStorage.getItem('pr_sidebar_collapsed') === 'true') {
      document.body.classList.add('sidebar-collapsed');
      const toggleBtn = $('menu-toggle');
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.title = 'แสดงแถบเมนูด้านข้าง';
      }
    }
  } catch (_) {}
}

function switchToInbox() {
  if (window.innerWidth <= 900) toggleSidebar(false);
  if (!state.archiveView) return;
  state.archiveView = false;
  state.selectedIds.clear();
  clearFilters();
  loadRecords();
}

function switchToArchive() {
  if (window.innerWidth <= 900) toggleSidebar(false);
  if (state.archiveView) return;
  state.archiveView = true;
  state.selectedIds.clear();
  clearFilters();
  loadRecords();
}

setTodayLabel();
initSidebarState();
bindEvents();
loadRecords();
