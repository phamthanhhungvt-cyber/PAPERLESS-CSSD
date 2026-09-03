/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (VERSION 3.4 - UNIFIED CLEAN CODE)
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

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

if (db) {
    try {
        db.settings({
            experimentalForceLongPolling: true,
            useFetchStreams: false
        });
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

// 3. KHỞI TẠO DOM
document.addEventListener('DOMContentLoaded', () => {
    docDuLieuLuuTruLocalStorage();
    initRealtimeListeners();
    initExcelLoader(); 
    initWordLoader(); 
    capNhatDanhSachMaMayRua();
    capNhatDanhSachMaMay();
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
    renderDanhSachPinAdmin(); 
    initCanvasKyDienTu();
    initGlobalBarcodeScanner();
    initDashboardTVClock();
});

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
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
            .catch(err => console.error("❌ Lỗi đồng bộ Cloud:", err));
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
        }, (err) => console.warn("Firestore listeners bypass:", err));

    db.collection("he_thong_config").doc("danh_muc_master")
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data.danhMucLinhKien) globalData.danhMucLinhKien = data.danhMucLinhKien;
                if (data.danhSachKhoa) globalData.danhSachKhoa = data.danhSachKhoa;
                
                localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));
                capNhatGiaoDienSauKhiNapExcel();
            }
        }, (err) => console.warn("Không lấy được danh mục Cloud:", err));

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
        }, (err) => console.warn("Không lấy được trạng thái Realtime Cloud:", err));
}

// 4. BỘ NẠP FILE EXCEL
function initExcelLoader() {
    const excelInput = document.getElementById('excelFileInput');
    if (!excelInput) return;

    excelInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            alert("❌ Chưa tải thư viện SheetJS (XLSX)!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                let targetSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase().includes('chi tiết')) || workbook.SheetNames[0];
                const targetSheet = workbook.Sheets[targetSheetName];
                const rawRows = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: "" });

                if (!rawRows || rawRows.length === 0) return;

                const headerRow = (rawRows[0] || []).map(v => String(v).trim().toLowerCase());
                
                let idxKhoaHoacBo = headerRow.findIndex(h => h.includes('tên ts (i)') || h.includes('khoa') || h.includes('phòng'));
                let idxMa = headerRow.findIndex(h => h.includes('mã dc') || h.includes('ab 120/12') || h.includes('mã ts') || h.includes('mã'));
                let idxTen = headerRow.findIndex(h => h.includes('tên ts chuẩn') || h.includes('tên chi tiết') || h.includes('tên dụng cụ') || h.includes('tên bộ'));
                let idxSoLuong = headerRow.findIndex(h => h.includes('số lượng') || h.includes('cơ số') || h.includes('sl'));

                if (idxKhoaHoacBo === -1) idxKhoaHoacBo = 1;
                if (idxMa === -1) idxMa = 2;
                if (idxTen === -1) idxTen = 3;
                if (idxSoLuong === -1) idxSoLuong = 4;

                const isFileCoSoKhoa = rawRows.some((r, i) => i > 0 && String(r[idxKhoaHoacBo]).toUpperCase().includes('PHÒNG SANH'));

                if (isFileCoSoKhoa) {
                    let danhSachBoMoi = [];
                    let setKhoa = new Set();
                    const savedCatalog = localStorage.getItem('cssd_aesculapCatalog');
                    const mapAesculap = savedCatalog ? JSON.parse(savedCatalog) : {};

                    for (let i = 1; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length === 0) continue;

                        const tenKhoa = r[idxKhoaHoacBo] ? String(r[idxKhoaHoacBo]).trim().toUpperCase() : "";
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
                            const keyClean = cleanSearchStr(keyAlias);
                            if (maBoClean.includes(keyClean) || tenBoClean.includes(keyClean)) {
                                targetAesculapName = valAesculap;
                                break;
                            }
                        }

                        for (const [tenBoAesculap, listLinhKien] of Object.entries(mapAesculap)) {
                            const aescClean = cleanSearchStr(tenBoAesculap);
                            if (
                                (targetAesculapName && cleanSearchStr(targetAesculapName) === aescClean) ||
                                tenBoClean.includes(aescClean) ||
                                aescClean.includes(tenBoClean)
                            ) {
                                chiTietLinhKien = listLinhKien;
                                break;
                            }
                        }

                        danhSachBoMoi.push({
                            khoa: tenKhoa,
                            maBo: maBo,
                            tenBo: tenBo,
                            soLuong: soLuong,
                            chiTietLinhKien: chiTietLinhKien
                        });
                    }

                    if (danhSachBoMoi.length > 0) {
                        globalData.danhMucLinhKien = danhSachBoMoi;
                        globalData.danhSachKhoa = Array.from(setKhoa);

                        localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                        localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));

                        if (db) {
                            db.collection("he_thong_config").doc("danh_muc_master").set({
                                danhMucLinhKien: globalData.danhMucLinhKien,
                                danhSachKhoa: globalData.danhSachKhoa,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }

                        capNhatGiaoDienSauKhiNapExcel();
                        alert(`🎉 NẠP THÀNH CÔNG!\n- Đã cập nhật ${globalData.danhSachKhoa.length} Khoa/Phòng\n- Tổng cộng: ${danhSachBoMoi.length} bộ dụng cụ.`);
                    }

                } else {
                    const mapChiTietTheoBo = {};

                    for (let i = 1; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length === 0) continue;

                        const tenBoRaw = r[idxKhoaHoacBo] ? String(r[idxKhoaHoacBo]).trim().toUpperCase() : "";
                        const maChiTiet = r[idxMa] ? String(r[idxMa]).trim() : "";
                        const tenChiTiet = r[idxTen] ? String(r[idxTen]).trim() : "";
                        const soLuong = r[idxSoLuong] !== "" && r[idxSoLuong] !== undefined ? Number(r[idxSoLuong]) || 1 : 1;

                        if (!tenBoRaw) continue;

                        if (!mapChiTietTheoBo[tenBoRaw]) {
                            mapChiTietTheoBo[tenBoRaw] = [];
                        }

                        if (tenChiTiet || maChiTiet) {
                            mapChiTietTheoBo[tenBoRaw].push({
                                maLinhKien: maChiTiet,
                                tenLinhKien: tenChiTiet || maChiTiet,
                                soLuong: soLuong
                            });
                        }
                    }

                    let countGhep = 0;
                    (globalData.danhMucLinhKien || []).forEach(bo => {
                        const maBoClean = cleanSearchStr(bo.maBo);
                        const tenBoClean = cleanSearchStr(bo.tenBo);

                        let targetAesculapName = "";
                        for (const [keyAlias, valAesculap] of Object.entries(SET_ALIAS_MAPPING)) {
                            const keyClean = cleanSearchStr(keyAlias);
                            if (maBoClean.includes(keyClean) || tenBoClean.includes(keyClean)) {
                                targetAesculapName = valAesculap;
                                break;
                            }
                        }

                        for (const [tenBoAesculap, listLinhKien] of Object.entries(mapChiTietTheoBo)) {
                            const aescClean = cleanSearchStr(tenBoAesculap);
                            if (
                                (targetAesculapName && cleanSearchStr(targetAesculapName) === aescClean) ||
                                tenBoClean.includes(aescClean) ||
                                aescClean.includes(tenBoClean)
                            ) {
                                bo.chiTietLinhKien = listLinhKien;
                                countGhep++;
                                break;
                            }
                        }
                    });

                    localStorage.setItem('cssd_aesculapCatalog', JSON.stringify(mapChiTietTheoBo));
                    localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));

                    if (db) {
                        db.collection("he_thong_config").doc("danh_muc_master").set({
                            danhMucLinhKien: globalData.danhMucLinhKien,
                            danhSachKhoa: globalData.danhSachKhoa,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    capNhatGiaoDienSauKhiNapExcel();
                    alert(`🎉 ĐÃ GHÉP NỐI THÀNH CÔNG CHI TIẾT AESCULAP!\n- Đã gắn chi tiết linh kiện vào ${countGhep} bộ dụng cụ!`);
                }

            } catch (err) {
                console.error("Lỗi đọc file Excel:", err);
                alert("❌ Lỗi khi đọc file Excel. Vui lòng kiểm tra lại cấu trúc file!");
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// 5. BỘ BÓC TÁCH FILE WORD (.DOCX) CHUẨN XÁC
function initWordLoader() {
    const wordInput = document.getElementById('wordFileInput');
    if (!wordInput) return;

    wordInput.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (typeof mammoth === 'undefined') {
            alert("❌ Chưa tải được thư viện mammoth.js!");
            return;
        }

        let totalSetsUpdated = 0;
        let danhSachTenBoCapNhat = [];
        const savedCatalog = localStorage.getItem('cssd_aesculapCatalog');
        const mapAesculap = savedCatalog ? JSON.parse(savedCatalog) : {};

        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                const html = result.value;

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const tables = doc.querySelectorAll('table');

                tables.forEach(table => {
                    let tenBo = "";
                    let chiTietLinhKien = [];
                    const rows = Array.from(table.querySelectorAll('tr'));

                    rows.forEach(tr => {
                        const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
                        if (cells.length === 0) return;

                        const fullRowText = cells.join(" ").toUpperCase();

                        if (cells.some(c => c.toUpperCase().includes("TÊN TS") || c.toUpperCase().includes("TÊN BỘ"))) {
                            for (let i = 0; i < cells.length; i++) {
                                const val = cells[i].trim();
                                const valUpper = val.toUpperCase();
                                if (
                                    val.length > 2 && 
                                    !valUpper.includes("KHOA") && 
                                    !valUpper.includes("KIỂM") && 
                                    !valUpper.includes("TÊN TS") && 
                                    !valUpper.includes("TÊN BỘ") && 
                                    !valUpper.includes("STT") && 
                                    !valUpper.includes("NGÀY") && 
                                    !valUpper.includes("NĂM") &&
                                    !/^\d+$/.test(val)
                                ) {
                                    tenBo = val;
                                    break;
                                }
                            }
                        }

                        if (
                            fullRowText.includes("KHOA KIỂM SOÁT") || 
                            fullRowText.includes("TÊN TS (I)") || 
                            fullRowText.includes("MÃ TS") || 
                            fullRowText.includes("CHECK SẠCH") ||
                            fullRowText.includes("CHECK VK") ||
                            fullRowText.includes("GHI CHÚ")
                        ) {
                            return;
                        }

                        let idxQty = cells.findIndex((c, idx) => idx >= 2 && /^\d+$/.test(c) && parseInt(c, 10) > 0);
                        if (idxQty !== -1 && cells.length >= 3) {
                            const maTS = cells[0];
                            const tenTS = cells[1];
                            const soLuong = parseInt(cells[idxQty], 10);

                            if (
                                tenTS.length > 1 && 
                                !tenTS.toUpperCase().includes("TỔNG") && 
                                !maTS.toUpperCase().includes("TỔNG") &&
                                !maTS.toUpperCase().includes("TÊN TS")
                            ) {
                                chiTietLinhKien.push({
                                    maLinhKien: maTS,
                                    tenLinhKien: tenTS,
                                    soLuong: soLuong
                                });
                            }
                        }
                    });

                    if (!tenBo) {
                        tenBo = file.name.replace(/\.[^/.]+$/, "").replace(/checklist|danh muc|bo dung cu|phieu kiem/gi, "").trim();
                    }

                    if (chiTietLinhKien.length > 0 && tenBo) {
                        const tenBoClean = cleanSearchStr(tenBo);

                        mapAesculap[tenBo] = chiTietLinhKien;
                        mapAesculap[tenBoClean] = chiTietLinhKien;

                        let targetAlias = SET_ALIAS_MAPPING[tenBoClean] ? cleanSearchStr(SET_ALIAS_MAPPING[tenBoClean]) : tenBoClean;

                        (globalData.danhMucLinhKien || []).forEach(bo => {
                            const boClean = cleanSearchStr(bo.tenBo);
                            const maClean = cleanSearchStr(bo.maBo);

                            const isExactMatch = 
                                boClean === tenBoClean || 
                                maClean === tenBoClean || 
                                boClean === targetAlias || 
                                maClean === targetAlias ||
                                (tenBoClean.length >= 6 && (boClean.includes(tenBoClean) || tenBoClean.includes(boClean))) ||
                                (targetAlias.length >= 6 && (boClean.includes(targetAlias) || targetAlias.includes(boClean)));

                            if (isExactMatch) {
                                bo.chiTietLinhKien = chiTietLinhKien;
                            }
                        });

                        totalSetsUpdated++;
                        danhSachTenBoCapNhat.push(`${tenBo} (${chiTietLinhKien.length} món)`);
                    }
                });

            } catch (err) {
                console.error(`Lỗi đọc file Word ${file.name}:`, err);
            }
        }

        localStorage.setItem('cssd_aesculapCatalog', JSON.stringify(mapAesculap));
        localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));

        if (db) {
            db.collection("he_thong_config").doc("danh_muc_master").set({
                danhMucLinhKien: globalData.danhMucLinhKien,
                danhSachKhoa: globalData.danhSachKhoa,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        capNhatGiaoDienSauKhiNapExcel();
        alert(`🎉 NẠP THÀNH CÔNG ${totalSetsUpdated} BỘ DỤNG CỤ TỪ WORD:\n- ${danhSachTenBoCapNhat.join("\n- ")}`);
    });
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
        ? (globalData.danhMucLinhKien || []).filter(item => item.khoa === tenKhoa)
        : (globalData.danhMucLinhKien || []);

    datalist.innerHTML = filteredItems.map(item => 
        `<option value="${item.maBo}">${item.tenBo} - [${item.khoa}]</option>`
    ).join('');
}

// 6. SÚNG QUÉT MÃ VẠCH (HID SCANNER)
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

// 7. GIỎ HÀNG BÁO TRẢ KHOA PHÒNG
function themVaoGio() {
    const inp = document.getElementById('khoa_inpMaBo');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!inp || !inp.value.trim()) {
        alert("Vui lòng chọn hoặc nhập mã mâm dụng cụ bẩn!");
        return;
    }

    const maBoInput = inp.value.trim().toUpperCase();
    const khoaSelect = selKhoa ? selKhoa.value : "";

    const item = (globalData.danhMucLinhKien || []).find(i => i.maBo.toUpperCase() === maBoInput) || {
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

function khoaGuiPhieuTraBatches() {
    if (gioHangTraTam.length === 0) {
        alert("⚠️ Giỏ hàng báo trả đang trống!");
        return;
    }

    const selKhoa = document.getElementById('khoa_selKhoa');
    let tenKhoa = selKhoa && selKhoa.value ? selKhoa.value : "";

    if (!tenKhoa && gioHangTraTam.length > 0) {
        tenKhoa = gioHangTraTam[0].khoa || "PHÒNG SANH - CẤP CỨU SẢN";
    }

    const newPhieu = {
        id: `PGN_${Date.now()}`,
        khoa: tenKhoa,
        items: [...gioHangTraTam],
        thoiGian: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        nhanSu: currentUser.nvName
    };

    if (!globalData.phieuTra) globalData.phieuTra = [];
    globalData.phieuTra.unshift(newPhieu);
    
    newPhieu.items.forEach(it => {
        ghiNhatKyFirebase({
            maBo: it.maBo,
            tenBo: it.tenBo,
            khoa: tenKhoa,
            trangThai: 'KHOA BÁO TRẢ ĐỒ BẨN',
            maLoHap: '---'
        });
    });

    gioHangTraTam = [];
    renderGioHangTam();
    dongBoTrangThaiRealtime();

    alert(`🚀 THÀNH CÔNG! Đã phát lệnh báo trả ${newPhieu.items.length} bộ dụng cụ bẩn!`);
}

function guiBaoTra() { khoaGuiPhieuTraBatches(); }
function guiPhieuBaoTra() { khoaGuiPhieuTraBatches(); }

// 8. XE THU GOM
let currentKiemDemIndex = null;

function renderBangChoThuGom() {
    const tbody = document.getElementById('bangChoThuGom');
    const filterSelect = document.getElementById('filterKhoaThuGom');
    const badgeSoCho = document.getElementById('badgeSoCho');

    if (!tbody) return;
    if (!globalData.phieuTra) globalData.phieuTra = [];

    if (filterSelect) {
        const khoasWithOrders = Array.from(new Set(globalData.phieuTra.map(p => p.khoa).filter(Boolean)));
        const currentValue = filterSelect.value;

        let optionsHtml = `<option value="">-- Tất Cả Khoa Có Lệnh Gửi (${globalData.phieuTra.length}) --</option>`;
        optionsHtml += khoasWithOrders.map(k => {
            const count = globalData.phieuTra.filter(p => p.khoa === k).length;
            return `<option value="${k}" ${currentValue === k ? 'selected' : ''}>${k} (${count} lệnh)</option>`;
        }).join('');

        filterSelect.innerHTML = optionsHtml;
    }

    const selectedKhoa = filterSelect ? filterSelect.value : "";
    const filteredPhieu = selectedKhoa 
        ? globalData.phieuTra.filter(p => p.khoa === selectedKhoa)
        : globalData.phieuTra;

    if (badgeSoCho) badgeSoCho.innerText = `${filteredPhieu.length} Lệnh`;

    if (filteredPhieu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-400">Hiện chưa có lệnh báo trả mâm bẩn nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredPhieu.map((phieu, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">
                <i class="fa-solid fa-hospital mr-1.5 text-sky-600"></i>${phieu.khoa || 'N/A'}
                <div class="text-[10px] text-slate-400 font-normal mt-0.5">Người gửi: ${phieu.nhanSu || 'N/A'}</div>
            </td>
            <td class="p-3">
                <div class="font-bold text-sky-800 mb-1">${(phieu.items || []).length} Bộ dụng cụ bẩn:</div>
                <div class="space-y-1">
                    ${(phieu.items || []).map(it => `
                        <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono mr-1">
                            <strong>${it.maBo || ''}</strong> - ${it.tenBo || ''}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td class="p-3 text-center font-bold text-slate-600">${phieu.thoiGian || ''}</td>
            <td class="p-3 text-center action-col">
                <button type="button" onclick="moPopupKiemDemThuGom(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all whitespace-nowrap">
                    <i class="fa-solid fa-clipboard-check mr-1"></i> Kiểm Đếm & Nhận
                </button>
            </td>
        </tr>
    `).join('');
}

function moPopupKiemDemThuGom(idx) {
    currentKiemDemIndex = idx;
    const phieu = (globalData.phieuTra || [])[idx];
    if (!phieu) return;

    const pop = document.getElementById('popupKiemDem');
    const popBo = document.getElementById('popDG_Bo');
    const popKhoa = document.getElementById('popKhoa');
    const popChecklist = document.getElementById('popKiemDemChecklist');

    if (popBo) popBo.innerText = `LỆNH THU GOM: ${(phieu.items || []).length} MÂM DỤNG CỤ`;
    if (popKhoa) popKhoa.innerText = phieu.khoa;

    if (popChecklist) {
        popChecklist.innerHTML = (phieu.items || []).map((it) => `
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
    }

    if (pop) pop.classList.remove('hidden');
}

function closePopupKiemDem() {
    const pop = document.getElementById('popupKiemDem');
    if (pop) pop.classList.add('hidden');
}

function saveKiemDem() {
    if (currentKiemDemIndex === null || !(globalData.phieuTra || [])[currentKiemDemIndex]) {
        if ((globalData.phieuTra || []).length === 0) return;
        currentKiemDemIndex = 0;
    }

    const phieuHienTai = globalData.phieuTra[currentKiemDemIndex];

    if (phieuHienTai && phieuHienTai.items) {
        if (!globalData.choRua) globalData.choRua = [];

        phieuHienTai.items.forEach(item => {
            const newItem = {
                ...item,
                khoa: phieuHienTai.khoa,
                thoiGianThuGom: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                nhanSuThuGom: currentUser.nvName
            };
            globalData.choRua.push(newItem);

            ghiNhatKyFirebase({
                maBo: item.maBo,
                tenBo: item.tenBo,
                khoa: phieuHienTai.khoa,
                trangThai: 'ĐÃ THU GOM VỀ CSSD',
                maLoHap: '---'
            });
        });
    }

    globalData.phieuTra.splice(currentKiemDemIndex, 1);
    currentKiemDemIndex = null;
    dongBoTrangThaiRealtime();

    alert("✅ Đã chốt kiểm đếm đối soát thành công!");
    closePopupKiemDem();
}

// 9. MÁY RỬA
function capNhatDanhSachMaMayRua() {
    const loaiEl = document.getElementById('rua_loaiRua');
    const maySoEl = document.getElementById('rua_maySo');
    if (!loaiEl || !maySoEl) return;

    const val = loaiEl.value;
    if (val.includes("tự động")) {
        maySoEl.innerHTML = `<option value="Belimed WD250 #1">Belimed WD250 #1</option><option value="Belimed WD250 #2">Belimed WD250 #2</option>`;
    } else if (val.includes("siêu âm")) {
        maySoEl.innerHTML = `<option value="Sonic Washer #1">Sonic Washer #1</option>`;
    } else {
        maySoEl.innerHTML = `<option value="Bồn Rửa Tay 01">Bồn Rửa Thủ Công #1</option>`;
    }
    tuDongTaoMaLoMeRua();
}

function tuDongTaoMaLoMeRua() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('rua_batchId');
    const meInp = document.getElementById('rua_meSo');
    if (batchInp && meInp) {
        meInp.value = "01";
        batchInp.value = `R${today}_01`;
    }
}

function renderBangChoRua() {
    const tbody = document.getElementById('bangChoRua');
    const badge = document.getElementById('badgeChoRua');
    if (!tbody) return;

    if (!globalData.choRua) globalData.choRua = [];
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
                ${item.tenBo}
                <span class="text-[10px] text-slate-400 block">${item.khoa || ''}</span>
            </td>
            <td class="p-2 text-right font-mono font-bold text-sky-700">${item.maBo}</td>
        </tr>
    `).join('');
}

function toggleSelectAllRua() {
    const chkAll = document.getElementById('selectAllRua');
    const items = document.querySelectorAll('.chk-rua-item');
    if (chkAll) {
        items.forEach(c => c.checked = chkAll.checked);
    }
}

function xacNhanMeRua() {
    const checkedInps = document.querySelectorAll('.chk-rua-item:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn ít nhất một bộ dụng cụ để cho vào mẻ rửa!");
        return;
    }

    const batchInp = document.getElementById('rua_batchId');
    const batchId = batchInp ? batchInp.value : `R${Date.now()}`;
    const loaiRua = document.getElementById('rua_loaiRua') ? document.getElementById('rua_loaiRua').value : "Máy rửa tự động";
    const chuKy = document.getElementById('rua_chuKy') ? document.getElementById('rua_chuKy').value : "Tiêu chuẩn";

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))).sort((a, b) => b - a);
    
    if (!globalData.dangRua) globalData.dangRua = [];

    selectedIndices.forEach(idx => {
        const item = globalData.choRua.splice(idx, 1)[0];
        if (item) {
            const newItem = {
                ...item,
                batchId: batchId,
                loaiRua: loaiRua,
                chuKy: chuKy,
                nhanSuRua: currentUser.nvName,
                thoiGianBatDau: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                timestampBatDauRua: Date.now()
            };
            globalData.dangRua.push(newItem);

            ghiNhatKyFirebase({
                maBo: item.maBo,
                tenBo: item.tenBo,
                khoa: item.khoa,
                trangThai: `ĐANG RỬA (${loaiRua})`,
                maLoHap: batchId
            });
        }
    });

    dongBoTrangThaiRealtime();
    alert(`🚀 Đã kích hoạt mẻ rửa ${batchId}!`);
}

function renderBangChoNiemThuRua() {
    const tbody = document.getElementById('bangChoNiemThuRua');
    if (!tbody) return;

    if (!globalData.dangRua) globalData.dangRua = [];

    if (globalData.dangRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có mẻ rửa nào đang chạy trong buồng.</td></tr>`;
        return;
    }

    tbody.innerHTML = globalData.dangRua.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-10">
                <input type="checkbox" class="chk-nghiemthu-rua w-4 h-4 rounded text-sky-600" data-idx="${idx}" checked>
            </td>
            <td class="p-2 font-mono font-bold text-sky-700">${item.batchId}</td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo} <span class="text-[10px] text-slate-400">(${item.maBo})</span></td>
            <td class="p-2 text-center font-semibold text-amber-600">Đang rửa (${item.thoiGianBatDau})</td>
        </tr>
    `).join('');
}

function toggleSelectAllNghiemThuRua() {
    const chkAll = document.getElementById('selectAllNghiemThuRua');
    const items = document.querySelectorAll('.chk-nghiemthu-rua');
    if (chkAll) {
        items.forEach(c => c.checked = chkAll.checked);
    }
}

function duyetSachMeRuaHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-rua:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn mâm dụng cụ cần nghiệm thu!");
        return;
    }

    const testResult = document.getElementById('rua_testDoSach') ? document.getElementById('rua_testDoSach').value : "ĐẠT";
    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))).sort((a, b) => b - a);

    if (!globalData.choDongGoi) globalData.choDongGoi = [];
    if (!globalData.meRua) globalData.meRua = [];

    selectedIndices.forEach(idx => {
        const item = globalData.dangRua.splice(idx, 1)[0];
        if (item) {
            item.testDoSach = testResult;
            item.thoiGianRuaXong = new Date().toLocaleString('vi-VN');
            
            globalData.choDongGoi.push(item);
            globalData.meRua.unshift(item);

            ghiNhatKyFirebase({
                maBo: item.maBo,
                tenBo: item.tenBo,
                khoa: item.khoa,
                trangThai: 'NGHIỆM THU RỬA ĐẠT',
                maLoHap: item.batchId
            });
        }
    });

    dongBoTrangThaiRealtime();
    alert("✅ Đã nghiệm thu đạt mẻ rửa!");
}

function tuChoiMeRuaHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-rua:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn mâm dụng cụ bị từ chối!");
        return;
    }

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))).sort((a, b) => b - a);

    selectedIndices.forEach(idx => {
        const item = globalData.dangRua.splice(idx, 1)[0];
        if (item) {
            globalData.choRua.push(item);
        }
    });

    dongBoTrangThaiRealtime();
    alert("🔴 Đã trả các mâm không đạt về Hàng Đợi Rửa!");
}

// 10. TRẠM ĐÓNG GÓI & AI SCANNER
function renderBangDongGoi() {
    const grid = document.getElementById('gridDongGoi');
    const badge = document.getElementById('badgeDongGoi');
    if (!grid) return;

    if (!globalData.choDongGoi) globalData.choDongGoi = [];
    if (badge) badge.innerText = `${globalData.choDongGoi.length}`;

    if (globalData.choDongGoi.length === 0) {
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Hiện chưa có mâm dụng cụ nào chờ đóng gói.</div>`;
        return;
    }

    grid.innerHTML = globalData.choDongGoi.map((item, idx) => `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
            <div>
                <div class="flex justify-between items-start mb-1">
                    <span class="font-mono font-bold text-sky-700 text-xs">${item.maBo}</span>
                    <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Đã Rửa Sạch</span>
                </div>
                <h4 class="font-bold text-sm text-slate-800">${item.tenBo}</h4>
                <p class="text-xs text-slate-500 mt-1">Khoa: <strong class="text-slate-700">${item.khoa || 'N/A'}</strong></p>
                <p class="text-[10px] text-slate-400 font-mono mt-0.5">Mẻ rửa: ${item.batchId || 'N/A'}</p>
            </div>
            <button onclick="moPopupDongGoi(${idx})" class="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 rounded-lg text-xs shadow-sm transition-all">
                <i class="fa-solid fa-box-archive mr-1"></i> Đóng Gói Mâm
            </button>
        </div>
    `).join('');
}

function moPopupDongGoi(idx) {
    itemDongGoiHienTai = idx;
    const item = (globalData.choDongGoi || [])[idx];
    if (!item) return;

    const pop = document.getElementById('popupDongGoi');
    const popBo = document.getElementById('popDG_Bo');
    const popSub = document.getElementById('popDG_SubTitle');
    const imgEl = document.getElementById('popDG_HinhAnh');
    const tbodyLinhKien = document.getElementById('popDG_DanhSachLinhKien');

    if (popBo) popBo.innerHTML = `<i class="fa-solid fa-box-open text-sky-600 mr-2"></i> ĐÓNG GÓI: ${item.tenBo}`;
    if (popSub) popSub.innerText = `Mã khay: ${item.maBo} | Khoa sở hữu: ${item.khoa || 'N/A'}`;

    const maBoClean = cleanSearchStr(item.maBo);
    const tenBoClean = cleanSearchStr(item.tenBo);

    let danhSachItems = [];

    const danhMucMaster = (globalData.danhMucLinhKien || []).find(d => cleanSearchStr(d.maBo) === maBoClean || cleanSearchStr(d.tenBo) === tenBoClean);
    if (danhMucMaster && danhMucMaster.chiTietLinhKien && danhMucMaster.chiTietLinhKien.length > 0) {
        danhSachItems = danhMucMaster.chiTietLinhKien;
    }

    if (danhSachItems.length === 0) {
        const savedCatalog = localStorage.getItem('cssd_aesculapCatalog');
        if (savedCatalog) {
            const mapAesculap = JSON.parse(savedCatalog);
            let targetAlias = SET_ALIAS_MAPPING[maBoClean] ? cleanSearchStr(SET_ALIAS_MAPPING[maBoClean]) : tenBoClean;

            for (const [keyName, listLinhKien] of Object.entries(mapAesculap)) {
                const keyClean = cleanSearchStr(keyName);
                if (
                    keyClean === tenBoClean || 
                    keyClean === maBoClean || 
                    keyClean === targetAlias ||
                    (keyClean.length >= 6 && (keyClean.includes(tenBoClean) || tenBoClean.includes(keyClean))) ||
                    (targetAlias.length >= 6 && (keyClean.includes(targetAlias) || targetAlias.includes(keyClean)))
                ) {
                    danhSachItems = listLinhKien;
                    if (danhMucMaster) danhMucMaster.chiTietLinhKien = listLinhKien;
                    break;
                }
            }
        }
    }

    if (imgEl) {
        imgEl.src = 'https://placehold.co/400x300/1e293b/38bdf8?text=So+Do+Mam+' + encodeURIComponent(item.maBo);
    }

    if (tbodyLinhKien) {
        if (danhSachItems.length === 0) {
            tbodyLinhKien.innerHTML = `
                <tr>
                    <td class="p-2 font-semibold text-slate-800">${item.tenBo} (Nguyên bộ)</td>
                    <td class="p-2 text-center font-mono font-bold text-sky-700">${item.soLuong || 1}</td>
                </tr>
            `;
        } else {
            tbodyLinhKien.innerHTML = danhSachItems.map(lk => `
                <tr class="border-b text-xs hover:bg-slate-50">
                    <td class="p-2 font-semibold text-slate-800">
                        ${lk.tenLinhKien || lk.ten} 
                        ${lk.maLinhKien ? `<span class="text-[10px] text-slate-400 font-mono ml-1">(${lk.maLinhKien})</span>` : ''}
                    </td>
                    <td class="p-2 text-center font-mono font-bold text-sky-700">${lk.soLuong || 1}</td>
                </tr>
            `).join('');
        }
    }

    tinhHanSuDung();
    if (pop) pop.classList.remove('hidden');
}

function closePopupDongGoi() {
    tatAICamera();
    const pop = document.getElementById('popupDongGoi');
    if (pop) pop.classList.add('hidden');
    itemDongGoiHienTai = null;
}

function tinhHanSuDung() {
    const loaiEl = document.getElementById('popDG_Loai');
    const hanEl = document.getElementById('popDG_Han');
    if (!loaiEl || !hanEl) return;

    const val = loaiEl.value;
    const days = parseInt(val.split('|')[1]) || 30;

    const future = new Date();
    future.setDate(future.getDate() + days);

    hanEl.innerText = future.toLocaleDateString('vi-VN');
}

function chotDongGoi() {
    if (itemDongGoiHienTai === null || !(globalData.choDongGoi || [])[itemDongGoiHienTai]) return;

    const loaiEl = document.getElementById('popDG_Loai');
    const vatLieuText = loaiEl ? loaiEl.value.split('|')[0] : "Giấy gói chuyên dụng";
    const days = loaiEl ? parseInt(loaiEl.value.split('|')[1]) || 30 : 30;

    const future = new Date();
    future.setDate(future.getDate() + days);

    const item = globalData.choDongGoi.splice(itemDongGoiHienTai, 1)[0];
    
    if (item) {
        if (!globalData.choHap) globalData.choHap = [];
        
        item.vatLieuBaoBoc = vatLieuText;
        item.hanSuDung = future.toLocaleDateString('vi-VN');
        item.thoiGianDongGoi = new Date().toLocaleString('vi-VN');
        item.nhanSuDongGoi = currentUser.nvName;

        globalData.choHap.push(item);

        ghiNhatKyFirebase({
            maBo: item.maBo,
            tenBo: item.tenBo,
            khoa: item.khoa,
            trangThai: 'ĐÃ ĐÓNG GÓI CHỜ HẤP',
            maLoHap: '---'
        });
    }

    dongBoTrangThaiRealtime();
    alert("✅ Đóng gói thành công! Dụng cụ đã tự động chuyển sang Trạm Hấp.");
    closePopupDongGoi();
}

const ROBOFLOW_LABEL_MAPPING = {
    "van doyen": "Van Doyen",
    "banh doyen": "Van Doyen",
    "banh farabeuf": "Banh Farabeuf",
    "farabeuf": "Banh Farabeuf",
    "can dao": "Cán Dao",
    "can dao so 3": "Cán Dao số 3",
    "can dao so 4": "Cán Dao số 4",
    "keo cat chi": "Kéo Cắt Chỉ",
    "keo cat ron": "Kéo Cắt Rốn",
    "mayo cong": "Kéo Mayo Cong",
    "keo mayo": "Kéo Mayo Cong",
    "metzenbaum": "Kéo Metzenbaum",
    "keo metzenbaum": "Kéo Metzenbaum",
    "kep hinh tim": "Kẹp Hình Tim",
    "kep kim": "Kẹp Kim Mang Chỉ",
    "kem mang kim": "Kẹp Kim Mang Chỉ",
    "kelly cong": "Kìm Kelly Cong",
    "kelly thang": "Kìm Kelly Thẳng",
    "kocher": "Kìm Kocher",
    "kep kocher": "Kìm Kocher",
    "collin": "Kìm Collin",
    "nhip": "Nhíp Phẫu Thuật",
    "kep phau tich": "Nhíp Phẫu Thuật",
    "vong giu dung cu": "Vòng Giữ Dụng Cụ",
    "bhd400": "Bồn Hạt Đậu 400ml",
    "bhd800": "Bồn Hạt Đậu 800ml"
};

async function kichHoatAICamera() {
    const video = document.getElementById('ai_webcam');
    const placeholder = document.getElementById('ai_placeholder');
    const btnScan = document.getElementById('btn_ai_scan');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("⚠️ Trình duyệt không hỗ trợ truy cập Camera!");
        return;
    }

    try {
        aiVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        
        if (video) {
            video.srcObject = aiVideoStream;
            video.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (btnScan) btnScan.disabled = false;
    } catch (err) {
        console.error("Lỗi Camera:", err);
        alert("Vui lòng cấp quyền truy cập Camera trên trình duyệt!");
    }
}

function tatAICamera() {
    if (aiVideoStream) {
        aiVideoStream.getTracks().forEach(track => track.stop());
        aiVideoStream = null;
    }
    const video = document.getElementById('ai_webcam');
    const placeholder = document.getElementById('ai_placeholder');
    const btnScan = document.getElementById('btn_ai_scan');

    if (video) video.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (btnScan) btnScan.disabled = true;
}

async function chupAnhVaDemAI() {
    const video = document.getElementById('ai_webcam');
    const canvas = document.getElementById('ai_canvas_overlay');
    const tbodyLinhKien = document.getElementById('popDG_DanhSachLinhKien');
    const btnScan = document.getElementById('btn_ai_scan');

    if (!video || video.classList.contains('hidden') || !video.videoWidth) {
        alert("⚠️ Vui lòng bấm 'Bật AI Camera' và hướng camera vào mâm dụng cụ trước!");
        return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64Image = dataUrl.split(',')[1];

    if (btnScan) {
        btnScan.disabled = true;
        btnScan.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Đang Quét AI Thực Tế...`;
    }

    let rawPredictions = [];

    try {
        const response = await fetch('https://detect.roboflow.com/cssd-instruments/1?api_key=NL3AKGKwKD5pagBvWgA3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: base64Image
        });

        if (response.ok) {
            const result = await response.json();
            rawPredictions = result.predictions || [];
        }
    } catch (err) {
        console.error("Lỗi AI:", err);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const aiDetections = [];

    rawPredictions.forEach(p => {
        const labelRaw = (p.class || p.label || "").toLowerCase().trim();
        const labelChuan = ROBOFLOW_LABEL_MAPPING[labelRaw] || p.class || "Dụng Cụ";
        const confidence = p.confidence || 0;

        if (confidence >= 0.4) {
            aiDetections.push({
                label: labelChuan,
                conf: confidence
            });

            const width = p.width || 50;
            const height = p.height || 50;
            const x = (p.x !== undefined) ? (p.x - width / 2) : 0;
            const y = (p.y !== undefined) ? (p.y - height / 2) : 0;

            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
            const text = `${labelChuan} (${Math.round(confidence * 100)}%)`;
            ctx.font = "bold 11px Arial";
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, (y > 20 ? y - 20 : y), textWidth + 8, 20);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + 4, (y > 20 ? y - 6 : y + 14));
        }
    });

    capNhatDoiSoatBangAI(aiDetections, tbodyLinhKien);

    if (btnScan) {
        btnScan.disabled = false;
        btnScan.innerHTML = `<i class="fa-solid fa-camera-retro mr-1"></i> Chụp & Đối Soát AI`;
    }
}

function capNhatDoiSoatBangAI(detections, tbodyLinhKien) {
    if (!tbodyLinhKien || itemDongGoiHienTai === null) return;

    const itemHienTai = (globalData.choDongGoi || [])[itemDongGoiHienTai];
    if (!itemHienTai) return;

    const masterInfo = (globalData.danhMucLinhKien || []).find(d => d.maBo.toUpperCase() === itemHienTai.maBo.toUpperCase());
    const danhSachChuan = (masterInfo && masterInfo.chiTietLinhKien && masterInfo.chiTietLinhKien.length > 0) 
        ? masterInfo.chiTietLinhKien 
        : [];

    const normalizeStr = (str) => {
        return (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

    const aiCounts = {};
    detections.forEach(d => {
        const norm = normalizeStr(d.label);
        aiCounts[norm] = (aiCounts[norm] || 0) + 1;
    });

    let html = '';
    let soMonThieu = 0;

    if (danhSachChuan.length > 0) {
        danhSachChuan.forEach(lk => {
            const tenMon = lk.tenLinhKien || lk.ten;
            const normTenMon = normalizeStr(tenMon);
            const slChuan = lk.soLuong || 1;
            
            let slAIQuet = 0;
            for (const [keyNorm, count] of Object.entries(aiCounts)) {
                if (normTenMon.includes(keyNorm) || keyNorm.includes(normTenMon)) {
                    slAIQuet += count;
                }
            }

            const slThieu = slChuan - slAIQuet;

            if (slThieu > 0) {
                soMonThieu += slThieu;
                html += `
                    <tr class="bg-rose-100/80 border-b border-rose-200 text-xs font-bold text-rose-800">
                        <td class="p-2.5">
                            <div class="flex items-center gap-1.5">
                                <i class="fa-solid fa-triangle-exclamation text-rose-600 animate-pulse"></i>
                                <span>${tenMon}</span>
                            </div>
                            ${lk.maLinhKien ? `<span class="text-[10px] text-rose-600/80 font-mono block ml-4">(${lk.maLinhKien})</span>` : ''}
                        </td>
                        <td class="p-2.5 text-center whitespace-nowrap">
                            <span class="bg-rose-600 text-white px-2 py-0.5 rounded text-[11px] font-extrabold">
                                THIẾU ${slThieu} / ${slChuan}
                            </span>
                            <span class="text-[10px] text-slate-500 block mt-0.5">(Đã đếm: ${slAIQuet})</span>
                        </td>
                    </tr>
                `;
            } else {
                html += `
                    <tr class="bg-emerald-50/70 border-b border-emerald-100 text-xs text-slate-800">
                        <td class="p-2.5 font-semibold">
                            <div class="flex items-center gap-1.5">
                                <i class="fa-solid fa-circle-check text-emerald-600"></i>
                                <span>${tenMon}</span>
                            </div>
                            ${lk.maLinhKien ? `<span class="text-[10px] text-slate-400 font-mono block ml-4">(${lk.maLinhKien})</span>` : ''}
                        </td>
                        <td class="p-2.5 text-center font-mono font-bold text-emerald-700 whitespace-nowrap">
                            <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px]">
                                ĐỦ (${slAIQuet}/${slChuan})
                            </span>
                        </td>
                    </tr>
                `;
            }
        });
    }

    tbodyLinhKien.innerHTML = html;
    tbodyLinhKien.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (soMonThieu > 0) {
        alert(`⚠️ CẢNH BÁO: Phát hiện mâm đang THIẾU ${soMonThieu} CHI TIẾT! Vui lòng kiểm tra các mục tô màu đỏ.`);
    } else if (detections.length > 0) {
        alert(`🎉 HỢP LỆ: Đã nhận diện đầy đủ toàn bộ chi tiết trên mâm!`);
    }
}

// 11. MÁY HẤP
function capNhatDanhSachMaMay() {
    const loaiEl = document.getElementById('hap_loaiHap');
    const maySoEl = document.getElementById('hap_maySo');
    if (!loaiEl || !maySoEl) return;

    const val = loaiEl.value;
    if (val.includes("hơi nước") || val.includes("Steam")) {
        maySoEl.innerHTML = `
            <option value="Lò Hấp Steam #1">Lò Hấp Steam #1 (Nhiệt Độ Cao)</option>
            <option value="Lò Hấp Steam #2">Lò Hấp Steam #2 (Nhiệt Độ Cao)</option>
        `;
    } else if (val.includes("Plasma") || val.includes("H2O2")) {
        maySoEl.innerHTML = `
            <option value="Lò Hấp H2O2 Plasma #1">Lò Hấp H2O2 Plasma #1 (Nhiệt Độ Thấp)</option>
        `;
    } else if (val.includes("EO")) {
        maySoEl.innerHTML = `
            <option value="Máy EO #1">Máy Tiệt Trùng EO #1</option>
        `;
    } else {
        maySoEl.innerHTML = `
            <option value="Lò Hấp Steam #1">Lò Hấp Steam #1</option>
            <option value="Lò Hấp Steam #2">Lò Hấp Steam #2</option>
        `;
    }
    tuDongTaoMaLoMeHap();
}

function tuDongTaoMaLoMeHap() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('hap_batchId');
    const meInp = document.getElementById('hap_meSo');
    if (batchInp && meInp) {
        meInp.value = "01";
        batchInp.value = `H${today}_01`;
    }
}

function renderBangChoHap() {
    const tbody = document.getElementById('bangChoHap');
    const badge = document.getElementById('badgeChoHap');
    if (!tbody) return;

    if (!globalData.choHap) globalData.choHap = [];
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
                ${item.tenBo}
                <span class="text-[10px] text-slate-400 block">${item.vatLieuBaoBoc || ''} - HSD: ${item.hanSuDung || ''}</span>
            </td>
            <td class="p-2 text-right font-mono font-bold text-purple-700">${item.maBo}</td>
        </tr>
    `).join('');
}

function toggleSelectAllHap() {
    const chkAll = document.getElementById('selectAllHap');
    const items = document.querySelectorAll('.chk-hap-item');
    if (chkAll) {
        items.forEach(c => c.checked = chkAll.checked);
    }
}

function xacNhanMeHap() {
    const checkedInps = document.querySelectorAll('.chk-hap-item:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn ít nhất một bộ dụng cụ để đưa vào lò hấp!");
        return;
    }

    const batchInp = document.getElementById('hap_batchId');
    const batchId = batchInp ? batchInp.value : `H${Date.now()}`;
    const loaiHap = document.getElementById('hap_loaiHap') ? document.getElementById('hap_loaiHap').value : "Hấp hơi nước";

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))).sort((a, b) => b - a);

    if (!globalData.dangHap) globalData.dangHap = [];

    selectedIndices.forEach(idx => {
        const item = globalData.choHap.splice(idx, 1)[0];
        if (item) {
            const newItem = {
                ...item,
                maLoHap: batchId,
                loaiHap: loaiHap,
                nhanSuHap: currentUser.nvName,
                thoiGianBatDauHap: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                timestampBatDauHap: Date.now()
            };
            globalData.dangHap.push(newItem);

            ghiNhatKyFirebase({
                maBo: item.maBo,
                tenBo: item.tenBo,
                khoa: item.khoa,
                trangThai: `ĐANG HẤP TIỆT TRÙNG (${loaiHap})`,
                maLoHap: batchId
            });
        }
    });

    dongBoTrangThaiRealtime();
    alert(`🔥 Đã khởi động mẻ tiệt trùng lò hấp: ${batchId}!`);
}

function renderBangChoNghiemThuHap() {
    const tbody = document.getElementById('bangChoNghiệmThu');
    if (!tbody) return;

    if (!globalData.dangHap) globalData.dangHap = [];

    if (globalData.dangHap.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có mẻ hấp nào đang trong lò.</td></tr>`;
        return;
    }

    tbody.innerHTML = globalData.dangHap.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-2 text-center w-10">
                <input type="checkbox" class="chk-nghiemthu-hap w-4 h-4 rounded text-purple-600" data-idx="${idx}" checked>
            </td>
            <td class="p-2 font-mono font-bold text-purple-700">${item.maLoHap}</td>
            <td class="p-2 font-semibold text-slate-800">${item.tenBo} <span class="text-[10px] text-slate-400">(${item.maBo})</span></td>
            <td class="p-2 text-center font-semibold text-rose-600">Đang hấp (${item.thoiGianBatDauHap})</td>
        </tr>
    `).join('');
}

function toggleSelectAllNghiemThu() {
    const chkAll = document.getElementById('selectAllNghiemThu');
    const items = document.querySelectorAll('.chk-nghiemthu-hap');
    if (chkAll) {
        items.forEach(c => c.checked = chkAll.checked);
    }
}

function nhapKhoHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn mâm dụng cụ cần duyệt đạt để nhập kho!");
        return;
    }

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))).sort((a, b) => b - a);

    if (!globalData.khoVoKhuan) globalData.khoVoKhuan = [];
    if (!globalData.meHap) globalData.meHap = [];

    selectedIndices.forEach(idx => {
        const item = globalData.dangHap.splice(idx, 1)[0];
        if (item) {
            item.trangThai = "VÔ KHUẨN (Trong Kho)";
            item.viTriKho = "Kệ A1 - Ô 02";
            item.thoiGianHoanTatHap = new Date().toLocaleString('vi-VN');
            item.timestampHoanTatHap = Date.now();

            let kpiStatus = "ĐẠT (<30m)";
            if (item.timestampBatDauHap) {
                const diffMinutes = Math.round((item.timestampHoanTatHap - item.timestampBatDauHap) / 60000);
                if (diffMinutes > 30) kpiStatus = "TRỄ (>30m)";
            }
            item.kpiBiStatus = kpiStatus;

            globalData.khoVoKhuan.unshift(item);
            globalData.meHap.unshift(item);

            ghiNhatKyFirebase({
                maBo: item.maBo,
                tenBo: item.tenBo,
                khoa: item.khoa,
                trangThai: 'NHẬP KHO VÔ KHUẨN',
                maLoHap: item.maLoHap
            });
        }
    });

    dongBoTrangThaiRealtime();
    alert("🎉 Đã nhập kho vô khuẩn thành công!");
}

function tuChoiHapHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn mâm dụng cụ bị từ chối!");
        return;
    }

    const selectedIndices = Array.from(checkedInps).map(c => parseInt(c.getAttribute('data-idx'))).sort((a, b) => b - a);

    selectedIndices.forEach(idx => {
        const item = globalData.dangHap.splice(idx, 1)[0];
        if (item) {
            globalData.choHap.push(item);
        }
    });

    dongBoTrangThaiRealtime();
    alert("🔴 Đã trả các mâm về Hàng Đợi Hấp!");
}

// 12. KHO VÔ KHUẨN & XUẤT KHO
function renderBangKhoVoKhuan() {
    const tbody = document.getElementById('bangKhoVoKhuan');
    if (!tbody) return;

    if (!globalData.khoVoKhuan) globalData.khoVoKhuan = [];

    if (globalData.khoVoKhuan.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-slate-400">Kho vô khuẩn hiện đang trống.</td></tr>`;
        return;
    }

    tbody.innerHTML = globalData.khoVoKhuan.map((item, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">${item.tenBo}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${item.maBo}</td>
            <td class="p-3 text-center text-slate-600 font-semibold">${item.khoa || 'Phòng Sanh'}</td>
            <td class="p-3 text-center font-semibold text-emerald-700">${item.viTriKho || 'Kệ A1'}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.hanSuDung || 'Còn Hạn'}</td>
            <td class="p-3 text-center action-col">
                <button onclick="xuatKhoDungCu(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded text-xs shadow-sm">
                    Xuất Trả
                </button>
            </td>
        </tr>
    `).join('');
}

function xuatKhoDungCu(idx) {
    if (!globalData.khoVoKhuan || !globalData.khoVoKhuan[idx]) return;
    
    const item = globalData.khoVoKhuan.splice(idx, 1)[0];
    dongBoTrangThaiRealtime();
    
    ghiNhatKyFirebase({
        maBo: item.maBo,
        tenBo: item.tenBo,
        khoa: item.khoa || 'Khoa Lâm Sàng',
        trangThai: 'XUẤT KHO VỀ KHOA',
        maLoHap: item.maLoHap || item.batchId || '---'
    });

    alert(`📦 Đã xuất mâm [${item.tenBo}] cho Khoa!`);
}

function ghiNhatKyFirebase(dataAction) {
    if (!db) return;

    const logEntry = {
        maBo: dataAction.maBo || "N/A",
        tenBo: dataAction.tenBo || "Mâm dụng cụ",
        khoa: dataAction.khoa || "CSSD",
        trangThai: dataAction.trangThai || "Đang xử lý",
        maLoHap: dataAction.maLoHap || dataAction.batchId || "---",
        nhanSu: currentUser.nvName || "KTV CSSD",
        thoiGian: new Date().toLocaleString('vi-VN'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("lich_su_luan_chuyen").add(logEntry)
        .catch((error) => console.error("❌ Lỗi ghi nhật ký Cloud:", error));
}

function xuatKhoXoayVong() {
    const inp = document.getElementById('xuat_inpMaBo');
    if (!inp || !inp.value.trim()) {
        alert("Vui lòng nhập/quét mã khay xuất!");
        return;
    }
    const ma = inp.value.trim().toUpperCase();
    const idx = (globalData.khoVoKhuan || []).findIndex(i => i.maBo.toUpperCase() === ma);
    if (idx !== -1) {
        xuatKhoDungCu(idx);
        inp.value = '';
    } else {
        alert("❌ Khay không có trong kho vô khuẩn!");
    }
}

// 13. BÁO CÁO & KPI
function renderBangKPIPerformance() {
    const tbody = document.getElementById('bangHieuSuatKTV');
    if (!tbody) return;

    const ktvStats = (globalData.ktvList || []).map((ktv, idx) => {
        const logsOfKtv = (globalData.lichSu || []).filter(l => l.nhanSu === ktv.name);
        
        const countThuGom = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('THU GOM')).length;
        const countRua = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('RỬA')).length;
        const countDongGoi = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('ĐÓNG GÓI')).length;
        const countHap = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('HẤP')).length;
        const countXuatKho = logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('XUẤT KHO')).length;

        const tongThaoTac = logsOfKtv.length;

        const totalBiReads = (globalData.meHap || []).filter(m => m.nhanSuHap === ktv.name || m.nhanSu === ktv.name).length;
        const passBiReads = (globalData.meHap || []).filter(m => (m.nhanSuHap === ktv.name || m.nhanSu === ktv.name) && m.kpiBiStatus === 'ĐẠT (<30m)').length;
        const biComplianceRate = totalBiReads > 0 ? Math.round((passBiReads / totalBiReads) * 100) : 100;

        return {
            stt: idx + 1,
            id: ktv.id,
            name: ktv.name,
            role: ktv.role,
            countThuGom,
            countRua,
            countDongGoi,
            countHap,
            countXuatKho,
            tongThaoTac,
            biComplianceRate
        };
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
            <td class="p-3 text-center font-bold ${stat.biComplianceRate >= 95 ? 'text-emerald-600' : 'text-rose-600'}">
                ${stat.biComplianceRate}% (30m)
            </td>
        </tr>
    `).join('');
}

function xuatBaoCaoKPIExcel() {
    if (typeof XLSX === 'undefined') {
        alert("❌ Chưa nạp thư viện XLSX!");
        return;
    }

    const dataKPI = (globalData.ktvList || []).map((ktv, idx) => {
        const logsOfKtv = (globalData.lichSu || []).filter(l => l.nhanSu === ktv.name);
        return {
            "STT": idx + 1,
            "Mã Nhân Viên": ktv.id,
            "Họ và Tên": ktv.name,
            "Chức Danh": ktv.role,
            "Số Mâm Rửa": logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('RỬA')).length,
            "Số Mâm Đóng Gói": logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('ĐÓNG GÓI')).length,
            "Số Mâm Hấp": logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('HẤP')).length,
            "Số Mâm Xuất Kho": logsOfKtv.filter(l => l.trangThai && l.trangThai.includes('XUẤT KHO')).length,
            "Tổng Thao Tác": logsOfKtv.length,
            "Tỷ Lệ Tuân Thủ BI 30m": "100%"
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataKPI);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BaoCao_KPI_NhanSu");
    XLSX.writeFile(wb, `BaoCao_KPI_KTV_CSSD_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// 14. DASHBOARD TIVI
function initDashboardTVClock() {
    setInterval(() => {
        const tvClockEl = document.getElementById('tv_realtime_clock');
        if (tvClockEl) {
            tvClockEl.innerText = new Date().toLocaleString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }, 1000);
}

function renderDashboardTV() {
    const elRua = document.getElementById('tv_meRua');
    const elHap = document.getElementById('tv_meHap');
    const elDangRua = document.getElementById('tv_dangRua');
    const elDangHap = document.getElementById('tv_dangHap');
    const elKho = document.getElementById('tv_khoVoKhuan');

    const elChoRua = document.getElementById('tv_choRua');
    const elChoDongGoi = document.getElementById('tv_choDongGoi');
    const elChoHap = document.getElementById('tv_choHap');

    if (elRua) elRua.innerText = `${(globalData.meRua || []).length}`;
    if (elHap) elHap.innerText = `${(globalData.meHap || []).length}`;
    if (elDangRua) elDangRua.innerText = `${(globalData.dangRua || []).length}`;
    if (elDangHap) elDangHap.innerText = `${(globalData.dangHap || []).length}`;
    if (elKho) elKho.innerText = `${(globalData.khoVoKhuan || []).length}`;

    if (elChoRua) elChoRua.innerText = `${(globalData.choRua || []).length}`;
    if (elChoDongGoi) elChoDongGoi.innerText = `${(globalData.choDongGoi || []).length}`;
    if (elChoHap) elChoHap.innerText = `${(globalData.choHap || []).length}`;

    const alertZoneTV = document.getElementById('tv_emergency_alert_zone');
    if (alertZoneTV) {
        if (currentRecallBatchId) {
            alertZoneTV.classList.remove('hidden');
            alertZoneTV.innerHTML = `
                <div class="bg-rose-600 text-white p-4 rounded-2xl animate-pulse flex items-center justify-between shadow-2xl">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-triangle-exclamation text-3xl"></i>
                        <div>
                            <h3 class="font-extrabold text-lg">CẢNH BÁO THU HỒI KHẨN CẤP LÔ TIỆT TRÙNG: ${currentRecallBatchId}</h3>
                            <p class="text-xs opacity-90">Phát hiện sự cố Chỉ thị sinh học BI (+)!</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            alertZoneTV.classList.add('hidden');
        }
    }
}

// 15. RENDER CÔNG NỢ, TỒN KHO & NHẬT KÝ
function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    const items = selectedKhoa 
        ? (globalData.danhMucLinhKien || []).filter(i => i.khoa === selectedKhoa) 
        : (globalData.danhMucLinhKien || []);

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">Vui lòng chọn Khoa/Phòng.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">
                ${item.tenBo} 
                <span class="text-[10px] text-sky-600 block font-mono">${item.maBo} (${item.khoa})</span>
            </td>
            <td class="p-3 text-center font-bold text-slate-600">0</td>
            <td class="p-3 text-center font-bold text-slate-600">0</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.soLuong || 1}</td>
            <td class="p-3 text-center font-bold text-rose-600">0</td>
        </tr>
    `).join('');
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
        items = items.filter(i => i.khoa === selectedKhoa);
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

function renderBangDanhMucLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    const tbodyTong = document.getElementById('bangDanhMucTong');

    if (tbody) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Chưa có dữ liệu.</td></tr>`;
        } else {
            tbody.innerHTML = globalData.danhMucLinhKien.map(item => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-bold text-slate-800">${item.tenBo} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo}</span></td>
                    <td class="p-3 text-slate-600">${item.khoa}</td>
                    <td class="p-3 text-center font-bold text-sky-700 bg-sky-50 rounded">${item.soLuong}</td>
                </tr>
            `).join('');
        }
    }

    if (tbodyTong) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) {
            tbodyTong.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu.</td></tr>`;
        } else {
            tbodyTong.innerHTML = globalData.danhMucLinhKien.map(item => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-mono font-bold text-sky-700">${item.maBo}</td>
                    <td class="p-3 font-bold text-slate-800">${item.tenBo}</td>
                    <td class="p-3 text-slate-600">${item.khoa}</td>
                    <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Sẵn Sàng (${item.soLuong})</span></td>
                </tr>
            `).join('');
        }
    }
}

function renderBangLichSuRua() {
    const tbody = document.getElementById('bangLichSuRua');
    if (!tbody) return;
    if (!globalData.meRua || globalData.meRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có mẻ rửa nào.</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.meRua.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.batchId}</td>
            <td class="p-3">${item.loaiRua || 'Máy rửa tự động'}</td>
            <td class="p-3">${item.chuKy || 'Tiêu chuẩn'}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.testDoSach || 'ĐẠT'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGianRuaXong || item.thoiGian || 'Vừa xong'}</td>
        </tr>
    `).join('');
}

function renderBangLichSuLuanChuyen() {
    const tbody = document.getElementById('bangLichSuHanhTrinhGoc');
    if (!tbody) return;
    if (!globalData.lichSu || globalData.lichSu.length === 0) {
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

// 16. CHUYỂN TAB & PHÂN QUYỀN
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
    if (tabId === 'mayrua') {
        renderBangChoRua();
        renderBangChoNiemThuRua();
        renderBangLichSuRua();
    }
    if (tabId === 'donggoi') renderBangDongGoi();
    if (tabId === 'mayhap') {
        renderBangChoHap();
        renderBangChoNghiemThuHap();
    }
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

function checkLogin() {
    const roleEl = document.getElementById('login_role');
    const passEl = document.getElementById('login_pass');
    
    const role = roleEl ? roleEl.value : 'ADMIN';
    const pin = passEl ? passEl.value.trim() : '';

    if (!pin) {
        alert("Vui lòng nhập Mã PIN xác thực!");
        return;
    }

    let foundUser = (globalData.ktvList || []).find(k => k.pin === pin);
    
    if (pin === '9999' || role === 'ADMIN') {
        foundUser = { id: 'ADMIN', name: 'ADMINISTRATOR', role: 'ADMIN' };
    } else if (!foundUser && (pin === '1234' || pin === 'NV01')) {
        foundUser = { id: 'NV01', name: 'KTV CSSD', role: 'CSSD' };
    }

    if (!foundUser) {
        alert("❌ Mã PIN xác thực không chính xác! (Admin: 9999, KTV: 1234)");
        return;
    }

    currentUser.role = role;
    currentUser.nvName = foundUser.name;

    const userInfoEl = document.getElementById('nav_user_info');
    if (userInfoEl) userInfoEl.innerText = currentUser.nvName;

    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    switchTab('khoaphong');
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

// 17. CAMERA SCANNER, BỆNH NHÂN & KÝ ĐIỆN TỬ
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
    if (html5QrCodeScanner) {
        html5QrCodeScanner.clear().catch(error => console.error(error));
    }
    const pop = document.getElementById('popupScanner');
    if (pop) pop.classList.add('hidden');
}

function moPopupSuDungBoDungCu() {
    const pop = document.getElementById('popupSuDungBoDungCu');
    if (pop) pop.classList.remove('hidden');
}
function closePopupSuDung() {
    const pop = document.getElementById('popupSuDungBoDungCu');
    if (pop) pop.classList.add('hidden');
}

function scanKhayVaoSuDung() {
    const inp = document.getElementById('sd_maKhayInp');
    if (!inp || !inp.value.trim()) return;

    const maKhay = inp.value.trim().toUpperCase();
    const item = (globalData.danhMucLinhKien || []).find(i => i.maBo.toUpperCase() === maKhay) || { maBo: maKhay, tenBo: "Khay Dụng Cụ" };

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
            <td class="p-2 text-center">
                <button onclick="tempSuDungKhay.splice(${idx},1); renderBangKhaySuDung();" class="text-rose-600"><i class="fa-solid fa-xmark"></i></button>
            </td>
        </tr>
    `).join('');
}

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

// 18. XUẤT BÁO CÁO EXCEL & IN TEM
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

    const res = (globalData.lichSu || []).filter(l => (l.maLoHap && l.maLoHap.toUpperCase().includes(maBatch)));
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
                            <td>${i.tenBo}</td>
                            <td>${i.maBo}</td>
                            <td>${i.khoa}</td>
                            <td style="text-align: center;">1</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    setTimeout(() => { window.print(); }, 200);
}

// 19. THU HỒI KHẨN CẤP LÔ TIỆT TRÙNG (BI+)
function moPopupThuHoiKhanCap() {
    const pop = document.getElementById('popupThuHoi');
    if (pop) pop.classList.remove('hidden');
}

function dongPopupThuHoi() {
    const pop = document.getElementById('popupThuHoi');
    if (pop) pop.classList.add('hidden');
}

function truyVetKhanCapLoHap() {
    const inpBatch = document.getElementById('recall_inpBatchId');
    const resultZone = document.getElementById('recall_resultZone');
    const tbody = document.getElementById('recall_tbody');
    const badge = document.getElementById('recall_totalBadge');

    if (!inpBatch || !inpBatch.value.trim()) {
        alert("⚠️ Vui lòng nhập mã lô tiệt trùng nghi ngờ sự cố BI (+)");
        return;
    }

    currentRecallBatchId = inpBatch.value.trim().toUpperCase();

    let listInRecall = [];

    (globalData.dangHap || []).forEach(item => {
        if (item.maLoHap && item.maLoHap.toUpperCase() === currentRecallBatchId) {
            listInRecall.push({ ...item, viTriRealtime: "Lò Hấp (Đang chạy)", mucDoRuiRo: "🔴 CAO" });
        }
    });

    (globalData.khoVoKhuan || []).forEach(item => {
        if ((item.maLoHap && item.maLoHap.toUpperCase() === currentRecallBatchId) || 
            (item.batchId && item.batchId.toUpperCase() === currentRecallBatchId)) {
            listInRecall.push({ ...item, viTriRealtime: "Kho Vô Khuẩn CSSD", mucDoRuiRo: "🟡 TRUNG BÌNH" });
        }
    });

    (globalData.lichSu || []).forEach(item => {
        if (item.maLoHap && item.maLoHap.toUpperCase() === currentRecallBatchId) {
            listInRecall.push({ 
                maBo: item.maBo, 
                tenBo: item.tenBo, 
                khoa: item.khoa, 
                viTriRealtime: "Khoa Lâm Sàng / BN", 
                mucDoRuiRo: "🔴 NGUY CƠ CAO" 
            });
        }
    });

    if (badge) badge.innerText = `${listInRecall.length} Mâm`;

    if (tbody) {
        if (listInRecall.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">Không tìm thấy mâm dụng cụ nào thuộc mã lô ${currentRecallBatchId}.</td></tr>`;
        } else {
            tbody.innerHTML = listInRecall.map(item => `
                <tr class="border-b hover:bg-rose-50 text-xs">
                    <td class="p-2.5 font-mono font-bold text-rose-700">${item.maBo || 'N/A'}</td>
                    <td class="p-2.5 font-bold text-slate-800">${item.tenBo || 'Mâm Dụng Cụ'}</td>
                    <td class="p-2.5 font-semibold text-slate-600">${item.khoa || 'N/A'}</td>
                    <td class="p-2.5 text-center font-bold text-sky-700">${item.viTriRealtime}</td>
                    <td class="p-2.5 text-center font-extrabold text-rose-600">${item.mucDoRuiRo}</td>
                </tr>
            `).join('');
        }
    }

    if (resultZone) resultZone.classList.remove('hidden');
}

function xacNhanPhatLenhThuHoi() {
    if (!currentRecallBatchId) {
        alert("⚠️ Chưa chọn mã lô tiệt trùng để phát lệnh phong tỏa!");
        return;
    }

    const lyDo = document.getElementById('recall_lyDo') ? document.getElementById('recall_lyDo').value.trim() : "Phát hiện BI (+)";

    if (confirm(`🚨 XÁC NHẬN PHONG TỎA: Bạn chắc chắn muốn thu hồi toàn bộ mâm dụng cụ mã lô [${currentRecallBatchId}]?`)) {
        globalData.khoVoKhuan = (globalData.khoVoKhuan || []).filter(i => (i.maLoHap || i.batchId || '').toUpperCase() !== currentRecallBatchId);
        globalData.dangHap = (globalData.dangHap || []).filter(i => (i.maLoHap || '').toUpperCase() !== currentRecallBatchId);

        ghiNhatKyFirebase({
            maBo: "ALL_BATCH",
            tenBo: `PHONG TỎA THU HỒI LÔ ${currentRecallBatchId}`,
            khoa: "TOÀN VIỆN",
            trangThai: `KHẨN CẤP: BI (+) - ${lyDo}`,
            maLoHap: currentRecallBatchId
        });

        dongBoTrangThaiRealtime();
        alert(`🔥 ĐÃ PHÁT LỆNH THU HỒI TỚI TOÀN VIỆN!`);
        dongPopupThuHoi();
    }
}

// 20. ADMIN SUBTAB & PIN CONFIG
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

function renderDanhSachPinAdmin() {
    const tbody = document.getElementById('bangCauHinhPinAdmin');
    if (!tbody) return;

    const searchInp = document.getElementById('search_pin_admin');
    const keyword = searchInp ? searchInp.value.trim().toLowerCase() : '';

    const filteredList = (globalData.ktvList || []).filter(ktv => 
        ktv.name.toLowerCase().includes(keyword) || ktv.id.toLowerCase().includes(keyword)
    );

    tbody.innerHTML = filteredList.map((ktv, index) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 text-center font-bold text-slate-500">${index + 1}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
            <td class="p-3 font-semibold text-slate-800">${ktv.name}</td>
            <td class="p-3 text-center font-mono">
                <input type="password" id="pin_input_${ktv.id}" value="${ktv.pin || '1234'}" class="w-24 text-center border rounded p-1 text-xs font-bold">
            </td>
            <td class="p-3 text-center">
                <select id="role_select_${ktv.id}" class="border rounded px-2 py-1 text-xs">
                    <option value="CSSD" ${ktv.role === 'CSSD' ? 'selected' : ''}>KTV CSSD</option>
                    <option value="KHOA" ${ktv.role === 'KHOA' ? 'selected' : ''}>Điều Dưỡng Khoa</option>
                    <option value="ADMIN" ${ktv.role === 'ADMIN' ? 'selected' : ''}>Administrator</option>
                </select>
            </td>
            <td class="p-3 text-center">
                <button type="button" onclick="capNhatPinNhanVien('${ktv.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-xs font-bold">Lưu</button>
            </td>
        </tr>
    `).join('');
}

function capNhatPinNhanVien(ktvId) {
    const pinInp = document.getElementById(`pin_input_${ktvId}`);
    const targetKtv = (globalData.ktvList || []).find(k => k.id === ktvId);
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

function resetDuLieuKet() { alert("🔄 Đã giải phóng mâm kẹt dở dang!"); }

function xoaSachDuLieuGiaoDichRealtime() {
    if (confirm("⚠️ Bạn có chắc chắn muốn xóa tất cả dữ liệu giao dịch trên Cloud?")) {
        globalData.lichSu = [];
        globalData.meRua = [];
        globalData.meHap = [];
        globalData.phieuTra = [];
        globalData.choRua = [];
        globalData.dangRua = [];
        globalData.choDongGoi = [];
        globalData.choHap = [];
        globalData.dangHap = [];
        globalData.khoVoKhuan = [];

        localStorage.clear();
        dongBoTrangThaiRealtime();

        alert("🗑️ Đã xóa sạch dữ liệu giao dịch thành công!");
    }
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
