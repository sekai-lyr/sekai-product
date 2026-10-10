(() => {
  'use strict';
  const KEY = 'sekai-memory-offline-v1';
  const seed = { anime: [], character: [], quote: [] };
  let data = load();
  let currentView = 'home';
  let animeFilter = '全部';
  let editing = null;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY));
      if (parsed && ['anime','character','quote'].every(k => Array.isArray(parsed[k]))) return parsed;
    } catch (_) {}
    return typeof structuredClone === 'function' ? structuredClone(seed) : JSON.parse(JSON.stringify(seed));
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(data)); renderAll(); }
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 1800); }
  function empty(title, text) { return `<div class="empty"><b>${title}</b>${text}</div>`; }
  function initials(text) { return esc((text || '记').trim().slice(0, 1)); }
  function imageOrFallback(url, fallback, className = 'poster') { return url ? `<img class="${className}" src="${esc(url)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${className}',textContent:'${fallback}'}))">` : `<div class="${className}">${fallback}</div>`; }

  const titles = {home:'我的回忆录',anime:'番剧档案',character:'角色收藏',quote:'台词摘录',more:'更多',search:'搜索'};
  function navigate(view) {
    currentView = view;
    $$('.view').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $$('.bottom-nav button').forEach(el => el.classList.toggle('active', el.dataset.nav === view));
    $('.bottom-nav').style.display = view === 'search' ? 'none' : '';
    $('#page-title').textContent = titles[view];
    $('#search-button').style.visibility = view === 'search' ? 'hidden' : 'visible';
    if (view === 'search') setTimeout(() => $('#search-input').focus(), 100);
    window.scrollTo(0, 0);
  }

  function renderStats() {
    const watched = data.anime.filter(x => x.status === '已看完').length;
    const avg = data.anime.filter(x => Number(x.score)).reduce((a,x,_,arr) => a + Number(x.score) / arr.length, 0);
    $('#stats').innerHTML = [
      ['番剧档案', data.anime.length], ['已看完', watched], ['平均评分', avg ? avg.toFixed(1) : '—']
    ].map(([k,v]) => `<div class="stat"><strong>${v}</strong><span>${k}</span></div>`).join('');
  }
  function animeCard(x) {
    const tags = [x.status, x.type, x.tags].filter(Boolean).slice(0,3).map(t => `<span class="pill">${esc(t)}</span>`).join('');
    return `<button class="card" data-edit="anime" data-id="${x.id}">${imageOrFallback(x.coverUrl, initials(x.title))}<div class="card-main"><h3>${esc(x.title)}</h3><div class="meta">${tags}</div>${x.memoryText ? `<p>${esc(x.memoryText)}</p>` : ''}</div>${x.score ? `<span class="score">★ ${esc(x.score)}</span>` : ''}</button>`;
  }
  function renderAnime() {
    const list = data.anime.filter(x => animeFilter === '全部' || x.status === animeFilter).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    $('#anime-list').innerHTML = list.length ? list.map(animeCard).join('') : empty('还没有番剧记录','点击“添加”收录第一部作品');
    const recent = [...data.anime].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
    $('#recent-list').innerHTML = recent.length ? recent.map(animeCard).join('') : empty('书架还是空的','从一部喜欢的番剧开始吧');
  }
  function renderCharacters() {
    const list = [...data.character].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    $('#character-list').innerHTML = list.length ? list.map(x => `<button class="character-card" data-edit="character" data-id="${x.id}"><div class="character-image">${x.imageUrl ? `<img src="${esc(x.imageUrl)}" alt="">` : initials(x.name)}</div><div class="body"><h3>${esc(x.name)}</h3><p>${esc(x.reason || '还没有写喜欢的理由')}</p><div class="hearts">${'♥'.repeat(Number(x.level) || 1)}${'♡'.repeat(5-(Number(x.level)||1))}</div></div></button>`).join('') : empty('还没有收藏角色','把最喜欢的角色留在这里');
  }
  function renderQuotes() {
    const list = [...data.quote].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    $('#quote-list').innerHTML = list.length ? list.map(x => `<button class="quote-card" data-edit="quote" data-id="${x.id}"><blockquote>${esc(x.content)}</blockquote><footer><span>${x.characterName ? '— '+esc(x.characterName) : '无署名'}</span><span>${esc(x.tag || '')}</span></footer></button>`).join('') : empty('还没有摘录台词','记录一句让你心动的话');
  }
  function renderAll() { renderStats(); renderAnime(); renderCharacters(); renderQuotes(); if (currentView === 'search') search(); }

  const fields = {
    anime: [
      ['title','番剧名称','text','例如：BanG Dream! It\'s MyGO!!!!!',true],
      ['status','观看状态','select',['在看','已看完','想看','暂停']],
      ['type','类型','text','例如：青春 / 音乐'], ['score','评分','number','0 - 10'],
      ['watchDate','观看日期','date',''], ['coverUrl','番剧封面','image',''],
      ['tags','标签','text','用逗号分隔'], ['memoryText','观后感','textarea','写下这部作品留给你的回忆']
    ],
    character: [
      ['name','角色名称','text','例如：高松灯',true], ['animeTitle','所属番剧','text','作品名称'],
      ['level','喜爱程度','select',['1','2','3','4','5']], ['imageUrl','角色图片','image',''],
      ['reason','喜欢的理由','textarea','为什么喜欢这个角色？']
    ],
    quote: [
      ['content','台词内容','textarea','输入想珍藏的台词',true], ['characterName','角色名','text','说出这句话的人'],
      ['animeTitle','所属番剧','text','作品名称'], ['tag','标签','text','例如：勇气 / 治愈'],
      ['feeling','当时的感受','textarea','这句话带给了你什么？']
    ]
  };
  const typeNames = {anime:'番剧',character:'角色',quote:'台词'};
  function fieldHtml([name,label,type,arg,required], value = '') {
    const req = required ? ' required' : '';
    if (type === 'select') return `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}"${req}>${arg.map(v => `<option${String(value)===v?' selected':''}>${v}</option>`).join('')}</select></div>`;
    if (type === 'textarea') return `<div class="field"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}" placeholder="${arg}"${req}>${esc(value)}</textarea></div>`;
    if (type === 'image') return `<div class="field image-field"><label>${label}</label><div class="image-picker"><div class="image-preview" id="preview-${name}"${value ? ` style="background-image:url('${esc(value)}');background-size:cover;background-position:center"` : ''}>${value ? '' : '暂无图片'}</div><div><input id="f-${name}" type="file" accept="image/*"><input type="hidden" name="${name}" value="${esc(value)}"><button class="remove-image" type="button" data-remove-image="${name}"${value ? '' : ' hidden'}>移除图片</button><p class="image-help">从相册选择，保存时自动压缩</p></div></div></div>`;
    const extra = type === 'number' ? ' min="0" max="10" step="0.1"' : '';
    return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${arg}"${extra}${req}></div>`;
  }
  function openSheet(type, id = null) {
    const record = id ? data[type].find(x => x.id === id) : {};
    editing = {type, id};
    $('#sheet-title').textContent = `${id ? '编辑' : '新增'}${typeNames[type]}`;
    $('#form-fields').innerHTML = fields[type].map(f => fieldHtml(f, record?.[f[0]] ?? '')).join('');
    $('#delete-button').hidden = !id;
    $('#sheet-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() { $('#sheet-backdrop').hidden = true; document.body.style.overflow = ''; editing = null; }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('not-image'));
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const max = 1280;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .78));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function submitRecord(event) {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    const record = {...formData, id: editing.id || uid(), updatedAt: now()};
    if (editing.id) data[editing.type] = data[editing.type].map(x => x.id === editing.id ? {...x,...record} : x);
    else data[editing.type].push(record);
    save(); closeSheet(); toast('已保存到本机');
  }
  function deleteRecord() {
    if (!editing?.id || !confirm('确定删除这条记录吗？')) return;
    data[editing.type] = data[editing.type].filter(x => x.id !== editing.id);
    save(); closeSheet(); toast('记录已删除');
  }
  function search() {
    const q = $('#search-input').value.trim().toLowerCase();
    if (!q) { $('#search-results').innerHTML = empty('搜索你的回忆','输入标题、角色、台词或标签'); return; }
    const includes = x => Object.values(x).some(v => String(v).toLowerCase().includes(q));
    const results = [
      ...data.anime.filter(includes).map(x => ({type:'anime',id:x.id,title:x.title,sub:[x.status,x.tags].filter(Boolean).join(' · ')})),
      ...data.character.filter(includes).map(x => ({type:'character',id:x.id,title:x.name,sub:x.animeTitle || x.reason})),
      ...data.quote.filter(includes).map(x => ({type:'quote',id:x.id,title:x.content,sub:x.characterName || x.animeTitle}))
    ];
    $('#search-results').innerHTML = results.length ? results.map(x => `<button class="card" data-edit="${x.type}" data-id="${x.id}"><div class="poster">${initials(x.title)}</div><div class="card-main"><h3>${esc(x.title)}</h3><p>${esc(x.sub || typeNames[x.type])}</p></div></button>`).join('') : empty('没有找到相关记录','试试其他关键词');
  }
  function exportData() {
    const payload = JSON.stringify({format:'sekai-memory-offline',version:1,exportedAt:now(),data}, null, 2);
    const fileName = `sekai-memory-${new Date().toISOString().slice(0,10)}.json`;
    if (window.AndroidBridge?.exportJson) { window.AndroidBridge.exportJson(payload, fileName); return; }
    const blob = new Blob([payload], {type:'application/json'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); URL.revokeObjectURL(link.href); toast('备份文件已生成');
  }
  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text()); const incoming = parsed.data || parsed;
      if (!incoming || !['anime','character','quote'].every(k => Array.isArray(incoming[k]))) throw new Error();
      if (!confirm('恢复备份将覆盖当前全部记录，是否继续？')) return;
      data = incoming; save(); toast('备份恢复成功');
    } catch (_) { toast('无法识别此备份文件'); }
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-nav]'); if (nav) navigate(nav.dataset.nav);
    const add = event.target.closest('[data-add]'); if (add) openSheet(add.dataset.add);
    const edit = event.target.closest('[data-edit]'); if (edit) openSheet(edit.dataset.edit, edit.dataset.id);
    const removeImage = event.target.closest('[data-remove-image]');
    if (removeImage) {
      const name = removeImage.dataset.removeImage;
      $(`input[name="${name}"]`).value = '';
      const preview = $(`#preview-${name}`); preview.style.backgroundImage = ''; preview.textContent = '暂无图片';
      removeImage.hidden = true;
    }
    const filter = event.target.closest('[data-filter]');
    if (filter) { animeFilter = filter.dataset.filter; $$('#anime-filter button').forEach(x => x.classList.toggle('active',x===filter)); renderAnime(); }
  });
  $('#record-form').addEventListener('change', async event => {
    if (event.target.type !== 'file' || !event.target.accept.includes('image')) return;
    const file = event.target.files[0]; if (!file) return;
    const name = event.target.id.replace('f-', '');
    toast('正在处理图片…');
    try {
      const image = await compressImage(file);
      $(`input[name="${name}"]`).value = image;
      const preview = $(`#preview-${name}`); preview.textContent = ''; preview.style.backgroundImage = `url('${image}')`; preview.style.backgroundSize = 'cover'; preview.style.backgroundPosition = 'center';
      $(`[data-remove-image="${name}"]`).hidden = false;
      toast('图片已选择');
    } catch (_) { toast('无法读取这张图片'); }
  });
  $('#search-button').addEventListener('click', () => navigate('search'));
  $('#search-close').addEventListener('click', () => navigate('home'));
  $('#search-input').addEventListener('input', search);
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet-backdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeSheet(); });
  $('#record-form').addEventListener('submit', submitRecord);
  $('#delete-button').addEventListener('click', deleteRecord);
  $('#export-button').addEventListener('click', exportData);
  $('#import-button').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value=''; });
  $('#clear-button').addEventListener('click', () => { if (confirm('确定清空全部离线数据吗？此操作无法撤销。')) { data = {anime:[],character:[],quote:[]}; save(); toast('数据已清空'); } });
  window.onBackupSaved = success => toast(success ? '备份文件已保存' : '已取消保存');
  renderAll(); search();
})();
