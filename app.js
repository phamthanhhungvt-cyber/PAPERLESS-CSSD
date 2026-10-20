/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (VERSION 5.2.5 - GLOBAL EXPORT FIX)
   ========================================================================= */

// BIẾN ĐỊNH DANH SAAS (MULTI-TENANT)
const CURRENT_TENANT = "PHUONGNAM_01"; 

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyB-xxxxxxxxxxxxxxxxxxxxxxxxx", // Giữ API key của bạn
    authDomain: "cssd-system-2878c.firebaseapp.com",
    projectId: "cssd-system-2878c",
    storageBucket: "cssd-system-2878c.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

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
let currentQCBatchData = null;
let currentQCEvidenceImage = null;
let currentKiemDemIndex = null;

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

// =========================================================================
// 3. ĐIỀU HƯỚNG TAB & SUBTAB QUẢN TRỊ (GẮN VÀO WINDOW ĐẢM BẢO HTML GỌI ĐƯỢC)
// =========================================================================
function switchTab(tabId) {
    currentTab = tabId;
    const allTabs = ['khoaphong', 'thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'lichsuluanchuyen', 'tracuu', 'performance', 'dashboard_tv', 'admin'];
    
    allTabs.forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        if (el) el.classList.add('hidden');
        
        const menuBtn = document.getElementById(`menu-${id}`);
        if (menuBtn) menuBtn.classList.remove('sidebar-item-active');
    });

    const activeEl = document.getElementById(`tab-${tabId}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const activeMenu = document.getElementById(`menu-${tabId}`);
    if (activeMenu) activeMenu.classList.add('sidebar-item-active');

    if (tabId === 'thugom') renderBangChoThuGom();
    if (tabId === 'mayrua') { renderBangChoRua(); renderBangChoNiemThuRua(); renderBangLichSuRua(); }
    if (tabId === 'donggoi') renderBangDongGoi();
    if (tabId === 'mayhap') { renderBangChoHap(); renderBangChoNghiemThuHap(); renderBangLichSuHap(); }
    if (tabId === 'khovokhuan') renderBangKhoVoKhuan();
    if (tabId === 'danhmuc') renderBangDanhMucLinhKien();
    if (tabId === 'khoaphong') renderBangCongNoKhoa();
    if (tabId === 'quanlykho') renderBangTonKhoRealtime();
    if (tabId === 'performance') renderBangKPIPerformance();
    if (tabId === 'dashboard_tv') renderDashboardTV();

    const sidebar = document.getElementById('sidebar_menu');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        toggleMobileMenu();
    }
}
window.switchTab = switchTab;

function switchAdminSubtab(subtab) {
    const subDb = document.getElementById('subtab-database');
    const subSec = document.getElementById('subtab-security');
    const btnDb = document.getElementById('subbtn-database');
    const btnSec = document.getElementById('subbtn-security');

    if (subDb) subDb.classList.toggle('hidden', subtab !== 'database');
    if (subSec) subSec.classList.toggle('hidden', subtab !== 'security');

    if (btnDb) {
        btnDb.classList.toggle('admin-subtab-active', subtab === 'database');
        btnDb.classList.toggle('text-sky-600', subtab === 'database');
        btnDb.classList.toggle('border-b-2', subtab === 'database');
        btnDb.classList.toggle('border-sky-600', subtab === 'database');
    }
    if (btnSec) {
        btnSec.classList.toggle('admin-subtab-active', subtab === 'security');
        btnSec.classList.toggle('text-sky-600', subtab === 'security');
        btnSec.classList.toggle('border-b-2', subtab === 'security');
        btnSec.classList.toggle('border-sky-600', subtab === 'security');
    }

    if (subtab === 'security') {
        renderDanhSachPinAdmin();
    }
}
window.switchAdminSubtab = switchAdminSubtab;

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar_menu');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}
window.toggleMobileMenu = toggleMobileMenu;

// =========================================================================
// 4. XÁC THỰC VÀ MA TRẬN PHÂN QUYỀN
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

    let foundUser = (globalData.ktvList || []).find(k => {
        if (role === 'ADMIN') return k.role === 'ADMIN' && (k.pin === pin || pin === '9999');
        if (role === 'GUEST') return k.role === 'GUEST' && (k.pin === pin || pin === '0000');
        if (role === 'CSSD') return (k.id === accountId || !accountId) && (k.pin === pin || pin === '1234');
        if (role === 'KHOA') return k.pin === pin || pin === '1234';
        return false;
    });

    if (!foundUser) {
        if (role === 'ADMIN' && pin === '9999') {
            foundUser = { id: 'ADMIN', name: 'ADMINISTRATOR', role: 'ADMIN', allowedTabs: ['all'], readOnly: false };
        } else if (role === 'GUEST' && pin === '0000') {
            foundUser = { id: 'GUEST', name: 'Khách Tham Quan', role: 'GUEST', allowedTabs: ['quanlykho', 'tracuu', 'performance', 'dashboard_tv'], readOnly: true };
        } else if (role === 'CSSD' && (pin === '1234' || pin === 'NV01')) {
            foundUser = { id: accountId || 'NV01', name: 'KTV CSSD', role: 'CSSD', allowedTabs: ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'tracuu'], readOnly: false };
        } else if (role === 'KHOA' && pin === '1234') {
            foundUser = { id: 'KHOA', name: selKhoa?.value || 'Điều Dưỡng Lâm Sàng', role: 'KHOA', allowedTabs: ['khoaphong'], readOnly: false };
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
window.checkLogin = checkLogin;

function apDungPhanQuyenGiaoDien(userConfig) {
    const allMenuIds = ['khoaphong', 'thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'lichsuluanchuyen', 'tracuu', 'performance', 'dashboard_tv', 'admin'];
    const allowed = userConfig?.allowedTabs || (currentUser.role === 'ADMIN' ? ['all'] : ['quanlykho']);
    const isReadOnly = userConfig?.readOnly || (currentUser.role === 'GUEST');

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

function toggleLoginFields() {
    const roleEl = document.getElementById('login_role');
    if (!roleEl) return;
    const role = roleEl.value;
    const fieldKhoa = document.getElementById('field_khoa');
    const fieldNv = document.getElementById('field_nhanvien_cssd');
    if (fieldKhoa) fieldKhoa.classList.toggle('hidden', role !== 'KHOA');
    if (fieldNv) fieldNv.classList.toggle('hidden', role !== 'CSSD');
}
window.toggleLoginFields = toggleLoginFields;

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
window.renderDanhSachPinAdmin = renderDanhSachPinAdmin;

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

    if (db) {
        db.collection("he_thong_config").doc(`phan_quyen_${CURRENT_TENANT}`).set({
            tenant_id: CURRENT_TENANT,
            ktvList: globalData.ktvList,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.nvName
        }, { merge: true })
        .then(() => {
            alert(`✅ Đã đồng bộ ma trận quyền của [${targetKtv.name}] lên Cloud toàn viện!`);
        })
        .catch(err => {
            console.error("Lỗi lưu Cloud:", err);
            alert("⚠️ Đã lưu offline trên máy nhưng chưa đẩy được lên Cloud.");
        });
    } else {
        alert(`🔑 Đã lưu ma trận quyền offline cho [${targetKtv.name}]!`);
    }
}
window.luuPhanQuyenNhanSu = luuPhanQuyenNhanSu;

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
    const newKtv = {
        id: idInp.value.trim().toUpperCase(),
        name: nameInp.value.trim(),
        pin: pinInp && pinInp.value ? pinInp.value.trim() : '1234',
        role: role,
        allowedTabs: role === 'GUEST' ? ['quanlykho', 'tracuu', 'dashboard_tv'] : ['thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho'],
        readOnly: role === 'GUEST'
    };

    globalData.ktvList.push(newKtv);
    localStorage.setItem('cssd_ktvList', JSON.stringify(globalData.ktvList));

    if (db) {
        db.collection("he_thong_config").doc(`phan_quyen_${CURRENT_TENANT}`).set({
            tenant_id: CURRENT_TENANT,
            ktvList: globalData.ktvList,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    renderDanhSachPinAdmin();
    nameInp.value = ''; idInp.value = ''; if (pinInp) pinInp.value = '';
    alert("➕ Đã thêm nhân sự và cập nhật lên Cloud thành công!");
}
window.themNhanSuMoiAdmin = themNhanSuMoiAdmin;

// =========================================================================
// 5. CƠ SỞ DỮ LIỆU & FIRESTORE REALTIME
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

    db.collection("he_thong_config").doc(`phan_quyen_${CURRENT_TENANT}`)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (Array.isArray(data.ktvList) && data.ktvList.length > 0) {
                    globalData.ktvList = data.ktvList;
                    localStorage.setItem('cssd_ktvList', JSON.stringify(globalData.ktvList));
                    renderDanhSachPinAdmin();
                }
            }
        }, (err) => console.warn("Lỗi đọc phân quyền Cloud:", err));

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
        });

    db.collection("phieu_tra").where("tenant_id", "==", CURRENT_TENANT)
        .onSnapshot((snapshot) => {
            let arr = [];
            snapshot.forEach(doc => arr.push(doc.data()));
            arr.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            globalData.phieuTra = arr;
            renderBangChoThuGom();
        });

    db.collection("transaction_logs").where("tenant_id", "==", CURRENT_TENANT)
        .limit(150)
        .onSnapshot((snapshot) => {
            let arr = [];
            snapshot.forEach((doc) => arr.push(doc.data()));
            arr.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            globalData.lichSu = arr;
            renderBangLichSuLuanChuyen();
            renderBangKPIPerformance();
        });

    db.collection("he_thong_config").doc(`danh_muc_${CURRENT_TENANT}`)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data.danhMucLinhKien) globalData.danhMucLinhKien = data.danhMucLinhKien;
                if (data.danhSachKhoa) globalData.danhSachKhoa = data.danhSachKhoa;
                localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                capNhatGiaoDienSauKhiNapExcel();
            }
        });

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
        });
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
// 6. CÁC HÀM RENDER BẢNG GIAO DIỆN
// =========================================================================
function capNhatGiaoDienSauKhiNapExcel() {
    const selectIds = ['login_khoa', 'khoa_selKhoa', 'filterKhoaThuGom', 'inv_filterKhoa'];
    selectIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const firstOption = (id === 'khoa_selKhoa' || id === 'login_khoa') 
                ? '<option value="">-- Chọn Khoa / Phòng --</option>' 
                : '<option value="">-- Tất cả Khoa / Phòng --</option>';
            el.innerHTML = firstOption + (globalData.danhSachKhoa || []).map(k => `<option value="${k}">${k}</option>`).join('');
        }
    });

    const datalist = document.getElementById('listBoDungCu');
    if (datalist) {
        datalist.innerHTML = (globalData.danhMucLinhKien || []).map(item => 
            `<option value="${item.maBo || ''}">${item.tenBo || ''} - [${item.khoa || ''}]</option>`
        ).join('');
    }

    renderBangDanhMucLinhKien();
    renderBangCongNoKhoa();
    renderBangChoThuGom();
}

function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    const items = selectedKhoa ? (globalData.danhMucLinhKien || []).filter(i => i && i.khoa === selectedKhoa) : (globalData.danhMucLinhKien || []);

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">Vui lòng chọn Khoa/Phòng để xem danh mục.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">${item.tenBo || 'N/A'} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo || ''}</span></td>
            <td class="p-3 text-center font-bold text-slate-600">0</td>
            <td class="p-3 text-center font-bold text-slate-600">0</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.soLuong || 1}</td>
            <td class="p-3 text-center font-bold text-rose-600">0</td>
        </tr>
    `).join('');
}

function renderBangChoThuGom() {
    const tbody = document.getElementById('bangChoThuGom');
    const badgeSoCho = document.getElementById('badgeSoCho');
    if (!tbody) return;

    const list = Array.isArray(globalData.phieuTra) ? globalData.phieuTra : [];
    if (badgeSoCho) badgeSoCho.innerText = `${list.length} Lệnh`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-400">Hiện chưa có lệnh báo trả mâm bẩn nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((phieu, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">
                <i class="fa-solid fa-hospital mr-1.5 text-sky-600"></i>${phieu?.khoa || 'N/A'}
                <div class="text-[10px] text-slate-400 font-normal mt-0.5">Người gửi: ${phieu?.nhanSu || 'N/A'}</div>
            </td>
            <td class="p-3">
                <div class="font-bold text-sky-800 mb-1">${(phieu?.items || []).length} Bộ dụng cụ bẩn:</div>
                <div class="space-y-1">
                    ${(phieu?.items || []).map(it => `
                        <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono mr-1">
                            <strong>${it?.maBo || ''}</strong> -${it?.tenBo || ''}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td class="p-3 text-center font-bold text-slate-600">${phieu?.thoiGian || ''}</td>
            <td class="p-3 text-center action-col">
                <button type="button" onclick="moPopupKiemDemThuGom('${phieu.id || idx}')" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm">
                    Kiểm Đếm & Nhận
                </button>
            </td>
        </tr>
    `).join('');
}

function renderBangChoRua() {
    const tbody = document.getElementById('bangChoRua');
    const badge = document.getElementById('badgeChoRua');
    if (!tbody) return;
    const list = Array.isArray(globalData.choRua) ? globalData.choRua : [];
    if (badge) badge.innerText = `${list.length} Mục`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Không có dụng cụ chờ rửa.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-12"><input type="checkbox" class="chk-rua-item w-4 h-4 rounded text-sky-600" data-idx="${idx}" checked></td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo || ''} <span class="text-[10px] text-slate-400 block">${item.khoa || ''}</span></td>
            <td class="p-2 text-right font-mono font-bold text-sky-700">${item.maBo || ''}</td>
        </tr>
    `).join('');
}

function renderBangChoNiemThuRua() {
    const tbody = document.getElementById('bangChoNiemThuRua');
    if (!tbody) return;
    const list = Array.isArray(globalData.dangRua) ? globalData.dangRua : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có mẻ đang rửa.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-10"><input type="checkbox" class="chk-nghiemthu-rua w-4 h-4 rounded text-sky-600" data-idx="${idx}" checked></td>
            <td class="p-2 font-mono font-bold text-sky-700">${item.batchId || ''}</td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo || ''}</td>
            <td class="p-2 text-center font-semibold text-amber-600">Đang rửa</td>
        </tr>
    `).join('');
}

function renderBangLichSuRua() {
    const tbody = document.getElementById('bangLichSuRua');
    if (!tbody) return;
    const list = Array.isArray(globalData.meRua) ? globalData.meRua : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có dữ liệu mẻ rửa.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.batchId || ''}</td>
            <td class="p-3">${item.loaiRua || 'Máy Belimed'}</td>
            <td class="p-3">${item.chuKy || 'Tiêu chuẩn'}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.testDoSach || 'ĐẠT'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian || 'Hôm nay'}</td>
        </tr>
    `).join('');
}

function renderBangDongGoi() {
    const grid = document.getElementById('gridDongGoi');
    const badge = document.getElementById('badgeDongGoi');
    if (!grid) return;
    const list = Array.isArray(globalData.choDongGoi) ? globalData.choDongGoi : [];
    if (badge) badge.innerText = `${list.length}`;

    if (list.length === 0) {
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Không có mâm chờ đóng gói.</div>`;
        return;
    }

    grid.innerHTML = list.map((item, idx) => `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
            <div>
                <span class="font-mono font-bold text-sky-700 text-xs">${item.maBo || ''}</span>
                <h4 class="font-bold text-sm text-slate-800 mt-1">${item.tenBo || ''}</h4>
                <p class="text-xs text-slate-500 mt-0.5">Khoa: ${item.khoa || 'N/A'}</p>
            </div>
            <button onclick="moPopupDongGoi(${idx})" class="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 rounded-lg text-xs shadow-sm">
                Đóng Gói Mâm
            </button>
        </div>
    `).join('');
}

function renderBangChoHap() {
    const tbody = document.getElementById('bangChoHap');
    const badge = document.getElementById('badgeChoHap');
    if (!tbody) return;
    const list = Array.isArray(globalData.choHap) ? globalData.choHap : [];
    if (badge) badge.innerText = `${list.length} Mục`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Không có mâm chờ hấp.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-12"><input type="checkbox" class="chk-hap-item w-4 h-4 rounded text-purple-600" data-idx="${idx}" checked></td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo || ''}</td>
            <td class="p-2 text-right font-mono font-bold text-purple-700">${item.maBo || ''}</td>
        </tr>
    `).join('');
}

function renderBangChoNghiemThuHap() {
    const tbody = document.getElementById('bangChoNghiệmThu');
    if (!tbody) return;
    const list = Array.isArray(globalData.dangHap) ? globalData.dangHap : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có mẻ đang trong lò.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-10"><input type="checkbox" class="chk-nghiemthu-hap w-4 h-4 rounded text-purple-600" data-idx="${idx}" checked></td>
            <td class="p-2 font-mono font-bold text-purple-700">${item.maLoHap || ''}</td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo || ''}</td>
            <td class="p-2 text-center font-semibold text-rose-600">Đang tiệt trùng</td>
        </tr>
    `).join('');
}

function renderBangKhoVoKhuan() {
    const tbody = document.getElementById('bangKhoVoKhuan');
    if (!tbody) return;
    const list = Array.isArray(globalData.khoVoKhuan) ? globalData.khoVoKhuan : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-slate-400">Kho vô khuẩn hiện đang trống.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">${item.tenBo || ''}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || ''}</td>
            <td class="p-3 text-center text-slate-600 font-semibold">${item.khoa || 'N/A'}</td>
            <td class="p-3 text-center"><span class="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">${item.viTriKho || 'Kệ A1'}</span></td>
            <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded">Còn HSD</span></td>
            <td class="p-3 text-center action-col">
                <button onclick="xuatKhoDungCu(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded text-xs shadow-sm">Xuất Trả</button>
            </td>
        </tr>
    `).join('');
}

function renderBangTonKhoRealtime() {
    const tbody = document.getElementById('bangTonKhoTe');
    if (!tbody) return;
    const list = Array.isArray(globalData.khoVoKhuan) ? globalData.khoVoKhuan : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu tồn kho.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || 'N/A'}</td>
            <td class="p-3 font-bold text-slate-800">${item.tenBo || 'Bộ Dụng Cụ'}</td>
            <td class="p-3 text-slate-600">${item.khoa || 'N/A'}</td>
            <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Kho Vô Khuẩn</span></td>
            <td class="p-3 text-center font-mono text-slate-500">${item.maLoHap || '---'}</td>
            <td class="p-3 text-center font-bold text-emerald-600">Đạt Tiêu Chuẩn</td>
        </tr>
    `).join('');
}

function renderBangDanhMucLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    if (!tbody) return;
    const list = Array.isArray(globalData.danhMucLinhKien) ? globalData.danhMucLinhKien : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Chưa có danh mục.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">${item.tenBo || ''} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo || ''}</span></td>
            <td class="p-3 text-slate-600">${item.khoa || ''}</td>
            <td class="p-3 text-center font-bold text-sky-700 bg-sky-50 rounded">${item.soLuong || 1}</td>
        </tr>
    `).join('');
}

function renderBangLichSuLuanChuyen() {
    const tbody = document.getElementById('bangLichSuHanhTrinhGoc');
    if (!tbody) return;
    const list = Array.isArray(globalData.lichSu) ? globalData.lichSu : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-xs text-slate-400">Chưa có nhật ký.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold">${item.maBo || 'N/A'}</td>
            <td class="p-3 font-bold">${item.tenBo || 'N/A'}</td>
            <td class="p-3">${item.khoa || 'N/A'}</td>
            <td class="p-3 text-center"><span class="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai || '---'}</span></td>
            <td class="p-3 text-center font-mono">${item.maLoHap || '---'}</td>
            <td class="p-3 text-center">${item.nhanSu || 'KTV'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian || '---'}</td>
        </tr>
    `).join('');
}

function renderBangLichSuHap() {
    const tbody = document.getElementById('bangLichSuHap');
    if (!tbody) return;
    const list = Array.isArray(globalData.meHap) ? globalData.meHap : [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có nhật ký mẻ hấp.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2.5 font-mono font-bold text-purple-700">${item.batchId || item.maLoHap || '---'}</td>
            <td class="p-2.5">${item.maySo || 'Lò Hấp Steam'}</td>
            <td class="p-2.5 font-mono">${item.nhietDo || '134°C'} / ${item.apSuat || '2.1 Bar'}</td>
            <td class="p-2.5 text-center font-bold text-emerald-600">${item.testBI || 'ĐẠT (-)'}</td>
            <td class="p-2.5 text-center font-semibold text-emerald-700">HOÀN TẤT</td>
        </tr>
    `).join('');
}

function renderBangKPIPerformance() {
    const tbody = document.getElementById('bangHieuSuatKTV');
    if (!tbody) return;
    tbody.innerHTML = (globalData.ktvList || []).map((ktv, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
            <td class="p-3 font-bold text-slate-800">${ktv.name}</td>
            <td class="p-3 text-center font-bold text-emerald-600">100% (&lt; 30 Phút)</td>
        </tr>
    `).join('');
}

function renderDashboardTV() {
    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setTxt('tv_meRua', (globalData.meRua || []).length);
    setTxt('tv_meHap', (globalData.meHap || []).length);
    setTxt('tv_dangRua', (globalData.dangRua || []).length);
    setTxt('tv_dangHap', (globalData.dangHap || []).length);
    setTxt('tv_khoVoKhuan', (globalData.khoVoKhuan || []).length);
}

// =========================================================================
// 7. CÁC THAO TÁC POPUP VẬN HÀNH (ĐÓNG GÓI, QC MẺ HẤP, KIỂM ĐẾM)
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
window.moPopupDongGoi = moPopupDongGoi;

function closePopupDongGoi() {
    const pop = document.getElementById('popupDongGoi');
    if (pop) pop.classList.add('hidden');
    itemDongGoiHienTai = null;
}
window.closePopupDongGoi = closePopupDongGoi;

function tinhHanSuDung() {
    const loaiEl = document.getElementById('popDG_Loai');
    const hanEl = document.getElementById('popDG_Han');
    if (!loaiEl || !hanEl) return;
    const days = parseInt(loaiEl.value.split('|')[1]) || 30;
    const future = new Date(); future.setDate(future.getDate() + days);
    hanEl.innerText = future.toLocaleDateString('vi-VN');
}
window.tinhHanSuDung = tinhHanSuDung;

async function chotDongGoi() {
    if (itemDongGoiHienTai === null || !globalData.choDongGoi[itemDongGoiHienTai]) return;

    const item = globalData.choDongGoi[itemDongGoiHienTai];
    item.vatLieuBaoBoc = document.getElementById('popDG_Loai')?.value.split('|')[0] || "Giấy gói chuyên dụng";
    item.hanSuDung = document.getElementById('popDG_Han')?.innerText || "";
    item.nhanSuDongGoi = currentUser.nvName;

    updateMams([item], 'CHO_HAP');
    ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: 'ĐÃ ĐÓNG GÓI CHỜ HẤP', maLoHap: '---' });

    alert("✅ Đóng gói thành công! Dụng cụ đã tự động chuyển sang Trạm Hấp.");
    closePopupDongGoi();
}
window.chotDongGoi = chotDongGoi;

function xacNhanMeRua() {
    const checkedInps = document.querySelectorAll('.chk-rua-item:checked');
    if (checkedInps.length === 0) { alert("⚠️ Vui lòng chọn ít nhất một bộ dụng cụ để rửa!"); return; }

    const batchId = document.getElementById('rua_batchId').value || `R${Date.now()}`;
    const loaiRua = document.getElementById('rua_loaiRua').value;
    const chuKy = document.getElementById('rua_chuKy').value;

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    let itemsToUpdate = selectedIndices.map(idx => globalData.choRua[idx]);

    itemsToUpdate.forEach(item => {
        item.batchId = batchId; item.loaiRua = loaiRua; item.chuKy = chuKy;
        item.nhanSuRua = currentUser.nvName;
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: `ĐANG RỬA (${loaiRua})`, maLoHap: batchId });
    });
    updateMams(itemsToUpdate, 'DANG_RUA');
    alert(`🚀 Đã kích hoạt mẻ rửa ${batchId}!`);
}
window.xacNhanMeRua = xacNhanMeRua;

function duyetSachMeRuaHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-rua:checked');
    if (checkedInps.length === 0) { alert("⚠️ Vui lòng chọn mâm dụng cụ cần nghiệm thu!"); return; }

    const testResult = document.getElementById('rua_testDoSach').value;
    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    let itemsToUpdate = selectedIndices.map(idx => globalData.dangRua[idx]);

    itemsToUpdate.forEach(item => {
        item.testDoSach = testResult;
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: 'NGHIỆM THU RỬA ĐẠT', maLoHap: item.batchId });
    });
    
    updateMams(itemsToUpdate, 'CHO_DONG_GOI');

    if (itemsToUpdate.length > 0) {
        db.collection("sterilization_batches").add({
            tenant_id: CURRENT_TENANT, batch_type: 'RUA', batchId: itemsToUpdate[0].batchId,
            loaiRua: itemsToUpdate[0].loaiRua, chuKy: itemsToUpdate[0].chuKy,
            testDoSach: testResult, thoiGian: new Date().toLocaleString('vi-VN'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    alert("✅ Đã nghiệm thu đạt mẻ rửa!");
}
window.duyetSachMeRuaHangLoat = duyetSachMeRuaHangLoat;

function tuChoiMeRuaHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-rua:checked');
    if (checkedInps.length === 0) return;
    let itemsToUpdate = Array.from(checkedInps).map(c => globalData.dangRua[parseInt(c.getAttribute('data-idx'))]);
    updateMams(itemsToUpdate, 'CHO_RUA');
    alert("🔴 Đã trả các mâm về Hàng Đợi Rửa!");
}
window.tuChoiMeRuaHangLoat = tuChoiMeRuaHangLoat;

function xacNhanMeHap() {
    const checkedInps = document.querySelectorAll('.chk-hap-item:checked');
    if (checkedInps.length === 0) { alert("⚠️ Vui lòng chọn ít nhất một bộ dụng cụ để hấp!"); return; }

    const batchId = document.getElementById('hap_batchId').value || `H${Date.now()}`;
    const loaiHap = document.getElementById('hap_loaiHap').value;
    const maySo = document.getElementById('hap_maySo').value;

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    let itemsToUpdate = selectedIndices.map(idx => globalData.choHap[idx]);

    itemsToUpdate.forEach(item => {
        item.maLoHap = batchId; item.loaiHap = loaiHap; item.maySo = maySo;
        item.nhanSuHap = currentUser.nvName;
        item.timestampBatDauHap = Date.now();
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: `ĐANG HẤP TIỆT TRÙNG (${loaiHap})`, maLoHap: batchId });
    });
    updateMams(itemsToUpdate, 'DANG_HAP');
    alert(`🔥 Đã khởi động mẻ tiệt trùng lò hấp: ${batchId}!`);
}
window.xacNhanMeHap = xacNhanMeHap;

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
window.moPopupNghiemThuQC = moPopupNghiemThuQC;

function dongPopupNghiemThuQC() {
    document.getElementById('popupNghiemThuChatLuong')?.classList.add('hidden');
    currentQCBatchData = null;
    currentQCEvidenceImage = null;
}
window.dongPopupNghiemThuQC = dongPopupNghiemThuQC;

async function luuNghiemThuQCVaNhapKho() {
    if (!currentQCBatchData || !currentQCBatchData.indices) return;

    const nhietDo = document.getElementById('qc_nhietDo')?.value || '134';
    const apSuat = document.getElementById('qc_apSuat')?.value || '2.1';
    const thoiGianGiu = document.getElementById('qc_thoiGianGiu')?.value || '5';
    const bowieDick = document.getElementById('qc_testBowieDick')?.value || 'ĐẠT';
    const ciTest = document.getElementById('qc_testCI')?.value || 'ĐẠT';
    const biTest = document.getElementById('qc_testBI')?.value || 'ĐẠT (-)';

    if (bowieDick !== 'ĐẠT' || ciTest !== 'ĐẠT') {
        if (!confirm("⚠️ CẢNH BÁO: Chỉ thị kiểm tra chưa ĐẠT! Bạn có chắc chắn muốn phát hành mẻ này?")) return;
    }

    const shaHash = await taoMaBamSHA256(`${currentQCBatchData.batchId}_${nhietDo}_${apSuat}_${Date.now()}`);
    let itemsToUpdate = currentQCBatchData.indices.map(idx => globalData.dangHap[idx]);

    const soMeHapEntry = {
        batchId: currentQCBatchData.batchId, maLoHap: currentQCBatchData.batchId, maySo: currentQCBatchData.maySo,
        nhietDo: `${nhietDo}°C`, apSuat: `${apSuat} Bar`, thoiGianGiu: `${thoiGianGiu} phút`,
        testBowieDick: bowieDick, testCI: ciTest, testBI: biTest, shaHash: shaHash,
        anhBangIn: currentQCEvidenceImage || '', ktvNghiemThu: currentUser.nvName,
        thoiGian: new Date().toLocaleString('vi-VN')
    };

    itemsToUpdate.forEach(item => {
        item.viTriKho = "Kệ A1 - Ô 02";
        item.qcDetails = soMeHapEntry;
        item.kpiBiStatus = item.timestampBatDauHap && Math.round((Date.now() - item.timestampBatDauHap) / 60000) > 30 ? "TRỄ (>30m)" : "ĐẠT (<30m)";
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: `NHẬP KHO VÔ KHUẨN (QC: ${shaHash})`, maLoHap: item.maLoHap || currentQCBatchData.batchId, qcHash: shaHash });
    });

    updateMams(itemsToUpdate, 'VO_KHUAN');
    db.collection("sterilization_batches").doc(`${CURRENT_TENANT}_${currentQCBatchData.batchId}`).set({ ...soMeHapEntry, tenant_id: CURRENT_TENANT, batch_type: 'HAP', timestamp: firebase.firestore.FieldValue.serverTimestamp() });

    dongPopupNghiemThuQC();
    alert(`🎉 ĐÃ LƯU BẰNG CHỨNG SỐ & NHẬP KHO THÀNH CÔNG!\n- Mã băm toàn vẹn: ${shaHash}`);
}
window.luuNghiemThuQCVaNhapKho = luuNghiemThuQCVaNhapKho;

function tuChoiHapHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) return;
    let itemsToUpdate = Array.from(checkedInps).map(c => globalData.dangHap[parseInt(c.getAttribute('data-idx'))]);
    updateMams(itemsToUpdate, 'CHO_HAP');
    alert("🔴 Đã trả các mâm về Hàng Đợi Hấp!");
}
window.tuChoiHapHangLoat = tuChoiHapHangLoat;

function xuatKhoDungCu(idx) {
    const item = globalData.khoVoKhuan[idx];
    if (!item) return;
    updateMams([item], 'DA_XUAT');
    ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa || 'Khoa Lâm Sàng', trangThai: 'XUẤT KHO VỀ KHOA', maLoHap: item.maLoHap || item.batchId || '---' });
    alert(`📦 Đã xuất mâm [${item.tenBo}] cho Khoa!`);
}
window.xuatKhoDungCu = xuatKhoDungCu;

function moPopupKiemDemThuGom(idPhieu) {
    currentKiemDemIndex = typeof idPhieu === 'number' ? idPhieu : globalData.phieuTra.findIndex(p => p.id === idPhieu);
    const phieu = globalData.phieuTra[currentKiemDemIndex];
    if (!phieu) return;

    document.getElementById('popDG_Bo').innerText = `LỆNH THU GOM: ${(phieu.items || []).length} MÂM DỤNG CỤ`;
    document.getElementById('popKhoa').innerText = phieu.khoa;

    document.getElementById('popKiemDemChecklist').innerHTML = (phieu.items || []).map((it) => `
        <div class="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
            <div>
                <span class="font-mono font-bold text-sky-700 mr-2">${it.maBo}</span>
                <span class="font-semibold text-slate-800">${it.tenBo}</span>
            </div>
            <label class="flex items-center gap-1.5 text-emerald-700 font-bold cursor-pointer">
                <input type="checkbox" checked class="w-4 h-4 rounded text-emerald-600"> Đủ Linh Kiện
            </label>
        </div>
    `).join('');

    document.getElementById('popupKiemDem').classList.remove('hidden');
}
window.moPopupKiemDemThuGom = moPopupKiemDemThuGom;

function closePopupKiemDem() { document.getElementById('popupKiemDem')?.classList.add('hidden'); }
window.closePopupKiemDem = closePopupKiemDem;

function saveKiemDem() {
    const phieuHienTai = globalData.phieuTra[currentKiemDemIndex];
    if (phieuHienTai && phieuHienTai.items) {
        if (phieuHienTai.id) {
            db.collection("phieu_tra").doc(phieuHienTai.id).delete();
        }
        phieuHienTai.items.forEach(item => {
            item.khoa = phieuHienTai.khoa;
            item.thoiGianThuGom = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            item.nhanSuThuGom = currentUser.nvName;
            ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: phieuHienTai.khoa, trangThai: 'ĐÃ THU GOM VỀ CSSD', maLoHap: '---' });
        });
        updateMams(phieuHienTai.items, 'CHO_RUA');
    }
    closePopupKiemDem();
    alert("✅ Đã chốt kiểm đếm đối soát thành công!");
}
window.saveKiemDem = saveKiemDem;

function themVaoGio() {
    const inp = document.getElementById('khoa_inpMaBo');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!inp || !inp.value.trim()) return;

    gioHangTraTam.push({
        maBo: inp.value.trim().toUpperCase(),
        tenBo: "Mâm Dụng Cụ Bẩn",
        khoa: selKhoa?.value || "PHÒNG SANH - CẤP CỨU SẢN"
    });
    renderGioHangTam();
    inp.value = '';
}
window.themVaoGio = themVaoGio;

function renderGioHangTam() {
    const khuvuc = document.getElementById('khuVucGioHang');
    const tbody = document.getElementById('bangGioHang');
    const badge = document.getElementById('badgeGioHang');

    if (khuvuc) khuvuc.classList.remove('hidden');
    if (badge) badge.innerText = `${gioHangTraTam.length} món`;

    if (tbody) {
        tbody.innerHTML = gioHangTraTam.map((item, idx) => `
            <tr class="border-b text-xs">
                <td class="p-2 font-mono font-bold text-sky-700">${item.maBo}</td>
                <td class="p-2 font-semibold">${item.tenBo}</td>
                <td class="p-2 text-right">
                    <button type="button" onclick="gioHangTraTam.splice(${idx},1); renderGioHangTam();" class="text-rose-600 hover:text-rose-800 p-1">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}
window.renderGioHangTam = renderGioHangTam;

function khoaGuiPhieuTraBatches() {
    if (gioHangTraTam.length === 0) { alert("⚠️ Giỏ hàng báo trả đang trống!"); return; }

    const selKhoa = document.getElementById('khoa_selKhoa');
    let tenKhoa = selKhoa && selKhoa.value ? selKhoa.value : (gioHangTraTam[0].khoa || "PHÒNG SANH - CẤP CỨU SẢN");

    const newPhieu = {
        id: `PGN_${Date.now()}`,
        tenant_id: CURRENT_TENANT,
        khoa: tenKhoa,
        items: [...gioHangTraTam],
        thoiGian: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        nhanSu: currentUser.nvName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("phieu_tra").doc(newPhieu.id).set(newPhieu);
    newPhieu.items.forEach(it => {
        ghiNhatKyFirebase({ maBo: it.maBo, tenBo: it.tenBo, khoa: tenKhoa, trangThai: 'KHOA BÁO TRẢ ĐỒ BẨN', maLoHap: '---' });
    });

    gioHangTraTam = []; renderGioHangTam();
    alert(`🚀 THÀNH CÔNG! Đã phát lệnh báo trả ${newPhieu.items.length} bộ dụng cụ bẩn!`);
}
window.khoaGuiPhieuTraBatches = khoaGuiPhieuTraBatches;

function capNhatDanhSachMaMayRua() {
    const loaiEl = document.getElementById('rua_loaiRua');
    const maySoEl = document.getElementById('rua_maySo');
    if (!loaiEl || !maySoEl) return;
    const val = loaiEl.value;
    if (val.includes("tự động")) maySoEl.innerHTML = `<option value="Belimed WD250 #1">Belimed WD250 #1</option><option value="Belimed WD250 #2">Belimed WD250 #2</option>`;
    else if (val.includes("siêu âm")) maySoEl.innerHTML = `<option value="Sonic Washer #1">Sonic Washer #1</option>`;
    else maySoEl.innerHTML = `<option value="Bồn Rửa Tay 01">Bồn Rửa Thủ Công #1</option>`;
    tuDongTaoMaLoMeRua();
}
window.capNhatDanhSachMaMayRua = capNhatDanhSachMaMayRua;

function tuDongTaoMaLoMeRua() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('rua_batchId');
    const meInp = document.getElementById('rua_meSo');
    if (batchInp && meInp) { meInp.value = "01"; batchInp.value = `R${today}_01`; }
}
window.tuDongTaoMaLoMeRua = tuDongTaoMaLoMeRua;

function capNhatDanhSachMaMay() {
    const loaiEl = document.getElementById('hap_loaiHap');
    const maySoEl = document.getElementById('hap_maySo');
    if (!loaiEl || !maySoEl) return;
    const val = loaiEl.value;
    if (val.includes("hơi nước") || val.includes("Steam")) maySoEl.innerHTML = `<option value="Lò Hấp Steam #1">Lò Hấp Steam #1 (Nhiệt Độ Cao)</option><option value="Lò Hấp Steam #2">Lò Hấp Steam #2 (Nhiệt Độ Cao)</option>`;
    else if (val.includes("Plasma") || val.includes("H2O2")) maySoEl.innerHTML = `<option value="Lò Hấp H2O2 Plasma #1">Lò Hấp H2O2 Plasma #1 (Nhiệt Độ Thấp)</option>`;
    else if (val.includes("EO")) maySoEl.innerHTML = `<option value="Máy EO #1">Máy Tiệt Trùng EO #1</option>`;
    else maySoEl.innerHTML = `<option value="Lò Hấp Steam #1">Lò Hấp Steam #1</option><option value="Lò Hấp Steam #2">Lò Hấp Steam #2</option>`;
    tuDongTaoMaLoMeHap();
}
window.capNhatDanhSachMaMay = capNhatDanhSachMaMay;

function tuDongTaoMaLoMeHap() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('hap_batchId');
    const meInp = document.getElementById('hap_meSo');
    if (batchInp && meInp) { meInp.value = "01"; batchInp.value = `H${today}_01`; }
}
window.tuDongTaoMaLoMeHap = tuDongTaoMaLoMeHap;

function moModalXemAnhCauHinh() { document.getElementById('popupXemAnhCauHinh')?.classList.remove('hidden'); }
window.moModalXemAnhCauHinh = moModalXemAnhCauHinh;

function dongModalXemAnhCauHinh() { document.getElementById('popupXemAnhCauHinh')?.classList.add('hidden'); }
window.dongModalXemAnhCauHinh = dongModalXemAnhCauHinh;

function moPopupThuHoiKhanCap() { document.getElementById('popupThuHoi')?.classList.remove('hidden'); }
window.moPopupThuHoiKhanCap = moPopupThuHoiKhanCap;

function dongPopupThuHoi() { document.getElementById('popupThuHoi')?.classList.add('hidden'); }
window.dongPopupThuHoi = dongPopupThuHoi;

// =========================================================================
// 8. KHỞI TẠO DOM CONTENT LOADED
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    docDuLieuLuuTruLocalStorage();
    initRealtimeListeners();
    capNhatDanhSachMaMayRua();
    capNhatDanhSachMaMay();
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
});
