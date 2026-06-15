// FILE: data.js - NƠI CHỨA DATABASE DỤNG CỤ (CẬP NHẬT TẠI ĐÂY)

const imageIndex = {
    "BB084R": "https://products.api.bbraun.io/api/image/BB084R?countryISOCode=01&watermark=true",
    "BD561R": "https://products.api.bbraun.io/api/image/BD561R?countryISOCode=01&watermark=true",
    "BD051R": "https://products.api.bbraun.io/api/image/BD051R?countryISOCode=01&watermark=true",
    "BC575R": "https://products.api.bbraun.io/api/image/BC575R?countryISOCode=01&watermark=true",
    "AC 071/17": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AC/1010.jpg",
    "BC606R": "https://products.api.bbraun.io/api/image/BC606R?countryISOCode=01&watermark=true",
    "BH167R": "https://products.api.bbraun.io/api/image/BH167R?countryISOCode=01&watermark=true",
    "BH166R": "https://products.api.bbraun.io/api/image/BH166R?countryISOCode=01&watermark=true",
    "BH644R": "https://products.api.bbraun.io/api/image/BH644R?countryISOCode=01&watermark=true",
    "BM237R": "https://products.api.bbraun.io/api/image/BM237R?countryISOCode=01&watermark=true",
    "BF122R": "https://products.api.bbraun.io/api/image/BF122R?countryISOCode=01&watermark=true",
    "BF120R": "https://products.api.bbraun.io/api/image/BF120R?countryISOCode=01&watermark=true",
    "AF 144/24": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AF/2245.jpg",
    "AK 354/00": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AK/2700.jpg",
    "BV617R": "https://products.api.bbraun.io/api/image/BV617R?countryISOCode=01&watermark=true",
    "BF123R": "https://products.api.bbraun.io/api/image/BF123R?countryISOCode=01&watermark=true",
    "AA 800/12": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AK/2809.jpg",
    "AD 010/03": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AD/1603.jpg",
    "AF 200/18": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AF/2263.jpg",
    "AA 751/11": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AA/431.jpg",
    "AC 101/14 SC": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AC/SC/ac101_14_sc.jpg",
    "AB 112/12": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AB/525.jpg",
    "AB 102/12": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AB/521.jpg",
    "AA 150/12": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AA/110.jpg",
    "AK 090/12": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AK/2391.jpg",
    "AK 060/02": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AK/2336.jpg",
    "KD 050/12": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/K/KD/4283.jpg",
    "AL 003/20": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/A/AL/2815.gif",
    "KD 240/18": "https://www.nopa-instruments.eu/fileadmin/user_upload/produkte/import/gross/K/KD/4357.jpg",    
    "SG-CHEN9": "https://images.unsplash.com/photo-1532187863486-abf9d39d6618?w=500"
};

const databaseExcel = {
    "SOSINH": [
        { ma: "AK 354/00", ten: "Banh tổ chức Farabeuf dài 8.3/4 in 43x15 mm", dinhMuc: 1 },
        { ma: "AA 800/12", ten: "Malleable 200x12mm", dinhMuc: 1 },
        { ma: "AA 800/17", ten: "Malleable 200x12mm", dinhMuc: 1 },
        { ma: "KU 318/14", ten: "Kẹp giữ dụng cụ MAYO 14cm", dinhMuc: 1 },
        { ma: "AD 010/03", ten: "Cán dao số 3", dinhMuc: 1 },
        { ma: "AF 200/18", ten: "Kẹp hình tim nhỏ", dinhMuc: 1 },
        { ma: "AA 751/11", ten: "Kẹp săng Backhaus 11cm", dinhMuc: 4 },
        { ma: "AC 101/14 SC", ten: "Kẹp săng Backhaus 11cm", dinhMuc: 1 },
        { ma: "AC 070/14", ten: "Kéo Mayo, thẳng, lưỡi vát, mũi tù/tù, dài 14 cm", dinhMuc: 1 },
        { ma: "AB 112/12", ten: "Nhíp mô, mảnh, ngàm có răng 1x2, dài 12 cm", dinhMuc: 1 },
        { ma: "AB 102/12", ten: "Kẹp phẫu tích Micro-Adson, mảnh, dài 12 cm", dinhMuc: 1 },
        { ma: "AA 115/10", ten: "Kẹp phẫu tích Baby-Mosquito, mảnh, cong, dài 10 cm", dinhMuc: 2 },
        { ma: "AA 150/12", ten: "Kẹp phẫu tích Mosquito, thẳng, mảnh, dài 12.5 cm", dinhMuc: 2 },
        { ma: "AK 090/12", ten: "Banh vết thương mạch máu Desmarres, dài 14 cm, kích thước 9x12mm", dinhMuc: 2 },
        { ma: "AK 060/02", ten: "Banh vết thương và khí quản, loại nhỏ, cong, 2 răng, nhọn, dài 16.5 cm", dinhMuc: 2 },
        { ma: "KD 050/12", ten: "Allis (Baby), thẳng, ngàm có răng 4x5, dài 13 cm", dinhMuc: 2 },
        { ma: "AL 003/20", ten: "Allis (Baby), thẳng, ngàm có răng 4x5, dài 13 cm", dinhMuc: 2 },
        { ma: "KD 240/18", ten: "Kẹp ruột không chấn thương Doyen, cong, lưỡi mềm và đàn hồi, dài 17 cm", dinhMuc: 1 },   
        { ma: "SG-CHEN9", ten: "Chén chun", dinhMuc: 1 }
    ],
    "MOBATCON": [
        { ma: "BB084R", ten: "Cán dao mổ, số 4, dài 135mm", dinhMuc: 1 },
        { ma: "BD561R", ten: "Kẹp phẫu tích có mẫu dài 20-22 cm", dinhMuc: 1 },
        { ma: "BD051R", net: "BD051R", ten: "Kẹp phẫu tích không mấu dài 22 cm", dinhMuc: 1 },
        { ma: "BC575R", ten: "Kéo Mayo-Stille cong 17/19.5 cm", dinhMuc: 1 },
        { ma: "AC 071/17", ten: "Kéo Mayo cong 17cm", dinhMuc: 1 },
        { ma: "BC606R", ten: "Kéo Metzenbaun cong, đầu tù, 18-20cm", dinhMuc: 1 },
        { ma: "BH167R", ten: "Kelly cong 16.5/18.5 cm", dinhMuc: 2 },
        { ma: "BH166R", ten: "Kelly thẳng 16.5/18.5cm", dinhMuc: 4 },
        { ma: "BH644R", ten: "Kẹp mạch máu Kocher", dinhMuc: 4 },
        { ma: "BM237R", ten: "Kềm mang kim 20 cm", dinhMuc: 2 },
        { ma: "BF122R", ten: "Kẹp hình tim, thẳng, có mấu, dài 245mm", dinhMuc: 2 },
        { ma: "BF120R", ten: "Kẹp hình tim, thẳng, KHÔNG mấu, dài 245mm", dinhMuc: 1 },
        { ma: "AF 144/24", ten: "Kềm sát khuẩn Collin 24.5 cm", dinhMuc: 1 },
        { ma: "AK 354/00", ten: "Banh tổ chức Farabeuf dài 8.3/4 in 43x15 mm", dinhMuc: 2 },
        { ma: "BV617R", ten: "Lưỡi banh giữa cho bộ banh bụng Balfour, kích thước 54x80 mm", dinhMuc: 1 },
        { ma: "SG-CHEN9", ten: "Chén chun", dinhMuc: 2 },
        { ma: "SG-BHD400", ten: "Bồn hạt đậu 400ml", dinhMuc: 1 },
        { ma: "SG-BHD800", ten: "Bồn hạt đậu 800ml", dinhMuc: 1 },
        { ma: "KYE 283/15", ten: "Hộp đựng dụng cụ, 465x280x150 mm", dinhMuc: 1 },
        { ma: "BF494R", ten: "Vòng giữ dụng cụ chữ U", dinhMuc: 1 },
        { ma: "BF123R", ten: "Kẹp hình tim, cong, ngàm có răng, dài 245mm", dinhMuc: 1 }
    ],
    "CATTUCUNG": [
        { ma: "BB084R", ten: "Cán dao mổ, số 4, dài 135mm", dinhMuc: 1 },
        { ma: "BT476R", ten: "Van âm đạo kích thước 36 x 110 mm", dinhMuc: 1 }
    ],
    "TONGQUATNHI": [
        { ma: "BB073R", ten: "Cán dao mổ, số 3, dài 125mm", dinhMuc: 1 },
        { ma: "BH166R", ten: "Kelly thẳng 16.5/18.5cm", dinhMuc: 2 }
    ]
};
