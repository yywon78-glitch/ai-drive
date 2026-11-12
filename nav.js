/* ── nav.js : 탭바, 토스트, 공통 유틸 ── */

function renderTabBar(active) {
  const el = document.getElementById('tabbar');
  if (!el) return;
  const tabs = [
    { id:'home',  ic:'🏠',  lb:'홈',   href:'index.html' },
    { id:'fuel',  ic:'⛽',  lb:'주유',  href:'fuel.html'  },
    { id:'maint', ic:'🔧',  lb:'정비',  href:'maint.html' },
    { id:'drive', ic:'🗺️',  lb:'운행',  href:'drive.html' },
    { id:'etc',   ic:'💳',  lb:'기타',  href:'etc.html'   },
    { id:'stat',  ic:'📊',  lb:'통계',  href:'stat.html'  }
  ];
  el.innerHTML = tabs.map(t => `
    <div class="tbi${active === t.id ? ' on' : ''}" onclick="location.href='${t.href}'">
      <span class="ic">${t.ic}</span>
      <span class="lb">${t.lb}</span>
    </div>`).join('');
}

/* ── 토스트 ── */
function toast(msg, dur=2200) {
  let el = document.getElementById('_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

/* ── URL 파라미터 ── */
function qp(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

/* ── 오늘 날짜 세팅 ── */
function setToday(id) {
  const el = document.getElementById(id);
  if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
}

/* ── 숫자 포맷 ── */
function numFmt(n) {
  return (n || 0).toLocaleString();
}

/* ── 삭제 확인 모달 ── */
let _delCb = null;
function confirmDel(msg, cb) {
  _delCb = cb;
  const box = document.getElementById('_delModal');
  if (!box) {
    // 동적 생성
    const m = document.createElement('div');
    m.id = '_delModal';
    m.className = 'del-modal';
    m.innerHTML = `
      <div class="del-box">
        <div class="del-title">삭제 확인</div>
        <div class="del-sub" id="_delMsg"></div>
        <div class="del-actions">
          <button class="del-cancel" onclick="closeDel()">취소</button>
          <button class="del-confirm" onclick="execDel()">삭제</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('_delMsg').textContent = msg;
  document.getElementById('_delModal').classList.add('show');
}
function closeDel() {
  const m = document.getElementById('_delModal');
  if (m) m.classList.remove('show');
  _delCb = null;
}
function execDel() {
  closeDel();
  if (_delCb) _delCb();
}

/* ── 차량 셀렉트 변경 핸들러 ── */
function onVehicleChange(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  setCurrentVid(el.value);
  if (typeof render === 'function') render();
  if (typeof load === 'function') load();
}
