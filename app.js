const firebaseConfig = { apiKey: "AIzaSyCxjdCTKHQlpm7SYbWCEws1HhcOaFp0LBA", authDomain: "cssd-system-2878c.firebaseapp.com", projectId: "cssd-system-2878c", storageBucket: "cssd-system-2878c.firebasestorage.app", messagingSenderId: "662377321937", appId: "1:662377321937:web:001c092e10319547623cf0" };
firebase.initializeApp(firebaseConfig); const db = firebase.firestore();

let thongTinMatKhauAdmin = { adminPIN: "admin2026", cssdPIN: "cssd2026", guestPIN: "guest2026" };
let cauHinhGiaoDien = {
    "ADMIN": ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'],
    "CSSD": ['thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','dashboard_tv'], 
    "KHOA": ['khoaphong','quanlykho','lichsuluanchuyen'], 
    "GUEST": ['quanlykho','danhmuc','lichsuluanchuyen','performance','dashboard_tv']
};

let currentRole = "", loginUserCode = "";
let danhSachKhoa = [], listGiaoDich = [], gioHangTam = [], danhSachKtvCssd = [], databaseExcel = [];

let html5QrCode = null; let targetInputIdForScan = ""; let idDangKiemDem = null; let idDangDongGoi = null;
let activeTab = 'thugom'; let renderTimeout = null;
let duLieuAnhBiTamBase64 = ""; // Biến tạm lưu chuỗi hình ảnh chỉ thị sinh học khi chụp

function getTodayDateStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

const cauHinhMayHap = { "Hấp hơi nước": ["A1", "A2", "A3", "A4"], "Hấp H2O2 (Plasma)": ["P1", "P2"], "Khử khuẩn EO": ["EO1", "EO2"] };

// --- LISTENERS REALTIME ---
db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").onSnapshot(doc => { 
    if (doc.exists) { 
        let res = doc.data(); 
        danhSachKhoa = res.danhSachKhoa || []; 
        danhSachKtvCssd = res.danhSachKtvCssd || []; 
        databaseExcel = res.databaseExcel || []; 
        if(res.thongTinMatKhauAdmin) thongTinMatKhauAdmin = Object.assign(thongTinMatKhauAdmin, res.thongTinMatKhauAdmin); 
        if(res.cauHinhGiaoDien) cauHinhGiaoDien = Object.assign(cauHinhGiaoDien, res.cauHinhGiaoDien);
    } 
    initSelects();
    if(activeTab === 'khoaphong') loadBoDungCuTheoKhoa(); 
    renderAdminInterface(); 
    if(currentRole) apDungPhanQuyenGiaoDien(currentRole);
    callRender();
});

db.collection("phieuGiaoNhan").orderBy("id", "desc").limit(1000).onSnapshot(snap => { 
    listGiaoDich = []; snap.forEach(doc => { let d = doc.data(); d.firestoreId = doc.id; listGiaoDich.push(d); }); 
    callRender();
});

function taiDanhMucLinhKienChuand() {
    db.collection("danhMucLinhKien").orderBy("tenLoaiBo").onSnapshot((snapshot) => {
        const tbody = document.getElementById("bangDanhMucLinhKien");
        if (!tbody) return; tbody.innerHTML = "";
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Chưa có dữ liệu cấu hình bộ linh kiện.</td></tr>`;
            return;
        }
        snapshot.forEach((doc) => {
            const data = doc.data();
            let linhKienHtml = `<div class="flex flex-wrap gap-1">`;
            if (data.chiTiet && Array.isArray(data.chiTiet)) {
                data.chiTiet.forEach(item => { linhKienHtml += `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">${item.tenBaoCao || item.tenChiTiet} (${item.soLuong})</span>`; });
            } else { linhKienHtml += `<span class="text-slate-400 italic">Không có chi tiết</span>`; }
            linhKienHtml += `</div>`;
            const tr = document.createElement("tr"); tr.className = "hover:bg-slate-50 transition-colors";
            tr.innerHTML = `<td class="p-3 font-bold text-slate-800">${data.tenLoaiBo}</td><td class="p-3">${linhKienHtml}</td><td class="p-3 text-center font-black text-sky-700 bg-sky-50/30">${data.tongSoLuong || 0}</td>`;
            tbody.appendChild(tr);
        });
    });
}

function callRender() { clearTimeout(renderTimeout); renderTimeout = setTimeout(() => { renderTheoTabHienTai(); }, 100); }

function anTatCaHeadersVaMenus() {
    document.getElementById('header-lamsang')?.classList.add('hidden');
    document.getElementById('header-vanhanh')?.classList.add('hidden');
    document.getElementById('header-dulieu')?.classList.add('hidden');
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(x => {
        document.getElementById('menu-' + x)?.classList.add('hidden');
    });
}

function apDungPhanQuyenGiaoDien(role) {
    anTatCaHeadersVaMenus();
    if (role === "ADMIN") {
        ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(tab => {
            document.getElementById('menu-' + tab)?.classList.remove('hidden');
        });
        document.getElementById('header-lamsang')?.classList.remove('hidden');
        document.getElementById('header-vanhanh')?.classList.remove('hidden');
        document.getElementById('header-dulieu')?.classList.remove('hidden');
        return;
    }
    let tabsDuocPhep = cauHinhGiaoDien[role] || [];
    tabsDuocPhep.forEach(tab => { document.getElementById('menu-' + tab)?.classList.remove('hidden'); });
    if (tabsDuocPhep.includes('khoaphong')) document.getElementById('header-lamsang')?.classList.remove('hidden');
    if (['thugom','donggoi','mayhap','khovokhuan'].some(t => tabsDuocPhep.includes(t))) document.getElementById('header-vanhanh')?.classList.remove('hidden');
    if (['quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].some(t => tabsDuocPhep.includes(t))) document.getElementById('header-dulieu')?.classList.remove('hidden');
}

function checkLogin() {
    const role = document.getElementById("login_role").value; 
    const pass = document.getElementById("login_pass").value; 
    let pA = thongTinMatKhauAdmin.adminPIN || "admin2026"; 
    let pC = thongTinMatKhauAdmin.cssdPIN || "cssd2026"; 
    let pG = thongTinMatKhauAdmin.guestPIN || "guest2026"; 
    if (role === "ADMIN" && pass === pA) { 
        currentRole = "ADMIN"; loginUserCode = "ADMIN"; document.getElementById("nav_user_info").innerText = "ADMINISTRATOR";
        document.getElementById("khoa_selKhoa").disabled = false; document.body.classList.remove('guest-mode');
        apDungPhanQuyenGiaoDien("ADMIN");
        switchTab('lichsuluanchuyen');
    } else if (role === "KHOA") { 
        const khoaSelect = document.getElementById("login_khoa").value; 
        let found = danhSachKhoa.find(x => x.ten === khoaSelect); 
        if (pass === (found ? found.pin : "123")) { 
            currentRole = "KHOA"; loginUserCode = khoaSelect; document.getElementById("nav_user_info").innerText = khoaSelect; 
            document.getElementById("khoa_selKhoa").value = khoaSelect; document.getElementById("khoa_selKhoa").disabled = true; document.body.classList.remove('guest-mode');
            apDungPhanQuyenGiaoDien("KHOA");
            switchTab('khoaphong');
        } else { return showToast("Sai mã PIN Khoa!", "error"); } 
    } else if (role === "CSSD") {
        const nvCode = document.getElementById("login_nv_cssd").value;
        if(!nvCode && pass === pC) { currentRole = "CSSD"; loginUserCode = "CSSD_CHUNG"; document.getElementById("nav_user_info").innerText = "CSSD GENERAL"; } 
        else if (nvCode) {
            let nv = danhSachKtvCssd.find(x => x.code === nvCode);
            if (nv && pass === nv.pin) { currentRole = "CSSD"; loginUserCode = nv.ten; document.getElementById("nav_user_info").innerText = `${nvCode} - ${nv.ten}`; }
            else { return showToast("Sai mã PIN của nhân viên này!", "error"); }
        } else { return showToast("Vui lòng chọn Nhân viên hoặc nhập PIN Backup!", "error"); }
        document.getElementById("khoa_selKhoa").disabled = false; document.body.classList.remove('guest-mode');
        apDungPhanQuyenGiaoDien("CSSD");
        let tabsDuocPhep = cauHinhGiaoDien["CSSD"] || [];
        if(tabsDuocPhep.includes('thugom')) switchTab('thugom');
        else if (tabsDuocPhep.length > 0) switchTab(tabsDuocPhep[0]);
    } else if (role === "GUEST") {
        if(pass === pG) {
            currentRole = "GUEST"; loginUserCode = "GUEST"; document.getElementById("nav_user_info").innerText = "KHÁCH THAM QUAN";
            document.body.classList.add('guest-mode'); 
            apDungPhanQuyenGiaoDien("GUEST");
            switchTab('quanlykho');
        } else { return showToast("Sai mã PIN Khách tham quan!", "error"); }
    } else { return showToast("Sai thông tin đăng nhập!", "error"); }
    document.getElementById("login-screen").classList.add("hidden"); document.getElementById("main-app").classList.remove("hidden");
}

function switchTab(t) { 
    if (currentRole !== "ADMIN") {
        let tabsDuocPhep = cauHinhGiaoDien[currentRole] || [];
        if(!tabsDuocPhep.includes(t)) { return showToast("Tài khoản của bạn không có quyền truy cập chức năng này!", "error"); }
    }
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(x => { 
        document.getElementById('tab-'+x)?.classList.add('hidden'); document.getElementById('menu-'+x)?.classList.remove('sidebar-item-active'); 
    }); 
    document.getElementById('tab-'+t)?.classList.remove('hidden'); document.getElementById('menu-'+t)?.classList.add('sidebar-item-active'); 
    activeTab = t; callRender(); 
}

function updateGiaoDienMatrix(role, tabId, checkboxElement) {
    if(!cauHinhGiaoDien[role]) cauHinhGiaoDien[role] = [];
    if(checkboxElement.checked) { if(!cauHinhGiaoDien[role].includes(tabId)) cauHinhGiaoDien[role].push(tabId); } 
    else { cauHinhGiaoDien[role] = cauHinhGiaoDien[role].filter(x => x !== tabId); }
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ cauHinhGiaoDien: cauHinhGiaoDien })
    .then(() => showToast(`Đã cập nhật quyền truy cập cho nhóm: ${role}`, "success"));
}

function renderAdminInterface() {
    document.getElementById("cfg_pinAdmin").value = thongTinMatKhauAdmin.adminPIN || "";
    document.getElementById("cfg_pinCSSD").value = thongTinMatKhauAdmin.cssdPIN || "";
    document.getElementById("cfg_pinGuest").value = thongTinMatKhauAdmin.guestPIN || "";
    
    const MatrixRoles = ["CSSD", "KHOA", "GUEST"];
    const MatrixTabs = [
        { id: "khoaphong", name: "1. Cổng Báo Trả Đồ" },
        { id: "thugom", name: "2. Xe Thu Gom" },
        { id: "donggoi", name: "3. Làm Sạch & Gói" },
        { id: "mayhap", name: "4. Quản Lý Mẻ Hấp" },
        { id: "khovokhuan", name: "5. Kho Vô Khuẩn" },
        { id: "quanlykho", name: "6. Tồn Kho Toàn Viện" },
        { id: "danhmuc", name: "7. Giám Sát Tuổi Thọ" },
        { id: "lichsuluanchuyen", name: "8. Nhật Ký Luân Chuyển" },
        { id: "tracuu", name: "9. Cấu Hình Hệ Thống" },
        { id: "performance", name: "10. Hiệu Suất KPI" },
        { id: "dashboard_tv", name: "11. Màn Hình Tivi" }
    ];

    let htmlMatrix = "";
    MatrixTabs.forEach(tab => {
        htmlMatrix += `<tr class="border-b font-medium text-xs"><td class="p-3 font-bold text-slate-700">${tab.name}</td>`;
        MatrixRoles.forEach(role => {
            let isChecked = (cauHinhGiaoDien[role] && cauHinhGiaoDien[role].includes(tab.id)) ? "checked" : "";
            htmlMatrix += `<td class="p-3 text-center"><input type="checkbox" ${isChecked} onchange="updateGiaoDienMatrix('${role}', '${tab.id}', this)" class="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"></td>`;
        });
        htmlMatrix += `</tr>`;
    });
    if(document.getElementById("bodyMaTranGiaoDien")) document.getElementById("bodyMaTranGiaoDien").innerHTML = htmlMatrix;

    const tbKhoa = document.getElementById("bangPhanQuyenKhoa");
    if(tbKhoa) {
        if(danhSachKhoa.length === 0) { tbKhoa.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500 font-bold italic">Danh sách Khoa trống.</td></tr>`; } 
        else { tbKhoa.innerHTML = danhSachKhoa.map((k, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-slate-700 text-[11px]">${k.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-rose-600 text-sm bg-rose-50/50">${k.pin || '123'}</td><td class="p-3 text-center"><div class="flex items-center justify-center gap-2"><input type="text" id="pin-khoa-${index}" placeholder="PIN" class="w-24 p-1.5 text-center border border-slate-300 rounded text-xs font-bold"><button onclick="updatePINTrựcTiep(${index}, '${k.ten}')" class="bg-sky-600 text-white font-bold py-1.5 px-3 rounded shadow text-[10px]">ĐỔI PIN</button></div></td></tr>`).join(''); }
    }
    const tbKtv = document.getElementById("bangNhanVienCssd");
    if(tbKtv) {
        if(danhSachKtvCssd.length === 0) { tbKtv.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Chưa có Nhân viên.</td></tr>`; }
        else { tbKtv.innerHTML = danhSachKtvCssd.map((nv, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-sky-700 text-xs">${nv.code}</td><td class="p-3 font-bold text-slate-700 text-[11px]">${nv.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-sky-600 text-sm bg-sky-50/50">${nv.pin}</td><td class="p-3 text-center"><button onclick="xoaKtvCssd('${nv.code}')" class="text-rose-600 font-bold text-[10px]"><i class="fa-solid fa-trash-can mr-1"></i>XÓA</button></td></tr>`).join(''); }
    }
}

function xuatKhoXoayVong() { 
    const k = document.getElementById("xuat_selKhoa").value; 
    const ma = document.getElementById("xuat_inpMaBo").value.trim().toUpperCase(); 
    if(!k || !ma) return showToast("Vui lòng Chọn Khoa và Quét Mã!", "error"); 
    let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && x.status === "CHO_XUAT"); 
    if(!khayThucTe) { document.getElementById("xuat_inpMaBo").value = ""; return showToast(`Mã ID ${ma} không tồn tại ở Kho Sạch Vô Khuẩn.`, "error"); } 
    
    db.collection("phieuGiaoNhan").doc(khayThucTe.firestoreId).update({ 
        status: "HOAN_TAT", 
        khoa: k, 
        ngayHoanTat: getTodayDateStr(),
        timeHoanTat: new Date().toLocaleTimeString('vi-VN'),
        nvXuatKho: loginUserCode || "CSSD_CHUNG"
    }).then(() => { 
        showToast(`Đã bàn giao mâm đồ cho Khoa ${k}!`, "success"); 
        document.getElementById("xuat_inpMaBo").value = ""; 
        callRender(); 
    }); 
}

// --- HÀM XỬ LÝ ĐỌC FILE ẢNH BI TẠI CHỖ CHUYỂN ĐỔI SANG BASE64 ---
function docAnhBiUpTaiCho(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = function() {
        duLieuAnhBiTamBase64 = reader.result; 
        showToast("Đã ghi nhận ảnh test BI thành công!", "success");
    };
    reader.readAsDataURL(file);
}

// --- TỐI ƯU LOGIC TỰ ĐỘNG PHÁT HIỆN MẺ ĐẦU TIÊN TRONG NGÀY ---
function tuDongTaoMaLoMeHap() {
    const maMay = document.getElementById("hap_maySo")?.value || "A1";
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const ngayChuoi = `${yy}${mm}${dd}`;
    
    let cacMeTrongNgay = listGiaoDich.filter(x => x.batchCode && x.batchCode.startsWith(maMay + ngayChuoi));
    let soMeMax = 0;
    cacMeTrongNgay.forEach(x => {
        let phanDuoi = x.batchCode.split("_")[1];
        if (phanDuoi) {
            let num = parseInt(phanDuoi);
            if (num > soMeMax) soMeMax = num;
        }
    });
    
    let meTiepTheo = soMeMax + 1;
    if (meTiepTheo > 99) meTiepTheo = 1;
    const chuoiMe = String(meTiepTheo).padStart(2, '0');
    const soLanDone = `${ngayChuoi}_${chuoiMe}`;
    const batchIdHoanChinh = `${maMay}${soLanDone}`;
    
    if (document.getElementById("hap_meSo")) document.getElementById("hap_meSo").value = chuoiMe;
    if (document.getElementById("hap_batchId")) document.getElementById("hap_batchId").value = batchIdHoanChinh;

    // HIỂN THỊ HOẶC ẨN KHU VỰC UP ẢNH BI: Chỉ hiện nút upload nếu là mẻ số 01 đầu tiên trong ngày
    const vungUpAnh = document.getElementById("khuVucUploadBI");
    if (vungUpAnh) {
        if (soMeMax === 0) {
            vungUpAnh.classList.remove("hidden");
            duLieuAnhBiTamBase64 = ""; 
        } else {
            vungUpAnh.classList.add("hidden");
            duLieuAnhBiTamBase64 = "";
        }
    }
}

// --- CẢI TIẾN HÀM XÁC NHẬN MẺ HẤP KẾ THỪA DỮ LIỆU TỰ ĐỘNG KHÔNG CẦN SHAREPOINT ---
function xacNhanMeHap() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); 
    if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm dụng cụ!", "error"); 
    
    let loaiHap = document.getElementById("hap_loaiHap").value; 
    let maMay = document.getElementById("hap_maySo").value; 
    let batchCode = document.getElementById("hap_batchId").value; 
    let chuKyNhiet = document.getElementById("hap_nhietDo").value; 
    let apSuat = document.getElementById("hap_apSuat").value || "N/A"; 
    
    const ngayHomNay = getTodayDateStr();
    let cacMeCuaMayTrongNgay = listGiaoDich.filter(x => x.batchCode && x.batchCode.startsWith(maMay) && x.ngayHapRealtime === ngayHomNay);
    let laMeDauTien = cacMeCuaMayTrongNgay.length === 0;

    // Nếu là mẻ số 01 bắt buộc chụp/đính kèm hình ảnh minh chứng
    if (laMeDauTien && !duLieuAnhBiTamBase64) {
        return showToast("Mẻ đầu tiên trong ngày! Vui lòng chụp/đính kèm ảnh test sinh học BI.", "error");
    }

    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllHap') return; 
        p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({ 
            status: "DANG_HAP", 
            batchCode: batchCode, 
            ngayHapRealtime: ngayHomNay, 
            thongTinLoHap: { 
                loaiHap: loaiHap, 
                maMay: maMay, 
                chuKyNhiet: chuKyNhiet, 
                apSuat: apSuat, 
                thoiGianBatDau: new Date().toLocaleTimeString('vi-VN'),
                giamSatChatLuong: {
                    chiThiHoaHoc: "ĐẠT",
                    laMeTestSinhHocGoc: laMeDauTien,
                    keThuaTuMaLo: laMeDauTien ? batchCode : (cacMeCuaMayTrongNgay[cacMeCuaMayTrongNgay.length - 1]?.batchCode || batchCode),
                    ketQuaSinhHoc: laMeDauTien ? "ÂM TÍNH (ĐẠT)" : "KẾ THỪA ĐẦU NGÀY",
                    minhChungAnhBase64: laMeDauTien ? duLieuAnhBiTamBase64 : "" 
                }
            } 
        })); 
    }); 
    
    Promise.all(p).then(() => { 
        showToast(`Kích hoạt lò thành công! Lô: ${batchCode}`, "success"); 
        duLieuAnhBiTamBase64 = ""; 
        tuDongTaoMaLoMeHap(); 
        callRender(); 
    }); 
}

function renderTheoTabHienTai() {
    if(activeTab === 'khoaphong') {
        const k = document.getElementById("khoa_selKhoa").value;
        let arrHtml = []; let noK = listGiaoDich.filter(x => x.khoa === k && x.status !== "HOAN_TAT" && x.status !== "CHO_XUAT");
        let gopNo = {}; noK.forEach(x => { let ten = x.bo.split(" [ID:")[0]; gopNo[ten] = (gopNo[ten]||0) + 1; });
        for (let key in gopNo) { arrHtml.push(`<tr class="border-b"><td class="p-3 font-bold text-slate-800">${key}</td><td class="p-3 text-center">-</td><td class="p-3 text-center">-</td><td class="p-3 text-center text-rose-600 font-bold">Nợ ${gopNo[key]}</td></tr>`); }
        document.getElementById("bangDonGiaoNhan").innerHTML = arrHtml.length ? arrHtml.join('') : `<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">Khoa chưa phát sinh công nợ trả đồ.</td></tr>`;
    }
    else if(activeTab === 'thugom') {
        let fK = document.getElementById("filterKhoaThuGom")?.value || "";
        let lsTG = listGiaoDich.filter(x => x.status === "CHO_THU"); 
        
        // Thực hiện lọc theo khoa nếu có chọn
        if (fK) {
            lsTG = lsTG.filter(x => x.khoa === fK);
        }
        
        // Cập nhật số lượng lệnh hiển thị thực tế lên badge
        if (document.getElementById("badgeSoCho")) {
            document.getElementById("badgeSoCho").innerText = `${lsTG.length} Lệnh`;
        }

        document.getElementById("bangChoThuGom").innerHTML = lsTG.map(i => {
            let tenBo = i.bo.split(" [ID:")[0]; let itemsInBo = databaseExcel.filter(x => { let boName = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; return String(boName).trim().toUpperCase() === String(tenBo).trim().toUpperCase(); });
            let checklistHtml = itemsInBo.length > 0 ? `<div class="max-h-24 overflow-y-auto pr-1">` + itemsInBo.map(item => { let tenDc = item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || item['Dụng cụ'] || item['TÊN BỘ'] || item['Tên Chi Tiết'] || item['NAME'] || "Dụng cụ"; let sl = item['Số lượng'] || item['SL'] || item['Số Lượng'] || 1; return `<div class="flex justify-between border-b border-dashed border-slate-200 py-1 text-[10px] text-slate-600"><span>- ${tenDc}</span><span class="font-bold text-sky-700">x${sl}</span></div>`; }).join('') + `</div>` : `<span class="italic text-[10px] text-slate-400">Không có cấu hình chi tiết</span>`;
            return `<tr class="border-b border-slate-50"><td class="p-3"><div class="font-bold text-slate-700 text-[11px] uppercase">${i.khoa}</div>${i.ghiChu ? `<div class="text-[10px] text-rose-600 font-medium italic mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${i.ghiChu}</div>` : ''}</td><td class="p-3"><div class="font-bold text-sky-700 text-[12px] uppercase">${tenBo}</div><div class="text-[10px] font-mono text-slate-400 mb-2">ID: ${i.maMacDinh}</div><div class="bg-slate-50 p-2 rounded border border-slate-100">${checklistHtml}</div></td><td class="p-3 text-center text-[10px] text-slate-500 font-bold">${i.time}</td><td class="p-3 text-center action-col"><button onclick="moPopupKiemDem('${i.firestoreId}')" class="bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded shadow font-black text-[11px]">KIỂM ĐẾM</button></td></tr>`;
        }).join('');
    }
    else if(activeTab === 'donggoi') {
        let lsDG = listGiaoDich.filter(x => x.status === "DANG_RUA"); document.getElementById("badgeDongGoi").innerText = lsDG.length;
        document.getElementById("gridDongGoi").innerHTML = lsDG.map(i => `<div class="bg-white p-3 rounded border border-slate-200 mb-2 flex justify-between items-center"><div class="flex-1"><div class="font-bold text-sky-700 text-[13px]">${i.bo}</div><div class="text-[10px] text-slate-500">Từ khoa: ${i.khoa}</div></div><button onclick="moPopupDongGoi('${i.firestoreId}')" class="bg-sky-50 text-sky-700 border border-sky-300 px-3 py-1.5 rounded text-[11px] font-black">ĐÓNG GÓI</button></div>`).join('');
    }
    else if(activeTab === 'mayhap') {
        let lsCH = listGiaoDich.filter(x => x.status === "CHO_HAP"); document.getElementById("badgeChoHap").innerText = `${lsCH.length} Mục`;
        document.getElementById("bangChoHap").innerHTML = lsCH.map(i => `<tr class="border-b"><td class="p-3 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="hap-checkbox"></td><td class="p-3 font-bold">${i.bo}</td><td class="p-3 text-right font-mono">${i.maMacDinh}</td></tr>`).join('');
        let lsNT = listGiaoDich.filter(x => x.status === "DANG_HAP"); document.getElementById("bangChoNghiệmThu").innerHTML = lsNT.map(i => `<tr class="border-b"><td class="p-2 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="nghiemthu-checkbox"></td><td class="p-2 font-bold text-xs">${i.bo} <span class="text-slate-400 font-normal">(${i.batchCode || 'Chưa có lô'})</span></td></tr>`).join('');
    }
    else if(activeTab === 'khovokhuan') {
        let kList = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean); if(document.getElementById("xuat_selKhoa").options.length <= 1) { document.getElementById("xuat_selKhoa").innerHTML = '<option value="">-- Chọn Khoa --</option>' + kList.map(k=>`<option value="${k}">${k}</option>`).join(''); }
        let lsXK = listGiaoDich.filter(x => x.status === "CHO_XUAT");
        document.getElementById("bangKhoVoKhuan").innerHTML = lsXK.map(i => `<tr class="border-b"><td class="p-3 font-bold text-slate-800 text-[11px]">${i.bo.split(" [ID:")[0]}</td><td class="p-3 font-mono text-sky-700 font-bold">${i.maMacDinh}</td><td class="p-3 text-center font-bold text-slate-500 text-[11px]">Kệ 01</td><td class="p-3 text-center text-[10px] text-emerald-700 font-bold">${i.hsd ? new Date(i.hsd).toLocaleDateString('vi-VN') : 'An toàn'}</td></tr>`).join('');
    }
    else if(activeTab === 'quanlykho') {
        let fK = document.getElementById("inv_filterKhoa").value; let uniqueKhoa = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean); document.getElementById("inv_filterKhoa").innerHTML = '<option value="">-- Tất cả --</option>' + uniqueKhoa.map(k=>`<option value="${k}" ${k===fK?'selected':''}>${k}</option>`).join('');
        let uniqueIDs = [...new Set(listGiaoDich.map(x=>x.maMacDinh))]; let arrHtml = []; const ngayHomNay = new Date(); ngayHomNay.setHours(0,0,0,0); 
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a,b) => b.id - a.id)[0]; if(!currentTrans || !ma) return;
            let viTriCode = currentTrans.status; let khoaGiữ = currentTrans.khoa; if (fK && khoaGiữ !== fK) return;
            let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if(viTriCode === "HOAN_TAT") { viTriText = `Sẵn sàng tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; } else if(viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">An toàn</span>`; let dongColorClass = ""; 
            if (currentTrans.hsd && (viTriCode === "CHO_XUAT" || viTriCode === "HOAN_TAT")) {
                const ngayHsd = new Date(currentTrans.hsd); ngayHsd.setHours(0,0,0,0); const soNgayConLai = Math.ceil((ngayHsd.getTime() - ngayHomNay.getTime()) / (1000 * 60 * 60 * 24));
                if (soNgayConLai < 0) { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">QUÁ HẠN</span>`; dongColorClass = "bg-rose-50/70 border-l-4 border-l-rose-500 font-bold"; } 
                else if (soNgayConLai <= 3) { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">HẠN < ${soNgayConLai} NGÀY</span>`; dongColorClass = "bg-amber-50/40 border-l-4 border-l-amber-500"; } 
                else { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Hạn ${soNgayConLai} ngày</span>`; }
            }
            arrHtml.push(`<tr class="border-b border-slate-100 ${dongColorClass}"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${currentTrans.bo.split(" [ID:")[0]}</td><td class="p-3 text-slate-500 text-[11px]">${khoaGiữ}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-mono font-bold text-slate-400">${currentTrans.batchCode || 'N/A'}</td><td class="p-3 text-center">${hsdBadget}</td></tr>`);
        });
        document.getElementById("bangTonKhoThucTe").innerHTML = arrHtml.join('');
    }
    else if(activeTab === 'danhmuc') {
        const tbody = document.getElementById("bangDanhMucTong"); if (!tbody) return;
        let uniqueIDs = [...new Set(listGiaoDich.map(x => x.maMacDinh))].filter(Boolean); let arrHtml = [];
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a, b) => b.id - a.id)[0]; if (!currentTrans) return;
            let viTriCode = currentTrans.status; let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if (viTriCode === "HOAN_TAT") { viTriText = `Tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; } else if (viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let chuKyLo = listGiaoDich.filter(x => x.maMacDinh === ma && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT")).length;
            arrHtml.push(`<tr class="border-b border-slate-100 font-medium"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${currentTrans.bo.split(" [ID:")[0]}</td><td class="p-3 text-center"><span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-black text-amber-700 bg-amber-50/50">${chuKyLo} lần</td></tr>`);
        });
        tbody.innerHTML = arrHtml.join('');
    }
    else if(activeTab === 'lichsuluanchuyen') {
        const tbody = document.getElementById("bangLichSuHanhTrinhGoc");
        if(tbody) {
            tbody.innerHTML = listGiaoDich.map(x => {
                let statusBadge = `<span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px]">${x.status}</span>`;
                if(x.status === "HOAN_TAT") statusBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded text-[10px]">ĐÃ BÀN GIAO</span>`;
                else if(x.status === "CHO_XUAT") statusBadge = `<span class="px-2 py-0.5 bg-teal-100 text-teal-800 font-bold rounded text-[10px]">KHO VÔ KHUẨN</span>`;
                else if(x.status === "DANG_HAP") statusBadge = `<span class="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">ĐANG HẤP LÒ</span>`;

                // LOGIC HIỂN THỊ ICON XEM NHANH ẢNH BI TEST (NẾU CÓ DỮ LIỆU)
                let minhChungHtml = "";
                let loGoc = listGiaoDich.find(m => m.batchCode === x.batchCode && m.thongTinLoHap?.giamSatChatLuong?.laMeTestSinhHocGoc === true);
                let anhBase64 = loGoc?.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64 || x.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64;
                
                if (anhBase64) {
                    minhChungHtml = `<br><span onclick="let w=window.open(); w.document.write('<img src=\''+'${anhBase64}'+'\' style=\'max-width:100%\'/>')" class="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-300 rounded px-1 cursor-pointer font-bold mt-1 inline-block"><i class="fa-solid fa-image mr-1"></i>Xem ảnh BI</span>`;
                }

                return `<tr class="border-b text-xs hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td>
                    <td class="p-3 font-bold text-slate-800">${x.bo ? x.bo.split(" [ID:")[0] : 'N/A'}</td>
                    <td class="p-3 font-semibold text-slate-500">${x.khoa || 'N/A'}</td>
                    <td class="p-3 text-center">${statusBadge}</td>
                    <td class="p-3 text-center font-mono font-bold text-rose-700 bg-rose-50/30">${x.batchCode || 'N/A'}${minhChungHtml}</td>
                    <td class="p-3 text-center font-bold text-sky-800 bg-sky-50/40">${x.nvXuatKho || '<span class="text-slate-300 font-normal">Chưa xuất</span>'}</td>
                    <td class="p-3 text-center text-slate-400 font-mono text-[11px]">${x.ngayTao || ''} ${x.time || ''}</td>
                </tr>`;
            }).join('');
        }
    }
    else if(activeTab === 'tracuu') {
        const tbody = document.getElementById("bangLichSuTruyXuatAdmin"); const searchInp = document.getElementById("inp_searchBatch")?.value.trim();
        if(tbody) {
            let dataFiltered = searchInp ? listGiaoDich.filter(x => x.batchCode && x.batchCode.toUpperCase() === searchInp.toUpperCase()) : listGiaoDich;
            tbody.innerHTML = dataFiltered.map(x => `<tr class="border-b text-xs"><td class="p-2.5 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td><td class="p-2.5 font-bold text-slate-800">${x.bo}</td><td class="p-2.5 font-semibold text-slate-500">${x.khoa}</td><td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">${x.status}</span></td><td class="p-2.5 text-center font-mono font-black text-rose-700 bg-rose-50/40">${x.batchCode || 'N/A'}</td><td class="p-2.5 text-center text-slate-400">${x.ngayTao || ''} - ${x.time || ''}</td></tr>`).join('');
        }
    }
    else if(activeTab === 'dashboard_tv') { renderDashboardTiviRealtime(); }
}

function renderDashboardTiviRealtime() {
    const homNayChuoi = getTodayDateStr();
    let slDangRua = listGiaoDich.filter(x => x.status === "DANG_RUA").length;
    let slDangHap = listGiaoDich.filter(x => x.status === "DANG_HAP").length;
    let slChoXuat = listGiaoDich.filter(x => x.status === "CHO_XUAT").length;
    let uniqueMeRuaHomNay = new Set(listGiaoDich.filter(x => x.status === "DANG_RUA" && x.ngayTao === homNayChuoi).map(x => x.time?.substring(0,5)));
    let uniqueMeHapHomNay = new Set(listGiaoDich.filter(x => x.ngayHapRealtime === homNayChuoi && x.batchCode).map(x => x.batchCode));
    let countQuadHan = 0; const ngayHomNay = new Date(); ngayHomNay.setHours(0,0,0,0);
    listGiaoDich.forEach(x => { if(x.hsd && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT")) { let nd = new Date(x.hsd); nd.setHours(0,0,0,0); if(nd.getTime() - ngayHomNay.getTime() < 0) countQuadHan++; } });
    if(document.getElementById("tv_meRua")) document.getElementById("tv_meRua").innerText = uniqueMeRuaHomNay.size;
    if(document.getElementById("tv_meHap")) document.getElementById("tv_meHap").innerText = uniqueMeHapHomNay.size;
    if(document.getElementById("tv_dangRua")) document.getElementById("tv_dangRua").innerText = slDangRua;
    if(document.getElementById("tv_dangHap")) document.getElementById("tv_dangHap").innerText = slDangHap;
    if(document.getElementById("tv_khoVoKhuan")) document.getElementById("tv_khoVoKhuan").innerText = slChoXuat;
    if(document.getElementById("tv_canhBaoHsd")) { document.getElementById("tv_canhBaoHsd").innerText = countQuadHan; }
}

function loadBoDungCuTheoKhoa() { let k = document.getElementById("khoa_selKhoa").value; let list = document.getElementById("listBoDungCu"); let f = danhSachKhoa.find(x => x.ten === k); list.innerHTML = (f && f.danhSachBo) ? f.danhSachBo.map(x => `<option value="${x}">`).join('') : ""; }
function themVaoGio() { let val = document.getElementById("khoa_inpMaBo").value.trim().toUpperCase(); if(!val) return; if (gioHangTam.some(x => x.maMacDinh === val)) { document.getElementById("khoa_inpMaBo").value = ""; return showToast("Mã này đã có trong danh sách chờ!", "error"); } let tenGoc = val.includes("[ID:") ? val.split(" [ID:")[0] : val; gioHangTam.push({bo: tenGoc, maMacDinh: val, slYeuCau: 1}); document.getElementById("khoa_inpMaBo").value = ""; renderGioHang(); }
function renderGioHang() { let khuVuc = document.getElementById("khuVucGioHang"); if(khuVuc) khuVuc.classList.toggle("hidden", gioHangTam.length===0); document.getElementById("bangGioHang").innerHTML = gioHangTam.map(i => `<tr><td class="p-2.5 font-bold text-sky-700 text-[11px]">${i.bo}</td></tr>`).join(''); }
function clearGioHang() { gioHangTam = []; renderGioHang(); }
function khoaGuiPhieuTraBatches() { const k = document.getElementById("khoa_selKhoa").value; if(!k) return showToast("Vui lòng chọn Khoa trước!"); if(gioHangTam.length === 0) return showToast("Không có dụng cụ trong danh sách!"); let p=[]; gioHangTam.forEach((i,idx) => p.push(db.collection("phieuGiaoNhan").add({ id: Date.now()+idx, ngayTao: getTodayDateStr(), time: new Date().toLocaleTimeString('vi-VN'), khoa: k, bo: i.bo, maMacDinh: i.maMacDinh, slYeuCau: 1, slThucTe: 1, status: "CHO_THU" }))); Promise.all(p).then(() => { clearGioHang(); showToast("Đã gửi lệnh thu gom!", "success"); callRender(); }); }
function inHoaDonGiaoNhan() { const k = document.getElementById("khoa_selKhoa").value; if (!k) return showToast("Vui lòng chọn Khoa/Phòng trước khi in!", "error"); let printHtml = `<div style="font-family: Arial, sans-serif; color: #000; padding: 10px;"><div style="text-align:center; margin-bottom: 20px;"><h2 style="font-size: 18px; margin-bottom: 5px;">BIÊN BẢN GIAO NHẬN DỤNG CỤ CSSD</h2><p style="font-size: 13px; margin: 0;">Khoa/Phòng: <strong style="font-size: 14px;">${k}</strong> - Ngày xuất phiếu: <strong>${new Date().toLocaleDateString('vi-VN')}</strong></p></div><table style="width:100%; border-collapse: collapse; text-align: left; font-size: 13px; font-family: Arial, sans-serif;"><thead><tr style="background-color: #f8fafc;"><th style="border: 1px solid #000; padding: 10px; font-weight: bold;">Phân Loại Mâm / Loại Dụng Cụ</th><th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">Đã Trả Bẩn</th><th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">Nhận Sạch</th><th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">CSSD Nợ Khoa</th></tr></thead><tbody>${document.getElementById("bangDonGiaoNhan").innerHTML}</tbody></table></div>`; const pZone = document.getElementById("print-zone"); pZone.innerHTML = printHtml; pZone.classList.remove("hidden"); window.print(); pZone.classList.add("hidden"); }
function moPopupKiemDem(id) { idDangKiemDem = id; let item = listGiaoDich.find(x => x.firestoreId === id); if(item) { document.getElementById("popBo").innerText = item.bo; document.getElementById("popKhoa").innerText = item.khoa; let tenBo = item.bo.split(" [ID:")[0]; let itemsInBo = databaseExcel.filter(x => { let boName = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; return String(boName).trim().toUpperCase() === String(tenBo).trim().toUpperCase(); }); let chkList = document.getElementById("popKiemDemChecklist"); if(itemsInBo.length > 0) { chkList.innerHTML = itemsInBo.map((ct, idx) => { let tenDc = ct['Tên Dụng Cụ Chi Tiết'] || ct['Tên dụng cụ'] || ct['Chi tiết'] || ct['Dụng cụ'] || ct['TÊN BỘ'] || ct['Tên Chi Tiết'] || ct['NAME'] || "Dụng cụ"; let sl = ct['Số lượng'] || ct['SL'] || ct['Số Lượng'] || 1; return `<label class="flex items-center justify-between py-2 border-b border-slate-200 cursor-pointer hover:bg-slate-100 px-2 rounded"><div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded text-sky-600"><span class="text-[12px] font-bold text-slate-700">${tenDc}</span></div><span class="text-[12px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded">SL: ${sl}</span></label>`; }).join(''); } else { chkList.innerHTML = `<p class="italic text-center text-[11px] text-slate-400 py-4">Chưa có cấu hình chi tiết linh kiện.</p>`; } document.getElementById("popGhiChu").value = ""; document.getElementById("popupKiemDem").classList.remove("hidden"); } }
function closePopupKiemDem() { document.getElementById("popupKiemDem").classList.add("hidden"); }
function saveKiemDem() { if(!idDangKiemDem) return; db.collection("phieuGiaoNhan").doc(idDangKiemDem).update({ status: "DANG_RUA", ghiChu: document.getElementById("popGhiChu").value }).then(() => { showToast("Đã chuyển mâm sang Trạm Làm Sạch!", "success"); closePopupKiemDem(); callRender(); }); }
function moPopupDongGoi(id) { idDangDongGoi = id; let item = listGiaoDich.find(x => x.firestoreId === id); if(item) { document.getElementById("popDG_Bo").innerText = item.bo; tinhHanSuDung(); document.getElementById("popupDongGoi").classList.remove("hidden"); } }
function closePopupDongGoi() { document.getElementById("popupDongGoi").classList.add("hidden"); }
function tinhHanSuDung() { let val = document.getElementById("popDG_Loai").value.split("|"); let days = parseInt(val[1]); let dateHSD = new Date(); dateHSD.setDate(dateHSD.getDate() + days); let p = document.getElementById("popDG_Han"); p.innerText = dateHSD.toLocaleDateString('vi-VN'); p.dataset.dateDB = dateHSD.toISOString().split('T')[0]; }
function chotDongGoi() { if(!idDangDongGoi) return; let chatLieuTen = document.getElementById("popDG_Loai").value.split("|")[0]; db.collection("phieuGiaoNhan").doc(idDangDongGoi).update({ status: "CHO_HAP", chatLieu: chatLieuTen, hsd: document.getElementById("popDG_Han").dataset.dateDB }).then(() => { showToast("Đã đóng gói, chuyển chờ hấp!", "success"); closePopupDongGoi(); callRender(); }); }
function toggleSelectAllHap() { let checked = document.getElementById('selectAllHap').checked; document.querySelectorAll('.hap-checkbox').forEach(cb => cb.checked = checked); }
function capNhatDanhSachMaMay() { const loaiHap = document.getElementById("hap_loaiHap")?.value; const selectMay = document.getElementById("hap_maySo"); if (!selectMay || !loaiHap) return; selectMay.innerHTML = ""; if (cauHinhMayHap[loaiHap]) { cauHinhMayHap[loaiHap].forEach(may => { selectMay.innerHTML += `<option value="${may}">${may}</option>`; }); } tuDongTaoMaLoMeHap(); }
function inTemTongHangLoat() { let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm để in tem!", "error"); let batchCode = document.getElementById("hap_batchId")?.value || "A1000000_01"; let container = document.createElement('div'); container.className = "print-label-container"; container.style.display = "flex"; container.style.flexWrap = "wrap"; container.style.width = "100%"; container.style.gap = "4px"; let stylePrint = document.createElement('style'); stylePrint.innerHTML = `@media print { body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: absolute; left: 0; top: 0; width: 100%; } .print-label-container { display: flex !important; flex-wrap: wrap !important; width: 100% !important; } .single-tem { width: 49% !important; page-break-inside: avoid; break-inside: avoid; } }`; container.appendChild(stylePrint); checkboxes.forEach((cb) => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let tenBoText = item.bo.split(" [ID:")[0]; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; container.innerHTML += `<div class="single-tem" style="width: 49%; border: 1px solid #000; padding: 6px; font-family: Arial; font-size: 11px; color: #000; box-sizing: border-box; background: #fff; margin-bottom: 6px;"><div style="text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tenBoText}</div><div style="text-align: center;"><svg id="barcode-lo-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span></div><div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dashed #000; padding-top: 3px; font-size: 10px;"><span>${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 9px; margin-top: 2px; font-family: monospace; font-weight: bold;">Lô: ${batchCode}</div></div>`; } }); const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); pZone.classList.remove("hidden"); checkboxes.forEach(cb => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-lo-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.2, height: 30, displayValue: true, fontSize: 10, margin: 2 }); } }); setTimeout(() => { window.print(); pZone.classList.add("hidden"); }, 300); }
function toggleSelectAllNghiemThu() { let checked = document.getElementById('selectAllNghiemThu').checked; document.querySelectorAll('.nghiemthu-checkbox').forEach(cb => cb.checked = checked); }
function nhapKhoHangLoat() { let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!"); let p = []; checkboxes.forEach(cb => { if(cb.id === 'selectAllNghiemThu') return; p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "CHO_XUAT"})); }); Promise.all(p).then(() => { showToast("Đã duyệt mâm đạt nhập kho Vô Khuẩn!", "success"); callRender(); }); }
function inTemNghiemThuHangLoat() { let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); let container = document.createElement('div'); container.className = "print-label-container"; container.style.display = "flex"; container.style.flexWrap = "wrap"; container.style.width = "100%"; container.style.gap = "4px"; let stylePrint = document.createElement('style'); stylePrint.innerHTML = `@media print { body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: absolute; left: 0; top: 0; width: 100%; } .print-label-container { display: flex !important; flex-wrap: wrap !important; width: 100% !important; } .single-tem { width: 49% !important; page-break-inside: avoid; break-inside: avoid; } }`; container.appendChild(stylePrint); checkboxes.forEach((cb) => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let tenBoText = item.bo.split(" [ID:")[0]; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; container.innerHTML += `<div class="single-tem" style="width: 49%; border: 1px solid #000; padding: 6px; font-family: Arial; font-size: 11px; color: #000; box-sizing: border-box; background: #fff; margin-bottom: 6px;"><div style="text-align: center; font-size: 9px; font-weight: bold;">PN HOSPITAL - CSSD</div><div style="text-align: center; font-weight: bold; font-size: 12px; margin: 2px 0;">${tenBoText}</div><div style="text-align: center;"><svg id="barcode-nt-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span><span style="color: green;">ĐẠT VÔ KHUẨN</span></div><div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; font-size: 10px;"><span>${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 8px; font-weight: bold; margin-top: 2px; font-family: monospace;">BATCH: ${item.batchCode || 'N/A'}</div></div>`; } }); const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); pZone.classList.remove("hidden"); checkboxes.forEach(cb => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-nt-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.2, height: 30, displayValue: true, fontSize: 10, margin: 2 }); } }); setTimeout(() => { window.print(); pZone.classList.add("hidden"); }, 300); }
function tuChoiHapHangLoat() { let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); let p = []; checkboxes.forEach(cb => { if(cb.id === 'selectAllNghiemThu') return; p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "DANG_RUA", ghiChu: "Không đạt hấp, trả về rửa lại"})); }); Promise.all(p).then(() => { showToast("Đã trả các mâm không đạt về Trạm làm sạch!", "success"); callRender(); }); }
function resetDuLieuKet() { if(confirm("Dọn dẹp mâm kẹt?")) { let p = []; listGiaoDich.forEach(doc => { if(doc.status !== "HOAN_TAT") { p.push(db.collection("phieuGiaoNhan").doc(doc.firestoreId).update({ status: "HOAN_TAT", ghiChu: "Dọn kẹt" })); } }); Promise.all(p).then(() => callRender()); } }
function switchAdminSubtab(sub) { document.getElementById('subtab-database').classList.add('hidden'); document.getElementById('subtab-security').classList.add('hidden'); document.getElementById('subbtn-database').classList.replace('admin-subtab-active', 'text-slate-600'); document.getElementById('subbtn-security').classList.replace('admin-subtab-active', 'text-slate-600'); document.getElementById('subtab-' + sub).classList.remove('hidden'); document.getElementById('subbtn-' + sub).classList.add('admin-subtab-active'); }
function saveAdminPIN(type) { let newVal = document.getElementById(`cfg_pin${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`).value.trim(); if(type === 'ADMIN') thongTinMatKhauAdmin.adminPIN = newVal; if(type === 'CSSD') thongTinMatKhauAdmin.cssdPIN = newVal; if(type === 'GUEST') thongTinMatKhauAdmin.guestPIN = newVal; db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ thongTinMatKhauAdmin: thongTinMatKhauAdmin }).then(() => showToast("Đã lưu PIN!", "success")); }
function themKtvCssd() { let code = prompt("Mã NV:"); let ten = prompt("Tên:"); let pin = prompt("PIN:"); if(code && ten && pin) { danhSachKtvCssd.push({ code: code.toUpperCase(), ten: ten, pin: pin }); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }); } }
function xoaKtvCssd(code) { if(confirm("Xóa?")) { danhSachKtvCssd = danhSachKtvCssd.filter(x => x.code !== code); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }); } }
function themKhoaThuCong() { let t = prompt("Tên Khoa:"); if(t) { danhSachKhoa.push({ ten: t.toUpperCase(), pin: "123", danhSachBo: [] }); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }); } }
function updatePINTrựcTiep(idx, tenKhoa) { let p = document.getElementById(`pin-khoa-${idx}`).value.trim(); if(p) { danhSachKhoa.find(x => x.ten === tenKhoa).pin = p; db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => showToast("Đổi PIN thành công", "success")); } }
function initSelects() { 
    let opts = '<option value="">-- Chọn Khoa --</option>' + danhSachKhoa.map(k=>`<option value="${k.ten}">${k.ten}</option>`).join('');
    document.getElementById("login_khoa").innerHTML = opts; 
    document.getElementById("khoa_selKhoa").innerHTML = opts; 
    
    // ĐỒNG BỘ: Nạp danh sách khoa phòng vào bộ lọc tìm kiếm của Tab 2 (Xe Thu Gom)
    if (document.getElementById("filterKhoaThuGom")) {
        document.getElementById("filterKhoaThuGom").innerHTML = '<option value="">-- Lọc theo Khoa --</option>' + danhSachKhoa.map(k=>`<option value="${k.ten}">${k.ten}</option>`).join('');
    }
    
    if(document.getElementById("login_nv_cssd")) document.getElementById("login_nv_cssd").innerHTML = '<option value="">-- Chọn KTV CSSD --</option>' + danhSachKtvCssd.map(k=>`<option value="${k.code}">${k.code} - ${k.ten}</option>`).join(''); 
}
function showToast(msg, type="error") { const t = document.createElement('div'); t.className = `fixed top-6 right-6 ${type==="error"?"bg-rose-600":"bg-emerald-600"} text-white px-5 py-3.5 rounded-lg shadow-2xl z-[100] font-bold text-sm`; t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }
function toggleMobileMenu() { document.getElementById("sidebar_menu").classList.toggle("-translate-x-full"); document.getElementById("mobile-overlay").classList.toggle("hidden"); }
function toggleLoginFields() { const r = document.getElementById("login_role").value; document.getElementById("field_khoa").style.display = (r === "KHOA") ? "block" : "none"; document.getElementById("field_nhanvien_cssd").style.display = (r === "CSSD") ? "block" : "none"; }
function moCamera(inputId) { targetInputIdForScan = inputId; document.getElementById("popupScanner").classList.remove("hidden"); html5QrCode = new Html5Qrcode("reader"); Html5Qrcode.getCameras().then(devices => { let cid = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id; html5QrCode.start(cid, { fps: 15, qrbox: { width: 260, height: 180 } }, (txt) => { document.getElementById(targetInputIdForScan).value = txt.trim().toUpperCase(); if(targetInputIdForScan==='khoa_inpMaBo') themVaoGio(); if(targetInputIdForScan==='xuat_inpMaBo') xuatKhoXoayVong(); }).catch(e=>{}) }); }
function dongCamera() { if(html5QrCode) html5QrCode.stop().then(() => html5QrCode.clear()); document.getElementById("popupScanner").classList.add("hidden"); }
function xoaSachDuLieuGiaoDichRealtime() { if(prompt("Nhập PIN ADMIN để xóa:") === (thongTinMatKhauAdmin.adminPIN||"admin2026")) { db.collection("phieuGiaoNhan").get().then(snap => { let b = db.batch(); snap.forEach(d => b.delete(d.ref)); b.commit().then(() => location.reload()); }); } }
function truyVetTheoMaBatch() { callRender(); }
function clearTruyVetBatch() { document.getElementById("inp_searchBatch").value = ""; callRender(); }
