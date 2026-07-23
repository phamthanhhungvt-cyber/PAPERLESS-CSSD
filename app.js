// =========================================================================
// 1. KHỞI TẠO HỆ THỐNG & CẤU HÌNH BIẾN TOÀN CỤC (PN HOSPITAL)
// =========================================================================
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL</title>
    
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- FontAwesome Icons CDN -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
    
    <!-- Firebase SDK (v8) -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    
    <!-- JsBarcode & Html5-QRCode Library -->
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script src="https://unpkg.com/html5-qrcode"></script>
    <!-- SheetJS (XLSX) for Excel Reading -->
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

    <style>
        .sidebar-item-active {
            background-color: #0284c7 !important;
            color: #ffffff !important;
            font-weight: bold;
        }
        .admin-subtab-active {
            border-bottom: 2px solid #0284c7;
            color: #0284c7;
            font-weight: bold;
        }
        body.guest-mode .action-col {
            display: none !important;
        }
        
        /* Cấu hình in ấn chuyên dụng */
        @media print {
            body * { visibility: hidden; }
            #print-zone, #print-zone * { visibility: visible; }
            #print-zone { position: absolute; left: 0; top: 0; width: 100%; }
        }
        
        /* Cấu hình in tem Bixolon 80mm x 50mm */
        .print-mode-bixolon .bixolon-label {
            width: 80mm;
            height: 50mm;
            padding: 4mm;
            box-sizing: border-box;
            page-break-after: always;
            background: #fff;
            color: #000;
        }
        
        /* Cấu hình in tài liệu / biên bản A4 */
        .print-mode-doc #print-zone {
            padding: 20px;
            background: #fff;
        }
    </style>
</head>
<body class="bg-slate-100 font-sans text-slate-800 antialiased min-h-screen">

    <!-- ========================================================================= -->
    <!-- 1. MÀN HÌNH ĐĂNG NHẬP -->
    <!-- ========================================================================= -->
    <div id="login-screen" class="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 border border-slate-100">
            <div class="text-center mb-6">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 text-sky-600 mb-3 text-2xl">
                    <i class="fa-solid fa-hospital-user"></i>
                </div>
                <h1 class="text-xl font-black text-slate-800 tracking-tight">PHUONG NAM HOSPITAL</h1>
                <p class="text-xs font-bold text-sky-600 uppercase tracking-widest mt-0.5">Hệ Thống Số Hóa Quản Lý CSSD</p>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">VAI TRÒ TRUY CẬP</label>
                    <select id="login_role" onchange="toggleLoginFields()" class="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none">
                        <option value="ADMIN">👑 VAI TRÒ QUANTRI (ADMIN)</option>
                        <option value="CSSD">🧪 NHÂN VIÊN VẬN HÀNH CSSD</option>
                        <option value="KHOA">🏥 KHOA / PHÒNG LÂM SÀNG</option>
                        <option value="GUEST">👁️ KHÁCH THAM QUAN (GUEST)</option>
                    </select>
                </div>

                <div id="field_khoa" class="hidden">
                    <label class="block text-xs font-bold text-slate-600 mb-1">CHỌN KHOA / PHÒNG</label>
                    <select id="login_khoa" class="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none">
                        <option value="">-- Chọn Khoa --</option>
                    </select>
                </div>

                <div id="field_nhanvien_cssd" class="hidden">
                    <label class="block text-xs font-bold text-slate-600 mb-1">NHÂN VIÊN CSSD KÍCH HOẠT</label>
                    <select id="login_nv_cssd" class="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none">
                        <option value="">-- Chọn KTV CSSD --</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">MÃ PIN XÁC THỰC</label>
                    <input type="password" id="login_pass" placeholder="••••••••" class="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none">
                </div>

                <button onclick="checkLogin()" class="w-full bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-black py-3 rounded-lg shadow-lg text-sm tracking-wider uppercase transition-all mt-2">
                    Xác Nhận Đăng Nhập
                </button>
            </div>
        </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2. GIAO DIỆN CHÍNH UNIFIED APPLICATION -->
    <!-- ========================================================================= -->
    <div id="main-app" class="hidden min-h-screen flex flex-col md:flex-row">
        
        <!-- Sidebar Navigation -->
        <aside id="sidebar_menu" class="fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transform -translate-x-full md:translate-x-0 transition-transform duration-200 ease-in-out flex flex-col justify-between shadow-2xl">
            <div>
                <!-- Brand Banner -->
                <div class="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <div class="text-xs font-black text-sky-400 tracking-wider">PN HOSPITAL</div>
                        <div class="text-sm font-extrabold text-white">CSSD DIGITAL WORKFLOW</div>
                    </div>
                    <button onclick="toggleMobileMenu()" class="md:hidden text-slate-400 hover:text-white">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Navigation Links -->
                <nav class="p-3 space-y-1 text-xs font-semibold overflow-y-auto max-h-[calc(100vh-140px)]">
                    <!-- Section: Cổng Lâm Sàng -->
                    <div id="header-lamsang" class="text-[10px] font-black text-slate-500 uppercase px-3 pt-3 pb-1">Cổng Lâm Sàng</div>
                    <button id="menu-khoaphong" onclick="switchTab('khoaphong')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-hospital-user w-4 text-sky-400"></i><span>Cổng Báo Trả & Nhận Đồ</span>
                    </button>

                    <!-- Section: Vận Hành CSSD -->
                    <div id="header-vanhanh" class="text-[10px] font-black text-slate-500 uppercase px-3 pt-3 pb-1">Trạm Vận Hành CSSD</div>
                    <button id="menu-thugom" onclick="switchTab('thugom')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-truck-pickup w-4 text-sky-400"></i><span>Xe Thu Gom & Đổi Soát</span>
                    </button>
                    <button id="menu-mayrua" onclick="switchTab('mayrua')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-soap w-4 text-sky-400"></i><span>Mẻ Rửa Belimed WD250</span>
                    </button>
                    <button id="menu-donggoi" onclick="switchTab('donggoi')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-box-open w-4 text-sky-400"></i><span>Làm Sạch & Đóng Gói</span>
                    </button>
                    <button id="menu-mayhap" onclick="switchTab('mayhap')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-temperature-arrow-up w-4 text-sky-400"></i><span>Mẻ Hấp Tiệt Trùng</span>
                    </button>
                    <button id="menu-khovokhuan" onclick="switchTab('khovokhuan')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-warehouse w-4 text-sky-400"></i><span>Kho Vô Khuẩn & Xuất Đồ</span>
                    </button>

                    <!-- Section: Dữ Liệu & Giám Sát -->
                    <div id="header-dulieu" class="text-[10px] font-black text-slate-500 uppercase px-3 pt-3 pb-1">Dữ Liệu & Báo Cáo</div>
                    <button id="menu-quanlykho" onclick="switchTab('quanlykho')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-boxes-stacked w-4 text-sky-400"></i><span>Tồn Kho Toàn Viện</span>
                    </button>
                    <button id="menu-danhmuc" onclick="switchTab('danhmuc')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-list-check w-4 text-sky-400"></i><span>Cơ Số Linh Kiện chuẩn</span>
                    </button>
                    <button id="menu-lichsuluanchuyen" onclick="switchTab('lichsuluanchuyen')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-clock-rotate-left w-4 text-sky-400"></i><span>Nhật Ký Luân Chuyển</span>
                    </button>
                    <button id="menu-tracuu" onclick="switchTab('tracuu')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-magnifying-glass w-4 text-sky-400"></i><span>Truy Xuất Mẻ Tiệt Trùng</span>
                    </button>
                    <button id="menu-performance" onclick="switchTab('performance')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-chart-line w-4 text-sky-400"></i><span>KPI Đọc BI 30 Phút</span>
                    </button>
                    <button id="menu-dashboard_tv" onclick="switchTab('dashboard_tv')" class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors">
                        <i class="fa-solid fa-tv w-4 text-sky-400"></i><span>Dashboard Tivi Trung Tâm</span>
                    </button>
                </nav>
            </div>

            <!-- User Info Footer -->
            <div class="p-3 border-t border-slate-800 bg-slate-950">
                <div class="flex items-center justify-between">
                    <div class="truncate">
                        <div class="text-[10px] text-slate-500 font-bold uppercase">Đang Đăng Nhập</div>
                        <div id="nav_user_info" class="text-xs font-black text-sky-400 truncate">ADMINISTRATOR</div>
                    </div>
                    <button onclick="location.reload()" class="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="Đăng xuất">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main Content Zone -->
        <main class="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8">
            
            <!-- Mobile Topbar Header -->
            <div class="md:hidden mb-4 flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                <button onclick="toggleMobileMenu()" class="p-2 text-slate-700">
                    <i class="fa-solid fa-bars text-lg"></i>
                </button>
                <span class="font-black text-xs text-sky-800 tracking-wider">CSSD SYSTEM</span>
                <span class="w-8"></span>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 1: KHOA PHÒNG LÂM SÀNG -->
            <!-- ========================================================================= -->
            <div id="tab-khoaphong" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-hospital-user mr-2 text-sky-600"></i>TRẠM GIAO NHẬN TẠI KHOA / PHÒNG</h2>
                            <p class="text-xs text-slate-500">Tạo lệnh báo trả mâm bẩn hoặc yêu cầu cấp mới khay vô khuẩn</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <select id="khoa_selKhoa" class="border border-slate-300 rounded-lg p-2 text-xs font-bold text-sky-800 bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none">
                                <option value="">-- Chọn Khoa --</option>
                            </select>
                            <button onclick="inHoaDonGiaoNhan()" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-xs shadow flex items-center gap-1.5">
                                <i class="fa-solid fa-print"></i> Biên Bản Công Nợ
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Quét Mâm Bẩn -->
                        <div class="lg:col-span-1 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <h3 class="font-black text-xs text-slate-700 uppercase tracking-wider"><i class="fa-solid fa-barcode mr-1.5 text-sky-600"></i>Nhập / Quét Mã Mâm Bẩn</h3>
                            <div class="flex gap-2">
                                <input type="text" id="khoa_inpMaBo" list="listBoDungCu" placeholder="Chọn hoặc quét mã mâm..." class="flex-1 border border-slate-300 rounded-lg p-2.5 text-xs font-bold uppercase focus:ring-2 focus:ring-sky-500 outline-none">
                                <datalist id="listBoDungCu"></datalist>
                                <button onclick="moCamera('khoa_inpMaBo')" class="bg-sky-600 text-white p-2.5 rounded-lg hover:bg-sky-700" title="Quét Cam">
                                    <i class="fa-solid fa-camera"></i>
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="themVaoGio()" class="flex-1 bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-lg text-xs shadow">
                                    + Thêm Vào Giỏ
                                </button>
                                <button onclick="khoaGuiYeuCauCapPhat()" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-2 rounded-lg text-xs shadow" title="Yêu cầu cấp khay mới">
                                    <i class="fa-solid fa-hand-holding-hand"></i> Yêu Cầu Cấp
                                </button>
                            </div>

                            <!-- Giỏ hàng tạm -->
                            <div id="khuVucGioHang" class="hidden pt-3 border-t border-slate-200">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-xs font-bold text-slate-600">Giỏ Báo Trả Tạm:</span>
                                    <span id="badgeGioHang" class="bg-sky-100 text-sky-800 text-[10px] font-black px-2 py-0.5 rounded-full">0 món</span>
                                </div>
                                <div class="max-h-40 overflow-y-auto bg-white rounded-lg border border-slate-200 mb-3">
                                    <table class="w-full text-left"><tbody id="bangGioHang"></tbody></table>
                                </div>
                                <button onclick="khoaGuiPhieuTraBatches()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow tracking-wider">
                                    🚀 Báo CSSD Đến Thu Gom
                                </button>
                            </div>
                        </div>

                        <!-- Bảng Công Nợ Luân Chuyển -->
                        <div class="lg:col-span-2 space-y-4">
                            <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div class="bg-slate-800 text-white p-3 text-xs font-black uppercase tracking-wider flex justify-between items-center">
                                    <span><i class="fa-solid fa-scale-balanced mr-2"></i>Bảng Công Nợ Luân Chuyển Dụng Cụ</span>
                                </div>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b">
                                                <th class="p-3">Loại Mâm / Dụng Cụ</th>
                                                <th class="p-3 text-center">Đã Trả Bẩn</th>
                                                <th class="p-3 text-center">Nhận Sạch</th>
                                                <th class="p-3 text-center">Nhận Vô Khuẩn</th>
                                                <th class="p-3 text-center">CSSD Nợ Khoa</th>
                                            </tr>
                                        </thead>
                                        <tbody id="bangDonGiaoNhan"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Danh Sách Chờ Nhận Vô Khuẩn & Yêu Cầu Cấp Phát -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t">
                        <!-- Xe Trung Chuyển Giao Lên -->
                        <div class="bg-purple-50/50 border border-purple-200 p-4 rounded-xl space-y-3">
                            <div class="flex justify-between items-center">
                                <h3 class="font-black text-xs text-purple-900 uppercase"><i class="fa-solid fa-truck-ramp-box mr-1.5"></i>Đang Vận Chuyển Về Khoa</h3>
                                <span id="badgeChoNhanKhoa" class="bg-purple-200 text-purple-900 text-[10px] font-black px-2 py-0.5 rounded-full">0 khay</span>
                            </div>
                            <div id="txtNguoiDungNhanHienTai" class="text-[11px] font-bold text-purple-700"></div>
                            <div class="overflow-x-auto bg-white rounded-lg border border-purple-200 max-h-48">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-purple-100 text-[10px] font-bold text-purple-800 border-b">
                                            <th class="p-2 text-center">Chọn</th>
                                            <th class="p-2">Mã ID</th>
                                            <th class="p-2">Tên Mâm</th>
                                            <th class="p-2">NVKH Xuất</th>
                                            <th class="p-2 text-center">Lô Tiệt Trùng</th>
                                        </tr>
                                    </thead>
                                    <tbody id="bangChoNhanTaiKhoa"></tbody>
                                </table>
                            </div>
                            <button onclick="khoaKyNhanDoSachDienTu()" class="w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-2 rounded-lg text-xs uppercase shadow">
                                ✍️ Ký Nhận Tiếp Nhận Đồ Sạch Về Tủ Khoa
                            </button>
                        </div>

                        <!-- Yêu Cầu Cấp Phát Đang Chờ -->
                        <div class="bg-amber-50/50 border border-amber-200 p-4 rounded-xl space-y-3">
                            <h3 class="font-black text-xs text-amber-900 uppercase"><i class="fa-solid fa-clock-rotate-left mr-1.5"></i>Trạng Thái Yêu Cầu Cấp Mới</h3>
                            <div class="overflow-x-auto bg-white rounded-lg border border-amber-200 max-h-56">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-amber-100 text-[10px] font-bold text-amber-900 border-b">
                                            <th class="p-2.5">Mâm Yêu Cầu</th>
                                            <th class="p-2.5 text-center">Trạng Thái</th>
                                            <th class="p-2.5 text-center">Giờ Yêu Cầu</th>
                                            <th class="p-2.5 text-center">Người Yêu Cầu</th>
                                        </tr>
                                    </thead>
                                    <tbody id="bangChoCapPhatTaiKhoa"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 2: XE THU GOM & ĐỐI SOÁT KIỂM ĐẾM -->
            <!-- ========================================================================= -->
            <div id="tab-thugom" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-truck-pickup mr-2 text-sky-600"></i>XE THU GOM DỤNG CỤ BẨN</h2>
                            <p class="text-xs text-slate-500">Đối soát chi tiết linh kiện mâm dụng cụ bẩn thu gom từ lâm sàng</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <select id="filterKhoaThuGom" onchange="callRender()" class="border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none">
                                <option value="">-- Lọc Theo Khoa --</option>
                            </select>
                            <span id="badgeSoCho" class="bg-rose-500 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow">0 Lệnh</span>
                        </div>
                    </div>

                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                    <th class="p-3 w-1/4">Khoa / Phòng Gửi</th>
                                    <th class="p-3 w-2/4">Bộ Dụng Cụ Bẩn & Cấu Hình Chi Tiết</th>
                                    <th class="p-3 text-center w-1/8">Thời Gian</th>
                                    <th class="p-3 text-center w-1/8 action-col">Hành Động</th>
                                </tr>
                            </thead>
                            <tbody id="bangChoThuGom"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 3: QUẢN LÝ MẺ RỬA BELIMED WD250 -->
            <!-- ========================================================================= -->
            <div id="tab-mayrua" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-soap mr-2 text-sky-600"></i>VẬN HÀNH MẺ RỬA KHỬ KHUẨN (BELIMED WD250)</h2>
                            <p class="text-xs text-slate-500">Thiết lập tham số chu trình và nghiệm thu hiệu quả làm sạch</p>
                        </div>
                        <span id="badgeChoRua" class="bg-sky-600 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow">0 Mục</span>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Cấu hình chạy mẻ rửa -->
                        <div class="lg:col-span-1 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <h3 class="font-black text-xs text-slate-700 uppercase tracking-wider"><i class="fa-solid fa-sliders mr-1 text-sky-600"></i>Cấu Hình Mẻ Máy Rửa</h3>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Phương thức rửa</label>
                                <select id="rua_loaiRua" onchange="capNhatDanhSachMaMayRua()" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none">
                                    <option value="Máy rửa khử khuẩn tự động">Máy rửa khử khuẩn tự động</option>
                                    <option value="Máy rửa sóng siêu âm">Máy rửa sóng siêu âm</option>
                                    <option value="Bồn rửa thủ công">Bồn rửa thủ công</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Mã thiết bị rửa</label>
                                <select id="rua_maySo" onchange="tuDongTaoMaLoMeRua()" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none"></select>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 mb-1">Số Mẻ Ngày</label>
                                    <input type="text" id="rua_meSo" readonly class="w-full bg-slate-200 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-center">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 mb-1">Mã Lô Định Danh</label>
                                    <input type="text" id="rua_batchId" readonly class="w-full bg-slate-200 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-center text-sky-700">
                                </div>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Chu trình làm sạch</label>
                                <select id="rua_chuKy" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none">
                                    <option value="Tiêu chuẩn (93°C - 10 phút)">Tiêu chuẩn (93°C - 10 phút)</option>
                                    <option value="Dụng cụ phẫu thuật nội soi">Dụng cụ phẫu thuật nội soi</option>
                                    <option value="Dụng cụ vi phẫu tinh xảo">Dụng cụ vi phẫu tinh xảo</option>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 mb-1">Hóa chất chuyên dụng</label>
                                    <select id="rua_hoaChat" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none"></select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 mb-1">Liều lượng / Lít</label>
                                    <input type="text" id="rua_lieuLuong" class="w-full border border-slate-300 rounded p-2 text-xs font-bold text-center">
                                </div>
                            </div>
                            <button onclick="xacNhanMeRua()" class="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow transition-all">
                                🚀 Kích Hoạt Chạy Mẻ Rửa
                            </button>
                        </div>

                        <!-- Danh sách mâm chờ xếp buồng rửa -->
                        <div class="lg:col-span-2 space-y-4">
                            <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div class="bg-slate-800 text-white p-3 text-xs font-black uppercase flex justify-between items-center">
                                    <span>Hàng Đợi Xếp Vào Buồng Rửa</span>
                                    <label class="text-[10px] font-normal flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" id="selectAllRua" onchange="toggleSelectAllRua()" class="rounded"> Chọn Tất Cả
                                    </label>
                                </div>
                                <div class="max-h-56 overflow-y-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b">
                                                <th class="p-2 text-center w-12">Chọn</th>
                                                <th class="p-2">Tên Bộ Dụng Cụ</th>
                                                <th class="p-2 text-right">Mã ID Khay</th>
                                            </tr>
                                        </thead>
                                        <tbody id="bangChoRua"></tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Nghiệm thu mẻ rửa đang chạy -->
                            <div class="bg-sky-50/50 border border-sky-200 p-4 rounded-xl space-y-3">
                                <div class="flex justify-between items-center">
                                    <h3 class="font-black text-xs text-sky-900 uppercase"><i class="fa-solid fa-check-double mr-1"></i>Nghiệm Thu Mẻ Đang Trong Buồng Rửa</h3>
                                    <label class="text-[10px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" id="selectAllNghiemThuRua" onchange="toggleSelectAllNghiemThuRua()" class="rounded"> Chọn Tất Cả
                                    </label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <select id="rua_testDoSach" class="flex-1 border border-slate-300 rounded p-2 text-xs font-bold outline-none">
                                        <option value="ĐẠT (Protein Test Negative)">🟢 ĐẠT (Test Protein Âm tính)</option>
                                        <option value="KHÔNG ĐẠT (Còn tồn dư máu/mủ)">🔴 KHÔNG ĐẠT (Tồn dư vết bẩn)</option>
                                    </select>
                                    <button onclick="duyetSachMeRuaHangLoat()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded text-xs shadow">
                                        Duyệt Đạt
                                    </button>
                                    <button onclick="tuChoiMeRuaHangLoat()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded text-xs shadow">
                                        Rửa Lại
                                    </button>
                                </div>
                                <div class="max-h-40 overflow-y-auto bg-white rounded border border-sky-200">
                                    <table class="w-full text-left"><tbody id="bangChoNiemThuRua"></tbody></table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Nhật ký mẻ rửa trong ngày -->
                    <div class="pt-4 border-t">
                        <h3 class="font-black text-xs text-slate-700 uppercase mb-3"><i class="fa-solid fa-receipt mr-1"></i>Mẻ Rửa Đã Chạy Trong Ngày</h3>
                        <div class="overflow-x-auto border border-slate-200 rounded-xl">
                            <table class="w-full text-left border-collapse">
                                <tbody id="bangLichSuRua"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 4: LÀM SẠCH VÀ ĐÓNG GÓI -->
            <!-- ========================================================================= -->
            <div id="tab-donggoi" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex justify-between items-center mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-box-open mr-2 text-sky-600"></i>TRẠM LÀM SẠCH & ĐÓNG GÓI DỤNG CỤ</h2>
                            <p class="text-xs text-slate-500">Kiểm tra bề mặt, tra dầu khớp nối và đóng gói vật liệu bao bọc</p>
                        </div>
                        <span id="badgeDongGoi" class="bg-amber-500 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow">0</span>
                    </div>

                    <div id="gridDongGoi" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 5: VẬN HÀNH MẺ HẤP & DUYỆT NHẬP KHO -->
            <!-- ========================================================================= -->
            <div id="tab-mayhap" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-temperature-arrow-up mr-2 text-sky-600"></i>QUẢN LÝ MẺ HẤP TIỆT TRÙNG</h2>
                            <p class="text-xs text-slate-500">Ghi nhận thông số lò tiệt trùng, kiểm tra chỉ thị sinh học (BI)</p>
                        </div>
                        <span id="badgeChoHap" class="bg-purple-600 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow">0 Mục</span>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Cấu hình lò tiệt trùng -->
                        <div class="lg:col-span-1 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <h3 class="font-black text-xs text-slate-700 uppercase tracking-wider"><i class="fa-solid fa-fire-burner mr-1 text-sky-600"></i>Thông Số Thiết Bị Hấp</h3>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Phương pháp tiệt trùng</label>
                                <select id="hap_loaiHap" onchange="capNhatDanhSachMaMay()" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none">
                                    <option value="Hấp hơi nước">Hấp hơi nước (Steam)</option>
                                    <option value="Hấp H2O2 (Plasma)">Hấp H2O2 (Plasma)</option>
                                    <option value="Khử khuẩn EO">Khử khuẩn EO</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Số hiệu máy hấp</label>
                                <select id="hap_maySo" onchange="tuDongTaoMaLoMeHap()" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none"></select>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 mb-1">Số Mẻ Lò</label>
                                    <input type="text" id="hap_meSo" readonly class="w-full bg-slate-200 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-center">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-600 mb-1">Mã Lô Lò Hấp</label>
                                    <input type="text" id="hap_batchId" readonly class="w-full bg-slate-200 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-center text-rose-700">
                                </div>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Chu kỳ nhiệt độ / Thời gian</label>
                                <select id="hap_nhietDo" class="w-full border border-slate-300 rounded p-2 text-xs font-bold outline-none">
                                    <option value="134°C - 4 phút">134°C - 4 phút (Chuẩn phẫu thuật)</option>
                                    <option value="121°C - 20 phút">121°C - 20 phút (Cao su/Nhựa)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-600 mb-1">Áp suất định mức (Bar)</label>
                                <input type="text" id="hap_apSuat" value="2.1" class="w-full border border-slate-300 rounded p-2 text-xs font-bold text-center">
                            </div>
                            <div class="pt-2 border-t border-slate-200">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="hap_hasBI" class="w-4 h-4 text-amber-600 rounded">
                                    <span class="text-xs font-black text-amber-900">Kèm Mẻ Test Chỉ Thị Sinh Học (BI)</span>
                                </label>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="xacNhanMeHap()" class="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow transition-all">
                                    🔥 Khởi Động Lò Hấp
                                </button>
                                <button onclick="inTemTongHangLoat()" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2.5 rounded-lg text-xs shadow" title="In Tem Mẻ Hấp">
                                    <i class="fa-solid fa-print"></i> In Tem
                                </button>
                            </div>
                        </div>

                        <!-- Hàng đợi chờ đóng lò & Nghiệm thu -->
                        <div class="lg:col-span-2 space-y-4">
                            <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div class="bg-slate-800 text-white p-3 text-xs font-black uppercase flex justify-between items-center">
                                    <span>Mâm Đã Đóng Gói Chờ Đưa Vào Lò</span>
                                    <label class="text-[10px] font-normal flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" id="selectAllHap" onchange="toggleSelectAllHap()" class="rounded"> Chọn Tất Cả
                                    </label>
                                </div>
                                <div class="max-h-52 overflow-y-auto">
                                    <table class="w-full text-left border-collapse">
                                        <tbody id="bangChoHap"></tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Nghiệm Thu Mẻ Hấp Hoàn Tất -->
                            <div class="bg-purple-50/50 border border-purple-200 p-4 rounded-xl space-y-3">
                                <div class="flex justify-between items-center">
                                    <h3 class="font-black text-xs text-purple-900 uppercase"><i class="fa-solid fa-vial-circle-check mr-1"></i>Nghiệm Thu Mẻ Hấp Đang Chạy Lò</h3>
                                    <label class="text-[10px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" id="selectAllNghiemThu" onchange="toggleSelectAllNghiemThu()" class="rounded"> Chọn Tất Cả
                                    </label>
                                </div>
                                
                                <div class="bg-white p-2.5 rounded-lg border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-bold text-slate-700">Minh chứng BI:</span>
                                        <input type="file" id="input_anhBI" accept="image/*" onchange="docAnhBiUpTaiCho(this)" class="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-purple-100 file:text-purple-700 font-bold">
                                    </div>
                                    <button onclick="inTemNghiemThuHangLoat()" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded text-xs shadow">
                                        <i class="fa-solid fa-barcode"></i> In Tem Vô Khuẩn
                                    </button>
                                </div>

                                <div class="max-h-40 overflow-y-auto bg-white rounded border border-purple-200">
                                    <table class="w-full text-left"><tbody id="bangChoNghiệmThu"></tbody></table>
                                </div>

                                <div class="flex gap-2">
                                    <button onclick="nhapKhoHangLoat()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer">
                                        <i class="fa-solid fa-check-double"></i> DUYỆT ĐẠT & CHO VÀO KHO LƯU TRỮ CHUNG
                                    </button>
                                    <button onclick="tuChoiHapHangLoat()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded text-xs shadow">
                                        Trả Lại
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Lịch sử các mẻ hấp trong ngày -->
                    <div class="pt-4 border-t">
                        <h3 class="font-black text-xs text-slate-700 uppercase mb-3"><i class="fa-solid fa-clock-history mr-1"></i>Nhật Ký Các Mẻ Hấp Trong Ngày</h3>
                        <div class="overflow-x-auto border border-slate-200 rounded-xl">
                            <table class="w-full text-left border-collapse">
                                <tbody id="bangLichSuHap"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 6: KHO VÔ KHUẨN & PHỐI HỢP CẤP PHÁT -->
            <!-- ========================================================================= -->
            <div id="tab-khovokhuan" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-warehouse mr-2 text-sky-600"></i>KHO LƯU TRỮ VÔ KHUẨN & XUẤT KHO</h2>
                            <p class="text-xs text-slate-500">Điều phối cấp phát xoay vòng theo nguyên tắc FIFO (Hạn dùng trước xuất trước)</p>
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto">
                            <select id="xuat_selKhoa" class="border border-slate-300 rounded-lg p-2 text-xs font-bold text-sky-800 bg-slate-50 outline-none">
                                <option value="">-- Chọn Khoa Muốn Trả Đồ --</option>
                            </select>
                            <div class="flex gap-1">
                                <input type="text" id="xuat_inpMaBo" placeholder="Quét/Nhập mã khay xuất..." class="border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold uppercase outline-none">
                                <button onclick="xuatKhoXoayVong()" class="bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-700">Xuất</button>
                                <button onclick="moCamera('xuat_inpMaBo')" class="bg-slate-800 text-white p-2 rounded-lg" title="Quét Cam"><i class="fa-solid fa-camera"></i></button>
                            </div>
                        </div>
                    </div>

                    <!-- Bảng Kho Vô Khuẩn Hiện Tại -->
                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                    <th class="p-3">Tên Bộ Dụng Cụ</th>
                                    <th class="p-3">Mã ID Khay</th>
                                    <th class="p-3 text-center">Khoa Sở Hữu</th>
                                    <th class="p-3 text-center">Vị Trí Kệ Kho</th>
                                    <th class="p-3 text-center">Hạn Sử Dụng</th>
                                    <th class="p-3 text-center action-col">Hành Động</th>
                                </tr>
                            </thead>
                            <tbody id="bangKhoVoKhuan"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 7: TỒN KHO TOÀN VIỆN -->
            <!-- ========================================================================= -->
            <div id="tab-quanlykho" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex justify-between items-center mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-boxes-stacked mr-2 text-sky-600"></i>GIÁM SÁT TỒN KHO TOÀN VIỆN REALTIME</h2>
                            <p class="text-xs text-slate-500">Theo dõi vị trí chính xác và cảnh báo hạn dùng của từng mã khay</p>
                        </div>
                        <select id="inv_filterKhoa" onchange="callRender()" class="border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none">
                            <option value="">-- Tất cả Khoa --</option>
                        </select>
                    </div>

                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                    <th class="p-3">Mã ID Khay</th>
                                    <th class="p-3">Tên Bộ Dụng Cụ</th>
                                    <th class="p-3">Khoa Đang Giữ</th>
                                    <th class="p-3 text-center">Trạng Thái Vị Trí</th>
                                    <th class="p-3 text-center">Mã Lô Hấp Gần Nhất</th>
                                    <th class="p-3 text-center">Cảnh Báo Hạn Dùng</th>
                                </tr>
                            </thead>
                            <tbody id="bangTonKhoTe"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 8: DANH MỤC CƠ SỐ LINH KIỆN MÂM -->
            <!-- ========================================================================= -->
            <div id="tab-danhmuc" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex justify-between items-center mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-list-check mr-2 text-sky-600"></i>CẤU HÌNH CƠ SỐ DỤNG CỤ CHI TIẾT & TUỔI THỌ</h2>
                            <p class="text-xs text-slate-500">Tra cứu cơ số linh kiện chuẩn mâm Aesculap nạp từ file Excel hệ thống</p>
                        </div>
                    </div>

                    <div class="space-y-6">
                        <div class="overflow-x-auto border border-slate-200 rounded-xl">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                        <th class="p-3 w-1/4">Tên Bộ Dụng Cụ Standard</th>
                                        <th class="p-3 w-2/4">Linh Kiện Chi Tiết & Giới Hạn Mẻ Hấp Max</th>
                                        <th class="p-3 text-center w-1/4">Tổng Cơ Số chiếc</th>
                                    </tr>
                                </thead>
                                <tbody id="bangDanhMucLinhKien"></tbody>
                            </table>
                        </div>

                        <div class="pt-4 border-t">
                            <h3 class="font-black text-xs text-slate-700 uppercase mb-3"><i class="fa-solid fa-rotate mr-1"></i>Vòng Đời Vận Hành Tất Cả Các Khay Dụng Cụ</h3>
                            <div class="overflow-x-auto border border-slate-200 rounded-xl">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b">
                                            <th class="p-3">Mã ID Khay</th>
                                            <th class="p-3">Tên Bộ Dụng Cụ</th>
                                            <th class="p-3 text-center">Trạng Thái Hiển Thị</th>
                                            <th class="p-3 text-center">Tổng Số Mẻ Tiệt Trùng Đã Hấp</th>
                                        </tr>
                                    </thead>
                                    <tbody id="bangDanhMucTong"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 9: NHẬT KÝ LUÂN CHUYỂN TOÀN VIỆN -->
            <!-- ========================================================================= -->
            <div id="tab-lichsuluanchuyen" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex justify-between items-center mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-clock-rotate-left mr-2 text-sky-600"></i>NHẬT KÝ LUÂN CHUYỂN REALTIME HỆ THỐNG</h2>
                            <p class="text-xs text-slate-500">Ghi nhận toàn bộ biến động vị trí, thời gian và nhân sự chịu trách nhiệm</p>
                        </div>
                    </div>

                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                    <th class="p-3">Mã ID Khay</th>
                                    <th class="p-3">Bộ Dụng Cụ</th>
                                    <th class="p-3">Khoa Liên Quan</th>
                                    <th class="p-3 text-center">Trạng Thái Bật</th>
                                    <th class="p-3 text-center">Mã Lô Hấp / Minh Chứng</th>
                                    <th class="p-3 text-center">Nhân Sự Xử Lý</th>
                                    <th class="p-3 text-center">Thời Gian Ghi Nhận</th>
                                </tr>
                            </thead>
                            <tbody id="bangLichSuHanhTrinhGoc"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 10: TRUY XUẤT MẺ HẤP TIỆT TRÙNG (TRACEABILITY) -->
            <!-- ========================================================================= -->
            <div id="tab-tracuu" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-magnifying-glass mr-2 text-sky-600"></i>TRUY XUẤT NGUỒN GỐC MẺ TIỆT TRÙNG KHẨN CẤP</h2>
                            <p class="text-xs text-slate-500">Truy vết sự cố nhiễm khuẩn ngược từ mã lô tiệt trùng về toàn bộ bệnh nhân</p>
                        </div>
                    </div>

                    <div class="flex gap-2 max-w-xl mb-6">
                        <input type="text" id="inp_searchBatch" placeholder="Nhập mã lô hấp (VD: A1260328_01)..." class="flex-1 border border-slate-300 rounded-lg p-3 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-sky-500 outline-none">
                        <button onclick="truyVetTheoMaBatch()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-3 rounded-lg text-xs uppercase shadow">
                            Tra Cứu Khẩn Cấp
                        </button>
                        <button onclick="clearTruyVetBatch()" class="bg-slate-200 text-slate-700 font-bold px-3 py-3 rounded-lg text-xs hover:bg-slate-300">
                            Xóa
                        </button>
                    </div>

                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                    <th class="p-3">Mã ID Khay</th>
                                    <th class="p-3">Tên Bộ Dụng Cụ</th>
                                    <th class="p-3">Khoa Sử Dụng</th>
                                    <th class="p-3">Trạng Thái</th>
                                    <th class="p-3 text-center">Mã Lô Tiệt Trùng</th>
                                    <th class="p-3 text-center">Thời Gian Kích Hoạt</th>
                                </tr>
                            </thead>
                            <tbody id="bangLichSuTruyXuatAdmin"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 11: HIỆU SUẤT KPI ĐỌC BI 30 PHÚT -->
            <!-- ========================================================================= -->
            <div id="tab-performance" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex justify-between items-center mb-6 pb-4 border-b">
                        <div>
                            <h2 class="text-lg font-black text-slate-800"><i class="fa-solid fa-chart-line mr-2 text-sky-600"></i>GIÁM SÁT KPI ĐỌC KẾT QUẢ BI TRONG 30 PHÚT</h2>
                            <p class="text-xs text-slate-500">Đo lường thời gian đáp ứng đọc chỉ thị sinh học sau tiệt trùng của kỹ thuật viên</p>
                        </div>
                    </div>

                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase">
                                    <th class="p-3 text-center w-16">STT</th>
                                    <th class="p-3">Mã KTV</th>
                                    <th class="p-3">Họ Và Tên Kỹ Thuật Viên</th>
                                    <th class="p-3 text-center">Tỷ Lệ Đạt KPI (< 30 Phút)</th>
                                </tr>
                            </thead>
                            <tbody id="bangHieuSuatKTV"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- TAB 12: DASHBOARD TIVI TRUNG TÂM -->
            <!-- ========================================================================= -->
            <div id="tab-dashboard_tv" class="space-y-6 hidden">
                <div class="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl space-y-6">
                    <div class="flex justify-between items-center pb-4 border-b border-slate-800">
                        <div>
                            <h2 class="text-xl font-black text-sky-400 tracking-wider"><i class="fa-solid fa-tv mr-2"></i>MÀN HÌNH GIÁM SÁT TRUNG TÂM CSSD</h2>
                            <p class="text-xs text-slate-400">Hiển thị thông số vận hành thời gian thực cho màn hình TV lớn</p>
                        </div>
                        <div class="text-right font-mono text-xs text-slate-400">
                            SYSTEM STATUS: <span class="text-emerald-400 font-bold">ONLINE</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50">
                            <div class="text-xs font-bold text-slate-400 uppercase">Mẻ Rửa Trong Ngày</div>
                            <div id="tv_meRua" class="text-3xl font-black text-sky-400 mt-2">0</div>
                        </div>
                        <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50">
                            <div class="text-xs font-bold text-slate-400 uppercase">Mẻ Hấp Trong Ngày</div>
                            <div id="tv_meHap" class="text-3xl font-black text-purple-400 mt-2">0</div>
                        </div>
                        <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50">
                            <div class="text-xs font-bold text-slate-400 uppercase">Đang Trong Buồng Rửa</div>
                            <div id="tv_dangRua" class="text-3xl font-black text-amber-400 mt-2">0</div>
                        </div>
                        <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50">
                            <div class="text-xs font-bold text-slate-400 uppercase">Đang Chạy Lò Hấp</div>
                            <div id="tv_dangHap" class="text-3xl font-black text-rose-400 mt-2">0</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                        <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-300">Mẻ Hấp Hoàn Tất:</span>
                            <span id="tv_meHap2" class="text-xl font-mono font-black text-purple-300">0</span>
                        </div>
                        <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-300">Sẵn Sàng Kho Vô Khuẩn:</span>
                            <span id="tv_khoVoKhuan" class="text-xl font-mono font-black text-emerald-400">0</span>
                        </div>
                        <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-300">Cảnh Báo Quá Hạn HSD:</span>
                            <span id="tv_canhBaoHsd" class="text-xl font-mono font-black text-rose-500">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================================================= -->
            <!-- CẤU HÌNH ADMIN MODULE (SUBTAB SYSTEM & SECURITY) -->
            <!-- ========================================================================= -->
            <div id="tab-admin" class="space-y-6 hidden">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex border-b border-slate-200 mb-6 gap-6 text-sm font-bold">
                        <button id="subbtn-database" onclick="switchAdminSubtab('database')" class="pb-2 admin-subtab-active">Nạp Cơ Sở Dữ Liệu Excel</button>
                        <button id="subbtn-security" onclick="switchAdminSubtab('security')" class="pb-2 text-slate-600">Cấu Hình PIN & Phân Quyền</button>
                    </div>

                    <!-- Subtab 1: Nạp Excel -->
                    <div id="subtab-database" class="space-y-4">
                        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <h3 class="font-black text-xs text-slate-700 uppercase">Nạp File Cấu Hình Định Biên & Linh Kiện Aesculap (.xlsx)</h3>
                            <input type="file" id="excelFileInput" accept=".xlsx, .xls" class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-600 file:text-white hover:file:bg-sky-700 cursor-pointer">
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <button onclick="khaiSinhKhayVangLai()" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow">
                                + Khai Sinh Khay Vãng Lai Thủ Công
                            </button>
                            <button onclick="resetDuLieuKet()" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow">
                                🔄 Giải Phóng Mâm Kẹt Dở Dang
                            </button>
                            <button onclick="xoaSachDuLieuGiaoDichRealtime()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow">
                                🗑️ Xóa Sạch Nhật Ký Giao Dịch
                            </button>
                        </div>
                    </div>

                    <!-- Subtab 2: Security & Permissions -->
                    <div id="subtab-security" class="space-y-6 hidden">
                        <!-- Đổi PIN -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="p-3 bg-slate-50 border rounded-lg space-y-2">
                                <label class="block text-xs font-bold">PIN Administrator</label>
                                <div class="flex gap-2">
                                    <input type="text" id="cfg_pinAdmin" class="flex-1 border rounded p-1.5 text-xs font-bold text-center">
                                    <button onclick="saveAdminPIN('ADMIN')" class="bg-sky-600 text-white text-[10px] font-bold px-2.5 rounded">Lưu</button>
                                </div>
                            </div>
                            <div class="p-3 bg-slate-50 border rounded-lg space-y-2">
                                <label class="block text-xs font-bold">PIN Backup CSSD</label>
                                <div class="flex gap-2">
                                    <input type="text" id="cfg_pinCSSD" class="flex-1 border rounded p-1.5 text-xs font-bold text-center">
                                    <button onclick="saveAdminPIN('CSSD')" class="bg-sky-600 text-white text-[10px] font-bold px-2.5 rounded">Lưu</button>
                                </div>
                            </div>
                            <div class="p-3 bg-slate-50 border rounded-lg space-y-2">
                                <label class="block text-xs font-bold">PIN Khách Tham Quan</label>
                                <div class="flex gap-2">
                                    <input type="text" id="cfg_pinGuest" class="flex-1 border rounded p-1.5 text-xs font-bold text-center">
                                    <button onclick="saveAdminPIN('GUEST')" class="bg-sky-600 text-white text-[10px] font-bold px-2.5 rounded">Lưu</button>
                                </div>
                            </div>
                        </div>

                        <!-- Ma trận phân quyền -->
                        <div>
                            <h3 class="font-black text-xs text-slate-700 uppercase mb-2">Ma Trận Cấu Hình Truy Cập Tab</h3>
                            <div class="overflow-x-auto border border-slate-200 rounded-xl">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-slate-800 text-white text-[10px] font-bold uppercase">
                                            <th class="p-2.5">Tab Giao Diện</th>
                                            <th class="p-2.5 text-center">CSSD</th>
                                            <th class="p-2.5 text-center">Khoa Lâm Sàng</th>
                                            <th class="p-2.5 text-center">Khách (Guest)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="bodyMaTranGiaoDien"></tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Quản lý KTV CSSD & PIN Khoa -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-black text-xs text-slate-700 uppercase">Danh Sách Nhân Viên CSSD</h3>
                                    <button onclick="themKtvCssd()" class="bg-sky-600 text-white px-2.5 py-1 rounded text-[10px] font-bold">+ Thêm KTV</button>
                                </div>
                                <div class="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                    <table class="w-full text-left"><tbody id="bangNhanVienCssd"></tbody></table>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-black text-xs text-slate-700 uppercase">PIN Khoa / Phòng Lâm Sàng</h3>
                                    <button onclick="themKhoaThuCong()" class="bg-sky-600 text-white px-2.5 py-1 rounded text-[10px] font-bold">+ Thêm Khoa</button>
                                </div>
                                <div class="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                    <table class="w-full text-left"><tbody id="bangPhanQuyenKhoa"></tbody></table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </main>
    </div>

    <!-- Overlay Mobile Navigation -->
    <div id="mobile-overlay" onclick="toggleMobileMenu()" class="fixed inset-0 bg-slate-900/50 z-30 hidden md:hidden"></div>

    <!-- ========================================================================= -->
    <!-- MODALS & POPUPS HE THONG -->
    <!-- ========================================================================= -->

    <!-- Modal 1: Kiểm Đếm Chi Tiết Linh Kiện (Thu Gom) -->
    <div id="popupKiemDem" class="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4 border border-slate-100 max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center pb-3 border-b">
                <div>
                    <h3 id="popBo" class="text-base font-black text-sky-800 uppercase">---</h3>
                    <p class="text-xs text-slate-500 font-bold">Khoa yêu cầu: <span id="popKhoa" class="text-slate-800">---</span></p>
                </div>
                <button onclick="closePopupKiemDem()" class="text-slate-400 hover:text-rose-500 text-lg p-1">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- List Linh Kiện Checkbox -->
            <div id="popKiemDemChecklist" class="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100"></div>

            <div class="space-y-2 pt-2 border-t">
                <label class="block text-xs font-bold text-slate-600">Ghi chú sự cố / Mã biên bản chênh lệch (Bắt buộc khi thiếu/hỏng):</label>
                <input type="text" id="popGhiChu" placeholder="Nhập lý do chênh lệch hoặc số biên bản..." class="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 outline-none">
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="saveKiemDem()" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow tracking-wider">
                    Chốt Kiểm Đếm & Chuyển Rửa
                </button>
                <button onclick="closePopupKiemDem()" class="bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg text-xs">
                    Hủy
                </button>
            </div>
        </div>
    </div>

    <!-- Modal 2: Popup Đóng Gói -->
    <div id="popupDongGoi" class="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b">
                <h3 id="popDG_Bo" class="text-base font-black text-slate-800 uppercase">ĐÓNG GÓI MÂM DỤNG CỤ</h3>
                <button onclick="closePopupDongGoi()" class="text-slate-400 hover:text-rose-500 text-lg">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Loại Vật Liệu Bao Bọc</label>
                    <select id="popDG_Loai" onchange="tinhHanSuDung()" class="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold outline-none">
                        <option value="Túi ép tiệt trùng Tyvek|180">Túi ép Tyvek (Hạn 180 Ngày)</option>
                        <option value="Giấy gói tiệt trùng không dệt|30">Giấy gói không dệt SMS (Hạn 30 Ngày)</option>
                        <option value="Container kim loại vô khuẩn|365">Container kim loại khóa Filter (Hạn 365 Ngày)</option>
                    </select>
                </div>
                <div class="p-3 bg-sky-50 border border-sky-200 rounded-lg flex justify-between items-center">
                    <span class="text-xs font-bold text-sky-900">Tính Tự Động HSD:</span>
                    <span id="popDG_Han" class="font-mono font-black text-sky-700 text-sm">--/--/----</span>
                </div>
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="chotDongGoi()" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow">
                    Xác Nhận Đóng Gói
                </button>
                <button onclick="closePopupDongGoi()" class="bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg text-xs">
                    Hủy
                </button>
            </div>
        </div>
    </div>

    <!-- Modal 3: Ký Chữ Ký Điện Tử Trên Canvas -->
    <div id="popupKyDienTu" class="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
            <div class="flex justify-between items-center pb-2 border-b">
                <h3 class="text-sm font-black text-slate-800 uppercase"><i class="fa-solid fa-pen-nib mr-1 text-sky-600"></i>KÝ NHẬN ĐỒ SẠCH VỀ KHOA</h3>
                <button onclick="dongPopupKyDienTu()" class="text-slate-400 hover:text-rose-500 text-lg">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Họ Và Tên Điều Dưỡng Nhận Đồ</label>
                    <input type="text" id="ky_tenNguoiNhan" placeholder="Nhập tên người nhận..." class="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold outline-none">
                </div>

                <div>
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-xs font-bold text-slate-600">Vẽ Chữ Ký Trực Tiếp Tại Đây</label>
                        <button onclick="xoaChuKyCanvas()" class="text-[10px] font-bold text-rose-600 hover:underline">Vẽ Lại</button>
                    </div>
                    <div class="border-2 border-dashed border-sky-300 rounded-xl bg-slate-50 overflow-hidden flex justify-center">
                        <canvas id="canvasKyDienTu" class="cursor-crosshair bg-white touch-none"></canvas>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="luuXacNhanKyNhan()" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow">
                    Lưu & Hoàn Tất Nhận Đồ
                </button>
                <button onclick="dongPopupKyDienTu()" class="bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg text-xs">
                    Hủy
                </button>
            </div>
        </div>
    </div>

    <!-- Modal 4: Quét Camera Barcode / QR Code -->
    <div id="popupScanner" class="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div class="flex justify-between items-center pb-2 border-b">
                <h3 class="text-xs font-black text-slate-800 uppercase"><i class="fa-solid fa-camera mr-1 text-sky-600"></i>QUÉT MÃ BARCODE / QR CODE</h3>
                <button onclick="dongCamera()" class="text-slate-400 hover:text-rose-500 text-lg">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <div id="reader" class="w-full overflow-hidden rounded-xl border border-slate-200 bg-black"></div>

            <button onclick="dongCamera()" class="w-full bg-slate-800 text-white font-bold py-2 rounded-lg text-xs">
                Đóng Camera
            </button>
        </div>
    </div>

    <!-- Zone In Ấn Ẩn (Bixolon Label & A4 Report) -->
    <div id="print-zone" class="hidden"></div>

    <!-- File app.js chứa logic xử lý -->
    <script src="app.js"></script>
</body>
</html>
