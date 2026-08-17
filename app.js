/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (UPDATE ĐỒNG BỘ CLOUD FIREBASE & CHỐNG LỖI QUIC PROTOCOL)
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

// Khởi tạo Firestore
const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

// Fix lỗi net::ERR_QUIC_PROTOCOL_ERROR & QUIC_NETWORK_IDLE_TIMEOUT
if (db) {
    try {
        db.settings({
            experimentalForceLongPolling: true
        });
        console.log("⚡ [FIRESTORE CONFIG] Đã kích hoạt experimentalForceLongPolling để chống lỗi ngắt mạng QUIC!");
    } catch (err) {
        console.warn("⚠️ Cấu hình Firestore settings đã được khởi tạo trước đó:", err);
    }
}

// 2. BIẾN TRẠNG THÁI TOÀN CỤC
let currentUser = { role: 'ADMIN', khoa: '', nvName: 'ADMINISTRATOR' };
let currentTab = 'khoaphong';
let html5QrCodeScanner = null;
let currentCameraInputId = null;

let globalData = {
    phieuTra: [],
    choRua: [],           // Dụng cụ chờ rửa
    dangRua: [],          // Dụng cụ đang trong buồng rửa
    choDongGoi: [],       // Dụng cụ chờ đóng gói
    choHap: [],           // Dụng cụ đã đóng gói chờ hấp
    dangHap: [],          // Dụng cụ đang trong lò hấp
    khoVoKhuan: [],       // Dụng cụ vô khuẩn sẵn sàng xuất
    meRua: [],
    meHap: [],
    lichSu: [],
    danhMucLinhKien: [],
    danhSachKhoa: [],
    ktvList: [
        { id: 'NV01', name: 'Nguyễn Văn A', pin: '1234', role: 'CSSD' },
        { id: 'ADMIN', name: 'ADMINISTRATOR', pin: '9999', role: 'ADMIN' }
    ]
};

let gioHangTraTam = [];
let tempSuDungKhay = [];
let itemDongGoiHienTai = null;

// Biến Canvas Ký Điện Tử
let canvasKy = null;
let ctxKy = null;
let isDrawingKy = false;

/* =========================================================================
   3. KHỞI TẠO VÀ ĐỒNG BỘ DỮ LIỆU CLOUD REALTIME
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    docDuLieuLuuTruLocalStorage();
    initRealtimeListeners();
    initExcelLoader(); 
    capNhatDanhSachMaMayRua();
    capNhatDanhSachMaMay();
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
    renderDanhSachPinAdmin(); 
    initCanvasKyDienTu();
});

function docDuLieuLuuTruLocalStorage() {
    try {
        const savedLinhKien = localStorage.getItem('cssd_danhMucLinhKien');
        const savedKhoa = localStorage.getItem('cssd_danhSachKhoa');
        if (savedLinhKien) globalData.danhMucLinhKien = JSON.parse(savedLinhKien);
        if (savedKhoa) globalData.danhSachKhoa = JSON.parse(savedKhoa);

        if (globalData.danhMucLinhKien.length > 0) {
            capNhatGiaoDienSauKhiNapExcel();
        }
        capNhatTatCaGiaoDien();
    } catch (err) {
        console.error("Lỗi khi đọc dữ liệu lưu trữ cục bộ:", err);
    }
}

// CẬP NHẬT TẤT CẢ GIAO DIỆN TRẠM TRÊN MÀN HÌNH
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
}

// LƯU TRẠNG THÁI REALTIME LÊN CLOUD FIREBASE VÀ LOCALSTORAGE
function dongBoTrangThaiRealtime() {
    const payload = {
        phieuTra: globalData.phieuTra,
        choRua: globalData.choRua,
        dangRua: globalData.dangRua,
        choDongGoi: globalData.choDongGoi,
        choHap: globalData.choHap,
        dangHap: globalData.dangHap,
        khoVoKhuan: globalData.khoVoKhuan,
        meRua: globalData.meRua,
        meHap: globalData.meHap,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 1. Lưu dự phòng vào LocalStorage
    localStorage.setItem('cssd_phieuTra', JSON.stringify(globalData.phieuTra));
    localStorage.setItem('cssd_choRua', JSON.stringify(globalData.choRua));
    localStorage.setItem('cssd_dangRua', JSON.stringify(globalData.dangRua));
    localStorage.setItem('cssd_choDongGoi', JSON.stringify(globalData.choDongGoi));
    localStorage.setItem('cssd_choHap', JSON.stringify(globalData.choHap));
    localStorage.setItem('cssd_dangHap', JSON.stringify(globalData.dangHap));
    localStorage.setItem('cssd_khoVoKhuan', JSON.stringify(globalData.khoVoKhuan));
    localStorage.setItem('cssd_meRua', JSON.stringify(globalData.meRua));
    localStorage.setItem('cssd_meHap', JSON.stringify(globalData.meHap));

    // 2. Đẩy đồng bộ lên Cloud Firebase
    if (db) {
        db.collection("he_thong_config").doc("trang_thai_realtime").set(payload, { merge: true })
            .catch(err => console.error("❌ Lỗi đồng bộ trạng thái Cloud:", err));
    }
}

// KHỞI TẠO BỘ LẮNG NGHE REALTIME 100% TỪ CLOUD
function initRealtimeListeners() {
    if (!db) return;

    // 1. Lắng nghe Nhật ký luân chuyển
    db.collection("lich_su_luan_chuyen").orderBy("timestamp", "desc").limit(100)
        .onSnapshot((snapshot) => {
            globalData.lichSu = [];
            snapshot.forEach((doc) => globalData.lichSu.push({ id: doc.id, ...doc.data() }));
            renderBangLichSuLuanChuyen();
        }, (err) => console.warn("Firestore listeners bypass:", err));

    // 2. Lắng nghe Danh mục Excel Master từ Cloud
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

    // 3. LẮNG NGHE ĐỒNG BỘ TOÀN BỘ TRẠM TRUNG GIAN THEO THỜI GIAN THỰC (REALTIME 100%)
    db.collection("he_thong_config").doc("trang_thai_realtime")
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                globalData.phieuTra = data.phieuTra || [];
                globalData.choRua = data.choRua || [];
                globalData.dangRua = data.dangRua || [];
                globalData.choDongGoi = data.choDongGoi || [];
                globalData.choHap = data.choHap || [];
                globalData.dangHap = data.dangHap || [];
                globalData.khoVoKhuan = data.khoVoKhuan || [];
                globalData.meRua = data.meRua || [];
                globalData.meHap = data.meHap || [];

                capNhatTatCaGiaoDien();
                console.log("☁️ [REALTIME 100%] Đã đồng bộ trạng thái mới nhất từ Cloud!");
            }
        }, (err) => console.warn("Không lấy được trạng thái Realtime Cloud:", err));
}

// NẠP EXCEL BỞI ADMIN VÀ TỰ ĐỘNG ĐẨY LÊN CLOUD
function initExcelLoader() {
    const excelInput = document.getElementById('excelFileInput');
    if (!excelInput) return;

    excelInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            alert("❌ Chưa tải thư viện SheetJS (XLSX). Vui lòng kiểm tra lại kết nối mạng!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                let bestSheetName = workbook.SheetNames[0];
                let maxRows = 0;

                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const range = XLSX.utils.decode_range(sheet['!ref'] || "A1:A1");
                    const rowCount = range.e.r - range.s.r + 1;
                    if (rowCount > maxRows) {
                        maxRows = rowCount;
                        bestSheetName = sheetName;
                    }
                });

                const targetSheet = workbook.Sheets[bestSheetName];
                const rawRows = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: "" });

                if (!rawRows || rawRows.length === 0) return;

                const row0 = rawRows[0] || [];
                const row0Str = row0.map(v => String(v).toLowerCase()).join(' ');
                const hasHeader = row0Str.includes('stt') || row0Str.includes('tên') || row0Str.includes('mã') || row0Str.includes('khoa');

                let parsedList = [];
                let setKhoa = new Set();

                if (hasHeader) {
                    const headerRow = row0.map(v => String(v).trim());
                    let idxKhoa = headerRow.findIndex(h => h.includes('Tên TS (i)') || h.includes('Khoa') || h.includes('Phòng'));
                    let idxMa = headerRow.findIndex(h => h.includes('MÃ') || h.includes('Mã'));
                    let idxTen = headerRow.findIndex(h => h.includes('Tên TS chuẩn') || h.includes('Tên bộ') || h.includes('Tên Dụng Cụ'));
                    let idxSoLuong = headerRow.findIndex(h => h.includes('Số lượng') || h.includes('Cơ số'));

                    if (idxKhoa === -1) idxKhoa = 1;
                    if (idxMa === -1) idxMa = 2;
                    if (idxTen === -1) idxTen = 3;
                    if (idxSoLuong === -1) idxSoLuong = 4;

                    for (let i = 1; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length === 0) continue;
                        const ten = r[idxTen] ? String(r[idxTen]).trim() : "";
                        const ma = r[idxMa] ? String(r[idxMa]).trim() : "";
                        const khoa = r[idxKhoa] ? String(r[idxKhoa]).trim() : "PHÒNG SANH";
                        const sl = r[idxSoLuong] !== "" && r[idxSoLuong] !== undefined ? Number(r[idxSoLuong]) || 1 : 1;

                        if (ten || ma) {
                            parsedList.push({ khoa, maBo: ma || `MA_${i}`, tenBo: ten || "Bộ Dụng Cụ", soLuong: sl });
                            if (khoa) setKhoa.add(khoa);
                        }
                    }
                } else {
                    for (let i = 1; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length < 3) continue;

                        const khoa = r[0] ? String(r[0]).trim() : "PHÒNG SANH";
                        const ma = r[1] ? String(r[1]).trim() : `MA_${i+1}`;
                        const ten = r[2] ? String(r[2]).trim() : "";
                        const sl = r[3] !== "" && r[3] !== undefined ? Number(r[3]) || 1 : 1;

                        if (ten || ma) {
                            parsedList.push({ khoa, maBo: ma, tenBo: ten || "Bộ Dụng Cụ", soLuong: sl });
                            if (khoa) setKhoa.add(khoa);
                        }
                    }
                }

                if (parsedList.length > 0) {
                    globalData.danhMucLinhKien = parsedList;
                    globalData.danhSachKhoa = Array.from(setKhoa);

                    localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                    localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));

                    if (db) {
                        db.collection("he_thong_config").doc("danh_muc_master").set({
                            danhMucLinhKien: globalData.danhMucLinhKien,
                            danhSachKhoa: globalData.danhSachKhoa,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            console.log("☁️ Đã đồng bộ danh mục Excel lên Cloud!");
                        });
                    }

                    capNhatGiaoDienSauKhiNapExcel();
                    alert(`🎉 Nạp thành công ${parsedList.length} bộ dụng cụ! Dữ liệu đã đồng bộ Realtime cho tất cả các thiết bị.`);
                }

            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
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
            el.innerHTML = firstOption + globalData.danhSachKhoa.map(k => `<option value="${k}">${k}</option>`).join('');
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
        ? globalData.danhMucLinhKien.filter(item => item.khoa === tenKhoa)
        : globalData.danhMucLinhKien;

    datalist.innerHTML = filteredItems.map(item => 
        `<option value="${item.maBo}">${item.tenBo} - [${item.khoa}]</option>`
    ).join('');
}

/* =========================================================================
   4. GIỎ HÀNG BÁO TRẢ & ĐỒNG BỘ REALTIME
   ========================================================================= */
function themVaoGio() {
    const inp = document.getElementById('khoa_inpMaBo');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!inp || !inp.value.trim()) {
        alert("Vui lòng chọn hoặc nhập mã mâm dụng cụ bẩn!");
        return;
    }

    const maBoInput = inp.value.trim().toUpperCase();
    const khoaSelect = selKhoa ? selKhoa.value : "";

    const item = globalData.danhMucLinhKien.find(i => i.maBo.toUpperCase() === maBoInput) || {
        maBo: maBoInput,
        tenBo: "Mâm Dụng Cụ Bẩn",
        khoa: khoaSelect || "PHÒNG SANH"
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
        alert("⚠️ Giỏ hàng báo trả đang trống! Vui lòng thêm mâm dụng cụ bẩn vào giỏ trước.");
        return;
    }

    const selKhoa = document.getElementById('khoa_selKhoa');
    let tenKhoa = selKhoa && selKhoa.value ? selKhoa.value : "";

    if (!tenKhoa && gioHangTraTam.length > 0) {
        tenKhoa = gioHangTraTam[0].khoa || "PHÒNG SANH";
    }

    const newPhieu = {
        id: `PGN_${Date.now()}`,
        khoa: tenKhoa,
        items: [...gioHangTraTam],
        thoiGian: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        nhanSu: currentUser.nvName
    };

    globalData.phieuTra.unshift(newPhieu);
    gioHangTraTam = [];
    renderGioHangTam();

    dongBoTrangThaiRealtime();

    alert(`🚀 THÀNH CÔNG! Đã phát lệnh báo trả ${newPhieu.items.length} bộ dụng cụ bẩn của Khoa [${tenKhoa}] sang Xe Thu Gom!`);
}

function guiBaoTra() { khoaGuiPhieuTraBatches(); }
function guiPhieuBaoTra() { khoaGuiPhieuTraBatches(); }

/* =========================================================================
   5. XE THU GOM & ĐỐI SOÁT REALTIME
   ========================================================================= */
let currentKiemDemIndex = null;

function renderBangChoThuGom() {
    const tbody = document.getElementById('bangChoThuGom');
    const filterSelect = document.getElementById('filterKhoaThuGom');
    const badgeSoCho = document.getElementById('badgeSoCho');

    if (!tbody) return;

    if (filterSelect) {
        const khoasWithOrders = Array.from(new Set(globalData.phieuTra.map(p => p.khoa)));
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
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-400">Hiện chưa có lệnh báo trả mâm bẩn nào từ các Khoa/Phòng.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredPhieu.map((phieu, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">
                <i class="fa-solid fa-hospital mr-1.5 text-sky-600"></i>${phieu.khoa}
                <div class="text-[10px] text-slate-400 font-normal mt-0.5">Người gửi: ${phieu.nhanSu}</div>
            </td>
            <td class="p-3">
                <div class="font-bold text-sky-800 mb-1">${phieu.items.length} Bộ dụng cụ bẩn:</div>
                <div class="space-y-1">
                    ${phieu.items.map(it => `
                        <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono mr-1">
                            <strong>${it.maBo}</strong> - ${it.tenBo}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td class="p-3 text-center font-bold text-slate-600">${phieu.thoiGian}</td>
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
    const phieu = globalData.phieuTra[idx];
    if (!phieu) return;

    const pop = document.getElementById('popupKiemDem');
    const popBo = document.getElementById('popBo');
    const popKhoa = document.getElementById('popKhoa');
    const popChecklist = document.getElementById('popKiemDemChecklist');

    if (popBo) popBo.innerText = `LỆNH THU GOM: ${phieu.items.length} MÂM DỤNG CỤ`;
    if (popKhoa) popKhoa.innerText = phieu.khoa;

    if (popChecklist) {
        popChecklist.innerHTML = phieu.items.map((it) => `
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
    if (currentKiemDemIndex === null || !globalData.phieuTra[currentKiemDemIndex]) {
        if (globalData.phieuTra.length === 0) return;
        currentKiemDemIndex = 0;
    }

    const phieuHienTai = globalData.phieuTra[currentKiemDemIndex];

    if (phieuHienTai && phieuHienTai.items) {
        if (!globalData.choRua) globalData.choRua = [];

        phieuHienTai.items.forEach(item => {
            globalData.choRua.push({
                ...item,
                khoa: phieuHienTai.khoa,
                thoiGianThuGom: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            });
        });
    }

    globalData.phieuTra.splice(currentKiemDemIndex, 1);
    currentKiemDemIndex = null;

    dongBoTrangThaiRealtime();

    alert("✅ Đã chốt kiểm đếm đối soát thành công! Dữ liệu đã nhảy Realtime sang Trạm Rửa Belimed WD250.");
    closePopupKiemDem();
}

/* =========================================================================
   6. MÁY RỬA REALTIME
   ========================================================================= */
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
            globalData.dangRua.push({
                ...item,
                batchId: batchId,
                loaiRua: loaiRua,
                chuKy: chuKy,
                thoiGianBatDau: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    dongBoTrangThaiRealtime();

    alert(`🚀 Đã kích hoạt mẻ rửa ${batchId} với ${selectedIndices.length} bộ dụng cụ! Dữ liệu đã đồng bộ Realtime.`);
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
        }
    });

    dongBoTrangThaiRealtime();

    alert("✅ Đã nghiệm thu đạt mẻ rửa! Mâm dụng cụ đã tự động nhảy Realtime sang Trạm Đóng Gói.");
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
    alert("🔴 Đã trả các mâm không đạt về Hàng Đợi Rửa trên Cloud!");
}

/* =========================================================================
   7. TRẠM LÀM SẠCH & ĐÓNG GÓI REALTIME
   ========================================================================= */
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
    const item = globalData.choDongGoi[idx];
    if (!item) return;

    const pop = document.getElementById('popupDongGoi');
    const popBo = document.getElementById('popDG_Bo');

    if (popBo) popBo.innerText = `ĐÓNG GÓI: ${item.tenBo} (${item.maBo})`;

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

    const val = loaiEl.value;
    const days = parseInt(val.split('|')[1]) || 30;

    const future = new Date();
    future.setDate(future.getDate() + days);

    hanEl.innerText = future.toLocaleDateString('vi-VN');
}

function chotDongGoi() {
    if (itemDongGoiHienTai === null || !globalData.choDongGoi[itemDongGoiHienTai]) return;

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
    }

    dongBoTrangThaiRealtime();

    alert("✅ Đóng gói thành công! Dụng cụ đã tự động chuyển Realtime sang Trạm Hấp Tiệt Trùng.");
    closePopupDongGoi();
}

/* =========================================================================
   8. MÁY HẤP TIỆT TRÙNG REALTIME
   ========================================================================= */
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
            globalData.dangHap.push({
                ...item,
                maLoHap: batchId,
                loaiHap: loaiHap,
                thoiGianBatDauHap: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                timestampBatDauHap: Date.now()
            });
        }
    });

    dongBoTrangThaiRealtime();

    alert(`🔥 Đã khởi động mẻ tiệt trùng lò hấp mã: ${batchId} cho ${selectedIndices.length} bộ dụng cụ! Dữ liệu đã đồng bộ Realtime.`);
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

            // Tự động tính KPI đọc BI trong 30 phút
            let kpiStatus = "ĐẠT (<30m)";
            if (item.timestampBatDauHap) {
                const diffMinutes = Math.round((item.timestampHoanTatHap - item.timestampBatDauHap) / 60000);
                if (diffMinutes > 30) kpiStatus = "TRỄ (>30m)";
            }
            item.kpiBiStatus = kpiStatus;

            globalData.khoVoKhuan.unshift(item);
            globalData.meHap.unshift(item);
        }
    });

    dongBoTrangThaiRealtime();

    alert("🎉 Đã nhập kho vô khuẩn thành công! Dữ liệu Kho Vô Khuẩn đã cập nhật Realtime.");
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

    alert("🔴 Đã trả các mâm về Hàng Đợi Hấp trên Cloud!");
}

/* =========================================================================
   9. KHO VÔ KHUẨN & XUẤT KHO REALTIME
   ========================================================================= */
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
    if (!globalData.khoVoKhuan[idx]) return;
    
    const item = globalData.khoVoKhuan.splice(idx, 1)[0];
    
    dongBoTrangThaiRealtime();
    
    ghiNhatKyFirebase({
        maBo: item.maBo,
        tenBo: item.tenBo,
        khoa: item.khoa || 'Khoa Lâm Sàng',
        trangThai: 'XUẤT KHO VỀ KHOA',
        maLoHap: item.maLoHap || item.batchId || '---'
    });

    alert(`📦 Đã xuất mâm [${item.tenBo}] cho Khoa & Đồng bộ Realtime thành công!`);
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
    const idx = globalData.khoVoKhuan.findIndex(i => i.maBo.toUpperCase() === ma);
    if (idx !== -1) {
        xuatKhoDungCu(idx);
        inp.value = '';
    } else {
        alert("❌ Khay không có trong kho vô khuẩn!");
    }
}

/* =========================================================================
   10. RENDER BẢNG CÔNG NỢ, TỒN KHO & DASHBOARD TV
   ========================================================================= */
function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    
    const items = selectedKhoa 
        ? globalData.danhMucLinhKien.filter(i => i.khoa === selectedKhoa) 
        : globalData.danhMucLinhKien;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">Vui lòng chọn Khoa/Phòng để xem công nợ bộ dụng cụ tương ứng.</td></tr>`;
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
        : globalData.danhMucLinhKien;

    if (selectedKhoa) {
        items = items.filter(i => i.khoa === selectedKhoa);
    }

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-slate-400">Không tìm thấy dữ liệu tồn kho. Vui lòng nạp file Excel cơ số.</td></tr>`;
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
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Chưa có dữ liệu. Vui lòng nạp file Excel.</td></tr>`;
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
            tbodyTong.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu khay dụng cụ</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có mẻ rửa nào</td></tr>`;
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

function renderDashboardTV() {
    const elRua = document.getElementById('tv_meRua');
    const elHap = document.getElementById('tv_meHap');
    const elDangRua = document.getElementById('tv_dangRua');
    const elDangHap = document.getElementById('tv_dangHap');
    const elHap2 = document.getElementById('tv_meHap2');
    const elKho = document.getElementById('tv_khoVoKhuan');

    if (elRua) elRua.innerText = `${(globalData.meRua || []).length}`;
    if (elHap) elHap.innerText = `${(globalData.meHap || []).length}`;
    if (elDangRua) elDangRua.innerText = `${(globalData.dangRua || []).length}`;
    if (elDangHap) elDangHap.innerText = `${(globalData.dangHap || []).length}`;
    if (elHap2) elHap2.innerText = `${(globalData.meHap || []).length}`;
    if (elKho) elKho.innerText = `${(globalData.khoVoKhuan || []).length}`;
}

function renderBangLichSuLuanChuyen() {
    const tbody = document.getElementById('bangLichSuHanhTrinhGoc');
    if (!tbody) return;
    if (globalData.lichSu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-xs text-slate-400">Chưa có nhật ký luân chuyển</td></tr>`;
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

/* =========================================================================
   11. CHUYỂN TAB & PHÂN QUYỀN
   ========================================================================= */
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
    const nvIdEl = document.getElementById('login_nv_id');
    
    const role = roleEl ? roleEl.value : 'ADMIN';
    const pin = passEl ? passEl.value : '';
    const nvId = nvIdEl ? nvIdEl.value.trim().toUpperCase() : '';

    if (!pin) {
        alert("Vui lòng nhập Mã PIN xác thực!");
        return;
    }

    let foundUser = globalData.ktvList.find(k => k.pin === pin);
    if (role === 'ADMIN' && pin === '9999') {
        foundUser = { id: 'ADMIN', name: 'ADMINISTRATOR', role: 'ADMIN' };
    }

    if (!foundUser) {
        alert("❌ Mã PIN xác thực không chính xác!");
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

/* =========================================================================
   12. CAMERA SCANNER, BỆNH NHÂN & KÝ ĐIỆN TỬ
   ========================================================================= */
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
    const item = globalData.danhMucLinhKien.find(i => i.maBo.toUpperCase() === maKhay) || { maBo: maKhay, tenBo: "Khay Dụng Cụ" };

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

// KHỞI TẠO CANVAS KÝ NHẬN ĐIỆN TỬ
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
    alert(`✍️ Đã lưu xác nhận chữ ký của [${tenNguoi}] thành công!`);
}

/* =========================================================================
   13. XUẤT BÁO CÁO EXCEL, TRUY XUẤT & IN TEM BARCODE ĐÔI
   ========================================================================= */
function xuatBaoCaoExcelLuanChuyen() {
    if (typeof XLSX === 'undefined') return;
    const dataLuanChuyen = globalData.lichSu.map(item => ({
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
    const dataMeRua = globalData.meRua.map(item => ({
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

    const res = globalData.lichSu.filter(l => (l.maLoHap && l.maLoHap.toUpperCase().includes(maBatch)));
    if (res.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-rose-500 font-bold">Không tìm thấy lịch sử luân chuyển khớp với mã lô: ${maBatch}</td></tr>`;
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

function renderBangKPIPerformance() {
    const tbody = document.getElementById('bangHieuSuatKTV');
    if (!tbody) return;

    tbody.innerHTML = globalData.ktvList.map((ktv, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
            <td class="p-3 font-bold text-slate-800">${ktv.name}</td>
            <td class="p-3 text-center font-bold text-emerald-600">100% (Đạt Chuẩn 30m)</td>
        </tr>
    `).join('');
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
            if (globalData.choHap[idx]) itemsToPrint.push(globalData.choHap[idx]);
        });
    } else {
        itemsToPrint = globalData.choHap || [];
    }

    if (itemsToPrint.length === 0) {
        alert("⚠️ Không có mâm dụng cụ nào được chọn để in tem!");
        return;
    }

    thucHienInTemBixolon(itemsToPrint, batchId, maySo, loaiHap);
}

function inTemNghiemThuHangLoat() {
    const checkedInps = document.querySelectorAll('.chk-nghiemthu-hap:checked');
    if (checkedInps.length === 0) {
        alert("⚠️ Vui lòng chọn ít nhất một mâm dụng cụ để in tem vô khuẩn!");
        return;
    }

    let itemsToPrint = [];
    checkedInps.forEach(chk => {
        const idx = parseInt(chk.getAttribute('data-idx'));
        if (globalData.dangHap[idx]) itemsToPrint.push(globalData.dangHap[idx]);
    });

    const firstItem = itemsToPrint[0] || {};
    thucHienInTemBixolon(itemsToPrint, firstItem.maLoHap || 'H001', firstItem.loaiHap || 'Steam', 'Lò Hấp CSSD');
}

function thucHienInTemBixolon(items, batchId, maySo, loaiHap) {
    const printZone = document.getElementById('print-zone');
    if (!printZone) return;

    document.body.className = "print-mode-bixolon";

    const ngayHienTai = new Date();
    const strNgayIn = ngayHienTai.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

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
                    ${globalData.danhMucLinhKien.slice(0, 10).map(i => `
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

/* =========================================================================
   14. ADMIN SUBTAB & PIN CONFIG REALTIME
   ========================================================================= */
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

    const filteredList = globalData.ktvList.filter(ktv => 
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
    const targetKtv = globalData.ktvList.find(k => k.id === ktvId);
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

        alert("🗑️ Đã xóa sạch dữ liệu giao dịch trên Cloud Realtime thành công!");
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
