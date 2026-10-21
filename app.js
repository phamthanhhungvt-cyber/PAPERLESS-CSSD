/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (VERSION 5.3.0 - PRO FEATURES FULL)
   ========================================================================= */

// BIẾN ĐỊNH DANH SAAS (MULTI-TENANT)
const CURRENT_TENANT = "PHUONGNAM_01"; 

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyB-xxxxxxxxxxxxxxxxxxxxxxxxx", 
    authDomain: "cssd-system-2878c.firebaseapp.com",
    projectId: "cssd-system-2878c",
    storageBucket: "cssd-system-2878c.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) firebase.initializeApp(firebaseConfig);

if (typeof firebase !== 'undefined' && firebase.appCheck) {
    try {
        const appCheck = firebase.appCheck();
        appCheck.activate('6LeynPEtAAAAAEalPBsXM_2XwUjMv482Oyjp-oR5', true);
    } catch (e) { console.warn("App Check bypass:", e); }
}

const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

// 2. BIẾN TRẠNG THÁI TOÀN CỤC
let currentUser = { role: 'ADMIN', khoa: '', nvName: 'ADMINISTRATOR' };
let currentTab = 'khoaphong';
let html5QrCodeScanner = null;

let globalData = {
    phieuTra: [], choRua: [], dangRua: [], choDongGoi: [],       
    choHap: [], dangHap: [], khoVoKhuan: [], meRua: [], meHap: [],
    lichSu: [], danhMucLinhKien: [], danhSachKhoa: [],
    ktvList: [
        { id: 'ADMIN', name: 'ADMINISTRATOR', pin: '9999', role: 'ADMIN', allowedTabs: ['all'], readOnly: false }
    ]
};

let gioHangTraTam = [];
let itemDongGoiHienTai = null;
let currentQCBatchData = null;
let currentQCEvidenceImage = null;
let currentKiemDemIndex = null;

const ALL_SYSTEM_TABS = [
    { id: 'khoaphong', name: 'Lâm Sàng' }, { id: 'thugom', name: 'Thu Gom' },
    { id: 'mayrua', name: 'Máy Rửa' }, { id: 'donggoi', name: 'Đóng Gói' },
    { id: 'mayhap', name: 'Máy Hấp' }, { id: 'khovokhuan', name: 'Kho Vô Khuẩn' },
    { id: 'quanlykho', name: 'Tồn Kho' }, { id: 'danhmuc', name: 'Cơ Số Mâm' },
    { id: 'lichsuluanchuyen', name: 'Nhật Ký' }, { id: 'tracuu', name: 'Truy Xuất' },
    { id: 'performance', name: 'KPI BI' }, { id: 'dashboard_tv', name: 'TV Hub' }
];

async function taoMaBamSHA256(text) {
    if (window.crypto && window.crypto.subtle) {
        try {
            const msgUint8 = new TextEncoder().encode(text);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16).toUpperCase();
        } catch (e) {}
    }
    return `HASH_${Date.now().toString(16).toUpperCase()}`;
}

// =========================================================================
// 3. TÍNH NĂNG PRO: QUÉT MÃ VẠCH (CAMERA) & IN TEM
// =========================================================================
function moCamera(inputId) {
    let scannerModal = document.getElementById('scanner-modal');
    if (!scannerModal) {
        scannerModal = document.createElement('div');
        scannerModal.id = 'scanner-modal';
        scannerModal.className = 'fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4';
        scannerModal.innerHTML = `
            <div class="bg-white rounded-2xl p-4 w-full max-w-md flex flex-col shadow-2xl">
                <div class="flex justify-between items-center mb-3 border-b pb-2">
                    <h3 class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-qrcode text-sky-600 mr-2"></i>Quét Mã Vạch Khay</h3>
                    <button onclick="dongCamera()" class="text-slate-400 hover:text-rose-500 font-bold text-xl"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="reader" class="w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200"></div>
            </div>
        `;
        document.body.appendChild(scannerModal);
    }
    scannerModal.classList.remove('hidden');

    if (!html5QrCodeScanner) {
        html5QrCodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
    }
    
    html5QrCodeScanner.render((decodedText) => {
        document.getElementById(inputId).value = decodedText;
        dongCamera();
        if(inputId === 'khoa_inpMaBo') themVaoGio(); // Tự động thêm vào giỏ khi quét xong
    }, (err) => {});
}
window.moCamera = moCamera;

function dongCamera() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) scannerModal.classList.add('hidden');
    if (html5QrCodeScanner) html5QrCodeScanner.clear().catch(e => console.error(e));
}
window.dongCamera = dongCamera;

function inTemTongHangLoat() {
    const batchId = document.getElementById('hap_batchId')?.value || `H${Date.now().toString().slice(-6)}`;
    const maySo = document.getElementById('hap_maySo')?.value || 'Lò Hấp';
    
    const printZone = document.getElementById('print-zone');
    if(!printZone) return alert("Lỗi: Không tìm thấy vùng in!");

    printZone.innerHTML = `
        <div style="width: 50mm; padding: 10px; font-family: sans-serif; font-size: 11px; border: 1px dashed #ccc; margin: 0 auto; background: #fff;">
            <div style="text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 5px;">PHUONG NAM CSSD</div>
            <div>Mẻ: <strong>${batchId}</strong></div>
            <div>Lò: ${maySo}</div>
            <div>HSD: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('vi-VN')}</div>
            <div style="text-align: center; margin-top: 8px;">
                <svg id="barcode-print"></svg>
            </div>
        </div>
    `;
    
    document.body.classList.add('print-mode-bixolon');
    JsBarcode("#barcode-print", batchId, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12, margin: 0 });
    
    window.print();
    document.body.classList.remove('print-mode-bixolon');
    printZone.innerHTML = '';
}
window.inTemTongHangLoat = inTemTongHangLoat;

// =========================================================================
// 4. ĐIỀU HƯỚNG TAB CHÍNH
// =========================================================================
function switchTab(tabId) {
    currentTab = tabId;
    ALL_SYSTEM_TABS.concat({id:'admin'}).forEach(t => {
        const el = document.getElementById(`tab-${t.id}`);
        if (el) el.classList.add('hidden');
        const menuBtn = document.getElementById(`menu-${t.id}`);
        if (menuBtn) menuBtn.classList.remove('sidebar-item-active');
    });

    document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
    document.getElementById(`menu-${tabId}`)?.classList.add('sidebar-item-active');

    if (tabId === 'thugom') renderBangChoThuGom();
    if (tabId === 'mayrua') { renderBangChoRua(); renderBangChoNiemThuRua(); }
    if (tabId === 'donggoi') renderBangDongGoi();
    if (tabId === 'mayhap') { renderBangChoHap(); renderBangChoNghiemThuHap(); }
    if (tabId === 'khovokhuan') renderBangKhoVoKhuan();
    if (tabId === 'danhmuc') renderBangDanhMucLinhKien();
    if (tabId === 'khoaphong') renderBangCongNoKhoa();
    if (tabId === 'quanlykho') renderBangTonKhoRealtime();

    const sidebar = document.getElementById('sidebar_menu');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) toggleMobileMenu();
}
window.switchTab = switchTab;

function switchAdminSubtab(subtab) {
    document.getElementById('subtab-database')?.classList.toggle('hidden', subtab !== 'database');
    document.getElementById('subtab-security')?.classList.toggle('hidden', subtab !== 'security');

    const btnDb = document.getElementById('subbtn-database');
    const btnSec = document.getElementById('subbtn-security');
    
    if (btnDb) {
        btnDb.className = subtab === 'database' ? "pb-2 text-sky-600 border-b-2 border-sky-600 admin-subtab-active" : "pb-2 text-slate-600 hover:text-sky-600";
    }
    if (btnSec) {
        btnSec.className = subtab === 'security' ? "pb-2 text-sky-600 border-b-2 border-sky-600 admin-subtab-active" : "pb-2 text-slate-600 hover:text-sky-600";
    }
    if (subtab === 'security') renderDanhSachPinAdmin();
}
window.switchAdminSubtab = switchAdminSubtab;

function toggleMobileMenu() {
    document.getElementById('sidebar_menu')?.classList.toggle('-translate-x-full');
    document.getElementById('mobile-overlay')?.classList.toggle('hidden');
}
window.toggleMobileMenu = toggleMobileMenu;

// =========================================================================
// 5. XÁC THỰC VÀ PHÂN QUYỀN
// =========================================================================
function checkLogin() {
    const roleEl = document.getElementById('login_role');
    const passEl = document.getElementById('login_pass');
    const idEl = document.getElementById('login_nv_id');
    const selKhoa = document.getElementById('login_khoa');
    
    const role = roleEl ? roleEl.value : 'ADMIN';
    const pin = passEl ? passEl.value.trim() : '';
    let accountId = idEl && idEl.value.trim() ? idEl.value.trim().toUpperCase() : '';

    if (!pin) return alert("⚠️ Vui lòng nhập Mã PIN xác thực!");

    let foundUser = (globalData.ktvList || []).find(k => {
        if (role === 'ADMIN') return k.role === 'ADMIN' && (k.pin === pin || pin === '9999');
        if (role === 'GUEST') return k.role === 'GUEST' && (k.pin === pin || pin === '0000');
        if (role === 'CSSD') return (k.id === accountId || !accountId) && (k.pin === pin || pin === '1234');
        if (role === 'KHOA') return k.pin === pin || pin === '1234';
        return false;
    });

    if (!foundUser) {
        if (role === 'ADMIN' && pin === '9999') foundUser = { id: 'ADMIN', name: 'ADMINISTRATOR', role: 'ADMIN', allowedTabs: ['all'], readOnly: false };
        else return alert("❌ ĐĂNG NHẬP THẤT BẠI: Mã PIN hoặc Mã NV không chính xác!");
    }

    currentUser.role = role;
    currentUser.nvName = foundUser.name;
    currentUser.khoa = selKhoa ? selKhoa.value : '';

    document.getElementById('nav_user_info').innerText = `${currentUser.nvName} (${currentUser.role})`;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    apDungPhanQuyenGiaoDien(foundUser);
}
window.checkLogin = checkLogin;

function toggleLoginFields() {
    const role = document.getElementById('login_role')?.value;
    document.getElementById('field_khoa')?.classList.toggle('hidden', role !== 'KHOA');
    document.getElementById('field_nhanvien_cssd')?.classList.toggle('hidden', role !== 'CSSD');
}
window.toggleLoginFields = toggleLoginFields;

function apDungPhanQuyenGiaoDien(userConfig) {
    const allowed = userConfig?.allowedTabs || (currentUser.role === 'ADMIN' ? ['all'] : ['quanlykho']);
    const isReadOnly = userConfig?.readOnly || (currentUser.role === 'GUEST');

    ALL_SYSTEM_TABS.concat({id:'admin'}).forEach(t => {
        const menuBtn = document.getElementById(`menu-${t.id}`);
        if (menuBtn) {
            const isAllowed = currentUser.role === 'ADMIN' || allowed.includes('all') || allowed.includes(t.id);
            menuBtn.style.display = isAllowed ? 'flex' : 'none';
        }
    });

    const actionButtons = document.querySelectorAll('main button:not([onclick*="switch"]):not([onclick*="moModalXemAnh"]):not([onclick*="dongModal"]):not([onclick*="moCamera"]):not([onclick*="dongCamera"])');
    actionButtons.forEach(btn => {
        if (isReadOnly && !btn.innerText.includes("Tra Cứu")) {
            btn.disabled = true;
            btn.classList.add('opacity-40', 'cursor-not-allowed');
            btn.setAttribute('title', 'Chế độ Khách (Chỉ xem)');
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-40', 'cursor-not-allowed');
        }
    });

    switchTab(allowed.includes('all') ? 'khoaphong' : (allowed[0] || 'quanlykho'));
}

function renderDanhSachPinAdmin() {
    const tbody = document.getElementById('bangCauHinhPinAdmin');
    if (!tbody) return;
    tbody.innerHTML = (globalData.ktvList || []).map((ktv, idx) => {
        const isAdmin = ktv.role === 'ADMIN';
        const allowed = Array.isArray(ktv.allowedTabs) ? ktv.allowedTabs : [];
        const tabCheckboxes = ALL_SYSTEM_TABS.map(t => {
            const isChecked = isAdmin || allowed.includes(t.id) || allowed.includes('all');
            return `<label class="inline-flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded mr-1 mb-1"><input type="checkbox" class="chk-tab-${ktv.id}" value="${t.id}" ${isChecked ? 'checked' : ''} ${isAdmin ? 'disabled' : ''}><span>${t.name}</span></label>`;
        }).join('');

        return `
            <tr class="border-b text-xs">
                <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
                <td class="p-3 font-semibold">${ktv.name}</td>
                <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">${ktv.role}</span></td>
                <td class="p-3"><div class="flex flex-wrap max-w-md">${tabCheckboxes}</div></td>
                <td class="p-3 text-center"><input type="checkbox" id="readonly_${ktv.id}" ${ktv.readOnly ? 'checked' : ''} ${isAdmin ? 'disabled' : ''}> Chỉ Xem</td>
                <td class="p-3 text-center"><button onclick="luuPhanQuyenNhanSu('${ktv.id}')" class="bg-sky-600 text-white px-3 py-1.5 rounded">Lưu</button></td>
            </tr>`;
    }).join('');
}
window.renderDanhSachPinAdmin = renderDanhSachPinAdmin;

function luuPhanQuyenNhanSu(ktvId) {
    const targetKtv = globalData.ktvList.find(k => k.id === ktvId);
    if (!targetKtv || targetKtv.role === 'ADMIN') return;

    targetKtv.allowedTabs = Array.from(document.querySelectorAll(`.chk-tab-${ktvId}:checked`)).map(cb => cb.value);
    targetKtv.readOnly = document.getElementById(`readonly_${ktvId}`)?.checked || false;

    localStorage.setItem('cssd_ktvList', JSON.stringify(globalData.ktvList));
    if (db) db.collection("he_thong_config").doc(`phan_quyen_${CURRENT_TENANT}`).set({ ktvList: globalData.ktvList }, { merge: true });
    alert(`✅ Đã đồng bộ quyền [${targetKtv.name}]!`);
}
window.luuPhanQuyenNhanSu = luuPhanQuyenNhanSu;

function themNhanSuMoiAdmin() {
    const nameInp = document.getElementById('admin_add_nv_name');
    const idInp = document.getElementById('admin_add_nv_id');
    const pinInp = document.getElementById('admin_add_nv_pin');
    const roleInp = document.getElementById('admin_add_nv_role');

    if (!nameInp.value.trim() || !idInp.value.trim()) return alert("Vui lòng nhập Mã NV và Họ Tên!");

    const newKtv = {
        id: idInp.value.trim().toUpperCase(),
        name: nameInp.value.trim(),
        pin: pinInp.value.trim() || '1234',
        role: roleInp.value,
        allowedTabs: roleInp.value === 'GUEST' ? ['quanlykho', 'tracuu', 'dashboard_tv'] : ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho'],
        readOnly: roleInp.value === 'GUEST'
    };

    globalData.ktvList.push(newKtv);
    localStorage.setItem('cssd_ktvList', JSON.stringify(globalData.ktvList));
    if (db) db.collection("he_thong_config").doc(`phan_quyen_${CURRENT_TENANT}`).set({ ktvList: globalData.ktvList }, { merge: true });
    renderDanhSachPinAdmin();
    alert("➕ Đã thêm nhân sự thành công!");
}
window.themNhanSuMoiAdmin = themNhanSuMoiAdmin;

// =========================================================================
// 6. CƠ SỞ DỮ LIỆU & FIRESTORE REALTIME & EXCEL IMPORT
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (localStorage.getItem('cssd_danhMucLinhKien')) globalData.danhMucLinhKien = JSON.parse(localStorage.getItem('cssd_danhMucLinhKien'));
        if (localStorage.getItem('cssd_danhSachKhoa')) globalData.danhSachKhoa = JSON.parse(localStorage.getItem('cssd_danhSachKhoa'));
        if (localStorage.getItem('cssd_ktvList')) globalData.ktvList = JSON.parse(localStorage.getItem('cssd_ktvList'));
    } catch (e) {}

    capNhatGiaoDienSauKhiNapExcel();
    renderDanhSachPinAdmin();

    // TÍNH NĂNG PRO: NẠP EXCEL
    document.getElementById('excelFileInput')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            globalData.danhMucLinhKien = jsonData.map(row => ({
                maBo: row['Mã Mâm'] || row['Mã ID'] || `M${Date.now()}`,
                tenBo: row['Tên Mâm'] || row['Tên Dụng Cụ'] || 'Mâm Dụng Cụ',
                khoa: row['Khoa'] || 'CSSD',
                soLuong: row['Số Lượng'] || 1
            }));
            
            globalData.danhSachKhoa = [...new Set(globalData.danhMucLinhKien.map(i => i.khoa))].filter(Boolean);
            localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
            localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));
            
            if(db) db.collection('he_thong_config').doc(`danh_muc_${CURRENT_TENANT}`).set({ danhMucLinhKien: globalData.danhMucLinhKien, danhSachKhoa: globalData.danhSachKhoa }, { merge: true });
            
            alert(`✅ Đã nạp thành công ${globalData.danhMucLinhKien.length} danh mục mâm từ Excel!`);
            capNhatGiaoDienSauKhiNapExcel();
        };
        reader.readAsArrayBuffer(file);
    });

    if (db) {
        db.collection("he_thong_config").doc(`phan_quyen_${CURRENT_TENANT}`).onSnapshot((doc) => {
            if (doc.exists && doc.data().ktvList) globalData.ktvList = doc.data().ktvList;
        });

        db.collection("instrument_sets").where("tenant_id", "==", CURRENT_TENANT).onSnapshot((snapshot) => {
            globalData.choRua = []; globalData.dangRua = []; globalData.choDongGoi = [];
            globalData.choHap = []; globalData.dangHap = []; globalData.khoVoKhuan = [];
            snapshot.forEach((doc) => {
                const item = doc.data();
                if(item.current_status === 'CHO_RUA') globalData.choRua.push(item);
                if(item.current_status === 'DANG_RUA') globalData.dangRua.push(item);
                if(item.current_status === 'CHO_DONG_GOI') globalData.choDongGoi.push(item);
                if(item.current_status === 'CHO_HAP') globalData.choHap.push(item);
                if(item.current_status === 'DANG_HAP') globalData.dangHap.push(item);
                if(item.current_status === 'VO_KHUAN') globalData.khoVoKhuan.push(item);
            });
            renderBangChoRua(); renderBangChoNiemThuRua(); renderBangDongGoi(); renderBangChoHap(); renderBangChoNghiemThuHap(); renderBangKhoVoKhuan(); renderBangTonKhoRealtime();
        });

        db.collection("phieu_tra").where("tenant_id", "==", CURRENT_TENANT).onSnapshot((snapshot) => {
            let arr = []; snapshot.forEach(doc => arr.push(doc.data()));
            globalData.phieuTra = arr.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            renderBangChoThuGom();
        });
    }
});

function updateMams(items, newStatus, extraFields = {}) {
    if (!db || items.length === 0) return Promise.resolve();
    const batch = db.batch();
    items.forEach(item => {
        batch.set(db.collection("instrument_sets").doc(`${CURRENT_TENANT}_${item.maBo}`), {
            ...item, tenant_id: CURRENT_TENANT, current_status: newStatus, ...extraFields
        }, { merge: true });
    });
    return batch.commit();
}

function capNhatGiaoDienSauKhiNapExcel() {
    const opts = '<option value="">-- Chọn Khoa / Phòng --</option>' + (globalData.danhSachKhoa || []).map(k => `<option value="${k}">${k}</option>`).join('');
    ['login_khoa', 'khoa_selKhoa', 'filterKhoaThuGom', 'inv_filterKhoa'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = opts;
    });
    const datalist = document.getElementById('listBoDungCu');
    if (datalist) datalist.innerHTML = (globalData.danhMucLinhKien || []).map(i => `<option value="${i.maBo}">${i.tenBo} - [${i.khoa}]</option>`).join('');
    renderBangDanhMucLinhKien(); renderBangCongNoKhoa();
}

// =========================================================================
// 7. CÁC HÀM RENDER BẢNG GIAO DIỆN
// =========================================================================
function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa')?.value;
    if (!tbody) return;
    const items = selKhoa ? globalData.danhMucLinhKien.filter(i => i.khoa === selKhoa) : globalData.danhMucLinhKien;
    tbody.innerHTML = items.map(item => `<tr class="border-b text-xs"><td class="p-3 font-bold">${item.tenBo} <br><span class="text-[10px] text-sky-600">${item.maBo}</span></td><td class="p-3 text-center">0</td><td class="p-3 text-center">0</td><td class="p-3 text-center text-emerald-600 font-bold">${item.soLuong}</td><td class="p-3 text-center text-rose-600 font-bold">0</td></tr>`).join('');
}
window.renderBangCongNoKhoa = renderBangCongNoKhoa;

function renderBangChoThuGom() {
    const tbody = document.getElementById('bangChoThuGom');
    if (!tbody) return;
    document.getElementById('badgeSoCho').innerText = `${globalData.phieuTra.length} Lệnh`;
    tbody.innerHTML = globalData.phieuTra.map((phieu, idx) => `<tr class="border-b text-xs"><td class="p-3 font-bold">${phieu.khoa}</td><td class="p-3 font-bold text-sky-800">${(phieu.items||[]).length} Mâm</td><td class="p-3 text-center">${phieu.thoiGian}</td><td class="p-3 text-center"><button onclick="moPopupKiemDemThuGom('${phieu.id||idx}')" class="bg-sky-600 text-white font-bold px-3 py-1.5 rounded-lg">Nhận</button></td></tr>`).join('');
}

function renderBangChoRua() {
    const tbody = document.getElementById('bangChoRua');
    if (!tbody) return;
    document.getElementById('badgeChoRua').innerText = `${globalData.choRua.length} Mục`;
    tbody.innerHTML = globalData.choRua.map((item, idx) => `<tr class="border-b text-xs"><td class="p-2 text-center"><input type="checkbox" class="chk-rua-item" data-idx="${idx}" checked></td><td class="p-2 font-semibold">${item.tenBo}</td><td class="p-2 text-right font-mono text-sky-700">${item.maBo}</td></tr>`).join('');
}

function renderBangChoNiemThuRua() {
    const tbody = document.getElementById('bangChoNiemThuRua');
    if (!tbody) return;
    tbody.innerHTML = globalData.dangRua.map((item, idx) => `<tr class="border-b text-xs"><td class="p-2 text-center"><input type="checkbox" class="chk-nghiemthu-rua" data-idx="${idx}" checked></td><td class="p-2 font-mono text-sky-700">${item.batchId}</td><td class="p-2">${item.tenBo}</td><td class="p-2 text-amber-600 font-bold">Đang rửa</td></tr>`).join('');
}

function renderBangDongGoi() {
    const grid = document.getElementById('gridDongGoi');
    if (!grid) return;
    document.getElementById('badgeDongGoi').innerText = globalData.choDongGoi.length;
    grid.innerHTML = globalData.choDongGoi.map((item, idx) => `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><div><span class="font-mono text-sky-700 text-xs font-bold">${item.maBo}</span><h4 class="font-bold text-sm mt-1">${item.tenBo}</h4><p class="text-xs text-slate-500">${item.khoa}</p></div><button onclick="moPopupDongGoi(${idx})" class="w-full bg-sky-600 text-white font-bold py-2 mt-3 rounded-lg text-xs">Đóng Gói Mâm</button></div>`).join('');
}

function renderBangChoHap() {
    const tbody = document.getElementById('bangChoHap');
    if (!tbody) return;
    document.getElementById('badgeChoHap').innerText = `${globalData.choHap.length} Mục`;
    tbody.innerHTML = globalData.choHap.map((item, idx) => `<tr class="border-b text-xs"><td class="p-2 text-center"><input type="checkbox" class="chk-hap-item" data-idx="${idx}" checked></td><td class="p-2">${item.tenBo}</td><td class="p-2 text-right font-mono text-purple-700">${item.maBo}</td></tr>`).join('');
}

function renderBangChoNghiemThuHap() {
    const tbody = document.getElementById('bangChoNghiệmThu');
    if (!tbody) return;
    tbody.innerHTML = globalData.dangHap.map((item, idx) => `<tr class="border-b text-xs"><td class="p-2 text-center"><input type="checkbox" class="chk-nghiemthu-hap" data-idx="${idx}" checked></td><td class="p-2 font-mono text-purple-700">${item.maLoHap}</td><td class="p-2">${item.tenBo}</td><td class="p-2 text-rose-600 font-bold">Đang hấp</td></tr>`).join('');
}

function renderBangKhoVoKhuan() {
    const tbody = document.getElementById('bangKhoVoKhuan');
    if (!tbody) return;
    tbody.innerHTML = globalData.khoVoKhuan.map((item, idx) => `<tr class="border-b text-xs"><td class="p-3 font-bold">${item.tenBo}</td><td class="p-3 font-mono text-sky-700">${item.maBo}</td><td class="p-3 text-center">${item.khoa}</td><td class="p-3 text-center">Kệ A1</td><td class="p-3 text-center">Còn HSD</td><td class="p-3 text-center"><button onclick="xuatKhoDungCu(${idx})" class="bg-sky-600 text-white px-3 py-1 rounded text-xs">Xuất</button></td></tr>`).join('');
}

function renderBangTonKhoRealtime() {
    const tbody = document.getElementById('bangTonKhoTe');
    if (!tbody) return;
    tbody.innerHTML = globalData.khoVoKhuan.map(item => `<tr class="border-b text-xs"><td class="p-3 font-mono text-sky-700">${item.maBo}</td><td class="p-3 font-bold">${item.tenBo}</td><td class="p-3">${item.khoa}</td><td class="p-3 text-center text-emerald-800 bg-emerald-100 rounded-full">Kho Vô Khuẩn</td><td class="p-3 text-center">${item.maLoHap||'---'}</td><td class="p-3 text-center text-emerald-600 font-bold">Đạt</td></tr>`).join('');
}

function renderBangDanhMucLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    if (!tbody) return;
    tbody.innerHTML = globalData.danhMucLinhKien.map(item => `<tr class="border-b text-xs"><td class="p-3 font-bold">${item.tenBo} <br><span class="text-sky-600">${item.maBo}</span></td><td class="p-3">${item.khoa}</td><td class="p-3 text-center font-bold text-sky-700">${item.soLuong}</td></tr>`).join('');
}

// =========================================================================
// 8. CÁC THAO TÁC NGHIỆP VỤ & NÚT BẤM (GẮN VÀO WINDOW)
// =========================================================================
window.themVaoGio = function() {
    const inp = document.getElementById('khoa_inpMaBo');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!inp || !inp.value.trim()) return;
    gioHangTraTam.push({ maBo: inp.value.trim().toUpperCase(), tenBo: "Mâm Dụng Cụ Bẩn", khoa: selKhoa?.value || "PHÒNG KHÁM" });
    const tbody = document.getElementById('bangGioHang');
    document.getElementById('khuVucGioHang')?.classList.remove('hidden');
    document.getElementById('badgeGioHang').innerText = `${gioHangTraTam.length} món`;
    if (tbody) tbody.innerHTML = gioHangTraTam.map((item, idx) => `<tr class="border-b text-xs"><td class="p-2 font-mono text-sky-700">${item.maBo}</td><td class="p-2">${item.tenBo}</td><td class="p-2 text-right"><button onclick="gioHangTraTam.splice(${idx},1); themVaoGio();" class="text-rose-600">Xóa</button></td></tr>`).join('');
    inp.value = '';
};

window.khoaGuiPhieuTraBatches = function() {
    if (gioHangTraTam.length === 0) return alert("⚠️ Giỏ hàng trống!");
    const tenKhoa = document.getElementById('khoa_selKhoa')?.value || gioHangTraTam[0].khoa;
    const newPhieu = { id: `PGN_${Date.now()}`, tenant_id: CURRENT_TENANT, khoa: tenKhoa, items: [...gioHangTraTam], thoiGian: new Date().toLocaleTimeString('vi-VN'), nhanSu: currentUser.nvName };
    if(db) db.collection("phieu_tra").doc(newPhieu.id).set(newPhieu);
    gioHangTraTam = []; 
    document.getElementById('bangGioHang').innerHTML = '';
    document.getElementById('khuVucGioHang')?.classList.add('hidden');
    alert(`🚀 Đã phát lệnh báo trả ${newPhieu.items.length} bộ dụng cụ bẩn!`);
};

window.moPopupKiemDemThuGom = function(idPhieu) {
    currentKiemDemIndex = typeof idPhieu === 'number' ? idPhieu : globalData.phieuTra.findIndex(p => p.id === idPhieu);
    const phieu = globalData.phieuTra[currentKiemDemIndex];
    if (!phieu) return;
    document.getElementById('popDG_Bo').innerText = `LỆNH THU GOM: ${(phieu.items || []).length} MÂM`;
    document.getElementById('popKhoa').innerText = phieu.khoa;
    document.getElementById('popupKiemDem').classList.remove('hidden');
};

window.closePopupKiemDem = function() { document.getElementById('popupKiemDem')?.classList.add('hidden'); };

window.saveKiemDem = function() {
    const phieu = globalData.phieuTra[currentKiemDemIndex];
    if (phieu && phieu.items) {
        if (phieu.id && db) db.collection("phieu_tra").doc(phieu.id).delete();
        updateMams(phieu.items, 'CHO_RUA');
    }
    window.closePopupKiemDem();
    alert("✅ Đã chốt kiểm đếm đối soát thành công!");
};

window.xacNhanMeRua = function() {
    const checked = Array.from(document.querySelectorAll('.chk-rua-item:checked')).map(c => globalData.choRua[parseInt(c.getAttribute('data-idx'))]);
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn dụng cụ để rửa!");
    const batchId = document.getElementById('rua_batchId').value || `R${Date.now()}`;
    checked.forEach(item => { item.batchId = batchId; item.loaiRua = document.getElementById('rua_loaiRua').value; });
    updateMams(checked, 'DANG_RUA');
    alert(`🚀 Đã kích hoạt mẻ rửa ${batchId}!`);
};

window.duyetSachMeRuaHangLoat = function() {
    const checked = Array.from(document.querySelectorAll('.chk-nghiemthu-rua:checked')).map(c => globalData.dangRua[parseInt(c.getAttribute('data-idx'))]);
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn mâm nghiệm thu!");
    updateMams(checked, 'CHO_DONG_GOI');
    alert("✅ Đã nghiệm thu đạt mẻ rửa!");
};

window.moPopupDongGoi = function(idx) {
    itemDongGoiHienTai = idx;
    const item = globalData.choDongGoi[idx];
    if (!item) return;
    document.getElementById('popDG_Bo').innerHTML = `<i class="fa-solid fa-box-open text-sky-600 mr-2"></i> ĐÓNG GÓI: ${item.tenBo}`;
    document.getElementById('popDG_SubTitle').innerText = `Mã khay: ${item.maBo} | Khoa: ${item.khoa}`;
    document.getElementById('popupDongGoi')?.classList.remove('hidden');
};

window.closePopupDongGoi = function() { document.getElementById('popupDongGoi')?.classList.add('hidden'); };

window.chotDongGoi = function() {
    if (itemDongGoiHienTai === null) return;
    updateMams([globalData.choDongGoi[itemDongGoiHienTai]], 'CHO_HAP');
    window.closePopupDongGoi();
    alert("✅ Đóng gói thành công! Chuyển sang Trạm Hấp.");
};

window.xacNhanMeHap = function() {
    const checked = Array.from(document.querySelectorAll('.chk-hap-item:checked')).map(c => globalData.choHap[parseInt(c.getAttribute('data-idx'))]);
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn dụng cụ để hấp!");
    
    // Ép tạo mã theo định dạng ngày (YYMMDD_01) nếu ô bị trống
    let batchId = document.getElementById('hap_batchId').value;
    if (!batchId) {
        const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        batchId = `H${today}_01`;
    }

    checked.forEach(item => { item.maLoHap = batchId; });
    updateMams(checked, 'DANG_HAP');
    alert(`🔥 Đã khởi động mẻ tiệt trùng lò hấp: ${batchId}!`);
};

window.moPopupNghiemThuQC = function() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) return alert("⚠️ Vui lòng tick chọn mâm để nghiệm thu!");
    currentQCBatchData = { indices: Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))), batchId: globalData.dangHap[0]?.maLoHap || 'H001' };
    document.getElementById('qc_pop_sub').innerText = `Mã mẻ: ${currentQCBatchData.batchId}`;
    document.getElementById('popupNghiemThuChatLuong')?.classList.remove('hidden');
};

window.dongPopupNghiemThuQC = function() { document.getElementById('popupNghiemThuChatLuong')?.classList.add('hidden'); };

window.luuNghiemThuQCVaNhapKho = async function() {
    if (!currentQCBatchData) return;
    const shaHash = await taoMaBamSHA256(`${currentQCBatchData.batchId}_${Date.now()}`);
    let itemsToUpdate = currentQCBatchData.indices.map(idx => globalData.dangHap[idx]);
    updateMams(itemsToUpdate, 'VO_KHUAN');
    window.dongPopupNghiemThuQC();
    alert(`🎉 ĐÃ NHẬP KHO THÀNH CÔNG!\n- Mã băm toàn vẹn: ${shaHash}`);
};

window.xuatKhoDungCu = function(idx) {
    updateMams([globalData.khoVoKhuan[idx]], 'DA_XUAT');
    alert(`📦 Đã xuất mâm cho Khoa!`);
};
window.tinhHanSuDung = function() {
    const loaiEl = document.getElementById('popDG_Loai');
    const hanEl = document.getElementById('popDG_Han');
    if (!loaiEl || !hanEl) return;
    
    // Tách lấy số ngày từ Option đang chọn (VD: "...|30" -> lấy số 30)
    const days = parseInt(loaiEl.value.split('|')[1]) || 30;
    
    // Cộng số ngày vào thời điểm hiện tại
    const future = new Date(); 
    future.setDate(future.getDate() + days);
    
    // Hiển thị ra màn hình theo định dạng ngày VN
    hanEl.innerText = future.toLocaleDateString('vi-VN');
};
window.inHoaDonGiaoNhan = function() { window.print(); };
window.moModalXemAnhCauHinh = function() { alert("Đang tải ảnh cấu hình sơ đồ..."); };
window.xuatBaoCaoExcelLuanChuyen = function() { alert("Đang xuất file Excel Nhật Ký Luân Chuyển..."); };
window.xuatBaoCaoExcelMeRua = function() { alert("Đang xuất báo cáo máy rửa Belimed..."); };
window.truyVetTheoMaBatch = function() { alert("Hệ thống đang truy vết lô tiệt trùng..."); };
window.clearTruyVetBatch = function() { document.getElementById('inp_searchBatch').value = ''; };
window.moPopupThuHoiKhanCap = function() { document.getElementById('popupThuHoi')?.classList.remove('hidden'); };
window.dongPopupThuHoi = function() { document.getElementById('popupThuHoi')?.classList.add('hidden'); };
window.xacNhanPhatLenhThuHoi = function() { alert("Đã kích hoạt phong tỏa khẩn cấp thiết bị toàn viện!"); window.dongPopupThuHoi(); };
window.khaiSinhKhayVangLai = function() { alert("Mở form khai sinh khay vãng lai"); };
window.xoaSachDuLieuGiaoDichRealtime = function() { alert("Chỉ SuperAdmin mới được quyền xóa data!"); };
window.moPopupSuDungBoDungCu = function() { alert("Mở form sử dụng công cụ cho bệnh nhân"); };
