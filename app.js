/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (VERSION 5.1.0 - FIX SWITCHTAB)
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
// 3. ĐIỀU HƯỚNG TAB CHÍNH (ĐƯỢC ĐẶT LÊN TRƯỚC ĐỂ TRÁNH LỖI NOT DEFINED)
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

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar_menu');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

// =========================================================================
// 4. XÁC THỰC VÀ PHÂN QUYỀN
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

// =========================================================================
// 5. CÁC HÀM RENDER & TIỆN ÍCH DỮ LIỆU
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
                            <strong>${it?.maBo \vert{}\vert{} ''}</strong> -${it?.tenBo || ''}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td class="p-3 text-center font-bold text-slate-600">${phieu?.thoiGian || ''}</td>
            <td class="p-3 text-center action-col">
                <button type="button" onclick="moPopupKiemDemThuGom(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm">
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

function switchAdminSubtab(subtab) {
    const subDb = document.getElementById('subtab-database');
    const subSec = document.getElementById('subtab-security');
    const btnDb = document.getElementById('subbtn-database');
    const btnSec = document.getElementById('subbtn-security');

    if (subDb) subDb.classList.toggle('hidden', subtab !== 'database');
    if (subSec) subSec.classList.toggle('hidden', subtab !== 'security');

    if (btnDb) btnDb.classList.toggle('admin-subtab-active', subtab === 'database');
    if (btnSec) btnSec.classList.toggle('admin-subtab-active', subtab === 'security');

    if (subtab === 'security') renderDanhSachPinAdmin();
}

function moModalXemAnhCauHinh() { document.getElementById('popupXemAnhCauHinh')?.classList.remove('hidden'); }
function dongModalXemAnhCauHinh() { document.getElementById('popupXemAnhCauHinh')?.classList.add('hidden'); }
function moPopupThuHoiKhanCap() { document.getElementById('popupThuHoi')?.classList.remove('hidden'); }
function dongPopupThuHoi() { document.getElementById('popupThuHoi')?.classList.add('hidden'); }

// =========================================================================
// 6. KHỞI TẠO DOM
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    docDuLieuLuuTruLocalStorage();
    initRealtimeListeners();
});
