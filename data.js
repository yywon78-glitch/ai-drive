/* ── data.js : 데이터 레이어 ── */

/* ── 영수증 이미지 저장 (IndexedDB) ── */
const ImgDB = (function(){
  let _db = null;
  function _open(){
    return new Promise((res,rej)=>{
      if(_db) return res(_db);
      const req = indexedDB.open('drive_imgs', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('imgs');
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror = rej;
    });
  }
  return {
    set:(id,data)=>_open().then(db=>new Promise((res,rej)=>{
      const tx=db.transaction('imgs','readwrite');
      tx.objectStore('imgs').put(data,id); tx.oncomplete=res; tx.onerror=rej;
    })),
    get:(id)=>_open().then(db=>new Promise((res,rej)=>{
      const req=db.transaction('imgs','readonly').objectStore('imgs').get(id);
      req.onsuccess=e=>res(e.target.result||null); req.onerror=rej;
    })),
    del:(id)=>_open().then(db=>new Promise(res=>{
      const tx=db.transaction('imgs','readwrite');
      tx.objectStore('imgs').delete(id); tx.oncomplete=res;
    }))
  };
})();

const DB = {
  get(k, d=[]) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
};

/* ── 편의 함수 ── */
function getVehicles() { return DB.get('vehicles', []); }
function setVehicles(v) { DB.set('vehicles', v); }
function getCurrentVid() { return DB.get('currentVid', ''); }
function setCurrentVid(id) { DB.set('currentVid', id); }

function getV() {
  const vs = getVehicles();
  const vid = getCurrentVid();
  return vs.find(v => v.id === vid) || vs[0] || null;
}

function getRecs(type) {
  const v = getV();
  if (!v) return [];
  const all = DB.get('recs_' + v.id, []);
  return type ? all.filter(r => r.type === type) : all;
}

function getAllRecs() {
  const v = getV();
  if (!v) return [];
  return DB.get('recs_' + v.id, []);
}

function addRec(r) {
  const v = getV();
  if (!v) return;
  const k = 'recs_' + v.id;
  const a = DB.get(k, []);
  a.unshift(r);
  DB.set(k, a);
}

function delRec(id) {
  const v = getV();
  if (!v) return;
  const k = 'recs_' + v.id;
  DB.set(k, DB.get(k, []).filter(r => r.id !== id));
}

function updateVehicleMileage(km) {
  const vs = getVehicles();
  const v = getV();
  if (!v) return;
  const idx = vs.findIndex(x => x.id === v.id);
  if (idx >= 0) { vs[idx].mileage = km; setVehicles(vs); }
}

/* ── 정비 항목 간격 테이블 ── */
const MAINT_INTERVAL = {
  engine_oil:       { km:10000, mo:12 },
  engine_oil_basic: { km:5000,  mo:6  },
  air_filter:       { km:20000, mo:12 },
  cabin_filter:     { km:15000, mo:6  },
  tire_rotation:    { km:10000, mo:null },
  tire_replace:     { km:50000, mo:48 },
  brake:            { km:40000, mo:null },
  coolant:          { km:40000, mo:24 },
  spark_plug:       { km:30000, mo:null },
  battery:          { km:null,  mo:30 }
};

const MAINT_LABEL = {
  engine_oil:'엔진오일(합성)', engine_oil_basic:'엔진오일(일반)',
  air_filter:'에어클리너', cabin_filter:'에어컨필터',
  tire_rotation:'타이어 로테이션', tire_replace:'타이어 교체',
  brake:'브레이크패드', coolant:'냉각수',
  spark_plug:'점화플러그', battery:'배터리',
  exterior:'외관', tax:'세금/검사', other:'기타'
};

const PURPOSE_LABEL = {
  commute:'출퇴근', business:'업무', personal:'개인', travel:'여행', other:'기타'
};

const INS_LABEL = {
  car_insurance:'자동차보험', car_tax:'자동차세', parking:'주차비', other:'기타'
};

/* ── 렌더 차량 셀렉트 (공통) ── */
function renderVehicleSelect(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const vs = getVehicles();
  const vid = getCurrentVid();
  el.innerHTML = vs.length
    ? vs.map(v => `<option value="${v.id}"${v.id === vid ? ' selected' : ''}>${v.name} ${v.plateNo}</option>`).join('')
    : '<option value="">차량 없음</option>';
}

/* ── 샘플 데이터 주입 (drive_sample_v1 플래그) ── */
(function injectSample() {
  if (localStorage.getItem('drive_sample_v1')) return;
  /* 이미 차량이 등록돼 있으면 샘플 주입 건너뜀 */
  if (getVehicles().length > 0) { localStorage.setItem('drive_sample_v1','1'); return; }

  const vid = 'v_s1';
  const vehicle = {
    id: vid,
    name: '그랜저',
    plateNo: '123가4567',
    year: '2022',
    fuelType: 'gasoline',
    tank: 60,
    insurance: '2027-04-15',
    inspect: '2027-08-20',
    mileage: 65840
  };
  localStorage.setItem('vehicles', JSON.stringify([vehicle]));
  localStorage.setItem('currentVid', vid);

  const recs = [];

  /* 주유 기록 10건 (2026-08 ~ 2026-11) */
  const fuelData = [
    { date:'2026-08-05', mileage:64200, liters:55.0, price:1640 },
    { date:'2026-08-28', mileage:64820, liters:52.3, price:1630 },
    { date:'2026-09-10', mileage:65150, liters:30.5, price:1650 },
    { date:'2026-09-25', mileage:65480, liters:31.2, price:1660 },
    { date:'2026-10-07', mileage:65680, liters:19.8, price:1670 },
    { date:'2026-10-18', mileage:65890, liters:20.5, price:1655 },
    { date:'2026-10-30', mileage:66120, liters:22.4, price:1645 },
    { date:'2026-11-05', mileage:66340, liters:21.0, price:1680 },
    { date:'2026-11-10', mileage:66520, liters:17.8, price:1670 },
    { date:'2026-11-11', mileage:66700, liters:17.2, price:1660 }
  ];
  let prevMileage = 63580;
  fuelData.forEach((f, i) => {
    const dist = f.mileage - prevMileage;
    const effic = dist > 0 ? +(dist / f.liters).toFixed(2) : 0;
    recs.push({
      id: 'f' + i,
      type: 'fuel',
      date: f.date,
      mileage: f.mileage,
      liters: f.liters,
      price: f.price,
      amount: Math.round(f.liters * f.price),
      effic,
      station: ['GS칼텍스 역삼점','SK에너지 강남점','현대오일뱅크','S-OIL 서초점','알뜰주유소'][i % 5]
    });
    prevMileage = f.mileage;
  });

  /* 정비 기록 5건 */
  const maintData = [
    { date:'2026-08-10', category:'engine_oil',   amount:65000, mileage:64250, shop:'현대블루핸즈 강남', nextDate:'2027-08-10', nextKm:74250 },
    { date:'2026-08-10', category:'air_filter',   amount:25000, mileage:64250, shop:'현대블루핸즈 강남', nextDate:'2027-08-10', nextKm:84250 },
    { date:'2026-09-15', category:'tire_rotation', amount:30000, mileage:65200, shop:'타이어뱅크 서초점',  nextDate:'',          nextKm:75200 },
    { date:'2026-10-05', category:'cabin_filter', amount:18000, mileage:65650, shop:'자동차용품점',        nextDate:'2027-04-05', nextKm:80650 },
    { date:'2026-11-01', category:'brake',        amount:120000, mileage:66200, shop:'현대블루핸즈 강남',  nextDate:'',          nextKm:106200 }
  ];
  maintData.forEach((m, i) => {
    recs.push({ id: 'm' + i, type:'maint', ...m, memo:'' });
  });

  /* 운행 기록 15건 (2026-10 ~ 2026-11) */
  const driveData = [
    { date:'2026-10-01', startKm:65500, endKm:65532, purpose:'commute', from:'집', to:'회사', startTime:'08:20', endTime:'08:52' },
    { date:'2026-10-02', startKm:65532, endKm:65564, purpose:'commute', from:'집', to:'회사', startTime:'08:15', endTime:'08:47' },
    { date:'2026-10-05', startKm:65564, endKm:65620, purpose:'business', from:'회사', to:'강남 고객사', startTime:'10:00', endTime:'10:35' },
    { date:'2026-10-07', startKm:65620, endKm:65680, purpose:'commute', from:'집', to:'회사', startTime:'08:25', endTime:'08:58' },
    { date:'2026-10-10', startKm:65680, endKm:65780, purpose:'personal', from:'집', to:'마트', startTime:'14:00', endTime:'15:10' },
    { date:'2026-10-14', startKm:65780, endKm:65812, purpose:'commute', from:'집', to:'회사', startTime:'08:18', endTime:'08:50' },
    { date:'2026-10-18', startKm:65812, endKm:65890, purpose:'business', from:'회사', to:'판교 거래처', startTime:'09:30', endTime:'10:15' },
    { date:'2026-10-21', startKm:65890, endKm:65922, purpose:'commute', from:'집', to:'회사', startTime:'08:20', endTime:'08:53' },
    { date:'2026-10-25', startKm:65922, endKm:66050, purpose:'travel',  from:'서울', to:'가평', startTime:'09:00', endTime:'10:30' },
    { date:'2026-10-30', startKm:66050, endKm:66120, purpose:'commute', from:'집', to:'회사', startTime:'08:22', endTime:'08:55' },
    { date:'2026-11-03', startKm:66120, endKm:66155, purpose:'commute', from:'집', to:'회사', startTime:'08:17', endTime:'08:50' },
    { date:'2026-11-05', startKm:66155, endKm:66340, purpose:'business', from:'서울', to:'수원 협력사', startTime:'10:00', endTime:'11:30' },
    { date:'2026-11-07', startKm:66340, endKm:66372, purpose:'commute', from:'집', to:'회사', startTime:'08:20', endTime:'08:52' },
    { date:'2026-11-10', startKm:66372, endKm:66520, purpose:'personal', from:'집', to:'부모님댁', startTime:'11:00', endTime:'12:40' },
    { date:'2026-11-11', startKm:66520, endKm:66552, purpose:'commute', from:'집', to:'회사', startTime:'08:18', endTime:'08:50' }
  ];
  driveData.forEach((d, i) => {
    recs.push({ id:'d'+i, type:'drive', ...d, dist: d.endKm - d.startKm, source:'manual' });
  });

  /* 하이패스 충전 3건 */
  const hipassData = [
    { date:'2026-08-20', amount:30000, place:'한국도로공사 충전소', balance:30000 },
    { date:'2026-09-18', amount:30000, place:'편의점 충전',         balance:38500 },
    { date:'2026-10-22', amount:50000, place:'하이플러스 카드사',   balance:62000 }
  ];
  hipassData.forEach((h, i) => {
    recs.push({ id:'h'+i, type:'hipass', ...h });
  });

  /* 보험 2건 */
  const insData = [
    { date:'2026-04-15', insType:'car_insurance', amount:620000, expiry:'2027-04-15', memo:'삼성화재 종합보험' },
    { date:'2026-06-30', insType:'car_tax',       amount:264000, expiry:'',           memo:'2026년 하반기' }
  ];
  insData.forEach((ins, i) => {
    recs.push({ id:'ins'+i, type:'insurance', ...ins });
  });

  localStorage.setItem('recs_' + vid, JSON.stringify(recs));
  localStorage.setItem('drive_sample_v1', '1');
})();
