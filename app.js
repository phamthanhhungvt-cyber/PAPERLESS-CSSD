/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (VERSION 4.8.1 - FINAL CACHE BUST)
   ========================================================================= */

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "cssd-system-2878c.firebaseapp.com",
    projectId: "cssd-system-2878c",
    storageBucket: "cssd-system-2878c.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Khởi tạo Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// KHỞI TẠO APP CHECK VỚI RECAPTCHA V3
if (typeof firebase !== 'undefined' && firebase.appCheck) {
    const appCheck = firebase.appCheck();
    // Dán SITE KEY của bạn vào đây (KHÔNG dán Secret Key)
    appCheck.activate(
        '6LeynPEtAAAAAEalPBsXM_2XwUjMv482Oyjp-oR5',
        true // Cho phép tự động làm mới token
    );
    console.log("🔒 [SECURITY] Firebase App Check (reCAPTCHA v3) đã được kích hoạt!");
}

const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
const storage = (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null;

if (db) {
    try {
        db.settings({
            experimentalForceLongPolling: true,
            useFetchStreams: false
        });
        console.log("⚡ [FIRESTORE CONFIG] Đã ép kết nối HTTP Long Polling thuần!");
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
    phieuTra: [],
    choRua: [],           
    dangRua: [],          
    choDongGoi: [],       
    choHap: [],           
    dangHap: [],          
    khoVoKhuan: [],       
    meRua: [],
    meHap: [],
    lichSu: [],
    danhMucLinhKien: [],
    danhSachKhoa: [],
    ktvList: [
        { id: 'NV01', name: 'Nguyễn Văn A', pin: '1234', role: 'CSSD' },
        { id: 'NV02', name: 'Trần Thị Thoa', pin: '1234', role: 'CSSD' },
        { id: 'NV03', name: 'Mai', pin: '1234', role: 'CSSD' },
        { id: 'ADMIN', name: 'ADMINISTRATOR', pin: '9999', role: 'ADMIN' }
    ]
};

let gioHangTraTam = [];
let tempSuDungKhay = [];
let itemDongGoiHienTai = null;
let currentRecallBatchId = "";
let anhBangChungDongGoiTam = null;

let currentQCBatchData = null;
let currentQCEvidenceImage = null;

let canvasKy = null;
let ctxKy = null;
let isDrawingKy = false;

let barcodeScannerBuffer = "";
let barcodeScannerTimer = null;
let isBarcodeScannerEnabled = true;

let aiVideoStream = null;

const SET_ALIAS_MAPPING = {
    "MOLAYTHAI": "MỔ LẤY THAI",
    "MO LAY THAI": "MỔ LẤY THAI",
    "BO MO LAY THAI": "MỔ LẤY THAI",
    "BỘ MỔ LẤY THAI": "MỔ LẤY THAI",
    "MO BAT CON": "MỔ LẤY THAI",
    "MỔ BẮT CON": "MỔ LẤY THAI",
    "SANH": "BỘ SANH",
    "BO SANH": "BỘ SANH",
    "BỘ SANH": "BỘ SANH",
    "NAO": "BỘ NẠO",
    "BO NAO": "BỘ NẠO",
    "BỘ NẠO": "BỘ NẠO",
    "KIEMCOL": "BỘ KIỂM COL",
    "KIEM COL": "BỘ KIỂM COL",
    "BỘ KIỂM COL": "BỘ KIỂM COL",
    "MAYTANGSINHMON": "MAY TẦNG SINH MÔN",
    "MAY TANG SINH MON": "MAY TẦNG SINH MÔN",
    "MAY TẦNG SINH MÔN": "MAY TẦNG SINH MÔN",
    "MAYTHAMMY": "BỘ MAY THẨM MỸ",
    "MAY THAM MY": "BỘ MAY THẨM MỸ",
    "BỘ MAY THẨM MỸ": "BỘ MAY THẨM MỸ",
    "KHAIKHIQUAN": "BỘ KHAI KHÍ QUẢN",
    "KHAI KHI QUAN": "BỘ KHAI KHÍ QUẢN",
    "BỘ KHAI KHÍ QUẢN": "BỘ KHAI KHÍ QUẢN",
    "UTPK": "UNG THƯ PHỤ KHOA",
    "UNG THU PHU KHOA": "UNG THƯ PHỤ KHOA",
    "UNG THƯ PHỤ KHOA": "UNG THƯ PHỤ KHOA",
    "MOCTC(HO)": "CẮT TỬ CUNG",
    "MO HO CAT TU CUNG": "CẮT TỬ CUNG",
    "CAT TU CUNG": "CẮT TỬ CUNG",
    "CẮT TỬ CUNG": "CẮT TỬ CUNG",
    "CTCNS(NB)": "CẮT TỬ CUNG NỘI SOI",
    "CAT TU CUNG NOI SOI": "CẮT TỬ CUNG NỘI SOI",
    "CẮT TỬ CUNG NỘI SOI": "CẮT TỬ CUNG NỘI SOI",
    "CTC(AD)": "PHẪU THUẬT NỘI SOI CẮT TỬ CUNG NGÃ ÂM ĐẠO",
    "CAT TU CUNG NGA AM DAO": "PHẪU THUẬT NỘI SOI CẮT TỬ CUNG NGÃ ÂM ĐẠO",
    "TIEUPHAU(NS)": "TIỂU PHẨU CHO NỘI SOI",
    "TIEU PHAU NOI SOI": "TIỂU PHẨU CHO NỘI SOI",
    "TIỂU PHẨU CHO NỘI SOI": "TIỂU PHẨU CHO NỘI SOI",
    "CATDOT": "CẮT ĐỐT",
    "CAT DOT": "CẮT ĐỐT",
    "CẮT ĐỐT": "CẮT ĐỐT",
    "TROCARXOAN": "BỘ TROCAR XOẮN",
    "TROCARTRON": "BỘ TROCAR TRƠN",
    "TROCARNHUAXOAN": "BỘ TROCAR NHỰA XOẮN",
    "NONG": "BỘ NONG",
    "BONONG": "BỘ NONG",
    "BỘ NONG": "BỘ NONG",
    "MAYCOL": "MAY NỘI SOI",
    "MAY COL": "MAY NỘI SOI",
    "MAYNOISOI": "MAY NỘI SOI",
    "MAY NỘI SOI": "MAY NỘI SOI",
    "ROBI": "KELLY ROBI",
    "DCGIAM1": "DỤNG CỤ GIẢM 1",
    "TIEUPHAUNHI": "TỔNG QUÁT NHI 1",
    "SOICTC": "BỘ SOI CỔ TỬ CUNG",
    "SOICOTUCUNG": "BỘ SOI CỔ TỬ CUNG",
    "BỘ SOI CỔ TỬ CUNG": "BỘ SOI CỔ TỬ CUNG",
    "DATVAVONG": "BỘ ĐẶT VÀ LẤY VÒNG",
    "DATVALAYVONG": "BỘ ĐẶT VÀ LẤY VÒNG",
    "BỘ ĐẶT VÀ LẤY VÒNG": "BỘ ĐẶT VÀ LẤY VÒNG",
    "SOSINH": "SƠ SINH",
    "SO SINH": "SƠ SINH",
    "SƠ SINH": "SƠ SINH",
    "NOISOI": "NỘI SOI",
    "NỘI SOI": "NỘI SOI",
    "TESE": "BỘ TESE/MICROTESE",
    "VIPHAUNAMKHOA": "VI PHẪU NAM KHOA",
    "TRUNGPHAUNAMKHOA": "TRUNG PHẪU NAM KHOA"
};

function cleanSearchStr(str) {
    return (str || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
}

function parseVietnameseDate(strDate) {
    if (!strDate) return null;
    if (strDate.includes('/')) {
        const parts = strDate.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    } else if (strDate.includes('-')) {
        const parts = strDate.split('-');
        if (parts[0].length === 4) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
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
        } catch (e) {
            console.warn("Crypto API fallback:", e);
        }
    }
    return `HASH_${Date.now().toString(16).toUpperCase()}`;
}

// =========================================================================
// 3. ĐỌC DỮ LIỆU LOCALSTORAGE & ĐỒNG BỘ CLOUD
// =========================================================================
function docDuLieuLuuTruLocalStorage() {
    try {
        const savedLinhKien = localStorage.getItem('cssd_danhMucLinhKien');
        const savedKhoa = localStorage.getItem('cssd_danhSachKhoa');
        if (savedLinhKien) globalData.danhMucLinhKien = JSON.parse(savedLinhKien) || [];
        if (savedKhoa) globalData.danhSachKhoa = JSON.parse(savedKhoa) || [];

        const savedPhieuTra = localStorage.getItem('cssd_phieuTra');
        if (savedPhieuTra) globalData.phieuTra = JSON.parse(savedPhieuTra) || [];

        const savedChoRua = localStorage.getItem('cssd_choRua');
        if (savedChoRua) globalData.choRua = JSON.parse(savedChoRua) || [];

        const savedDangRua = localStorage.getItem('cssd_dangRua');
        if (savedDangRua) globalData.dangRua = JSON.parse(savedDangRua) || [];

        const savedChoDongGoi = localStorage.getItem('cssd_choDongGoi');
        if (savedChoDongGoi) globalData.choDongGoi = JSON.parse(savedChoDongGoi) || [];

        const savedChoHap = localStorage.getItem('cssd_choHap');
        if (savedChoHap) globalData.choHap = JSON.parse(savedChoHap) || [];

        const savedDangHap = localStorage.getItem('cssd_dangHap');
        if (savedDangHap) globalData.dangHap = JSON.parse(savedDangHap) || [];

        const savedKhoVoKhuan = localStorage.getItem('cssd_khoVoKhuan');
        if (savedKhoVoKhuan) globalData.khoVoKhuan = JSON.parse(savedKhoVoKhuan) || [];

        const savedMeRua = localStorage.getItem('cssd_meRua');
        if (savedMeRua) globalData.meRua = JSON.parse(savedMeRua) || [];

        const savedMeHap = localStorage.getItem('cssd_meHap');
        if (savedMeHap) globalData.meHap = JSON.parse(savedMeHap) || [];

        capNhatGiaoDienSauKhiNapExcel();
        capNhatTatCaGiaoDien();
    } catch (err) {
        console.error("Lỗi đọc LocalStorage:", err);
    }
}

function capNhatTatCaGiaoDien() {
    renderBangChoThuGom();
    renderBangChoRua();
    renderBangChoNiemThuRua();
    renderBangDongGoi();
    renderBangChoHap();
    renderBangChoNghiemThuHap();
    renderBangKhoVoKhuan();
    renderBangTonKhoRealtime();
    renderDashboardTV();
    renderBangKPIPerformance();
    renderBangCongNoKhoa();
    renderBangLichSuHap();
}

function dongBoTrangThaiRealtime() {
    const payload = {
        phieuTra: globalData.phieuTra || [],
        choRua: globalData.choRua || [],
        dangRua: globalData.dangRua || [],
        choDongGoi: globalData.choDongGoi || [],
        choHap: globalData.choHap || [],
        dangHap: globalData.dangHap || [],
        khoVoKhuan: globalData.khoVoKhuan || [],
        meRua: globalData.meRua || [],
        meHap: globalData.meHap || [],
        updatedAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
    };

    localStorage.setItem('cssd_phieuTra', JSON.stringify(payload.phieuTra));
    localStorage.setItem('cssd_choRua', JSON.stringify(payload.choRua));
    localStorage.setItem('cssd_dangRua', JSON.stringify(payload.dangRua));
    localStorage.setItem('cssd_choDongGoi', JSON.stringify(payload.choDongGoi));
    localStorage.setItem('cssd_choHap', JSON.stringify(payload.choHap));
    localStorage.setItem('cssd_dangHap', JSON.stringify(payload.dangHap));
    localStorage.setItem('cssd_khoVoKhuan', JSON.stringify(payload.khoVoKhuan));
    localStorage.setItem('cssd_meRua', JSON.stringify(payload.meRua));
    localStorage.setItem('cssd_meHap', JSON.stringify(payload.meHap));

    if (db) {
        db.collection("he_thong_config").doc("trang_thai_realtime").set(payload, { merge: true })
            .catch(err => console.warn("Lưu realtime cloud tạm hoãn:", err.message));
    }
}

function initRealtimeListeners() {
    if (!db) return;

    db.collection("lich_su_luan_chuyen").orderBy("timestamp", "desc").limit(100)
        .onSnapshot((snapshot) => {
            globalData.lichSu = [];
            snapshot.forEach((doc) => globalData.lichSu.push({ id: doc.id, ...doc.data() }));
            renderBangLichSuLuanChuyen();
            renderBangKPIPerformance();
        }, (err) => console.warn("Firestore listeners bypass:", err.message));

    db.collection("he_thong_config").doc("danh_muc_master")
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data.danhMucLinhKien && data.danhMucLinhKien.length > 0) {
                    globalData.danhMucLinhKien = data.danhMucLinhKien;
                }
                if (data.danhSachKhoa && data.danhSachKhoa.length > 0) {
                    globalData.danhSachKhoa = data.danhSachKhoa;
                }
                
                localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));
                capNhatGiaoDienSauKhiNapExcel();
            }
        }, (err) => console.warn("Không lấy được danh mục Cloud:", err.message));

    db.collection("he_thong_config").doc("trang_thai_realtime")
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                globalData.phieuTra = Array.isArray(data.phieuTra) ? data.phieuTra : [];
                globalData.choRua = Array.isArray(data.choRua) ? data.choRua : [];
                globalData.dangRua = Array.isArray(data.dangRua) ? data.dangRua : [];
                globalData.choDongGoi = Array.isArray(data.choDongGoi) ? data.choDongGoi : [];
                globalData.choHap = Array.isArray(data.choHap) ? data.choHap : [];
                globalData.dangHap = Array.isArray(data.dangHap) ? data.dangHap : [];
                globalData.khoVoKhuan = Array.isArray(data.khoVoKhuan) ? data.khoVoKhuan : [];
                globalData.meRua = Array.isArray(data.meRua) ? data.meRua : [];
                globalData.meHap = Array.isArray(data.meHap) ? data.meHap : [];

                capNhatTatCaGiaoDien();
            }
        }, (err) => console.warn("Không lấy được trạng thái Realtime Cloud:", err.message));
}

// =========================================================================
// 4. CÁC HÀM RENDER GIAO DIỆN
// =========================================================================
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
    if (khoaSel) {
        khoaSel.onchange = function() {
            capNhatGoiYBoDungCuTheoKhoa(this.value);
            renderBangCongNoKhoa();
        };
    }

    const invSel = document.getElementById('inv_filterKhoa');
    if (invSel) {
        invSel.onchange = function() {
            renderBangTonKhoRealtime();
        };
    }

    capNhatGoiYBoDungCuTheoKhoa('');
    renderBangDanhMucLinhKien();
    renderBangCongNoKhoa();
    renderBangChoThuGom();
}

function capNhatGoiYBoDungCuTheoKhoa(tenKhoa) {
    const datalist = document.getElementById('listBoDungCu');
    if (!datalist) return;

    const filteredItems = tenKhoa 
        ? (globalData.danhMucLinhKien || []).filter(item => item && item.khoa === tenKhoa)
        : (globalData.danhMucLinhKien || []);

    datalist.innerHTML = filteredItems.map(item => 
        `<option value="${item.maBo || ''}">${item.tenBo \vert{}\vert{} ''} - [${item.khoa || ''}]</option>`
    ).join('');
}

function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    const items = selectedKhoa 
        ? (globalData.danhMucLinhKien || []).filter(i => i && i.khoa === selectedKhoa) 
        : (globalData.danhMucLinhKien || []);

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
            if (diffDays < 0) {
                dsCanhBaoHetHan.push(`${m.tenBo} (${m.maBo})`);
            } else if (diffDays <= 7) {
                dsCanhBaoSapHetHan.push(`${m.tenBo} (còn ${diffDays} ngày)`);
            }
        }
    });

    let alertBannerContainer = document.getElementById('khoa_alert_fefo_banner');
    if (!alertBannerContainer) {
        alertBannerContainer = document.createElement('div');
        alertBannerContainer.id = 'khoa_alert_fefo_banner';
        const parentArea = tbody.closest('.bg-white') || tbody.parentElement;
        if (parentArea && parentArea.parentElement) {
            parentArea.parentElement.insertBefore(alertBannerContainer, parentArea);
        }
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
    } else {
        alertBannerContainer.innerHTML = '';
    }

    tbody.innerHTML = items.map(item => {
        const listKhayCungMa = mamCuaKhoaTrongKho.filter(k => k.maBo === item.maBo);
        let noteHSD = '';

        listKhayCungMa.forEach(k => {
            const expDate = parseVietnameseDate(k.hanSuDung);
            if (expDate && !isNaN(expDate.getTime())) {
                const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                    noteHSD = `<span class="inline-block bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded mt-1 border border-rose-200 animate-pulse">🚨 Có mâm quá hạn (${k.hanSuDung})</span>`;
                } else if (diffDays <= 7 && !noteHSD) {
                    noteHSD = `<span class="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 border border-amber-200">⚠️ Còn ${diffDays} ngày (${k.hanSuDung})</span>`;
                }
            }
        });

        return `
            <tr class="border-b hover:bg-slate-50 text-xs">
                <td class="p-3 font-bold text-slate-800">
                    ${item.tenBo || 'N/A'} 
                    <span class="text-[10px] text-sky-600 block font-mono">${item.maBo || ''} (${item.khoa \vert{}\vert{} ''})</span>${noteHSD}
                </td>
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
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Chưa có dữ liệu danh mục.</td></tr>`;
        } else {
            tbody.innerHTML = (globalData.danhMucLinhKien || []).map(item => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-bold text-slate-800">${item.tenBo || ''} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo || ''}</span></td>
                    <td class="p-3 text-slate-600">${item.khoa || ''}</td>
                    <td class="p-3 text-center font-bold text-sky-700 bg-sky-50 rounded">${item.soLuong || 1}</td>
                </tr>
            `).join('');
        }
    }

    if (tbodyTong) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) {
            tbodyTong.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu khay dụng cụ.</td></tr>`;
        } else {
            tbodyTong.innerHTML = (globalData.danhMucLinhKien || []).map(item => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-mono font-bold text-sky-700">${item.maBo || ''}</td>
                    <td class="p-3 font-bold text-slate-800">${item.tenBo || ''}</td>
                    <td class="p-3 text-slate-600">${item.khoa || ''}</td>
                    <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Sẵn Sàng (${item.soLuong || 1})</span></td>
                </tr>
            `).join('');
        }
    }
}

// BẢNG THU GOM AN TOÀN CHỐNG CRASH LENGTH
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
        optionsHtml += khoasWithOrders.map(k => {
            const count = globalData.phieuTra.filter(p => p?.khoa === k).length;
            return `<option value="${k}" ${currentValue === k ? 'selected' : ''}>${k} (${count} lệnh)</option>`;
        }).join('');

        filterSelect.innerHTML = optionsHtml;
    }

    const selectedKhoa = filterSelect ? filterSelect.value : "";
    const filteredPhieu = selectedKhoa 
        ? globalData.phieuTra.filter(p => p && p.khoa === selectedKhoa)
        : globalData.phieuTra;

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
                    <button type="button" onclick="moPopupKiemDemThuGom(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all whitespace-nowrap">
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
    let items = (globalData.khoVoKhuan && globalData.khoVoKhuan.length > 0)
        ? globalData.khoVoKhuan 
        : (globalData.danhMucLinhKien || []);

    if (selectedKhoa) {
        items = items.filter(i => i && i.khoa === selectedKhoa);
    }

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

    if (!Array.isArray(globalData.choRua)) globalData.choRua = [];
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
                ${item.tenBo || ''}
                <span class="text-[10px] text-slate-400 block">${item.khoa || ''}</span>
            </td>
            <td class="p-2 text-right font-mono font-bold text-sky-700">${item.maBo || ''}</td>
        </tr>
    `).join('');
}

function renderBangChoNiemThuRua() {
    const tbody = document.getElementById('bangChoNiemThuRua');
    if (!tbody) return;

    if (!Array.isArray(globalData.dangRua)) globalData.dangRua = [];

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
    if (!Array.isArray(globalData.meRua) || globalData.meRua.length === 0) {
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

    if (!Array.isArray(globalData.choDongGoi)) globalData.choDongGoi = [];
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

    if (!Array.isArray(globalData.choHap)) globalData.choHap = [];
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
                ${item.tenBo || ''}
                <span class="text-[10px] text-slate-400 block">${item.vatLieuBaoBoc \vert{}\vert{} ''} - HSD:${item.hanSuDung || ''}</span>
            </td>
            <td class="p-2 text-right font-mono font-bold text-purple-700">${item.maBo || ''}</td>
        </tr>
    `).join('');
}

function renderBangChoNghiemThuHap() {
    const tbody = document.getElementById('bangChoNghiệmThu');
    if (!tbody) return;

    if (!Array.isArray(globalData.dangHap)) globalData.dangHap = [];

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

// BẢNG KHO VÔ KHUẨN & XUẤT KHO THEO CHUẨN FEFO
function renderBangKhoVoKhuan() {
    const tbody = document.getElementById('bangKhoVoKhuan');
    if (!tbody) return;

    if (!Array.isArray(globalData.khoVoKhuan)) globalData.khoVoKhuan = [];

    if (globalData.khoVoKhuan.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-slate-400">Kho vô khuẩn hiện đang trống. Chưa có mâm dụng cụ nào sẵn sàng.</td></tr>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    globalData.khoVoKhuan.forEach(item => {
        const expDate = parseVietnameseDate(item.hanSuDung);
        if (expDate && !isNaN(expDate.getTime())) {
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            item._diffDays = diffDays;
            item._expTimestamp = expDate.getTime();
        } else {
            item._diffDays = 999;
            item._expTimestamp = 9999999999999;
        }
    });

    globalData.khoVoKhuan.sort((a, b) => a._expTimestamp - b._expTimestamp);

    tbody.innerHTML = globalData.khoVoKhuan.map((item, idx) => {
        const diffDays = item._diffDays;
        let badgeHSD = '';
        let actionBtn = '';

        if (diffDays < 0) {
            badgeHSD = `
                <span class="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-rose-200">
                    <i class="fa-solid fa-triangle-exclamation text-rose-600 animate-pulse"></i>
                    ĐÃ HẾT HẠN (${item.hanSuDung || 'N/A'})
                </span>
            `;
            actionBtn = `
                <button onclick="thuHoiMamHetHanVeRua(${idx})" class="bg-rose-600 hover:bg-rose-700 text-white
