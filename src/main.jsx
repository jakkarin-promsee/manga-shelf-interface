import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Plus, Pencil, Trash2, X, ImagePlus, Minus, Check, LibraryBig, Search } from 'lucide-react';
import './style.css';

async function api(url, options) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
  return data;
}

const blank = { title: '', chapter: 0, cover: '', sourceUrl: '', note: '' };
const themes = ['#254464', '#315574', '#233d65', '#36576b', '#284d71', '#314b69'];
const coverColor = (title) => themes[Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0) % themes.length];

function Cover({ item, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.cover]);
  return <div className={`cover ${className}`} style={{ '--cover-color': coverColor(item.title || '') }}>
    {item.cover && !broken ? <img src={item.cover} alt={`ปก ${item.title}`} onError={() => setBroken(true)} /> : <div className="cover-fallback"><span className="cover-ornament">✳</span><span className="cover-fallback-title">{item.title || 'YOUR STORY'}</span><span className="cover-fallback-line" /></div>}
  </div>;
}

function Modal({ initial, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    function esc(event) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; if (preview) URL.revokeObjectURL(preview); };
  }, [onClose, preview]);

  const change = (key, value) => setForm(valueBefore => ({ ...valueBefore, [key]: value }));
  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      let cover = form.cover;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('รูปต้องไม่เกิน 5 MB');
        const image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'));
          reader.readAsDataURL(file);
        });
        cover = (await api('/api/cover', { method: 'POST', body: JSON.stringify({ image }) })).cover;
      }
      await onSave({ title: form.title.trim(), chapter: Number(form.chapter), cover, sourceUrl: form.sourceUrl.trim(), note: form.note.trim() });
      onClose();
    } catch (problem) { setError(problem.message); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><div className="eyebrow">YOUR COLLECTION</div><h2 id="modal-title">{initial ? 'แก้ไขเรื่องนี้' : 'เพิ่มเรื่องใหม่'}</h2></div><button className="icon-button" aria-label="ปิด" onClick={onClose}><X size={20} /></button></div>
      <form onSubmit={save}>
        <div className="form-layout">
          <label className="upload-zone">
            <Cover item={{ title: form.title || 'YOUR STORY', cover: preview || form.cover }} className="upload-cover" />
            <span className="upload-caption"><ImagePlus size={17} /> {file ? 'เปลี่ยนรูปปก' : 'อัปโหลดรูปปก'}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
              const picked = event.target.files?.[0];
              if (picked) { if (preview) URL.revokeObjectURL(preview); setFile(picked); setPreview(URL.createObjectURL(picked)); }
            }} />
          </label>
          <div className="form-fields">
            <label>ชื่อมังงะ <span>*</span><input autoFocus required maxLength="160" placeholder="เช่น เรื่องที่ตามทุกสัปดาห์" value={form.title} onChange={event => change('title', event.target.value)} /></label>
            <label>ตอนล่าสุดที่อ่านจบ <span>*</span><input required type="number" min="0" max="1000000" step="1" value={form.chapter} onChange={event => change('chapter', event.target.value)} /></label>
            <label>URL เว็บที่อ่าน <small>(ไม่บังคับ)</small><input type="url" placeholder="https://เว็บที่อ่าน/เรื่องนี้" value={form.sourceUrl || ''} onChange={event => change('sourceUrl', event.target.value)} /></label>
            <label>ลิงก์รูปปก <small>(หรืออัปโหลดรูปด้านซ้าย)</small><input type="url" placeholder="https://..." value={form.cover.startsWith('/covers/') ? '' : form.cover} onChange={event => { setFile(null); setPreview(null); change('cover', event.target.value); }} /></label>
            <label>โน้ตส่วนตัว <small>(ไม่บังคับ)</small><textarea rows="2" maxLength="500" placeholder="เว็บที่อ่าน / ออกทุกวันศุกร์..." value={form.note} onChange={event => change('note', event.target.value)} /></label>
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">{initial && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={16} /> ลบเรื่อง</button>}<button className="cancel-button" type="button" onClick={onClose}>ยกเลิก</button><button className="primary-button save-button" disabled={saving}><Check size={17} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>
      </form>
    </section>
  </div>;
}

function CategoryModal({ onClose, onSave, initial }) {
  const [name, setName] = useState(initial?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const esc = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [onClose]);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await onSave(name.trim()); onClose(); }
    catch (problem) { setError(problem.message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><div className="modal-head"><div><div className="eyebrow">YOUR COLLECTION</div><h2 id="category-modal-title">{initial ? 'แก้ชื่อหมวด' : 'เพิ่มหมวดใหม่'}</h2></div><button className="icon-button" type="button" aria-label="ปิด" onClick={onClose}><X size={18} /></button></div><form onSubmit={submit}><label className="category-field">ชื่อหมวด<input autoFocus required maxLength="60" placeholder="เช่น กำลังอ่าน / อ่านจบแล้ว" value={name} onChange={event => setName(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>ยกเลิก</button><button className="primary-button save-button" disabled={saving}>{saving ? 'กำลังบันทึก...' : initial ? 'บันทึก' : 'เพิ่มหมวด'}</button></div></form></section></div>;
}

function MangaCard({ item, index, busy, onChapter, onEdit, canDrag }) {
  const [editingNumber, setEditingNumber] = useState(false);
  const [number, setNumber] = useState(item.chapter);
  useEffect(() => setNumber(item.chapter), [item.chapter]);
  async function commit(event) {
    event?.preventDefault();
    const next = Number(number);
    if (Number.isInteger(next) && next >= 0 && next <= 1000000 && next !== item.chapter) await onChapter(item, next);
    setEditingNumber(false);
  }
  const openSource = () => item.sourceUrl ? window.open(item.sourceUrl, '_blank', 'noopener,noreferrer') : onEdit(item);
  return <article className="manga-card" data-id={item.id} draggable={canDrag} role={item.sourceUrl ? 'link' : 'button'} tabIndex={0} aria-label={item.sourceUrl ? `เปิดเว็บอ่าน ${item.title}` : `เพิ่มเว็บที่อ่านให้ ${item.title}`} title={item.sourceUrl ? 'เปิดเว็บที่อ่าน' : 'คลิกเพื่อเพิ่ม URL เว็บที่อ่าน'} onClick={event => { if (!event.target.closest('button, input, form')) openSource(); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openSource(); } }} style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
    <div className="card-cover-wrap"><Cover item={item} /><div className="cover-topline">MANGA / {String(index + 1).padStart(2, '0')}</div><button className="card-edit" aria-label={`แก้ไข ${item.title}`} title="แก้ไขเรื่อง" onClick={() => onEdit(item)}><Pencil size={16} /></button></div>
    <div className="card-content"><div className="card-label">กำลังติดตาม <span className="status-dot" /></div><h3 title={item.title}>{item.title}</h3>{item.note && <p className="card-note" title={item.note}>{item.note}</p>}
      <div className="chapter-row"><div><span className="chapter-caption">อ่านจบแล้ว</span>{editingNumber ? <form className="number-form" onSubmit={commit}><input autoFocus aria-label="ใส่เลขตอนล่าสุด" type="number" min="0" max="1000000" value={number} onChange={event => setNumber(event.target.value)} onBlur={() => commit()} /><button aria-label="บันทึกเลขตอน" type="submit"><Check size={15} /></button></form> : <button className="chapter-number" title="คลิกเพื่อแก้เลขตอน" onClick={() => setEditingNumber(true)}>{item.chapter === 0 ? 'จำไม่ได้' : `ตอนที่ ${item.chapter}`} <Pencil size={13} /></button>}</div><div className="stepper"><button disabled={busy || item.chapter <= 0} aria-label={`ลดตอน ${item.title}`} onClick={() => onChapter(item, item.chapter - 1)}><Minus size={17} /></button><button className="stepper-plus" disabled={busy} aria-label={`เพิ่มตอน ${item.title}`} onClick={() => onChapter(item, item.chapter + 1)}><Plus size={19} /></button></div></div>
    </div>
  </article>;
}

function App() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState({});
  const [toast, setToast] = useState('');
  const [cardSize, setCardSize] = useState(158);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [categories, setCategories] = useState([{ id: 'main', name: 'หมวดหลัก' }]);
  const [categoryModalTarget, setCategoryModalTarget] = useState(undefined);
  const dragRef = useRef(null);
  const dragOrderRef = useRef(null);
  const categoryDragRef = useRef(null);
  const suppressClickRef = useRef(0);
  const scrollRef = useRef({ pointer: null, frame: 0 });
  const moveCardAtRef = useRef(null);
  useEffect(() => { api('/api/manga').then(setItems).catch(problem => setError(problem.message)).finally(() => setLoaded(true)); }, []);
  useEffect(() => { api('/api/config').then(config => { setCardSize(config.cardSize); setCategories(config.categories?.length ? config.categories : [{ id: 'main', name: 'หมวดหลัก' }]); }).catch(problem => setError(problem.message)).finally(() => setConfigLoaded(true)); }, []);
  useEffect(() => { if (!configLoaded) return; const timer = setTimeout(() => { api('/api/config', { method: 'PUT', body: JSON.stringify({ cardSize }) }).catch(problem => setError(problem.message)); }, 350); return () => clearTimeout(timer); }, [cardSize, configLoaded]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let hiddenSince = 0;
    const onVisibilityChange = () => {
      if (document.hidden) { hiddenSince = Date.now(); return; }
      const wasAway = hiddenSince && Date.now() - hiddenSince >= 1500;
      hiddenSince = 0;
      if (wasAway && !document.querySelector('.modal-backdrop,.number-form')) window.location.reload();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
  useEffect(() => {
    const state = scrollRef.current;
    const tick = () => {
      if (!state.pointer || (!dragRef.current && !categoryDragRef.current)) { state.frame = 0; return; }
      const edge = Math.min(110, window.innerHeight * .2);
      const y = state.pointer.y;
      const speed = y < edge ? -Math.ceil((edge - y) / edge * 18) : y > window.innerHeight - edge ? Math.ceil((y - (window.innerHeight - edge)) / edge * 18) : 0;
      if (speed) {
        window.scrollBy(0, speed);
        if (dragRef.current) moveCardAtRef.current?.(state.pointer.x, state.pointer.y);
      }
      state.frame = requestAnimationFrame(tick);
    };
    const onDragOver = event => {
      if (!dragRef.current && !categoryDragRef.current) return;
      state.pointer = { x: event.clientX, y: event.clientY };
      if (!state.frame) state.frame = requestAnimationFrame(tick);
    };
    const onWheel = event => {
      if (!dragRef.current && !categoryDragRef.current) return;
      event.preventDefault();
      window.scrollBy(0, event.deltaY);
      if (dragRef.current && state.pointer) moveCardAtRef.current?.(state.pointer.x, state.pointer.y);
    };
    document.addEventListener('dragover', onDragOver);
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => { document.removeEventListener('dragover', onDragOver); window.removeEventListener('wheel', onWheel, true); cancelAnimationFrame(state.frame); };
  }, []);
  function stopDragScroll() {
    scrollRef.current.pointer = null;
    cancelAnimationFrame(scrollRef.current.frame);
    scrollRef.current.frame = 0;
  }
  const shown = useMemo(() => items.filter(item => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [items, query]);
  const displayedCategories = query ? categories.filter(category => shown.some(item => (item.categoryId || 'main') === category.id)) : categories;
  const edit = modal && !modal.startsWith('new:') ? items.find(item => item.id === modal) : null;
  async function save(form) {
    if (edit) {
      const changed = await api(`/api/manga/${edit.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      setItems(previous => previous.map(item => item.id === edit.id ? changed : item));
      setToast('บันทึกการแก้ไขแล้ว');
    } else {
      const created = await api('/api/manga', { method: 'POST', body: JSON.stringify({ ...form, categoryId: modal.slice(4) }) });
      setItems(previous => [...previous, created]);
      setToast('เพิ่มเข้าชั้นแล้ว');
    }
  }
  async function chapter(item, next) {
    if (busy[item.id]) return;
    setBusy(previous => ({ ...previous, [item.id]: true }));
    try {
      const changed = await api(`/api/manga/${item.id}`, { method: 'PATCH', body: JSON.stringify({ chapter: next }) });
      setItems(previous => previous.map(x => x.id === item.id ? changed : x));
      setToast(`บันทึก ${item.title} ตอนที่ ${next} แล้ว`);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(previous => ({ ...previous, [item.id]: false })); }
  }
  async function remove() {
    if (!edit || !window.confirm(`ลบ “${edit.title}” ออกจากชั้น?`)) return;
    try { await api(`/api/manga/${edit.id}`, { method: 'DELETE' }); setItems(previous => previous.filter(item => item.id !== edit.id)); setModal(null); setToast('ลบเรื่องแล้ว'); }
    catch (problem) { setError(problem.message); }
  }
  async function addCategory(name) {
    const created = await api('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
    setCategories(previous => [...previous, created]);
  }
  async function saveCategory(name) {
    if (categoryModalTarget) {
      const changed = await api(`/api/categories/${categoryModalTarget.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      setCategories(previous => previous.map(entry => entry.id === changed.id ? changed : entry));
    } else await addCategory(name);
  }
  function startCategoryDrag(event, category) {
    if (category.id === 'main' || query || event.target.closest('button')) { event.preventDefault(); return; }
    categoryDragRef.current = { id: category.id, original: categories };
    suppressClickRef.current = Date.now() + 600;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', category.id);
    const block = event.currentTarget.closest('.category-block');
    requestAnimationFrame(() => block?.classList.add('dragging-category'));
  }
  function overCategory(event, targetId) {
    if (!categoryDragRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const movingId = categoryDragRef.current.id;
    if (movingId === targetId) return;
    const without = categories.filter(entry => entry.id !== movingId);
    const targetIndex = without.findIndex(entry => entry.id === targetId);
    const rect = event.currentTarget.getBoundingClientRect();
    const after = targetId === 'main' || event.clientY > rect.top + rect.height / 2;
    const position = Math.max(1, targetIndex + (after ? 1 : 0));
    without.splice(position, 0, categories.find(entry => entry.id === movingId));
    if (without.some((entry, index) => entry.id !== categories[index].id)) setCategories(without);
  }
  function dropCategory(event) {
    if (!categoryDragRef.current) return;
    event.preventDefault();
    stopDragScroll();
    const original = categoryDragRef.current.original;
    categoryDragRef.current = null;
    suppressClickRef.current = Date.now() + 600;
    const ids = categories.map(entry => entry.id);
    api('/api/categories/order', { method: 'PUT', body: JSON.stringify({ ids }) }).catch(problem => { setCategories(original); setError(problem.message); });
  }
  function endCategoryDrag() {
    if (!categoryDragRef.current) return;
    stopDragScroll();
    setCategories(categoryDragRef.current.original);
    categoryDragRef.current = null;
    suppressClickRef.current = Date.now() + 600;
  }
  async function removeCategory(category) {
    if (!window.confirm(`ลบหมวด “${category.name}”? มังงะในหมวดจะย้ายกลับหมวดหลัก`)) return;
    try {
      await api(`/api/categories/${category.id}`, { method: 'DELETE' });
      setCategories(previous => previous.filter(entry => entry.id !== category.id));
      setItems(previous => previous.map(item => item.categoryId === category.id ? { ...item, categoryId: 'main' } : item));
    } catch (problem) { setError(problem.message); }
  }
  function startDrag(event) {
    const card = event.target.closest('.manga-card');
    if (!card || query || event.target.closest('button,input,form')) { event.preventDefault(); return; }
    dragRef.current = { id: card.dataset.id, original: items };
    dragOrderRef.current = items.map(item => ({ id: item.id, categoryId: item.categoryId || 'main' }));
    suppressClickRef.current = Date.now() + 600;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.id);
    requestAnimationFrame(() => card.classList.add('dragging'));
  }
  function moveCardAt(x, y) {
    if (!dragRef.current) return;
    const element = document.elementFromPoint(x, y);
    const grid = element?.closest('.card-grid') || element?.closest('.category-block')?.querySelector('.card-grid');
    if (!grid) return;
    const target = element.closest('.manga-card');
    if (target?.dataset.id === dragRef.current.id) return;
    const categoryId = grid.dataset.categoryId;
    const order = dragOrderRef.current.filter(entry => entry.id !== dragRef.current.id);
    let position;
    if (target) {
      const rect = target.getBoundingClientRect();
      position = order.findIndex(entry => entry.id === target.dataset.id) + (x > rect.left + rect.width / 2 ? 1 : 0);
    } else {
      const rank = new Map(categories.map((category, index) => [category.id, index]));
      position = order.findIndex(entry => rank.get(entry.categoryId) > rank.get(categoryId));
      if (position < 0) position = order.length;
    }
    order.splice(position, 0, { id: dragRef.current.id, categoryId });
    if (order.every((entry, index) => entry.id === dragOrderRef.current[index].id && entry.categoryId === dragOrderRef.current[index].categoryId)) return;
    dragOrderRef.current = order;
    setItems(previous => { const byId = new Map(previous.map(item => [item.id, item])); return order.map(entry => ({ ...byId.get(entry.id), categoryId: entry.categoryId })); });
  }
  moveCardAtRef.current = moveCardAt;
  function dragOver(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    moveCardAt(event.clientX, event.clientY);
  }
  function dropDrag(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    stopDragScroll();
    event.currentTarget.querySelector('.dragging')?.classList.remove('dragging');
    const placements = dragOrderRef.current;
    const original = dragRef.current.original;
    dragRef.current = null;
    dragOrderRef.current = null;
    suppressClickRef.current = Date.now() + 600;
    api('/api/manga/layout', { method: 'PUT', body: JSON.stringify({ placements }) }).catch(problem => { setItems(original); setError(problem.message); });
  }
  function endDrag(event) {
    if (!dragRef.current) return;
    stopDragScroll();
    event.currentTarget.querySelector('.dragging')?.classList.remove('dragging');
    const original = dragRef.current.original;
    dragRef.current = null;
    dragOrderRef.current = null;
    suppressClickRef.current = Date.now() + 600;
    setItems(original);
  }
  return <main className="gallery-shell" style={{ '--card-min-width': `${cardSize}px` }}>
    <header className="gallery-header">
      <div className="brand"><span className="brand-mark"><LibraryBig size={19} strokeWidth={1.8} /></span><span className="brand-name">MANGA<span>SHELF</span></span></div>
      <div className="header-actions"><button className="add-category" aria-label="เพิ่มหมวด" onClick={() => setCategoryModalTarget(null)}><Plus size={15} /><span>เพิ่มหมวด</span></button><label className="search-box"><Search size={16} /><input aria-label="ค้นหามังงะ" type="search" placeholder="ค้นหามังงะ..." value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    </header>
    <div className="gallery-main">
    <div className="category-toolbar"><span>COLLECTIONS</span></div>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="ปิดข้อความ"><X size={16} /></button></div>}
    {!loaded ? <div className="empty-state">กำลังโหลด...</div> : query && shown.length === 0 ? <div className="empty-state"><div className="empty-symbol"><Search size={30} /></div><p>ไม่พบมังงะที่ค้นหา</p><span>ลองค้นหาด้วยชื่อเรื่องอื่น</span></div> : displayedCategories.map(category => { const members = shown.filter(item => (item.categoryId || 'main') === category.id); return <section className="category-block" key={category.id} data-category-id={category.id} aria-label={category.name} onDragOver={event => overCategory(event, category.id)} onDrop={dropCategory} onDragEnd={endCategoryDrag}><div className="category-head" draggable={category.id !== 'main' && !query} onDragStart={event => startCategoryDrag(event, category)} title={category.id !== 'main' ? 'ลากเพื่อจัดลำดับหมวด' : undefined}><div className="category-heading"><span className="category-accent" /><h2>{category.name}</h2></div><div className="category-actions"><button className="category-edit" aria-label={`แก้ชื่อหมวด ${category.name}`} title="แก้ชื่อหมวด" onClick={() => setCategoryModalTarget(category)}><Pencil size={14} /></button>{category.id !== 'main' && <button className="category-remove" aria-label={`ลบหมวด ${category.name}`} title="ลบหมวด" onClick={() => removeCategory(category)}><X size={15} /></button>}</div></div><div className="card-grid" data-category-id={category.id} onDragStart={startDrag} onDragOver={dragOver} onDrop={dropDrag} onDragEnd={endDrag} onClickCapture={event => { if (Date.now() < suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>{members.map((item, index) => <MangaCard key={item.id} item={item} index={index} busy={busy[item.id]} canDrag={!query} onChapter={chapter} onEdit={item => setModal(item.id)} />)}<button className="add-card-tile" aria-label={`เพิ่มมังงะในหมวด ${category.name}`} onClick={() => setModal(`new:${category.id}`)}><span className="add-card-icon"><Plus size={17} /></span><span>เพิ่มมังงะ</span></button></div></section>; })}
    </div>
    <label className="size-control"><span>ขนาดการ์ด</span><input aria-label="ปรับขนาดการ์ด" type="range" min="130" max="240" step="2" value={cardSize} onChange={event => setCardSize(Number(event.target.value))} /><output>{cardSize}</output></label>
    {modal && <Modal key={modal} initial={edit} onClose={() => setModal(null)} onSave={save} onDelete={remove} />}{categoryModalTarget !== undefined && <CategoryModal key={categoryModalTarget?.id || 'new'} initial={categoryModalTarget} onClose={() => setCategoryModalTarget(undefined)} onSave={saveCategory} />}{toast && <div className="toast"><Check size={17} />{toast}</div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);

