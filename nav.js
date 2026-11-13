/* ── nav.js : 탭바, 토스트, 공통 유틸 ── */

/* ── 첫 진입 시 항상 홈에서 시작 ── */
(function(){
  const pg = location.pathname.split('/').pop() || 'index.html';
  if (pg !== 'index.html' && !sessionStorage.getItem('drive_app_started')) {
    location.replace('index.html');
  }
})();

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
    <div class="tbi${active === t.id ? ' on' : ''}" onclick="location.replace('${t.href}')">
      <span class="ic" style="pointer-events:none">${t.ic}</span>
      <span class="lb" style="pointer-events:none">${t.lb}</span>
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

/* ══════════════════════════════════════════
   영수증 OCR — Claude Vision API
══════════════════════════════════════════ */
function _getApiKey() { return localStorage.getItem('crm_key') || ''; }

function _resizeImg(dataUrl, maxW=1600, q=0.9) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.src = dataUrl;
  });
}

const _OCR_PROMPTS = {
  fuel: `이 주유 영수증 사진에서 정보를 추출해 JSON만 반환하세요(설명 없이):
{"date":"YYYY-MM-DD","liters":숫자,"pricePerLiter":숫자,"amount":숫자,"station":"주유소명"}
날짜가 없으면 오늘, 모르는 값은 null.`,

  maint: `이 정비 영수증 사진에서 정보를 추출해 JSON만 반환하세요:
{"date":"YYYY-MM-DD","amount":숫자,"shop":"정비소명","memo":"메모"}
날짜가 없으면 오늘, 모르는 값은 null.`,

  insurance: `이 보험료/세금 영수증 사진에서 정보를 추출해 JSON만 반환하세요:
{"date":"YYYY-MM-DD","amount":숫자,"expiry":"YYYY-MM-DD","memo":"보험사 또는 내용"}
날짜가 없으면 오늘, 모르는 값은 null.`,

  other: `이 영수증 사진에서 정보를 추출해 JSON만 반환하세요:
{"date":"YYYY-MM-DD","amount":숫자,"desc":"업체명 또는 내용"}
날짜가 없으면 오늘, 모르는 값은 null.`,

  vehicle: `이 차량등록증 사진에서 정보를 추출해 JSON만 반환하세요(설명 없이):
{"plateNo":"차량번호(예:123가4567)","name":"차명(예:그랜저)","year":"연식(4자리 연도)","fuelType":"연료종류(gasoline/diesel/lpg/ev/hybrid 중 하나)"}
연료종류는 반드시 gasoline/diesel/lpg/ev/hybrid 중 하나로만 답하세요. 모르는 값은 null.`
};

async function ocrReceipt(dataUrl, type) {
  const key = _getApiKey();
  if (!key) {
    /* 같은 도메인이라 localStorage 공유 — CRM 설정으로 이동 */
    if (confirm('API 키가 없습니다.\n명함관리 앱 설정에서 Claude API 키를 등록하시겠습니까?')) {
      location.href = '/ai-crm/settings.html';
    }
    return null;
  }
  const resized = await _resizeImg(dataUrl);
  const base64  = resized.replace(/^data:image\/jpeg;base64,/, '');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role:'user', content:[
          { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:base64 } },
          { type:'text',  text: _OCR_PROMPTS[type] || _OCR_PROMPTS.other }
        ]}]
      })
    });
    const d = await res.json();
    /* API 오류 체크 */
    if (!res.ok || d.type === 'error') {
      const msg = d.error?.message || `HTTP ${res.status}`;
      toast('❗ API 오류: ' + msg);
      console.error('OCR API 오류:', d);
      return null;
    }
    const text = d.content?.[0]?.text || '';
    /* JSON 추출 — greedy 매칭으로 전체 객체 포함 */
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { toast('⚠️ 인식됐지만 데이터 추출 실패 — 직접 입력해주세요'); return null; }
    try {
      return JSON.parse(m[0]);
    } catch(pe) {
      toast('⚠️ JSON 파싱 실패 — 직접 입력해주세요');
      console.error('JSON 파싱 오류:', m[0]);
      return null;
    }
  } catch(e) {
    toast('❗ 네트워크 오류: ' + e.message);
    console.error('OCR 오류:', e);
    return null;
  }
}

/* ── 영수증 스캔 버튼 HTML 생성 ── */
function scanBtnHtml(inputId, onChangeFn) {
  return `<label style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:9px;background:#f0fdf4;border:1.5px solid #bbf7d0;color:#15803d;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation;">
    📷 영수증 스캔
    <input id="${inputId}" type="file" accept="image/*" capture="environment" style="display:none" onchange="${onChangeFn}">
  </label>`;
}

/* ── 차량 셀렉트 변경 핸들러 ── */
function onVehicleChange(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  setCurrentVid(el.value);
  if (typeof render === 'function') render();
  if (typeof load === 'function') load();
}
