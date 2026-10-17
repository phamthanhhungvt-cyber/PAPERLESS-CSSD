/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (SaaS ENTERPRISE VERSION)
   ========================================================================= */

// BIẾN ĐỊNH DANH SAAS (MULTI-TENANT) - BẮT BUỘC
const CURRENT_TENANT = "PHUONGNAM_01"; 

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "cssd-system-2878c.firebaseapp.com",
    projectId: "cssd-system-2878c",
    storageBucket: "cssd-system-2878c.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// KHỞI TẠO APP CHECK VỚI RECAPTCHA V3
if (typeof firebase !== 'undefined' && firebase.appCheck) {
    const appCheck = firebase.appCheck();
    appCheck.activate('6LeynPEtAAAAAEalPBsXM_2XwUjMv482Oyjp-oR5', true);
    console.log("🔒 [SECURITY] Firebase App Check (reCAPTCHA v3) đã được kích hoạt!");
}

const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
const storage = (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null;

if (db) {
    try {
        db.settings({ experimentalForceLongPolling: true, useFetchStreams: false });
    } catch (err) {
        console.warn("Firestore settings bypass:", err);
    }
}

// 2. BIẾN TRẠNG THÁI TOÀN CỤC
let currentUser = { role: 'ADMIN', khoa: '', nvName: 'ADMINISTRATOR' };
let currentTab = 'khoaphong';
let html5QrCodeScanner = null;
let currentCameraInputId = null;

let globalData = {
    phieuTra: [], choRua: [], dangRua: [], choDongGoi: [],       
    choHap: [], dangHap: [], khoVoKhuan: [], meRua: [], meHap: [],
    lichSu: [], danhMucLinhKien: [], danhSachKhoa: []
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

let aiVideoStream = null;

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
// 3. ĐỘNG CƠ CƠ SỞ DỮ LIỆU CHUẨN SAAS (FIRESTORE COLLECTIONS)
// =========================================================================
function docDuLieuLuuTruLocalStorage() {
    try {
        const savedLinhKien = localStorage.getItem('cssd_danhMucLinhKien');
        const savedKhoa = localStorage.getItem('cssd_danhSachKhoa');
        if (savedLinhKien) globalData.danhMucLinhKien = JSON.parse(savedLinhKien) || [];
        if (savedKhoa) globalData.danhSachKhoa = JSON.parse(savedKhoa) || [];
        capNhatGiaoDienSauKhiNapExcel();
    } catch (err) { console.error("Lỗi đọc Local:", err); }
}

function capNhatTatCaGiaoDien() {
    renderBangChoRua(); renderBangChoNiemThuRua(); renderBangDongGoi();
    renderBangChoHap(); renderBangChoNghiemThuHap(); renderBangKhoVoKhuan();
    renderBangTonKhoRealtime(); renderDashboardTV(); renderBangCongNoKhoa();
}

function dongBoTrangThaiRealtime() {
    // Đã thay thế bằng updateMams() chuẩn NoSQL
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
// 4. CÁC HÀM RENDER GIAO DIỆN & TƯƠNG TÁC
// =========================================================================
function checkLogin() {
    const roleEl = document.getElementById('login_role');
    const passEl = document.getElementById('login_pass');
    const idEl = document.getElementById('login_nv_id');
    
    const role = roleEl ? roleEl.value : 'ADMIN';
    const pin = passEl ? passEl.value.trim() : '';
    let accountId = idEl && idEl.value.trim() ? idEl.value.trim().toLowerCase() : '';

    if (!pin) { alert("⚠️ Vui lòng nhập Mã PIN xác thực!"); return; }

    const btnLogin = document.querySelector('#login-screen button');
    const originalBtnText = btnLogin.innerHTML;
    btnLogin.disabled = true;
    btnLogin.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Đang mã hóa & xác thực...`;

    let emailAuth = "";
    if (role === 'ADMIN') {
        emailAuth = `admin@phuongnam.com`;
    } else if (role === 'CSSD') {
        if(!accountId) {
            alert("⚠️ Vui lòng nhập Mã KTV (VD: NV01)!");
            btnLogin.disabled = false;
            btnLogin.innerHTML = originalBtnText;
            return;
        }
        emailAuth = `${accountId}@phuongnam.com`;
    } else {
        emailAuth = `khoa@phuongnam.com`; 
    }

    const passwordAuth = `${pin}cssd`;

    if(typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signInWithEmailAndPassword(emailAuth, passwordAuth)
            .then((userCredential) => {
                currentUser.role = role;
                currentUser.nvName = role === 'ADMIN' ? 'ADMINISTRATOR' : (accountId.toUpperCase() || 'Điều Dưỡng Khoa');

                const userInfoEl = document.getElementById('nav_user_info');
                if (userInfoEl) userInfoEl.innerText = currentUser.nvName;

                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                switchTab('khoaphong');
            })
            .catch((error) => {
                console.warn("Lỗi xác thực:", error.code, error.message);
                alert("❌ ĐĂNG NHẬP THẤT BẠI: Mã PIN hoặc Mã NV không chính xác!");
                btnLogin.disabled = false;
                btnLogin.innerHTML = originalBtnText;
            });
    } else {
        alert("⚠️ Firebase Auth chưa tải xong, vui lòng F5 lại trang!");
        btnLogin.disabled = false;
        btnLogin.innerHTML = originalBtnText;
    }
}

function capNhatGiaoDienSauKhiNapExcel() {
    const selectIds = ['login_khoa', 'khoa_selKhoa', 'xuat_selKhoa', 'inv_filterKhoa', 'filterKhoaThuGom'];
    selectIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const firstOption = (id === 'khoa_selKhoa' || id === 'login_khoa' || id === 'xuat_selKhoa') 
                ? '<option value="">-- Chọn Khoa / Phòng --</option>' 
                : '<option value="">-- Tất cả Khoa / Phòng --</option>';
            el.innerHTML = firstOption + (globalData.danhSachKhoa || []).map(k => `<option value="${k}">${k}</option>`).join('');
        }
    });

    const khoaSel = document.getElementById('khoa_selKhoa');
    if (khoaSel) { khoaSel.onchange = function() { capNhatGoiYBoDungCuTheoKhoa(this.value); renderBangCongNoKhoa(); }; }
    const invSel = document.getElementById('inv_filterKhoa');
    if (invSel) { invSel.onchange = function() { renderBangTonKhoRealtime(); }; }

    capNhatGoiYBoDungCuTheoKhoa('');
    renderBangDanhMucLinhKien();
    renderBangCongNoKhoa();
    renderBangChoThuGom();
}

function capNhatGoiYBoDungCuTheoKhoa(tenKhoa) {
    const datalist = document.getElementById('listBoDungCu');
    if (!datalist) return;
    const filteredItems = tenKhoa ? (globalData.danhMucLinhKien || []).filter(item => item && item.khoa === tenKhoa) : (globalData.danhMucLinhKien || []);
    datalist.innerHTML = filteredItems.map(item => `<option value="${item.maBo || ''}">${item.tenBo || ''} - [${item.khoa || ''}]</option>`).join('');
}

function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    const items = selectedKhoa ? (globalData.danhMucLinhKien || []).filter(i => i && i.khoa === selectedKhoa) : (globalData.danhMucLinhKien || []);

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">Vui lòng chọn Khoa/Phòng để xem cơ số bộ dụng cụ.</td></tr>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mamCuaKhoaTrongKho = (globalData.khoVoKhuan || []).filter(k => !selectedKhoa || k.khoa === selectedKhoa);
    
    let dsCanhBaoSapHetHan = [];
    let dsCanhBaoHetHan = [];

    mamCuaKhoaTrongKho.forEach(m => {
        const expDate = parseVietnameseDate(m.hanSuDung);
        if (expDate && !isNaN(expDate.getTime())) {
            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) dsCanhBaoHetHan.push(`${m.tenBo} (${m.maBo})`);
            else if (diffDays <= 7) dsCanhBaoSapHetHan.push(`${m.tenBo} (còn ${diffDays} ngày)`);
        }
    });

    let alertBannerContainer = document.getElementById('khoa_alert_fefo_banner');
    if (!alertBannerContainer) {
        alertBannerContainer = document.createElement('div');
        alertBannerContainer.id = 'khoa_alert_fefo_banner';
        const parentArea = tbody.closest('.bg-white') || tbody.parentElement;
        if (parentArea && parentArea.parentElement) parentArea.parentElement.insertBefore(alertBannerContainer, parentArea);
    }

    if (dsCanhBaoHetHan.length > 0 || dsCanhBaoSapHetHan.length > 0) {
        alertBannerContainer.innerHTML = `
            <div class="mb-4 space-y-2">
                ${dsCanhBaoHetHan.length > 0 ? `
                    <div class="p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-800 text-xs flex items-center justify-between shadow-sm">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-triangle-exclamation text-rose-600 text-base animate-pulse"></i>
                            <div>
                                <span class="font-extrabold uppercase">Cảnh Báo Hết Hạn Vô Khuẩn:</span>
                                <span>Có ${dsCanhBaoHetHan.length} mâm đã quá hạn: <strong>${dsCanhBaoHetHan.join(', ')}</strong>. Vui lòng gửi trả về CSSD để tiệt trùng lại!</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${dsCanhBaoSapHetHan.length > 0 ? `
                    <div class="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg text-amber-800 text-xs flex items-center justify-between shadow-sm">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-clock text-amber-600 text-base"></i>
                            <div>
                                <span class="font-extrabold uppercase">Cảnh Báo Hạn Dùng FEFO:</span>
                                <span>Có ${dsCanhBaoSapHetHan.length} mâm sắp hết hạn (≤ 7 ngày): <strong>${dsCanhBaoSapHetHan.join(', ')}</strong>. Ưu tiên sử dụng trước!</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    } else { alertBannerContainer.innerHTML = ''; }

    tbody.innerHTML = items.map(item => {
        const listKhayCungMa = mamCuaKhoaTrongKho.filter(k => k.maBo === item.maBo);
        let noteHSD = '';
        listKhayCungMa.forEach(k => {
            const expDate = parseVietnameseDate(k.hanSuDung);
            if (expDate && !isNaN(expDate.getTime())) {
                const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) noteHSD = `<span class="inline-block bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded mt-1 border border-rose-200 animate-pulse">🚨 Có mâm quá hạn (${k.hanSuDung})</span>`;
                else if (diffDays <= 7 && !noteHSD) noteHSD = `<span class="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 border border-amber-200">⚠️ Còn ${diffDays} ngày (${k.hanSuDung})</span>`;
            }
        });
        return `
            <tr class="border-b hover:bg-slate-50 text-xs">
                <td class="p-3 font-bold text-slate-800">${item.tenBo || 'N/A'} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo || ''} (${item.khoa || ''})</span>${noteHSD}</td>
                <td class="p-3 text-center font-bold text-slate-600">0</td>
                <td class="p-3 text-center font-bold text-slate-600">0</td>
                <td class="p-3 text-center font-bold text-emerald-600">${item.soLuong || 1}</td>
                <td class="p-3 text-center font-bold text-rose-600">0</td>
            </tr>
        `;
    }).join('');
}

function renderBangDanhMucLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    const tbodyTong = document.getElementById('bangDanhMucTong');

    if (tbody) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Chưa có dữ liệu danh mục.</td></tr>`;
        else tbody.innerHTML = (globalData.danhMucLinhKien || []).map(item => `
            <tr class="border-b hover:bg-slate-50 text-xs">
                <td class="p-3 font-bold text-slate-800">${item.tenBo || ''} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo || ''}</span></td>
                <td class="p-3 text-slate-600">${item.khoa || ''}</td>
                <td class="p-3 text-center font-bold text-sky-700 bg-sky-50 rounded">${item.soLuong || 1}</td>
            </tr>
        `).join('');
    }

    if (tbodyTong) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) tbodyTong.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu khay dụng cụ.</td></tr>`;
        else tbodyTong.innerHTML = (globalData.danhMucLinhKien || []).map(item => `
            <tr class="border-b hover:bg-slate-50 text-xs">
                <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || ''}</td>
                <td class="p-3 font-bold text-slate-800">${item.tenBo || ''}</td>
                <td class="p-3 text-slate-600">${item.khoa || ''}</td>
                <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Sẵn Sàng (${item.soLuong || 1})</span></td>
            </tr>
        `).join('');
    }
}

function renderBangChoThuGom() {
    const tbody = document.getElementById('bangChoThuGom');
    const filterSelect = document.getElementById('filterKhoaThuGom');
    const badgeSoCho = document.getElementById('badgeSoCho');

    if (!tbody) return;
    if (!Array.isArray(globalData.phieuTra)) globalData.phieuTra = [];

    if (filterSelect) {
        const khoasWithOrders = Array.from(new Set(globalData.phieuTra.map(p => p?.khoa).filter(Boolean)));
        const currentValue = filterSelect.value;
        let optionsHtml = `<option value="">-- Tất Cả Khoa Có Lệnh Gửi (${globalData.phieuTra.length}) --</option>`;
        optionsHtml += khoasWithOrders.map(k => `<option value="${k}" ${currentValue === k ? 'selected' : ''}>${k} (${globalData.phieuTra.filter(p => p?.khoa === k).length} lệnh)</option>`).join('');
        filterSelect.innerHTML = optionsHtml;
    }

    const selectedKhoa = filterSelect ? filterSelect.value : "";
    const filteredPhieu = selectedKhoa ? globalData.phieuTra.filter(p => p && p.khoa === selectedKhoa) : globalData.phieuTra;

    if (badgeSoCho) badgeSoCho.innerText = `${filteredPhieu.length} Lệnh`;

    if (filteredPhieu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-400">Hiện chưa có lệnh báo trả mâm bẩn nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredPhieu.map((phieu, idx) => {
        const itemList = Array.isArray(phieu?.items) ? phieu.items : [];
        return `
            <tr class="border-b hover:bg-slate-50 text-xs">
                <td class="p-3 font-bold text-slate-800">
                    <i class="fa-solid fa-hospital mr-1.5 text-sky-600"></i>${phieu?.khoa || 'N/A'}
                    <div class="text-[10px] text-slate-400 font-normal mt-0.5">Người gửi: ${phieu?.nhanSu || 'N/A'}</div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-sky-800 mb-1">${itemList.length} Bộ dụng cụ bẩn:</div>
                    <div class="space-y-1">
                        ${itemList.map(it => `
                            <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono mr-1">
                                <strong>${it?.maBo || ''}</strong> - ${it?.tenBo || ''}
                            </span>
                        `).join('')}
                    </div>
                </td>
                <td class="p-3 text-center font-bold text-slate-600">${phieu?.thoiGian || ''}</td>
                <td class="p-3 text-center action-col">
                    <button type="button" onclick="moPopupKiemDemThuGom('${phieu.id}')" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all whitespace-nowrap">
                        <i class="fa-solid fa-clipboard-check mr-1"></i> Kiểm Đếm & Nhận
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderBangTonKhoRealtime() {
    const tbody = document.getElementById('bangTonKhoTe');
    const selKhoa = document.getElementById('inv_filterKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    let items = (globalData.khoVoKhuan && globalData.khoVoKhuan.length > 0) ? globalData.khoVoKhuan : [];
    if (selectedKhoa) items = items.filter(i => i && i.khoa === selectedKhoa);

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || 'N/A'}</td>
            <td class="p-3 font-bold text-slate-800">${item.tenBo || 'Bộ Dụng Cụ'}</td>
            <td class="p-3 text-slate-600 font-semibold">${item.khoa || 'N/A'}</td>
            <td class="p-3 text-center">
                <span class="${item.trangThai ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'} font-bold px-2 py-0.5 rounded-full text-[10px]">
                    ${item.viTriKho || item.trangThai || 'Tủ Khoa Lâm Sàng'}
                </span>
            </td>
            <td class="p-3 text-center font-mono text-slate-500">${item.maLoHap || item.batchId || '---'}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.hanSuDung || 'Sẵn Sàng'}</td>
        </tr>
    `).join('');
}

function renderBangChoRua() {
    const tbody = document.getElementById('bangChoRua');
    const badge = document.getElementById('badgeChoRua');
    if (!tbody) return;
    if (badge) badge.innerText = `${globalData.choRua.length} Mục`;

    if (globalData.choRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Hiện chưa có dụng cụ nào trong hàng đợi rửa.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.choRua.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-12">
                <input type="checkbox" class="chk-rua-item w-4 h-4 rounded text-sky-600" data-idx="${idx}" checked>
            </td>
            <td class="p-2 font-semibold text-slate-800">
                ${item.tenBo || ''} <span class="text-[10px] text-slate-400 block">${item.khoa || ''}</span>
            </td>
            <td class="p-2 text-right font-mono font-bold text-sky-700">${item.maBo || ''}</td>
        </tr>
    `).join('');
}

function renderBangChoNiemThuRua() {
    const tbody = document.getElementById('bangChoNiemThuRua');
    if (!tbody) return;
    if (globalData.dangRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có mẻ rửa nào đang chạy trong buồng.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.dangRua.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-10">
                <input type="checkbox" class="chk-nghiemthu-rua w-4 h-4 rounded text-sky-600" data-idx="${idx}" checked>
            </td>
            <td class="p-2 font-mono font-bold text-sky-700">${item.batchId || ''}</td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo || ''} <span class="text-[10px] text-slate-400">(${item.maBo || ''})</span></td>
            <td class="p-2 text-center font-semibold text-amber-600">Đang rửa (${item.thoiGianBatDau || ''})</td>
        </tr>
    `).join('');
}

function renderBangLichSuRua() {
    const tbody = document.getElementById('bangLichSuRua');
    if (!tbody) return;
    if (globalData.meRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có mẻ rửa nào.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.meRua.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.batchId || ''}</td>
            <td class="p-3">${item.loaiRua || 'Máy rửa tự động'}</td>
            <td class="p-3">${item.chuKy || 'Tiêu chuẩn'}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.testDoSach || 'ĐẠT'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGianRuaXong || item.thoiGian || 'Vừa xong'}</td>
        </tr>
    `).join('');
}

function renderBangDongGoi() {
    const grid = document.getElementById('gridDongGoi');
    const badge = document.getElementById('badgeDongGoi');
    if (!grid) return;
    if (badge) badge.innerText = `${globalData.choDongGoi.length}`;

    if (globalData.choDongGoi.length === 0) {
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Hiện chưa có mâm dụng cụ nào chờ đóng gói.</div>`;
        return;
    }
    grid.innerHTML = globalData.choDongGoi.map((item, idx) => `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
            <div>
                <div class="flex justify-between items-start mb-1">
                    <span class="font-mono font-bold text-sky-700 text-xs">${item.maBo || ''}</span>
                    <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Đã Rửa Sạch</span>
                </div>
                <h4 class="font-bold text-sm text-slate-800">${item.tenBo || ''}</h4>
                <p class="text-xs text-slate-500 mt-1">Khoa: <strong class="text-slate-700">${item.khoa || 'N/A'}</strong></p>
                <p class="text-[10px] text-slate-400 font-mono mt-0.5">Mẻ rửa: ${item.batchId || 'N/A'}</p>
            </div>
            <button onclick="moPopupDongGoi(${idx})" class="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 rounded-lg text-xs shadow-sm transition-all">
                <i class="fa-solid fa-box-archive mr-1"></i> Đóng Gói Mâm
            </button>
        </div>
    `).join('');
}

function renderBangChoHap() {
    const tbody = document.getElementById('bangChoHap');
    const badge = document.getElementById('badgeChoHap');
    if (!tbody) return;
    if (badge) badge.innerText = `${globalData.choHap.length} Mục`;

    if (globalData.choHap.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Hiện chưa có mâm nào chờ hấp.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.choHap.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-12">
                <input type="checkbox" class="chk-hap-item w-4 h-4 rounded text-purple-600" data-idx="${idx}" checked>
            </td>
            <td class="p-2 font-semibold text-slate-800">
                ${item.tenBo || ''} <span class="text-[10px] text-slate-400 block">${item.vatLieuBaoBoc || ''} - HSD: ${item.hanSuDung || ''}</span>
            </td>
            <td class="p-2 text-right font-mono font-bold text-purple-700">${item.maBo || ''}</td>
        </tr>
    `).join('');
}

function renderBangChoNghiemThuHap() {
    const tbody = document.getElementById('bangChoNghiệmThu');
    if (!tbody) return;
    if (globalData.dangHap.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có mẻ hấp nào đang trong lò.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.dangHap.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-10">
                <input type="checkbox" class="chk-nghiemthu-hap w-4 h-4 rounded text-purple-600" data-idx="${idx}" checked>
            </td>
            <td class="p-2 font-mono font-bold text-purple-700">${item.maLoHap || ''}</td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo || ''} <span class="text-[10px] text-slate-400">(${item.maBo || ''})</span></td>
            <td class="p-2 text-center font-semibold text-rose-600">Đang hấp (${item.thoiGianBatDauHap || ''})</td>
        </tr>
    `).join('');
}

function renderBangKhoVoKhuan() {
    const tbody = document.getElementById('bangKhoVoKhuan');
    if (!tbody) return;
    if (globalData.khoVoKhuan.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-slate-400">Kho vô khuẩn hiện đang trống. Chưa có mâm dụng cụ nào sẵn sàng.</td></tr>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    globalData.khoVoKhuan.forEach(item => {
        const expDate = parseVietnameseDate(item.hanSuDung);
        if (expDate && !isNaN(expDate.getTime())) {
            item._diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            item._expTimestamp = expDate.getTime();
        } else {
            item._diffDays = 999; item._expTimestamp = 9999999999999;
        }
    });

    globalData.khoVoKhuan.sort((a, b) => a._expTimestamp - b._expTimestamp);

    tbody.innerHTML = globalData.khoVoKhuan.map((item, idx) => {
        const diffDays = item._diffDays;
        let badgeHSD = '', actionBtn = '';

        if (diffDays < 0) {
            badgeHSD = `<span class="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-rose-200"><i class="fa-solid fa-triangle-exclamation text-rose-600 animate-pulse"></i> ĐÃ HẾT HẠN (${item.hanSuDung || 'N/A'})</span>`;
            actionBtn = `<button onclick="thuHoiMamHetHanVeRua(${idx})" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded text-xs shadow-sm whitespace-nowrap"><i class="fa-solid fa-rotate-left mr-1"></i> Về Làm Sạch</button>`;
        } else if (diffDays <= 7) {
            badgeHSD = `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-300 animate-pulse"><i class="fa-solid fa-clock text-amber-600"></i> Còn ${diffDays} ngày (${item.hanSuDung})</span><span class="block text-[10px] text-amber-700 font-semibold mt-0.5">⚠️ Ưu tiên xuất FEFO</span>`;
            actionBtn = `<button onclick="xuatKhoDungCu(${idx})" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded text-xs shadow-sm whitespace-nowrap"><i class="fa-solid fa-truck-fast mr-1"></i> Xuất Trả</button>`;
        } else {
            badgeHSD = `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-200"><i class="fa-solid fa-circle-check text-emerald-600"></i> Còn ${diffDays} ngày (${item.hanSuDung})</span>`;
            actionBtn = `<button onclick="xuatKhoDungCu(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded text-xs shadow-sm whitespace-nowrap">Xuất Trả</button>`;
        }

        return `
            <tr class="border-b hover:bg-slate-50 text-xs transition-colors ${diffDays < 0 ? 'bg-rose-50/50' : (diffDays <= 7 ? 'bg-amber-50/40' : '')}">
                <td class="p-3">
                    <div class="font-bold text-slate-800">${item.tenBo || ''}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${item.vatLieuBaoBoc || 'Bao gói tiêu chuẩn'}</div>
                </td>
                <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || ''}</td>
                <td class="p-3 text-center text-slate-600 font-semibold">${item.khoa || 'Phòng Sanh'}</td>
                <td class="p-3 text-center"><span class="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">${item.viTriKho || 'Kệ A1'}</span></td>
                <td class="p-3 text-center">${badgeHSD}</td>
                <td class="p-3 text-center action-col">${actionBtn}</td>
            </tr>
        `;
    }).join('');
}

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

function moPopupKiemDemThuGom(idPhieu) {
    currentKiemDemIndex = globalData.phieuTra.findIndex(p => p.id === idPhieu);
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

function saveKiemDem() {
    const phieuHienTai = globalData.phieuTra[currentKiemDemIndex];
    if (phieuHienTai && phieuHienTai.items) {
        db.collection("phieu_tra").doc(phieuHienTai.id).delete();

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

function xacNhanMeRua() {
    const checkedInps = document.querySelectorAll('.chk-rua-item:checked');
    if (checkedInps.length === 0) { alert("⚠️ Vui lòng chọn ít nhất một bộ dụng cụ để cho vào mẻ rửa!"); return; }

    const batchId = document.getElementById('rua_batchId').value || `R${Date.now()}`;
    const loaiRua = document.getElementById('rua_loaiRua').value;
    const chuKy = document.getElementById('rua_chuKy').value;

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    let itemsToUpdate = selectedIndices.map(idx => globalData.choRua[idx]);

    itemsToUpdate.forEach(item => {
        item.batchId = batchId; item.loaiRua = loaiRua; item.chuKy = chuKy;
        item.nhanSuRua = currentUser.nvName;
        item.thoiGianBatDau = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        item.timestampBatDauRua = Date.now();
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: `ĐANG RỬA (${loaiRua})`, maLoHap: batchId });
    });
    updateMams(itemsToUpdate, 'DANG_RUA');
    alert(`🚀 Đã kích hoạt mẻ rửa ${batchId}!`);
}

function duyetSachMeRuaHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-rua:checked');
    if (checkedInps.length === 0) { alert("⚠️ Vui lòng chọn mâm dụng cụ cần nghiệm thu!"); return; }

    const testResult = document.getElementById('rua_testDoSach').value;
    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    let itemsToUpdate = selectedIndices.map(idx => globalData.dangRua[idx]);

    itemsToUpdate.forEach(item => {
        item.testDoSach = testResult;
        item.thoiGianRuaXong = new Date().toLocaleString('vi-VN');
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

function tuChoiMeRuaHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-rua:checked');
    if (checkedInps.length === 0) return;
    let itemsToUpdate = Array.from(checkedInps).map(c => globalData.dangRua[parseInt(c.getAttribute('data-idx'))]);
    updateMams(itemsToUpdate, 'CHO_RUA');
    alert("🔴 Đã trả các mâm không đạt về Hàng Đợi Rửa!");
}

async function chotDongGoi() {
    if (itemDongGoiHienTai === null || !globalData.choDongGoi[itemDongGoiHienTai]) return;

    const btnConfirm = document.querySelector('#popupDongGoi button[onclick="chotDongGoi()"]');
    if (btnConfirm) { btnConfirm.disabled = true; btnConfirm.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Đang lưu...`; }

    const loaiEl = document.getElementById('popDG_Loai');
    const vatLieuText = loaiEl ? loaiEl.value.split('|')[0] : "Giấy gói chuyên dụng";
    const days = loaiEl ? parseInt(loaiEl.value.split('|')[1]) || 30 : 30;
    const future = new Date(); future.setDate(future.getDate() + days);

    const item = globalData.choDongGoi[itemDongGoiHienTai];
    let evidenceUrl = "";

    if (storage && anhBangChungDongGoiTam) {
        try {
            const fileName = `evidence_${item.maBo}_${Date.now()}.jpg`;
            const fileRef = storage.ref().child(`cssd_evidence/${fileName}`);
            await fileRef.putString(anhBangChungDongGoiTam, 'data_url');
            evidenceUrl = await fileRef.getDownloadURL();
        } catch (err) { evidenceUrl = anhBangChungDongGoiTam; }
    }

    item.vatLieuBaoBoc = vatLieuText;
    item.hanSuDung = future.toLocaleDateString('vi-VN');
    item.thoiGianDongGoi = new Date().toLocaleString('vi-VN');
    item.nhanSuDongGoi = currentUser.nvName;
    item.anhBangChung = evidenceUrl;

    updateMams([item], 'CHO_HAP');
    ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: 'ĐÃ ĐÓNG GÓI CHỜ HẤP', maLoHap: '---', anhBangChung: evidenceUrl });

    anhBangChungDongGoiTam = null;
    alert("✅ Đóng gói thành công! Dụng cụ đã tự động chuyển sang Trạm Hấp.");
    closePopupDongGoi();

    if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.innerHTML = `<i class="fa-solid fa-box-archive mr-1"></i> Xác Nhận Đóng Gói & Chuyển Hấp`; }
}

function xacNhanMeHap() {
    const checkedInps = document.querySelectorAll('.chk-hap-item:checked');
    if (checkedInps.length === 0) { alert("⚠️ Vui lòng chọn ít nhất một bộ dụng cụ để đưa vào lò hấp!"); return; }

    const batchId = document.getElementById('hap_batchId').value || `H${Date.now()}`;
    const loaiHap = document.getElementById('hap_loaiHap').value;
    const maySo = document.getElementById('hap_maySo').value;

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx')));
    let itemsToUpdate = selectedIndices.map(idx => globalData.choHap[idx]);

    itemsToUpdate.forEach(item => {
        item.maLoHap = batchId; item.loaiHap = loaiHap; item.maySo = maySo;
        item.nhanSuHap = currentUser.nvName;
        item.thoiGianBatDauHap = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        item.timestampBatDauHap = Date.now();
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: `ĐANG HẤP TIỆT TRÙNG (${loaiHap})`, maLoHap: batchId });
    });
    updateMams(itemsToUpdate, 'DANG_HAP');
    alert(`🔥 Đã khởi động mẻ tiệt trùng lò hấp: ${batchId}!`);
}

async function luuNghiemThuQCVaNhapKho() {
    if (!currentQCBatchData || !currentQCBatchData.indices) return;

    const nhietDo = document.getElementById('qc_nhietDo')?.value || '134';
    const apSuat = document.getElementById('qc_apSuat')?.value || '2.1';
    const thoiGianGiu = document.getElementById('qc_thoiGianGiu')?.value || '5';
    const bowieDick = document.getElementById('qc_testBowieDick')?.value || 'ĐẠT';
    const ciTest = document.getElementById('qc_testCI')?.value || 'ĐẠT';
    const biTest = document.getElementById('qc_testBI')?.value || 'ĐẠT (-)';

    if (bowieDick !== 'ĐẠT' || ciTest !== 'ĐẠT') {
        if (!confirm("⚠️ CẢNH BÁO Y KHOA: Test Bowie-Dick hoặc Chỉ thị hóa học chưa ĐẠT! Bạn có chắc chắn muốn phát hành mẻ tiệt trùng này?")) return;
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
        item.thoiGianHoanTatHap = new Date().toLocaleString('vi-VN');
        item.qcDetails = soMeHapEntry;
        item.kpiBiStatus = item.timestampBatDauHap && Math.round((Date.now() - item.timestampBatDauHap) / 60000) > 30 ? "TRỄ (>30m)" : "ĐẠT (<30m)";
        
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: `NHẬP KHO VÔ KHUẨN (QC: ${shaHash})`, maLoHap: item.maLoHap || currentQCBatchData.batchId, qcHash: shaHash });
    });

    updateMams(itemsToUpdate, 'VO_KHUAN');
    db.collection("sterilization_batches").doc(`${CURRENT_TENANT}_${currentQCBatchData.batchId}`).set({ ...soMeHapEntry, tenant_id: CURRENT_TENANT, batch_type: 'HAP', timestamp: firebase.firestore.FieldValue.serverTimestamp() });

    dongPopupNghiemThuQC();
    alert(`🎉 ĐÃ LƯU BẰNG CHỨNG SỐ & NHẬP KHO THÀNH CÔNG!\n- Mã băm toàn vẹn: ${shaHash}`);
}

function tuChoiHapHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) return;
    let itemsToUpdate = Array.from(checkedInps).map(c => globalData.dangHap[parseInt(c.getAttribute('data-idx'))]);
    updateMams(itemsToUpdate, 'CHO_HAP');
    alert("🔴 Đã trả các mâm về Hàng Đợi Hấp!");
}

function xuatKhoDungCu(idx) {
    const item = globalData.khoVoKhuan[idx];
    if (!item) return;
    updateMams([item], 'DA_XUAT');
    ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa || 'Khoa Lâm Sàng', trangThai: 'XUẤT KHO VỀ KHOA', maLoHap: item.maLoHap || item.batchId || '---' });
    alert(`📦 Đã xuất mâm [${item.tenBo}] cho Khoa!`);
}

function thuHoiMamHetHanVeRua(idx) {
    const item = globalData.khoVoKhuan[idx];
    if (!item) return;
    if (confirm(`🚨 MÂM HẾT HẠN: Chuyển mâm [${item.tenBo}] về Trạm Rửa xử lý lại?`)) {
        item.trangThai = 'HẾT HẠN - THU VỀ RỬA LẠI';
        item.thoiGianThuGom = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        item.nhanSuThuGom = currentUser.nvName;
        updateMams([item], 'CHO_RUA');
        ghiNhatKyFirebase({ maBo: item.maBo, tenBo: item.tenBo, khoa: item.khoa, trangThai: 'QUÁ HẠN DÙNG - THU HỒI TÁI XỬ LÝ', maLoHap: item.maLoHap || '---' });
        alert(`🔄 Đã chuyển mâm về Hàng Đợi Rửa thành công!`);
    }
}

function xacNhanPhatLenhThuHoi() {
    if (!currentRecallBatchId) { alert("⚠️ Chưa chọn mã lô tiệt trùng để phát lệnh phong tỏa!"); return; }
    const lyDo = document.getElementById('recall_lyDo') ? document.getElementById('recall_lyDo').value.trim() : "Phát hiện BI (+)";

    if (confirm(`🚨 XÁC NHẬN PHONG TỎA LÔ [${currentRecallBatchId}]?`)) {
        const batch = db.batch();
        const addToBatch = (i) => {
            if ((i.maLoHap || '').toUpperCase() === currentRecallBatchId || (i.batchId || '').toUpperCase() === currentRecallBatchId) {
                batch.set(db.collection("instrument_sets").doc(`${CURRENT_TENANT}_${i.maBo}`), { current_status: 'CHO_RUA', trangThai: 'THU HỒI KHẨN CẤP' }, { merge: true });
            }
        };
        globalData.khoVoKhuan.forEach(addToBatch);
        globalData.dangHap.forEach(addToBatch);
        batch.commit();

        ghiNhatKyFirebase({ maBo: "ALL_BATCH", tenBo: `PHONG TỎA THU HỒI LÔ ${currentRecallBatchId}`, khoa: "TOÀN VIỆN", trangThai: `KHẨN CẤP: BI (+) - ${lyDo}`, maLoHap: currentRecallBatchId });
        alert(`🔥 ĐÃ PHÁT LỆNH THU HỒI TỚI TOÀN VIỆN!`);
        dongPopupThuHoi();
    }
}

function xoaSachDuLieuGiaoDichRealtime() {
    if (confirm("⚠️ Xóa toàn bộ nhật ký giao dịch? (Dữ liệu không thể phục hồi)")) {
        ['instrument_sets', 'phieu_tra', 'transaction_logs', 'sterilization_batches'].forEach(col => {
            db.collection(col).where("tenant_id", "==", CURRENT_TENANT).get().then(snap => {
                const b = db.batch();
                snap.docs.forEach(doc => b.delete(doc.ref));
                b.commit();
            });
        });
        alert("🗑️ Đã xóa sạch dữ liệu giao dịch thành công!");
    }
}

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
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) toggleMobileMenu();
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar_menu');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
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

function renderBangLichSuLuanChuyen() {
    const tbody = document.getElementById('bangLichSuHanhTrinhGoc');
    if (!tbody) return;
    if (!Array.isArray(globalData.lichSu) || globalData.lichSu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-xs text-slate-400">Chưa có nhật ký.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.lichSu.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold">${item.maBo || 'MÂM_01'}</td>
            <td class="p-3 font-bold">${item.tenBo || 'Mâm Dụng Cụ'}</td>
            <td class="p-3">${item.khoa || 'Khoa GMHS'}</td>
            <td class="p-3 text-center"><span class="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai || 'Luân chuyển'}</span></td>
            <td class="p-3 text-center font-mono">${item.maLoHap || '---'}</td>
            <td class="p-3 text-center">${item.nhanSu || 'KTV'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian || 'Vừa xong'}</td>
        </tr>
    `).join('');
}

function renderBangLichSuHap() {
    const tbody = document.getElementById('bangLichSuHap');
    if (!tbody) return;
    if (!Array.isArray(globalData.meHap) || globalData.meHap.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có nhật ký mẻ hấp trong ngày.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.meHap.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2.5 font-mono font-bold text-purple-700">${item.batchId || item.maLoHap || '---'}
                ${item.shaHash ? `<span class="block text-[9px] text-slate-400 font-normal">SHA: ${item.shaHash}</span>` : ''}
            </td>
            <td class="p-2.5">${item.maySo || 'Lò Hấp CSSD'}</td>
            <td class="p-2.5 font-mono">${item.nhietDo || '134°C'} / ${item.apSuat || '2.1 Bar'}</td>
            <td class="p-2.5 text-center font-bold ${String(item.testBI).includes('ĐẠT') ? 'text-emerald-600' : 'text-amber-600'}">${item.testBI || 'ĐẠT (-)'}</td>
            <td class="p-2.5 text-center font-semibold text-emerald-700">${item.shaHash ? '🟢 ĐÃ LƯU SỔ QC' : 'HOÀN TẤT'}</td>
        </tr>
    `).join('');
}

function renderBangKPIPerformance() {
    const tbody = document.getElementById('bangHieuSuatKTV');
    if (!tbody) return;
    const ktvStats = (globalData.ktvList || []).map((ktv, idx) => {
        const logsOfKtv = (globalData.lichSu || []).filter(l => l && l.nhanSu === ktv.name);
        const countRua = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('RỬA')).length;
        const countDongGoi = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('ĐÓNG GÓI')).length;
        const countHap = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('HẤP')).length;
        const countXuatKho = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('XUẤT KHO')).length;
        const tongThaoTac = logsOfKtv.length;
        const totalBiReads = (globalData.meHap || []).filter(m => m && (m.nhanSuHap === ktv.name || m.nhanSu === ktv.name)).length;
        const passBiReads = (globalData.meHap || []).filter(m => m && (m.nhanSuHap === ktv.name || m.nhanSu === ktv.name) && m.kpiBiStatus === 'ĐẠT (<30m)').length;
        const biComplianceRate = totalBiReads > 0 ? Math.round((passBiReads / totalBiReads) * 100) : 100;
        return { stt: idx + 1, id: ktv.id, name: ktv.name, role: ktv.role, countRua, countDongGoi, countHap, countXuatKho, tongThaoTac, biComplianceRate };
    });
    tbody.innerHTML = ktvStats.map(stat => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 text-center font-bold text-slate-500">${stat.stt}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${stat.id}</td>
            <td class="p-3 font-bold text-slate-800">${stat.name} <span class="text-[10px] text-slate-400 block">${stat.role}</span></td>
            <td class="p-3 text-center font-bold text-slate-700">${stat.countRua}</td>
            <td class="p-3 text-center font-bold text-slate-700">${stat.countDongGoi}</td>
            <td class="p-3 text-center font-bold text-purple-700">${stat.countHap}</td>
            <td class="p-3 text-center font-bold text-emerald-700">${stat.countXuatKho}</td>
            <td class="p-3 text-center font-extrabold text-sky-800">${stat.tongThaoTac}</td>
            <td class="p-3 text-center font-bold ${stat.biComplianceRate >= 95 ? 'text-emerald-600' : 'text-rose-600'}">${stat.biComplianceRate}% (30m)</td>
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
    setTxt('tv_choRua', (globalData.choRua || []).length);
    setTxt('tv_choDongGoi', (globalData.choDongGoi || []).length);
    setTxt('tv_choHap', (globalData.choHap || []).length);

    const alertZoneTV = document.getElementById('tv_emergency_alert_zone');
    if (alertZoneTV) {
        if (currentRecallBatchId) {
            alertZoneTV.classList.remove('hidden');
            alertZoneTV.innerHTML = `<div class="bg-rose-600 text-white p-4 rounded-2xl animate-pulse flex items-center justify-between shadow-2xl"><div class="flex items-center gap-3"><i class="fa-solid fa-triangle-exclamation text-3xl"></i><div><h3 class="font-extrabold text-lg">CẢNH BÁO THU HỒI KHẨN CẤP LÔ TIỆT TRÙNG: ${currentRecallBatchId}</h3><p class="text-xs opacity-90">Phát hiện sự cố Chỉ thị sinh học BI (+)!</p></div></div></div>`;
        } else { alertZoneTV.classList.add('hidden'); }
    }
}

function moCamera(inputId) {
    currentCameraInputId = inputId;
    const pop = document.getElementById('popupScanner');
    if (pop) pop.classList.remove('hidden');
    if (typeof Html5QrcodeScanner !== 'undefined') {
        html5QrCodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
        html5QrCodeScanner.render((decodedText) => {
            if (currentCameraInputId) {
                const inputEl = document.getElementById(currentCameraInputId);
                if (inputEl) inputEl.value = decodedText;
            }
            dongCamera();
        }, (error) => {});
    }
}

function dongCamera() {
    if (html5QrCodeScanner) html5QrCodeScanner.clear().catch(error => console.error(error));
    const pop = document.getElementById('popupScanner');
    if (pop) pop.classList.add('hidden');
}

function scanKhayVaoSuDung() {
    const inp = document.getElementById('sd_maKhayInp');
    if (!inp || !inp.value.trim()) return;
    const maKhay = inp.value.trim().toUpperCase();
    const item = (globalData.danhMucLinhKien || []).find(i => i && i.maBo.toUpperCase() === maKhay) || { maBo: maKhay, tenBo: "Khay Dụng Cụ" };
    tempSuDungKhay.push(item);
    renderBangKhaySuDung();
    inp.value = '';
}

function renderBangKhaySuDung() {
    const tbody = document.getElementById('sd_bangKhayChon');
    if (!tbody) return;
    tbody.innerHTML = tempSuDungKhay.map((item, idx) => `
        <tr class="border-b text-xs">
            <td class="p-2 text-center font-bold">${idx + 1}</td>
            <td class="p-2 font-mono font-bold text-teal-700">${item.maBo}</td>
            <td class="p-2 font-semibold">${item.tenBo}</td>
            <td class="p-2 text-center font-mono">H260328_01</td>
            <td class="p-2 text-center"><span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Vô Khuẩn</span></td>
            <td class="p-2 text-center"><button onclick="tempSuDungKhay.splice(${idx},1); renderBangKhaySuDung();" class="text-rose-600"><i class="fa-solid fa-xmark"></i></button></td>
        </tr>
    `).join('');
}

function moPopupSuDungBoDungCu() { document.getElementById('popupSuDungBoDungCu').classList.remove('hidden'); }
function closePopupSuDung() { document.getElementById('popupSuDungBoDungCu').classList.add('hidden'); }

// =========================================================================
// 11. CÁC HÀM TIỆN ÍCH, XUẤT EXCEL & IN ẤN BỔ SUNG
// =========================================================================
function initCanvasKyDienTu() {
    canvasKy = document.getElementById('canvasKyDienTu');
    if (!canvasKy) return;

    canvasKy.width = 320;
    canvasKy.height = 160;
    ctxKy = canvasKy.getContext('2d');
    ctxKy.lineWidth = 2.5;
    ctxKy.strokeStyle = "#0284c7";

    const getPos = (e) => {
        const rect = canvasKy.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e) => {
        isDrawingKy = true;
        const pos = getPos(e);
        ctxKy.beginPath();
        ctxKy.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawingKy) return;
        const pos = getPos(e);
        ctxKy.lineTo(pos.x, pos.y);
        ctxKy.stroke();
    };

    const stopDraw = () => { isDrawingKy = false; };

    canvasKy.addEventListener('mousedown', startDraw);
    canvasKy.addEventListener('mousemove', draw);
    canvasKy.addEventListener('mouseup', stopDraw);

    canvasKy.addEventListener('touchstart', startDraw, { passive: true });
    canvasKy.addEventListener('touchmove', draw, { passive: true });
    canvasKy.addEventListener('touchend', stopDraw);
}

function xoaChuKyCanvas() {
    if (ctxKy && canvasKy) {
        ctxKy.clearRect(0, 0, canvasKy.width, canvasKy.height);
    }
}

function khoaKyNhanDoSachDienTu() {
    const pop = document.getElementById('popupKyDienTu');
    if (pop) pop.classList.remove('hidden');
    xoaChuKyCanvas();
}

function dongPopupKyDienTu() {
    const pop = document.getElementById('popupKyDienTu');
    if (pop) pop.classList.add('hidden');
}

function luuXacNhanKyNhan() {
    const tenNguoi = document.getElementById('ky_tenNguoiNhan') ? document.getElementById('ky_tenNguoiNhan').value : "";
    if (!tenNguoi) {
        alert("Vui lòng nhập tên người nhận đồ!");
        return;
    }
    dongPopupKyDienTu();
    alert(`✍️ Đã lưu chữ ký của [${tenNguoi}]!`);
}

function xuatBaoCaoExcelLuanChuyen() {
    if (typeof XLSX === 'undefined') return;
    const dataLuanChuyen = (globalData.lichSu || []).map(item => ({
        "Mã ID Khay": item.maBo || "N/A",
        "Tên Bộ Dụng Cụ": item.tenBo || "N/A",
        "Khoa / Phòng": item.khoa || "N/A",
        "Trạng Thái": item.trangThai || "N/A",
        "Mã Lô Tiệt Trùng": item.maLoHap || "N/A",
        "Nhân Sự Xử Lý": item.nhanSu || "N/A",
        "Thời Gian Ghi Nhận": item.thoiGian || "N/A"
    }));

    const wsLuanChuyen = XLSX.utils.json_to_sheet(dataLuanChuyen.length ? dataLuanChuyen : [{ "Ghi chú": "Chưa có dữ liệu" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsLuanChuyen, "Nhat_Ky_Luan_Chuyen");
    XLSX.writeFile(wb, `BaoCao_LuanChuyen_CSSD_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function xuatBaoCaoExcelMeRua() {
    if (typeof XLSX === 'undefined') return;
    const dataMeRua = (globalData.meRua || []).map(item => ({
        "Mã Lô Rửa": item.batchId || "N/A",
        "Mã Máy Rửa": item.maySo || "Belimed WD250",
        "Chu Trình": item.chuKy || "Tiêu chuẩn",
        "Kết Quả": item.testDoSach || "ĐẠT",
        "Thời Gian": item.thoiGianRuaXong || item.thoiGian || "N/A"
    }));

    const wsMeRua = XLSX.utils.json_to_sheet(dataMeRua.length ? dataMeRua : [{ "Ghi chú": "Chưa có dữ liệu" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMeRua, "Me_Rua_Belimed");
    XLSX.writeFile(wb, `NhatKy_MeRua_Belimed_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function truyVetTheoMaBatch() {
    const inp = document.getElementById('inp_searchBatch');
    const tbody = document.getElementById('bangLichSuTruyXuatAdmin');
    if (!inp || !tbody) return;

    const maBatch = inp.value.trim().toUpperCase();
    if (!maBatch) {
        alert("Vui lòng nhập mã lô tiệt trùng cần truy vết!");
        return;
    }

    const res = (globalData.lichSu || []).filter(l => l && l.maLoHap && l.maLoHap.toUpperCase().includes(maBatch));
    if (res.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-rose-500 font-bold">Không tìm thấy mã lô: ${maBatch}</td></tr>`;
        return;
    }

    tbody.innerHTML = res.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || 'N/A'}</td>
            <td class="p-3 font-bold text-slate-800">${item.tenBo || 'Mâm Dụng Cụ'}</td>
            <td class="p-3 font-semibold text-slate-600">${item.khoa || 'N/A'}</td>
            <td class="p-3 text-center"><span class="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai}</span></td>
            <td class="p-3 text-center font-mono font-bold text-purple-700">${item.maLoHap}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian}</td>
        </tr>
    `).join('');
}

function clearTruyVetBatch() {
    const inp = document.getElementById('inp_searchBatch');
    const tbody = document.getElementById('bangLichSuTruyXuatAdmin');
    if (inp) inp.value = '';
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-slate-400">Nhập mã lô hấp để truy vết.</td></tr>`;
}

function inTemTongHangLoat() {
    const batchInp = document.getElementById('hap_batchId');
    const maySoEl = document.getElementById('hap_maySo');
    const loaiHapEl = document.getElementById('hap_loaiHap');
    
    const batchId = batchInp ? batchInp.value : `H${Date.now()}`;
    const maySo = maySoEl ? maySoEl.value : "Lò Hấp Steam #1";
    const loaiHap = loaiHapEl ? loaiHapEl.value : "Hấp Hơi Nước";

    const checkedInps = document.querySelectorAll('.chk-hap-item:checked');
    let itemsToPrint = [];

    if (checkedInps.length > 0) {
        checkedInps.forEach(chk => {
            const idx = parseInt(chk.getAttribute('data-idx'));
            if ((globalData.choHap || [])[idx]) itemsToPrint.push(globalData.choHap[idx]);
        });
    } else {
        itemsToPrint = globalData.choHap || [];
    }

    if (itemsToPrint.length === 0) {
        alert("⚠️ Không có mâm dụng cụ nào được chọn!");
        return;
    }

    thucHienInTemBixolon(itemsToPrint, batchId, maySo, loaiHap);
}

function inTemNghiemThuHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn ít nhất một mâm để in tem!");
        return;
    }

    let itemsToPrint = [];
    checkedInps.forEach(chk => {
        const idx = parseInt(chk.getAttribute('data-idx'));
        if ((globalData.dangHap || [])[idx]) itemsToPrint.push(globalData.dangHap[idx]);
    });

    const firstItem = itemsToPrint[0] || {};
    thucHienInTemBixolon(itemsToPrint, firstItem.maLoHap || 'H001', firstItem.loaiHap || 'Steam', 'Lò Hấp CSSD');
}

function thucHienInTemBixolon(items, batchId, maySo, loaiHap) {
    const printZone = document.getElementById('print-zone');
    if (!printZone) return;

    document.body.className = "print-mode-bixolon";
    const strNgayIn = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    printZone.innerHTML = `
        <style>
            @media print {
                body * { visibility: hidden; }
                #print-zone, #print-zone * { visibility: visible; }
                #print-zone { position: absolute; left: 0; top: 0; width: 100%; }
            }
            .label-page {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
                page-break-inside: avoid;
            }
            .single-label {
                width: 49%;
                border: 1px solid #333;
                padding: 6px 10px;
                background: #fff;
                font-family: Arial, sans-serif;
                box-sizing: border-box;
                border-radius: 2px;
            }
        </style>
        <div class="labels-container">
            ${items.map((item, idx) => {
                const maHienThi = item.maBo || 'SG-BHD800';
                const tenNhanVien = currentUser.nvName || 'Trần Thị Thoa';
                const hanSuDung = item.hanSuDung || '31-08-2026';
                const maSoPhatHanh = item.batchId || item.maLoHap || (1020 + idx);

                const labelHtml = `
                    <div class="single-label">
                        <div style="text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 2px; text-transform: uppercase;">
                            ${maHienThi}
                        </div>
                        <div style="text-align: center; margin: 2px 0;">
                            <svg id="barcode-${idx}" style="max-width: 100%; height: 42px;"></svg>
                        </div>
                        <div style="text-align: center; font-size: 11px; color: #222; margin-bottom: 4px;">
                            ${maSoPhatHanh}
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; margin-bottom: 3px;">
                            <span>SL: ${item.soLuong || 1}</span>
                            <span style="font-weight: bold; color: #000;">${tenNhanVien}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px;">
                            <span>${strNgayIn}</span>
                            <span><strong>HSD: ${hanSuDung}</strong></span>
                        </div>
                    </div>
                `;

                if (idx % 2 === 0) {
                    return `<div class="label-page">${labelHtml}${idx + 1 < items.length ? '' : '<div class="single-label" style="visibility:hidden;"></div>'}`;
                } else {
                    return `${labelHtml}</div>`;
                }
            }).join('')}
        </div>
    `;

    if (typeof JsBarcode === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js";
        script.onload = () => renderBarcodesAndPrint(items);
        document.head.appendChild(script);
    } else {
        renderBarcodesAndPrint(items);
    }
}

function renderBarcodesAndPrint(items) {
    items.forEach((item, idx) => {
        const barcodeId = `#barcode-${idx}`;
        const codeValue = item.maBo || 'SG-BHD800';
        if (document.querySelector(barcodeId)) {
            JsBarcode(barcodeId, codeValue, {
                format: "CODE128",
                displayValue: false,
                margin: 0,
                height: 40,
                width: 1.8
            });
        }
    });

    setTimeout(() => {
        window.print();
    }, 300);
}

function inHoaDonGiaoNhan() {
    const printZone = document.getElementById('print-zone');
    if (!printZone) return;

    document.body.className = "print-mode-doc";

    printZone.innerHTML = `
        <div style="padding: 10px; font-family: Arial, sans-serif;">
            <h2 style="text-align: center; margin-bottom: 5px; text-transform: uppercase;">BIÊN BẢN GIAO NHẬN DỤNG CỤ TIỆT TRÙNG</h2>
            <p style="text-align: center; font-size: 12px; margin-bottom: 15px;">Thời gian in: ${new Date().toLocaleString('vi-VN')}</p>
            <table>
                <thead>
                    <tr>
                        <th>Tên Bộ Dụng Cụ</th>
                        <th>Mã ID</th>
                        <th>Khoa Trả</th>
                        <th>Số Lượng</th>
                    </tr>
                </thead>
                <tbody>
                    ${(globalData.danhMucLinhKien || []).slice(0, 10).map(i => `
                        <tr>
                            <td>${i.tenBo || ''}</td>
                            <td>${i.maBo || ''}</td>
                            <td>${i.khoa || ''}</td>
                            <td style="text-align: center;">1</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    setTimeout(() => { window.print(); }, 200);
}

function khaiSinhKhayVangLai() {
    const ma = prompt("Nhập mã khay vãng lai:");
    if (ma) alert(`✨ Đã khởi tạo khay: ${ma.toUpperCase()}`);
}

function moModalXemAnhCauHinh() {
    const pop = document.getElementById('popupXemAnhCauHinh');
    if (pop) pop.classList.remove('hidden');
}

function dongModalXemAnhCauHinh() {
    const pop = document.getElementById('popupXemAnhCauHinh');
    if (pop) pop.classList.add('hidden');
}

function initGlobalBarcodeScanner() {
    window.addEventListener('keydown', (e) => {
        if (!isBarcodeScannerEnabled) return;

        const activeElement = document.activeElement;
        const isInputField = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable);
        if (isInputField && activeElement.id !== 'global_barcode_catcher') {
            return;
        }

        if (e.key === 'Enter') {
            if (barcodeScannerBuffer.length > 2) {
                const scannedCode = barcodeScannerBuffer.trim().toUpperCase();
                xuLyMaBarcodeQuetTuSung(scannedCode);
            }
            barcodeScannerBuffer = "";
            clearTimeout(barcodeScannerTimer);
        } else if (e.key.length === 1) {
            barcodeScannerBuffer += e.key;
            clearTimeout(barcodeScannerTimer);
            barcodeScannerTimer = setTimeout(() => {
                barcodeScannerBuffer = "";
            }, 100);
        }
    });
}

function xuLyMaBarcodeQuetTuSung(scannedCode) {
    if (scannedCode.startsWith('H') || scannedCode.startsWith('R')) {
        switchTab('tracuu');
        const inpBatch = document.getElementById('inp_searchBatch');
        if (inpBatch) inpBatch.value = scannedCode;
        truyVetTheoMaBatch();
        return;
    }

    if (currentTab === 'khoaphong') {
        const inp = document.getElementById('khoa_inpMaBo');
        if (inp) {
            inp.value = scannedCode;
            themVaoGio();
        }
    } else if (currentTab === 'khovokhuan') {
        const inp = document.getElementById('xuat_inpMaBo');
        if (inp) {
            inp.value = scannedCode;
            xuatKhoXoayVong();
        }
    } else {
        alert(`🔍 Đã quét mã: [${scannedCode}]`);
    }
}

function toggleGlobalBarcodeScanner(enable) {
    isBarcodeScannerEnabled = enable;
}

function themVaoGio() {
    const inp = document.getElementById('khoa_inpMaBo');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!inp || !inp.value.trim()) {
        alert("Vui lòng chọn hoặc nhập mã mâm dụng cụ bẩn!");
        return;
    }

    const maBoInput = inp.value.trim().toUpperCase();
    const khoaSelect = selKhoa ? selKhoa.value : "";

    const item = (globalData.danhMucLinhKien || []).find(i => i && i.maBo.toUpperCase() === maBoInput) || {
        maBo: maBoInput,
        tenBo: "Mâm Dụng Cụ Bẩn",
        khoa: khoaSelect || "PHÒNG SANH - CẤP CỨU SẢN"
    };

    gioHangTraTam.push(item);
    renderGioHangTam();
    inp.value = '';
}

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

function guiBaoTra() { khoaGuiPhieuTraBatches(); }
function guiPhieuBaoTra() { khoaGuiPhieuTraBatches(); }
// =========================================================================
// HÀM BỔ SUNG BỊ THIẾU
// =========================================================================
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

function tuDongTaoMaLoMeRua() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('rua_batchId');
    const meInp = document.getElementById('rua_meSo');
    if (batchInp && meInp) { meInp.value = "01"; batchInp.value = `R${today}_01`; }
}

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

function tuDongTaoMaLoMeHap() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('hap_batchId');
    const meInp = document.getElementById('hap_meSo');
    if (batchInp && meInp) { meInp.value = "01"; batchInp.value = `H${today}_01`; }
}

function renderDanhSachPinAdmin() {
    const tbody = document.getElementById('bangCauHinhPinAdmin');
    if (!tbody) return;
    const searchInp = document.getElementById('search_pin_admin');
    const keyword = searchInp ? searchInp.value.trim().toLowerCase() : '';
    const filteredList = (globalData.ktvList || []).filter(ktv => ktv && (ktv.name.toLowerCase().includes(keyword) || ktv.id.toLowerCase().includes(keyword)));
    tbody.innerHTML = filteredList.map((ktv, index) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 text-center font-bold text-slate-500">${index + 1}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
            <td class="p-3 font-semibold text-slate-800">${ktv.name}</td>
            <td class="p-3 text-center font-mono"><input type="password" id="pin_input_${ktv.id}" value="${ktv.pin || '1234'}" class="w-24 text-center border rounded p-1 text-xs font-bold"></td>
            <td class="p-3 text-center">
                <select id="role_select_${ktv.id}" class="border rounded px-2 py-1 text-xs">
                    <option value="CSSD" ${ktv.role === 'CSSD' ? 'selected' : ''}>KTV CSSD</option>
                    <option value="KHOA" ${ktv.role === 'KHOA' ? 'selected' : ''}>Điều Dưỡng Khoa</option>
                    <option value="ADMIN" ${ktv.role === 'ADMIN' ? 'selected' : ''}>Administrator</option>
                </select>
            </td>
            <td class="p-3 text-center"><button type="button" onclick="capNhatPinNhanVien('${ktv.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-xs font-bold">Lưu</button></td>
        </tr>
    `).join('');
}

function capNhatPinNhanVien(ktvId) {
    const pinInp = document.getElementById(`pin_input_${ktvId}`);
    const targetKtv = (globalData.ktvList || []).find(k => k && k.id === ktvId);
    if (targetKtv && pinInp) {
        targetKtv.pin = pinInp.value.trim();
        alert(`🔑 Đã cập nhật PIN cho [${targetKtv.name}]!`);
    }
}

function themNhanSuMoiAdmin() {
    const nameInp = document.getElementById('admin_add_nv_name');
    const idInp = document.getElementById('admin_add_nv_id');
    const pinInp = document.getElementById('admin_add_nv_pin');
    const roleInp = document.getElementById('admin_add_nv_role');
// =========================================================================
// HÀM ĐỒNG HỒ DASHBOARD TV
// =========================================================================
function initDashboardTVClock() {
    setInterval(() => {
        const tvClockEl = document.getElementById('tv_realtime_clock');
        if (tvClockEl) tvClockEl.innerText = new Date().toLocaleString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
}
    if (!nameInp || !idInp || !nameInp.value.trim() || !idInp.value.trim()) {
        alert("Vui lòng nhập Mã NV và Họ Tên!");
        return;
    }

    if (!globalData.ktvList) globalData.ktvList = [];

    globalData.ktvList.push({
        id: idInp.value.trim().toUpperCase(),
        name: nameInp.value.trim(),
        pin: pinInp && pinInp.value ? pinInp.value.trim() : '1234',
        role: roleInp ? roleInp.value : 'CSSD'
    });

    renderDanhSachPinAdmin();
    nameInp.value = '';
    idInp.value = '';
    if (pinInp) pinInp.value = '';
    alert("➕ Đã thêm nhân sự thành công!");
}
document.addEventListener('DOMContentLoaded', () => {
    docDuLieuLuuTruLocalStorage();
    initRealtimeListeners();
    initExcelLoader(); 
    initWordLoader(); 
    capNhatDanhSachMaMayRua();
    capNhatDanhSachMaMay();
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
    initCanvasKyDienTu();
    initGlobalBarcodeScanner();
});

function initExcelLoader() {
    const excelInput = document.getElementById('excelFileInput');
    if (!excelInput) return;
    excelInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (typeof XLSX === 'undefined') { alert("❌ Chưa tải thư viện SheetJS (XLSX)!"); return; }
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                let targetSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase().includes('chi tiết') || s.trim().toLowerCase().includes('cơ số') || s.trim().toLowerCase().includes('sheet1')) || workbook.SheetNames[0];
                const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheetName], { header: 1, defval: "" });
                if (!rawRows || rawRows.length === 0) return;

                const headerRow = (rawRows[0] || []).map(v => String(v).trim().toLowerCase());
                let idxKhoa = headerRow.findIndex(h => h.includes('khoa') || h.includes('phòng') || h.includes('tên ts (i)') || h.includes('đơn vị'));
                let idxMa = headerRow.findIndex(h => h.includes('mã dc') || h.includes('mã ts') || h.includes('mã'));
                let idxTen = headerRow.findIndex(h => h.includes('tên ts chuẩn') || h.includes('tên chi tiết') || h.includes('tên dụng cụ') || h.includes('tên bộ'));
                let idxSoLuong = headerRow.findIndex(h => h.includes('số lượng') || h.includes('cơ số') || h.includes('sl'));
                if (idxKhoa === -1) idxKhoa = 1; if (idxMa === -1) idxMa = 2; if (idxTen === -1) idxTen = 3; if (idxSoLuong === -1) idxSoLuong = 4;

                let danhSachBoMoi = [];
                let setKhoa = new Set();
                const mapAesculap = JSON.parse(localStorage.getItem('cssd_aesculapCatalog') || '{}');

                for (let i = 1; i < rawRows.length; i++) {
                    const r = rawRows[i];
                    if (!r || r.length === 0) continue;
                    const tenKhoa = r[idxKhoa] ? String(r[idxKhoa]).trim().toUpperCase() : "";
                    const maBo = r[idxMa] ? String(r[idxMa]).trim().toUpperCase() : `BO_${i}`;
                    const tenBo = r[idxTen] ? String(r[idxTen]).trim() : "Bộ Dụng Cụ";
                    const soLuong = r[idxSoLuong] !== "" && r[idxSoLuong] !== undefined ? Number(r[idxSoLuong]) || 1 : 1;

                    if (!tenKhoa || !tenBo) continue;
                    setKhoa.add(tenKhoa);

                    let chiTietLinhKien = [];
                    const maBoClean = cleanSearchStr(maBo);
                    const tenBoClean = cleanSearchStr(tenBo);
                    let targetAesculapName = "";
                    for (const [keyAlias, valAesculap] of Object.entries(SET_ALIAS_MAPPING)) {
                        if (maBoClean.includes(cleanSearchStr(keyAlias)) || tenBoClean.includes(cleanSearchStr(keyAlias))) { targetAesculapName = valAesculap; break; }
                    }
                    for (const [tenBoAesculap, listLinhKien] of Object.entries(mapAesculap)) {
                        const aescClean = cleanSearchStr(tenBoAesculap);
                        if ((targetAesculapName && cleanSearchStr(targetAesculapName) === aescClean) || tenBoClean.includes(aescClean) || aescClean.includes(tenBoClean)) {
                            chiTietLinhKien = listLinhKien; break;
                        }
                    }
                    danhSachBoMoi.push({ khoa: tenKhoa, maBo: maBo, tenBo: tenBo, soLuong: soLuong, chiTietLinhKien: chiTietLinhKien });
                }

                if (danhSachBoMoi.length > 0) {
                    globalData.danhMucLinhKien = danhSachBoMoi;
                    globalData.danhSachKhoa = Array.from(setKhoa);
                    localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                    localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));
                    if (db) db.collection("he_thong_config").doc(`danh_muc_${CURRENT_TENANT}`).set({ danhMucLinhKien: globalData.danhMucLinhKien, danhSachKhoa: globalData.danhSachKhoa, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    capNhatGiaoDienSauKhiNapExcel();
                    alert(`🎉 NẠP THÀNH CÔNG!\n- Tổng cộng: ${danhSachBoMoi.length} bộ dụng cụ.`);
                }
            } catch (err) { alert("❌ Lỗi khi đọc file Excel!"); }
        };
        reader.readAsArrayBuffer(file);
    });
}

function initWordLoader() {
    const wordInput = document.getElementById('wordFileInput');
    if (!wordInput) return;
    wordInput.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (typeof mammoth === 'undefined') { alert("❌ Chưa tải được thư viện mammoth.js!"); return; }

        let totalSetsUpdated = 0;
        let danhSachTenBoCapNhat = [];
        const mapAesculap = JSON.parse(localStorage.getItem('cssd_aesculapCatalog') || '{}');

        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                const doc = new DOMParser().parseFromString(result.value, 'text/html');
                
                doc.querySelectorAll('table').forEach(table => {
                    let tenBo = "", chiTietLinhKien = [], idxMa = -1, idxTen = -1, idxQty = -1;
                    const rows = Array.from(table.querySelectorAll('tr'));

                    rows.forEach(tr => {
                        const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
                        if (cells.length === 0) return;
                        const fullRow = cells.join(" ").toUpperCase();
                        if (!tenBo) {
                            if (fullRow.includes("MỔ LẤY THAI") || fullRow.includes("MỔ BẮT CON")) tenBo = "MỔ LẤY THAI";
                            else if (fullRow.includes("BỘ SANH") || fullRow.includes("ĐỠ SANH")) tenBo = "BỘ SANH";
                            else if (cells.some(c => c.toUpperCase().includes("TÊN TS") || c.toUpperCase().includes("TÊN BỘ"))) {
                                for (let c of cells) {
                                    if (c.length > 2 && !c.includes("KHOA") && !c.includes("KIỂM") && !c.includes("STT") && !c.includes("Ngày") && !/^\d+$/.test(c)) {
                                        tenBo = c.replace(/checklist|danh mục|bộ dụng cụ/gi, '').trim(); break;
                                    }
                                }
                            }
                        }
                        cells.forEach((c, i) => {
                            const u = c.toUpperCase();
                            if (u.includes("MÃ TS") || u === "MÃ" || u.includes("MÃ SỐ")) idxMa = i;
                            if (u.includes("TÊN TS") || u.includes("TÊN DỤNG CỤ") || u === "TÊN") idxTen = i;
                            if (u.includes("SL") || u.includes("SỐ LƯỢNG") || u.includes("CƠ SỐ")) idxQty = i;
                        });
                    });

                    if (!tenBo) tenBo = file.name.replace(/\.[^/.]+$/, "").replace(/checklist|danh muc|bo dung cu|phieu kiem/gi, "").trim();

                    rows.forEach(tr => {
                        const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
                        if (cells.length < 2) return;
                        const fullRow = cells.join(" ").toUpperCase();
                        if (fullRow.includes("KHOA KIỂM SOÁT") || fullRow.includes("CHECK SẠCH") || fullRow.includes("GHI CHÚ") || fullRow.includes("TỔNG CỘNG") || fullRow.includes("ĐIỀU DƯỠNG")) return;

                        let maTS = "", tenTS = "", soLuong = 0;
                        if (idxTen !== -1 && idxQty !== -1) {
                            tenTS = cells[idxTen] || ""; maTS = idxMa !== -1 ? (cells[idxMa] || "") : ""; soLuong = parseInt(cells[idxQty], 10) || 0;
                        } else {
                            let qtyIndex = cells.findIndex((c, i) => i >= 1 && /^\d+$/.test(c) && parseInt(c, 10) > 0 && parseInt(c, 10) < 50);
                            if (qtyIndex !== -1) {
                                soLuong = parseInt(cells[qtyIndex], 10);
                                let textCells = cells.slice(0, qtyIndex).filter(c => !/^\d+$/.test(c));
                                if (textCells.length >= 2) {
                                    if (/[A-Z]{1,3}\s?\d+|\d{5,}/.test(textCells[0])) { maTS = textCells[0]; tenTS = textCells[1]; } 
                                    else { tenTS = textCells[0]; maTS = textCells[1]; }
                                } else if (textCells.length === 1) { tenTS = textCells[0]; }
                            }
                        }

                        if (tenTS && soLuong > 0 && !tenTS.toUpperCase().includes("TÊN TS") && !tenTS.toUpperCase().includes("BỘ SANH") && !tenTS.toUpperCase().includes("MỔ LẤY THAI")) {
                            chiTietLinhKien.push({ maLinhKien: maTS, tenLinhKien: tenTS, soLuong: soLuong });
                        }
                    });

                    if (chiTietLinhKien.length > 0 && tenBo) {
                        const tenBoClean = cleanSearchStr(tenBo);
                        mapAesculap[tenBo] = chiTietLinhKien;
                        mapAesculap[tenBoClean] = chiTietLinhKien;
                        if (tenBoClean.includes("MOLAYTHAI") || tenBoClean.includes("MOBATCON")) {
                            mapAesculap["MỔ LẤY THAI"] = chiTietLinhKien; mapAesculap["MOLAYTHAI"] = chiTietLinhKien;
                        }

                        (globalData.danhMucLinhKien || []).forEach(bo => {
                            const boClean = cleanSearchStr(bo.tenBo); const maClean = cleanSearchStr(bo.maBo);
                            if ((tenBoClean.includes("MOLAYTHAI") && (boClean.includes("MOLAYTHAI") || maClean.includes("MOLAYTHAI") || boClean.includes("MOBATCON"))) ||
                                (tenBoClean.includes("SANH") && !tenBoClean.includes("MOLAYTHAI") && (boClean === "BOSANH" || maClean === "SGSANH")) ||
                                boClean === tenBoClean || maClean === tenBoClean) {
                                bo.chiTietLinhKien = chiTietLinhKien;
                            }
                        });
                        totalSetsUpdated++;
                        danhSachTenBoCapNhat.push(`${tenBo} (${chiTietLinhKien.length} món)`);
                    }
                });
            } catch (err) { console.error(`Lỗi đọc file ${file.name}:`, err); }
        }

        localStorage.setItem('cssd_aesculapCatalog', JSON.stringify(mapAesculap));
        localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));

        if (db) db.collection("he_thong_config").doc(`danh_muc_${CURRENT_TENANT}`).set({ danhMucLinhKien: globalData.danhMucLinhKien, danhSachKhoa: globalData.danhSachKhoa, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        
        capNhatGiaoDienSauKhiNapExcel();
        alert(`🎉 ĐÃ BÓC TÁCH VÀ GHI ĐÈ THÀNH CÔNG ${totalSetsUpdated} BỘ DỤNG CỤ:\n- ${danhSachTenBoCapNhat.join("\n- ")}`);
    });
}
