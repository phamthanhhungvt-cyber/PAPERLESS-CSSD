/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (SaaS ENTERPRISE VERSION 5.0)
   ========================================================================= */

// BIẾN ĐỊNH DANH SAAS (MULTI-TENANT)
const CURRENT_TENANT = "PHUONGNAM_01"; 

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyB-xxxxxxxxxxxxxxxxxxxxxxxxx", // Thay mã API key thật của bạn
    authDomain: "cssd-system-2878c.firebaseapp.com",
    projectId: "cssd-system-2878c",
    storageBucket: "cssd-system-2878c.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Khởi tạo App Check nếu có thư viện
if (typeof firebase !== 'undefined' && firebase.appCheck) {
    try {
        const appCheck = firebase.appCheck();
        appCheck.activate('6LeynPEtAAAAAEalPBsXM_2XwUjMv482Oyjp-oR5', true);
        console.log("🔒 [SECURITY] Firebase App Check đã kích hoạt!");
    } catch (e) {
        console.warn("App Check bypass:", e);
    }
}

const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
const storage = (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null;

// 2. BIẾN TRẠNG THÁI TOÀN CỤC
let currentUser = { role: 'ADMIN', khoa: '', nvName: 'ADMINISTRATOR' };
let currentTab = 'khoaphong';
let html5QrCodeScanner = null;
let currentCameraInputId = null;

let globalData = {
    phieuTra: [], choRua: [], dangRua: [], choDongGoi: [],       
    choHap: [], dangHap: [], khoVoKhuan: [], meRua: [], meHap: [],
    lichSu: [], danhMucLinhKien: [], danhSachKhoa: [],
    ktvList: [
        { 
            id: 'NV01', name: 'Nguyễn Văn A', pin: '1234', role: 'CSSD', 
            allowedTabs: ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'tracuu'], 
            readOnly: false 
        },
        { 
            id: 'NV02', name: 'Trần Thị Thoa', pin: '1234', role: 'CSSD', 
            allowedTabs: ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'tracuu'], 
            readOnly: false 
        },
        { 
            id: 'NV03', name: 'Mai', pin: '1234', role: 'CSSD', 
            allowedTabs: ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'tracuu'], 
            readOnly: false 
        },
        { 
            id: 'GUEST', name: 'Khách Tham Quan', pin: '0000', role: 'GUEST', 
            allowedTabs: ['quanlykho', 'tracuu', 'performance', 'dashboard_tv'], 
            readOnly: true 
        },
        { 
            id: 'ADMIN', name: 'ADMINISTRATOR', pin: '9999', role: 'ADMIN', 
            allowedTabs: ['all'], 
            readOnly: false 
        }
    ]
};

let gioHangTraTam = [];
let tempSuDungKhay = [];
let itemDongGoiHienTai = null;
let currentRecallBatchId = "";
let anhBangChungDongGoiTam = null;
let currentQCBatchData = null;
let currentQCEvidenceImage = null;
let currentKiemDemIndex = null;

let canvasKy = null;
let ctxKy = null;
let isDrawingKy = false;

let barcodeScannerBuffer = "";
let barcodeScannerTimer = null;
let isBarcodeScannerEnabled = true;

const ALL_SYSTEM_TABS = [
    { id: 'khoaphong', name: 'Lâm Sàng' },
    { id: 'thugom', name: 'Thu Gom' },
    { id: 'mayrua', name: 'Máy Rửa' },
    { id: 'donggoi', name: 'Đóng Gói' },
    { id: 'mayhap', name: 'Máy Hấp' },
    { id: 'khovokhuan', name: 'Kho Vô Khuẩn' },
    { id: 'quanlykho', name: 'Tồn Kho' },
    { id: 'danhmuc', name: 'Cơ Số Mâm' },
    { id: 'lichsuluanchuyen', name: 'Nhật Ký' },
    { id: 'tracuu', name: 'Truy Xuất' },
    { id: 'performance', name: 'KPI BI' },
    { id: 'dashboard_tv', name: 'TV Hub' }
];

const SET_ALIAS_MAPPING = {
    "MOLAYTHAI": "MỔ LẤY THAI", "MO LAY THAI": "MỔ LẤY THAI",
    "SANH": "BỘ SANH", "BO SANH": "BỘ SANH",
    "NAO": "BỘ NẠO", "MAYTANGSINHMON": "MAY TẦNG SINH MÔN",
    "MOCTC(HO)": "CẮT TỬ CUNG", "NOISOI": "NỘI SOI"
};

function cleanSearchStr(str) {
    return (str || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
}

function parseVietnameseDate(strDate) {
    if (!strDate) return null;
    if (strDate.includes('/')) {
        const parts = strDate.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    } else if (strDate.includes('-')) {
        const parts = strDate.split('-');
        if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
        else return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(strDate);
}

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
// 3. ĐỒNG BỘ FIRESTORE & LOCAL STORAGE
// =========================================================================
function docDuLieuLuuTruLocalStorage() {
    try {
        const savedLinhKien = localStorage.getItem('cssd_danhMucLinhKien');
        const savedKhoa = localStorage.getItem('cssd_danhSachKhoa');
        const savedKtv = localStorage.getItem('cssd_ktvList');

        if (savedLinhKien) globalData.danhMucLinhKien = JSON.parse(savedLinhKien) || [];
        if (savedKhoa) globalData.danhSachKhoa = JSON.parse(savedKhoa) || [];
        if (savedKtv) globalData.ktvList = JSON.parse(savedKtv) || globalData.ktvList;

        capNhatGiaoDienSauKhiNapExcel();
        renderDanhSachPinAdmin();
    } catch (err) { console.error("Lỗi đọc Local:", err); }
}

function capNhatTatCaGiaoDien() {
    renderBangChoRua(); renderBangChoNiemThuRua(); renderBangDongGoi();
    renderBangChoHap(); renderBangChoNghiemThuHap(); renderBangKhoVoKhuan();
    renderBangTonKhoRealtime(); renderDashboardTV(); renderBangCongNoKhoa();
}

function initRealtimeListeners() {
    if (!db) return;

    db.collection("instrument_sets").where("tenant_id", "==", CURRENT_TENANT)
        .onSnapshot((snapshot) => {
            globalData.choRua = []; globalData.dangRua = []; globalData.choDongGoi = [];
            globalData.choHap = []; globalData.dangHap = []; globalData.khoVoKhuan = [];

            snapshot.forEach((doc) => {
                const item = doc.data();
                switch(item.current_status) {
                    case 'CHO_RUA': globalData.choRua.push(item); break;
                    case 'DANG_RUA': globalData.dangRua.push(item); break;
                    case 'CHO_DONG_GOI': globalData.choDongGoi.push(item); break;
                    case 'CHO_HAP': globalData.choHap.push(item); break;
                    case 'DANG_HAP': globalData.dangHap.push(item); break;
                    case 'VO_KHUAN': globalData.khoVoKhuan.push(item); break;
                }
            });
            capNhatTatCaGiaoDien();
        }, (err) => console.warn("Firestore sets bypass:", err));

    db.collection("phieu_tra").where("tenant_id", "==", CURRENT_TENANT)
        .onSnapshot((snapshot) => {
            let arr = [];
            snapshot.forEach(doc => arr.push(doc.data()));
            arr.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            globalData.phieuTra = arr;
            renderBangChoThuGom();
        }, (err) => console.warn("Firestore phieu_tra bypass:", err));

    db.collection("transaction_logs").where("tenant_id", "==", CURRENT_TENANT)
        .limit(150)
        .onSnapshot((snapshot) => {
            let arr = [];
            snapshot.forEach((doc) => arr.push(doc.data()));
            arr.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            globalData.lichSu = arr;
            renderBangLichSuLuanChuyen();
            renderBangKPIPerformance();
        }, (err) => console.warn("Firestore logs bypass:", err));

    db.collection("he_thong_config").doc(`danh_muc_${CURRENT_TENANT}`)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data.danhMucLinhKien) globalData.danhMucLinhKien = data.danhMucLinhKien;
                if (data.danhSachKhoa) globalData.danhSachKhoa = data.danhSachKhoa;
                localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                capNhatGiaoDienSauKhiNapExcel();
            }
        }, (err) => console.warn("Firestore danh_muc bypass:", err));

    db.collection("sterilization_batches").where("tenant_id", "==", CURRENT_TENANT)
        .onSnapshot((snapshot) => {
            let arrHap = [], arrRua = [];
            snapshot.forEach(doc => {
                const b = doc.data();
                if (b.batch_type === 'HAP') arrHap.push(b);
                if (b.batch_type === 'RUA') arrRua.push(b);
            });
            arrHap.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            arrRua.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            globalData.meHap = arrHap;
            globalData.meRua = arrRua;
            renderBangLichSuHap();
            renderBangLichSuRua();
        }, (err) => console.warn("Firestore batches bypass:", err));
}

function updateMams(items, newStatus, extraFields = {}) {
    if (!db || items.length === 0) return Promise.resolve();
    const batch = db.batch();
    items.forEach(item => {
        if (!item.maBo) return;
        const ref = db.collection("instrument_sets").doc(`${CURRENT_TENANT}_${item.maBo}`);
        batch.set(ref, {
            ...item,
            tenant_id: CURRENT_TENANT,
            current_status: newStatus,
            ...extraFields,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    return batch.commit();
}

function ghiNhatKyFirebase(dataAction) {
    if (!db) return;
    const logEntry = {
        tenant_id: CURRENT_TENANT,
        maBo: dataAction.maBo || "N/A",
        tenBo: dataAction.tenBo || "Mâm dụng cụ",
        khoa: dataAction.khoa || "CSSD",
        trangThai: dataAction.trangThai || "Đang xử lý",
        maLoHap: dataAction.maLoHap || dataAction.batchId || "---",
        nhanSu: currentUser.nvName || "KTV CSSD",
        thoiGian: new Date().toLocaleString('vi-VN'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection("transaction_logs").add(logEntry);
}

// =========================================================================
// 4. XÁC THỰC VÀ PHÂN QUYỀN TRUY CẬP (RBAC & READ-ONLY)
// =========================================================================
function checkLogin() {
    const roleEl = document.getElementById('login_role');
    const passEl = document.getElementById('login_pass');
    const idEl = document.getElementById('login_nv_id');
    const selKhoa = document.getElementById('login_khoa');
    
    const role = roleEl ? roleEl.value : 'ADMIN';
    const pin = passEl ? passEl.value.trim() : '';
    let accountId = idEl && idEl.value.trim() ? idEl.value.trim().toUpperCase() : '';

    if (!pin) { alert("⚠️ Vui lòng nhập Mã PIN xác thực!"); return; }

    // Tìm trong danh sách phân quyền nội bộ
    let foundUser = (globalData.ktvList || []).find(k => {
        if (role === 'ADMIN') return k.role === 'ADMIN' && k.pin === pin;
        if (role === 'GUEST') return k.role === 'GUEST' && (k.pin === pin || pin === '0000');
        if (role === 'CSSD') return k.id === accountId && k.pin === pin;
        if (role === 'KHOA') return k.pin === pin;
        return false;
    });

    // Mặc định fallback nếu khớp mã PIN cơ bản
    if (!foundUser) {
        if (role === 'ADMIN' && pin === '9999') {
            foundUser = { id: 'ADMIN', name: 'ADMINISTRATOR', role: 'ADMIN', allowedTabs: ['all'], readOnly: false };
        } else if (role === 'GUEST' && pin === '0000') {
            foundUser = { id: 'GUEST', name: 'Khách Tham Quan', role: 'GUEST', allowedTabs: ['quanlykho', 'tracuu', 'performance', 'dashboard_tv'], readOnly: true };
        } else if (role === 'CSSD' && (pin === '1234' || pin === 'NV01')) {
            foundUser = { id: accountId || 'NV01', name: 'KTV CSSD', role: 'CSSD', allowedTabs: ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'tracuu'], readOnly: false };
        } else if (role === 'KHOA' && pin === '1234') {
            foundUser = { id: 'KHOA', name: selKhoa ? selKhoa.value : 'Điều Dưỡng Lâm Sàng', role: 'KHOA', allowedTabs: ['khoaphong'], readOnly: false };
        }
    }

    if (!foundUser) {
        alert("❌ ĐĂNG NHẬP THẤT BẠI: Mã PIN hoặc Mã NV không chính xác!");
        return;
    }

    currentUser.role = role;
    currentUser.nvName = foundUser.name;
    currentUser.khoa = selKhoa ? selKhoa.value : '';

    const userInfoEl = document.getElementById('nav_user_info');
    if (userInfoEl) userInfoEl.innerText = `${currentUser.nvName} (${currentUser.role})`;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    apDungPhanQuyenGiaoDien(foundUser);
}

function apDungPhanQuyenGiaoDien(userConfig) {
    const allMenuIds = ['khoaphong', 'thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'lichsuluanchuyen', 'tracuu', 'performance', 'dashboard_tv', 'admin'];
    const allowed = userConfig?.allowedTabs || (currentUser.role === 'ADMIN' ? ['all'] : ['quanlykho']);
    const isReadOnly = userConfig?.readOnly || (currentUser.role === 'GUEST');

    // 1. Điều khiển thanh menu điều hướng
    allMenuIds.forEach(tabId => {
        const menuBtn = document.getElementById(`menu-${tabId}`);
        if (menuBtn) {
            const isAllowed = currentUser.role === 'ADMIN' || allowed.includes('all') || allowed.includes(tabId);
            menuBtn.style.display = isAllowed ? 'flex' : 'none';
        }
    });

    const menuAdmin = document.getElementById('menu-admin');
    if (menuAdmin) {
        menuAdmin.style.display = currentUser.role === 'ADMIN' ? 'flex' : 'none';
    }

    // 2. Nếu là Chế độ Chỉ Xem (Read-only), vô hiệu hóa toàn bộ nút hành động
    const actionButtons = document.querySelectorAll('main button:not([title="Đăng xuất"]):not([onclick*="switch"]):not([onclick*="moModalXemAnh"]):not([onclick*="dongModal"])');
    actionButtons.forEach(btn => {
        if (isReadOnly) {
            btn.disabled = true;
            btn.classList.add('opacity-40', 'cursor-not-allowed');
            btn.setAttribute('title', 'Tài khoản ở chế độ Khách (Chỉ xem)');
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-40', 'cursor-not-allowed');
            btn.removeAttribute('title');
        }
    });

    const firstTab = allowed.includes('all') ? 'khoaphong' : (allowed[0] || 'quanlykho');
    switchTab(firstTab);
}

function renderDanhSachPinAdmin() {
    const tbody = document.getElementById('bangCauHinhPinAdmin');
    if (!tbody) return;

    tbody.innerHTML = (globalData.ktvList || []).map((ktv, idx) => {
        const isAdmin = ktv.role === 'ADMIN';
        const allowed = Array.isArray(ktv.allowedTabs) ? ktv.allowedTabs : [];

        const tabCheckboxes = ALL_SYSTEM_TABS.map(t => {
            const isChecked = isAdmin || allowed.includes(t.id) || allowed.includes('all');
            return `
                <label class="inline-flex items-center gap-1 text-[11px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer mr-1 mb-1">
                    <input type="checkbox" class="chk-tab-${ktv.id}" value="${t.id}" ${isChecked ? 'checked' : ''} ${isAdmin ? 'disabled' : ''}>
                    <span>${t.name}</span>
                </label>
            `;
        }).join('');

        return `
            <tr class="border-b hover:bg-slate-50 text-xs">
                <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
                <td class="p-3 font-semibold text-slate-800">${ktv.name}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ktv.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : 
                        ktv.role === 'GUEST' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'
                    }">${ktv.role}</span>
                </td>
                <td class="p-3">
                    <div class="flex flex-wrap max-w-md">${tabCheckboxes}</div>
                </td>
                <td class="p-3 text-center">
                    <label class="inline-flex items-center gap-1 cursor-pointer text-[11px] font-bold ${ktv.readOnly ? 'text-rose-600' : 'text-slate-600'}">
                        <input type="checkbox" id="readonly_${ktv.id}" ${ktv.readOnly ? 'checked' : ''} ${isAdmin ? 'disabled' : ''}>
                        Chỉ Xem
                    </label>
                </td>
                <td class="p-3 text-center">
                    <button onclick="luuPhanQuyenNhanSu('${ktv.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm">
                        Lưu
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function luuPhanQuyenNhanSu(ktvId) {
    const targetKtv = (globalData.ktvList || []).find(k => k.id === ktvId);
    if (!targetKtv) return;

    if (targetKtv.role !== 'ADMIN') {
        const checkboxes = document.querySelectorAll(`.chk-tab-${ktvId}:checked`);
        targetKtv.allowedTabs = Array.from(checkboxes).map(cb => cb.value);
        
        const readonlyCb = document.getElementById(`readonly_${ktvId}`);
        targetKtv.readOnly = readonlyCb ? readonlyCb.checked : false;
    }

    localStorage.setItem('cssd_ktvList', JSON.stringify(globalData.ktvList));
    alert(`🔑 Đã cập nhật ma trận quyền cho [${targetKtv.name}]!`);
}

function themNhanSuMoiAdmin() {
    const nameInp = document.getElementById('admin_add_nv_name');
    const idInp = document.getElementById('admin_add_nv_id');
    const pinInp = document.getElementById('admin_add_nv_pin');
    const roleInp = document.getElementById('admin_add_nv_role');

    if (!nameInp || !idInp || !nameInp.value.trim() || !idInp.value.trim()) {
        alert("Vui lòng nhập Mã NV và Họ Tên!");
        return;
    }

    const role = roleInp ? roleInp.value : 'CSSD';
    globalData.ktvList.push({
        id: idInp.value.trim().toUpperCase(),
        name: nameInp.value.trim(),
        pin: pinInp && pinInp.value ? pinInp.value.trim() : '1234',
        role: role,
        allowedTabs: role === 'GUEST' ? ['quanlykho', 'tracuu', 'dashboard_tv'] : ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho'],
        readOnly: role === 'GUEST'
    });

    localStorage.setItem('cssd_ktvList', JSON.stringify(globalData.ktvList));
    renderDanhSachPinAdmin();
    nameInp.value = ''; idInp.value = ''; if (pinInp) pinInp.value = '';
    alert("➕ Đã thêm nhân sự và cấp quyền mặc định!");
}

// =========================================================================
// 5. CÁC HÀM VẬN HÀNH & POPUP
// =========================================================================
function moPopupDongGoi(idx) {
    itemDongGoiHienTai = idx;
    const item = (globalData.choDongGoi || [])[idx];
    if (!item) return;

    const pop = document.getElementById('popupDongGoi');
    const popBo = document.getElementById('popDG_Bo');
    const popSub = document.getElementById('popDG_SubTitle');
    const tbody = document.getElementById('popDG_DanhSachLinhKien');

    if (popBo) popBo.innerHTML = `<i class="fa-solid fa-box-open text-sky-600 mr-2"></i> ĐÓNG GÓI: ${item.tenBo}`;
    if (popSub) popSub.innerText = `Mã khay: ${item.maBo} | Khoa: ${item.khoa || 'N/A'}`;

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td class="p-2 font-semibold text-slate-800">${item.tenBo} (Tiêu chuẩn)</td>
                <td class="p-2 text-center font-mono font-bold text-sky-700">${item.soLuong || 1}</td>
            </tr>
        `;
    }

    tinhHanSuDung();
    if (pop) pop.classList.remove('hidden');
}

function closePopupDongGoi() {
    const pop = document.getElementById('popupDongGoi');
    if (pop) pop.classList.add('hidden');
    itemDongGoiHienTai = null;
}

function tinhHanSuDung() {
    const loaiEl = document.getElementById('popDG_Loai');
    const hanEl = document.getElementById('popDG_Han');
    if (!loaiEl || !hanEl) return;
    const days = parseInt(loaiEl.value.split('|')[1]) || 30;
    const future = new Date(); future.setDate(future.getDate() + days);
    hanEl.innerText = future.toLocaleDateString('vi-VN');
}

function moPopupNghiemThuQC() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng tick chọn ít nhất một mâm để nghiệm thu mẻ hấp!");
        return;
    }

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    const firstItem = (globalData.dangHap || [])[selectedIndices[0]] || {};
    
    currentQCBatchData = {
        indices: selectedIndices,
        batchId: firstItem.maLoHap || 'H001',
        maySo: firstItem.maySo || (document.getElementById('hap_maySo')?.value || 'Lò Hấp Steam #1'),
        loaiHap: firstItem.loaiHap || (document.getElementById('hap_loaiHap')?.value || 'Hấp hơi nước')
    };

    const pop = document.getElementById('popupNghiemThuChatLuong');
    const popSub = document.getElementById('qc_pop_sub');
    const ktvName = document.getElementById('qc_ktv_name');
    const fileInp = document.getElementById('qc_fileAnhBangIn');
    const previewZone = document.getElementById('qc_preview_zone');

    if (popSub) popSub.innerText = `Mã mẻ: ${currentQCBatchData.batchId} | ${currentQCBatchData.maySo} (${currentQCBatchData.loaiHap})`;
    if (ktvName) ktvName.innerText = `${currentUser.nvName} (${currentUser.role})`;
    if (fileInp) fileInp.value = '';
    if (previewZone) previewZone.classList.add('hidden');
    currentQCEvidenceImage = null;

    taoMaBamSHA256(currentQCBatchData.batchId + Date.now()).then(hash => {
        const hashEl = document.getElementById('qc_hash_preview');
        if (hashEl) hashEl.innerText = `SHA256: ${hash}...`;
    });

    if (fileInp) {
        fileInp.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    currentQCEvidenceImage = evt.target.result;
                    const imgEl = document.getElementById('qc_img_preview');
                    if (imgEl) imgEl.src = currentQCEvidenceImage;
                    if (previewZone) previewZone.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (pop) pop.classList.remove('hidden');
}

function dongPopupNghiemThuQC() {
    const pop = document.getElementById('popupNghiemThuChatLuong');
    if (pop) pop.classList.add('hidden');
    currentQCBatchData = null;
    currentQCEvidenceImage = null;
}
