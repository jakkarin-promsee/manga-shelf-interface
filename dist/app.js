const root = document.getElementById('root');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themes = ['#254464','#315574','#233d65','#36576b','#284d71','#314b69'];
const color = title => themes[Array.from(title || '').reduce((sum, c) => sum + c.charCodeAt(0),0) % themes.length];
let items = [], query = '', sort = 'updated', editing = null, busy = new Set(), error = '', toastTimer, cardSize = 158, draggedId = null, draggedCategoryId = null, suppressClickUntil = 0;
let dragPointer = null, scrollFrame = 0;
let categories = [{ id: 'main', name: 'หมวดหลัก' }];
const icon = {book:'▧',plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',minus:'−',edit:'✎',search:'⌕',close:'×',check:'✓',trash:'⌫',up:'↗'};

async function api(url, options) {
  const response = await fetch(url, { ...options, headers: {'Content-Type':'application/json'} });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'บันทึกไม่สำเร็จ');
  return data;
}
function cover(item, extra='') {
  const title = escape(item.title || 'YOUR STORY');
  const img = item.cover ? `<img src="${escape(item.cover)}" alt="ปก ${title}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
  return `<div class="cover ${extra}" style="--cover-color:${color(item.title)}">${img}<div class="cover-fallback" style="display:${item.cover?'none':'flex'}"><span class="cover-ornament">✳</span><span class="cover-fallback-title">${title}</span><span class="cover-fallback-line"></span></div></div>`;
}
function card(item) {
  return `<article class="manga-card" data-id="${item.id}" draggable="${!query}" tabindex="0" role="${item.sourceUrl?'link':'button'}" aria-label="${escape((item.sourceUrl?'เปิดเว็บอ่าน ':'เพิ่มเว็บที่อ่านให้ ')+item.title)}" title="${item.sourceUrl?'เปิดเว็บที่อ่าน':'คลิกเพื่อเพิ่ม URL เว็บที่อ่าน'}"><div class="card-cover-wrap">${cover(item)}<button class="card-edit" data-action="edit" data-id="${item.id}" aria-label="แก้ไข ${escape(item.title)}" title="แก้ไขเรื่อง">${icon.edit}</button></div><div class="card-content"><h3 title="${escape(item.title)}">${escape(item.title)}</h3><div class="chapter-row"><div><span class="chapter-caption">อ่านจบแล้ว</span><button class="chapter-number" data-action="number" data-id="${item.id}" title="คลิกเพื่อแก้เลขตอน">${item.chapter===0?'จำไม่ได้':`ตอนที่ ${item.chapter}`} <span>${icon.edit}</span></button></div><div class="stepper"><button data-action="minus" data-id="${item.id}" aria-label="ลดตอน ${escape(item.title)}" ${item.chapter===0||busy.has(item.id)?'disabled':''}>${icon.minus}</button><button class="stepper-plus" data-action="plus" data-id="${item.id}" aria-label="เพิ่มตอน ${escape(item.title)}" ${busy.has(item.id)?'disabled':''}>${icon.plus}</button></div></div></div></article>`;
}
function categoryBlock(category, shown) {
  const members = shown.filter(item => (item.categoryId || 'main') === category.id);
  return `<section class="category-block" data-category-id="${category.id}" aria-label="${escape(category.name)}"><div class="category-head" ${category.id==='main'||query?'':`draggable="true" title="ลากเพื่อจัดลำดับหมวด"`}><div class="category-heading"><span class="category-accent"></span><h2>${escape(category.name)}</h2></div><div class="category-actions"><button class="category-edit" data-action="edit-category" data-id="${category.id}" aria-label="แก้ชื่อหมวด ${escape(category.name)}" title="แก้ชื่อหมวด">${icon.edit}</button>${category.id==='main'?'':`<button class="category-remove" data-action="delete-category" data-id="${category.id}" aria-label="ลบหมวด ${escape(category.name)}" title="ลบหมวด">×</button>`}</div></div><div class="card-grid" data-category-id="${category.id}">${members.map(card).join('')}<button class="add-card-tile" data-action="new" data-category-id="${category.id}" aria-label="เพิ่มมังงะในหมวด ${escape(category.name)}"><span class="add-card-icon">${icon.plus}</span><span>เพิ่มมังงะ</span></button></div></section>`;
}
function render() {
  const shown = items.filter(item => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const visibleCategories = query ? categories.filter(category => shown.some(item => (item.categoryId || 'main') === category.id)) : categories;
  root.innerHTML = `<main class="gallery-shell" style="--card-min-width:${cardSize}px"><header class="gallery-header"><div class="brand"><span class="brand-mark">${icon.book}</span><span class="brand-name">MANGA<span>SHELF</span></span></div><div class="header-actions"><button class="add-category" data-action="new-category" aria-label="เพิ่มหมวด">${icon.plus}<span>เพิ่มหมวด</span></button><label class="search-box"><span aria-hidden="true">${icon.search}</span><input id="search" type="search" aria-label="ค้นหามังงะ" placeholder="ค้นหามังงะ..." value="${escape(query)}"></label></div></header><div class="gallery-main"><div class="category-toolbar"><span>COLLECTIONS</span></div>${error?`<div class="error-banner" role="alert">${escape(error)}<button data-action="dismiss" aria-label="ปิดข้อความ">×</button></div>`:''}${query && shown.length===0?`<div class="empty-state"><div class="empty-symbol">${icon.search}</div><p>ไม่พบมังงะที่ค้นหา</p><span>ลองค้นหาด้วยชื่อเรื่องอื่น</span></div>`:visibleCategories.map(category => categoryBlock(category, shown)).join('')}</div><label class="size-control"><span>ขนาดการ์ด</span><input id="card-size" type="range" aria-label="ปรับขนาดการ์ด" min="130" max="240" step="2" value="${cardSize}"><output>${cardSize}</output></label></main>`;
}
function notify(message) { clearTimeout(toastTimer); document.querySelector('.toast')?.remove(); const node=document.createElement('div');node.className='toast';node.textContent=`✓  ${message}`;document.body.append(node);toastTimer=setTimeout(()=>node.remove(),3000); }
function fail(problem) { error=problem.message; render(); }
function categoryModal(initial=null) {
  const node = document.createElement('div');
  node.className = 'modal-backdrop';
  node.innerHTML = `<section class="modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><div class="modal-head"><div><div class="eyebrow">YOUR COLLECTION</div><h2 id="category-modal-title">${initial?'แก้ชื่อหมวด':'เพิ่มหมวดใหม่'}</h2></div><button class="icon-button" type="button" data-category-modal="close" aria-label="ปิด">×</button></div><form><label class="category-field">ชื่อหมวด<input name="name" required maxlength="60" placeholder="เช่น กำลังอ่าน / อ่านจบแล้ว" value="${escape(initial?.name||'')}" autofocus></label><p class="form-error" role="alert" hidden></p><div class="modal-actions"><button class="cancel-button" type="button" data-category-modal="close">ยกเลิก</button><button class="primary-button save-button" type="submit">${initial?'บันทึก':'เพิ่มหมวด'}</button></div></form></section>`;
  document.body.append(node);
  document.body.style.overflow = 'hidden';
  node.querySelector('[name=name]').focus();
  const close = () => { node.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  node.addEventListener('mousedown', e => { if (e.target === node) close(); });
  node.addEventListener('click', e => { if (e.target.closest('[data-category-modal=close]')) close(); });
  node.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = node.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const category = await api(initial?`/api/categories/${initial.id}`:'/api/categories', { method: initial?'PATCH':'POST', body: JSON.stringify({ name: node.querySelector('[name=name]').value.trim() }) });
      if (initial) categories = categories.map(entry => entry.id === initial.id ? category : entry);
      else categories.push(category);
      close();
      render();
    } catch (problem) {
      const alert = node.querySelector('.form-error');
      alert.hidden = false;
      alert.textContent = problem.message;
    } finally { button.disabled = false; }
  });
}
function modal(item=null, categoryId='main') {
  editing=item;
  const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><div class="eyebrow">YOUR COLLECTION</div><h2 id="modal-title">${item?'แก้ไขเรื่องนี้':'เพิ่มเรื่องใหม่'}</h2></div><button class="icon-button" data-modal="close" aria-label="ปิด">×</button></div><form id="manga-form"><div class="form-layout"><label class="upload-zone">${cover(item||{title:'YOUR STORY'},'upload-cover')}<span class="upload-caption">▧ อัปโหลดรูปปก</span><input id="file" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="form-fields"><label>ชื่อมังงะ <span>*</span><input name="title" required maxlength="160" placeholder="เช่น เรื่องที่ตามทุกสัปดาห์" value="${escape(item?.title||'')}"></label><label>ตอนล่าสุดที่อ่านจบ <span>*</span><input name="chapter" required type="number" min="0" max="1000000" step="1" value="${item?.chapter??0}"></label><label>URL เว็บที่อ่าน <small>(ไม่บังคับ)</small><input name="sourceUrl" type="url" placeholder="https://เว็บที่อ่าน/เรื่องนี้" value="${escape(item?.sourceUrl||'')}"></label><label>ลิงก์รูปปก <small>(หรืออัปโหลดรูปด้านซ้าย)</small><input name="cover" type="url" placeholder="https://..." value="${item?.cover?.startsWith('/covers/')?'':escape(item?.cover||'')}"></label><label>โน้ตส่วนตัว <small>(ไม่บังคับ)</small><textarea name="note" rows="2" maxlength="500" placeholder="เว็บที่อ่าน / ออกทุกวันศุกร์...">${escape(item?.note||'')}</textarea></label></div></div><p class="form-error" role="alert" hidden></p><div class="modal-actions">${item?`<button class="delete-button" type="button" data-modal="delete">⌫ ลบเรื่อง</button>`:''}<button class="cancel-button" type="button" data-modal="close">ยกเลิก</button><button class="primary-button save-button" type="submit">✓ บันทึก</button></div></form></section>`;document.body.append(node);document.body.style.overflow='hidden';node.querySelector('[name=title]').focus();
  const close=()=>{node.remove();document.body.style.overflow='';document.removeEventListener('keydown',esc)};
  const esc=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',esc);
  node.addEventListener('mousedown',e=>{if(e.target===node)close()});
  node.addEventListener('click',async e=>{const action=e.target.closest('[data-modal]')?.dataset.modal;if(action==='close')close();if(action==='delete'&&item&&confirm(`ลบ “${item.title}” ออกจากชั้น?`)){try{await api(`/api/manga/${item.id}`,{method:'DELETE'});items=items.filter(x=>x.id!==item.id);close();render();notify('ลบเรื่องแล้ว')}catch(problem){node.querySelector('.form-error').hidden=false;node.querySelector('.form-error').textContent=problem.message}}});
  node.querySelector('#file').addEventListener('change',e=>{const file=e.target.files[0];if(file){const image=node.querySelector('.upload-cover img');const url=URL.createObjectURL(file);if(image){image.src=url;image.style.display='block';image.nextElementSibling.style.display='none'}else{node.querySelector('.upload-cover').insertAdjacentHTML('afterbegin',`<img src="${url}" alt="รูปปกที่เลือก">`);node.querySelector('.cover-fallback').style.display='none'}}});
  node.querySelector('#manga-form').addEventListener('submit',async e=>{e.preventDefault();const button=node.querySelector('[type=submit]');button.disabled=true;const form=new FormData(e.target);const file=node.querySelector('#file').files[0];const alert=node.querySelector('.form-error');try{let cover=item?.cover||'';if(form.get('cover'))cover=form.get('cover').trim();if(file){if(file.size>5*1024*1024)throw Error('รูปต้องไม่เกิน 5 MB');const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('อ่านรูปไม่สำเร็จ'));reader.readAsDataURL(file)});cover=(await api('/api/cover',{method:'POST',body:JSON.stringify({image})})).cover}const payload={title:form.get('title').trim(),chapter:Number(form.get('chapter')),cover,sourceUrl:form.get('sourceUrl').trim(),note:form.get('note').trim(),...(!item?{categoryId}:{})};const saved=await api(item?`/api/manga/${item.id}`:'/api/manga',{method:item?'PATCH':'POST',body:JSON.stringify(payload)});items=item?items.map(x=>x.id===item.id?saved:x):[...items,saved];close();render();notify(item?'บันทึกการแก้ไขแล้ว':'เพิ่มเข้าชั้นแล้ว')}catch(problem){alert.textContent=problem.message;alert.hidden=false}finally{button.disabled=false}});
}
async function setChapter(item,next){if(busy.has(item.id))return;busy.add(item.id);try{const changed=await api(`/api/manga/${item.id}`,{method:'PATCH',body:JSON.stringify({chapter:next})});items=items.map(x=>x.id===item.id?changed:x);notify(`บันทึก ${item.title} ตอนที่ ${next} แล้ว`)}catch(problem){error=problem.message}finally{busy.delete(item.id);render()}}
function openSource(item) {
  if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
  else modal(item);
}
function positionCardAt(x, y) {
  if (!draggedId) return;
  const target = document.elementFromPoint(x, y);
  const grid = target?.closest('.card-grid') || target?.closest('.category-block')?.querySelector('.card-grid');
  const moving = [...root.querySelectorAll('.manga-card')].find(card => card.dataset.id === draggedId);
  if (!grid || !moving) return;
  const card = target.closest('.manga-card');
  if (!card) { grid.insertBefore(moving, grid.querySelector('.add-card-tile')); return; }
  if (card === moving) return;
  const rect = card.getBoundingClientRect();
  const after = y > rect.bottom || (y >= rect.top && y <= rect.bottom && x > rect.left + rect.width / 2);
  grid.insertBefore(moving, after ? card.nextSibling : card);
}
function stopDragScroll() {
  dragPointer = null;
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
}
function dragScrollTick() {
  if (!dragPointer || (!draggedId && !draggedCategoryId)) { stopDragScroll(); return; }
  const edge = Math.min(110, window.innerHeight * .2);
  const y = dragPointer.y;
  const speed = y < edge ? -Math.ceil((edge - y) / edge * 18) : y > window.innerHeight - edge ? Math.ceil((y - (window.innerHeight - edge)) / edge * 18) : 0;
  if (speed) {
    window.scrollBy(0, speed);
    if (draggedId) positionCardAt(dragPointer.x, dragPointer.y);
  }
  scrollFrame = requestAnimationFrame(dragScrollTick);
}
document.addEventListener('dragover', e => {
  if (!draggedId && !draggedCategoryId) return;
  dragPointer = { x: e.clientX, y: e.clientY };
  if (!scrollFrame) scrollFrame = requestAnimationFrame(dragScrollTick);
});
window.addEventListener('wheel', e => {
  if (!draggedId && !draggedCategoryId) return;
  e.preventDefault();
  window.scrollBy(0, e.deltaY);
  if (draggedId && dragPointer) positionCardAt(dragPointer.x, dragPointer.y);
}, { passive: false, capture: true });
root.addEventListener('dragstart', e => {
  const head = e.target.closest('.category-head[draggable="true"]');
  if (head && !e.target.closest('button')) {
    draggedCategoryId = head.closest('.category-block').dataset.categoryId;
    suppressClickUntil = Date.now() + 600;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCategoryId);
    requestAnimationFrame(() => head.closest('.category-block')?.classList.add('dragging-category'));
    return;
  }
  const card = e.target.closest('.manga-card');
  if (!card || query || e.target.closest('button,input,form')) { e.preventDefault(); return; }
  draggedId = card.dataset.id;
  suppressClickUntil = Date.now() + 600;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedId);
  requestAnimationFrame(() => card.classList.add('dragging'));
});
root.addEventListener('dragover', e => {
  if (draggedCategoryId) {
    const target = e.target.closest('.category-block');
    const moving = [...root.querySelectorAll('.category-block')].find(block => block.dataset.categoryId === draggedCategoryId);
    if (!target || !moving) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (target === moving) return;
    if (target.dataset.categoryId === 'main') target.after(moving);
    else {
      const after = e.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      target.parentNode.insertBefore(moving, after ? target.nextSibling : target);
    }
    return;
  }
  if (!draggedId) return;
  const grid = e.target.closest('.card-grid') || e.target.closest('.category-block')?.querySelector('.card-grid');
  if (!grid) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  positionCardAt(e.clientX, e.clientY);
});
root.addEventListener('drop', e => {
  if (draggedCategoryId) {
    e.preventDefault();
    stopDragScroll();
    const ids = [...root.querySelectorAll('.category-block')].map(block => block.dataset.categoryId);
    const original = categories;
    const byId = new Map(categories.map(category => [category.id, category]));
    draggedCategoryId = null;
    suppressClickUntil = Date.now() + 600;
    if (ids[0] !== 'main' || ids.length !== categories.length) { render(); return; }
    categories = ids.map(id => byId.get(id));
    render();
    api('/api/categories/order', { method: 'PUT', body: JSON.stringify({ ids }) }).catch(problem => { categories = original; fail(problem); });
    return;
  }
  if (!draggedId) return;
  const grid = e.target.closest('.card-grid') || e.target.closest('.category-block')?.querySelector('.card-grid');
  if (!grid) return;
  e.preventDefault();
  stopDragScroll();
  const placements = categories.flatMap(category => [...root.querySelectorAll(`.card-grid[data-category-id="${category.id}"] .manga-card`)].map(card => ({ id: card.dataset.id, categoryId: category.id })));
  const original = items;
  const byId = new Map(items.map(item => [item.id, item]));
  items = placements.map(entry => ({ ...byId.get(entry.id), categoryId: entry.categoryId }));
  draggedId = null;
  suppressClickUntil = Date.now() + 600;
  render();
  api('/api/manga/layout', { method: 'PUT', body: JSON.stringify({ placements }) }).catch(problem => { items = original; fail(problem); });
});
root.addEventListener('dragend', () => {
  stopDragScroll();
  if (draggedCategoryId) {
    draggedCategoryId = null;
    suppressClickUntil = Date.now() + 600;
    render();
    return;
  }
  if (!draggedId) return;
  draggedId = null;
  suppressClickUntil = Date.now() + 600;
  render();
});
root.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); return; }
  const button = e.target.closest('[data-action]');
  if (button) {
    const action = button.dataset.action;
    const item = items.find(x => x.id === button.dataset.id);
    if (action === 'new') modal(null, button.dataset.categoryId || 'main');
    if (action === 'new-category') categoryModal();
    if (action === 'edit-category') categoryModal(categories.find(entry => entry.id === button.dataset.id));
    if (action === 'delete-category') {
      const category = categories.find(entry => entry.id === button.dataset.id);
      if (category && confirm(`ลบหมวด “${category.name}”? มังงะในหมวดจะย้ายกลับหมวดหลัก`)) {
        api(`/api/categories/${category.id}`, { method: 'DELETE' }).then(() => { categories = categories.filter(entry => entry.id !== category.id); items = items.map(entry => entry.categoryId === category.id ? { ...entry, categoryId: 'main' } : entry); render(); }).catch(fail);
      }
    }
    if (action === 'edit') modal(item);
    if (action === 'plus') setChapter(item, item.chapter + 1);
    if (action === 'minus' && item.chapter > 0) setChapter(item, item.chapter - 1);
    if (action === 'number') {
      button.outerHTML = `<form class="number-form" data-id="${item.id}"><input aria-label="ตอนล่าสุดที่อ่านจบของ ${escape(item.title)}" type="number" min="0" max="1000000" step="1" value="${item.chapter}" required><button type="submit" aria-label="บันทึกเลขตอน">${icon.check}</button></form>`;
      const input = root.querySelector(`.number-form[data-id="${item.id}"] input`);
      input.focus();
      input.select();
    }
    if (action === 'dismiss') { error = ''; render(); }
    return;
  }
  if (e.target.closest('.number-form')) return;
  const card = e.target.closest('.manga-card');
  if (card) openSource(items.find(x => x.id === card.dataset.id));
});
root.addEventListener('submit', e => {
  const form = e.target.closest('.number-form');
  if (!form) return;
  e.preventDefault();
  const item = items.find(x => x.id === form.dataset.id);
  const input = form.querySelector('input');
  const value = Number(input.value);
  if (!input.validity.valid || !Number.isInteger(value) || value < 0 || value > 1000000) { input.reportValidity(); return; }
  if (value === item.chapter) render();
  else setChapter(item, value);
});
root.addEventListener('keydown', e => {
  if (e.target.closest('.number-form') && e.key === 'Escape') { e.preventDefault(); render(); return; }
  if (e.target.matches('.manga-card') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openSource(items.find(x => x.id === e.target.dataset.id));
  }
});
root.addEventListener('input',e=>{if(e.target.id==='search'){const start=e.target.selectionStart;query=e.target.value;render();const input=document.getElementById('search');input.focus();input.setSelectionRange(start,start)}if(e.target.id==='card-size'){cardSize=Number(e.target.value);root.querySelector('.gallery-shell').style.setProperty('--card-min-width',`${cardSize}px`);root.querySelector('.size-control output').textContent=cardSize}});
root.addEventListener('change',e=>{if(e.target.id==='card-size'){api('/api/config',{method:'PUT',body:JSON.stringify({cardSize})}).catch(fail)}if(e.target.id==='sort'){sort=e.target.value;render()}});
let hiddenSince = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenSince = Date.now(); return; }
  const wasAway = hiddenSince && Date.now() - hiddenSince >= 1500;
  hiddenSince = 0;
  if (wasAway && !document.querySelector('.modal-backdrop,.number-form')) window.location.reload();
});
api('/api/manga').then(data=>{items=data;render()}).catch(fail);
api('/api/config').then(config=>{cardSize=config.cardSize;categories=config.categories?.length?config.categories:categories;render()}).catch(fail);
render();

