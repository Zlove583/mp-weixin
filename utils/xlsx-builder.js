"use strict";

/**
 * xlsx-builder.js — 自包含 XLSX 生成器
 * 无需外部依赖，直接生成符合 OOXML 标准的 .xlsx 文件
 * 支持：千 百 十 万 千 百 十 元 角 分 独立分栏格式
 */

/* ---------- CRC32 实现 ---------- */
function crc32(data) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (var j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- UTF-8 编码 ---------- */
function utf8Encode(str) {
  var encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  if (encoder) return encoder.encode(str);
  // 降级实现
  var buf = [], i, c;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c < 0x80) { buf.push(c); }
    else if (c < 0x800) { buf.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
    else { buf.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
  }
  return new Uint8Array(buf);
}

/* ---------- XML 转义 ---------- */
function xmlEsc(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ---------- ZIP 打包（Store 方法，无压缩） ---------- */
function buildZip(entries) {
  // entries: [{name:string, data:Uint8Array}]
  var localHeaders = [];
  var centralEntries = [];
  var offset = 0;

  for (var e = 0; e < entries.length; e++) {
    var entry = entries[e];
    var nameBytes = utf8Encode(entry.name);
    var data = entry.data;
    var crc = crc32(data);

    // 本地文件头 30 字节 + 文件名长度
    var lh = new Uint8Array(30 + nameBytes.length);
    var lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); // PK#1234
    lv.setUint16(4, 20, true);  // 版本
    lv.setUint16(6, 0, true);   // 通用标志
    lv.setUint16(8, 0, true);   // 压缩方式: store
    lv.setUint16(10, 0, true);  // 修改时间
    lv.setUint16(12, 0, true);  // 修改日期
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);  // 压缩后大小
    lv.setUint32(22, data.length, true);  // 压缩前大小
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);  // 额外字段长度
    lh.set(nameBytes, 30);

    localHeaders.push({ header: lh, data: data, offset: offset });
    centralEntries.push({ nameBytes: nameBytes, crc: crc, size: data.length, offset: offset });
    offset += lh.length + data.length;
  }

  // 中央目录
  var centralBuf = [];
  for (var c = 0; c < centralEntries.length; c++) {
    var ce = centralEntries[c];
    var ch = new Uint8Array(46 + ce.nameBytes.length);
    var cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, ce.crc, true);
    cv.setUint32(20, ce.size, true);
    cv.setUint32(24, ce.size, true);
    cv.setUint16(28, ce.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, ce.offset, true);
    ch.set(ce.nameBytes, 46);
    centralBuf.push(ch);
  }

  // 中央目录结束记录
  var cdEnd = new Uint8Array(22);
  var cdv = new DataView(cdEnd.buffer);
  cdv.setUint32(0, 0x06054b50, true);
  cdv.setUint16(4, 0, true);
  cdv.setUint16(6, 0, true);
  cdv.setUint16(8, centralEntries.length, true);
  cdv.setUint16(10, centralEntries.length, true);

  var centralSize = 0;
  for (var i = 0; i < centralBuf.length; i++) centralSize += centralBuf[i].length;

  cdv.setUint32(12, centralSize, true);
  cdv.setUint32(16, offset, true);
  cdv.setUint16(20, 0, true);

  // 合并
  var totalSize = offset + centralSize + 22;
  var result = new Uint8Array(totalSize);
  var pos = 0;
  for (var i = 0; i < localHeaders.length; i++) {
    result.set(localHeaders[i].header, pos);
    pos += localHeaders[i].header.length;
    result.set(localHeaders[i].data, pos);
    pos += localHeaders[i].data.length;
  }
  for (var i = 0; i < centralBuf.length; i++) {
    result.set(centralBuf[i], pos);
    pos += centralBuf[i].length;
  }
  result.set(cdEnd, pos);
  return result;
}

/* ---------- XLSX 文件构建器 ---------- */

/**
 * 创建 OOXML Content_Types.xml
 */
function buildContentTypes(sheetNames) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
  xml += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
  xml += '<Default Extension="xml" ContentType="application/xml"/>';
  for (var i = 1; i <= sheetNames.length; i++) {
    xml += '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  }
  xml += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  xml += '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>';
  xml += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  xml += '</Types>';
  return xml;
}

/**
 * 创建 _rels/.rels
 */
function buildRels() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
}

/**
 * 创建 xl/_rels/workbook.xml.rels
 */
function buildWbRels(sheetCount) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  xml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  xml += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>';
  for (var i = 1; i <= sheetCount; i++) {
    xml += '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>';
  }
  xml += '</Relationships>';
  return xml;
}

/**
 * 创建 xl/workbook.xml
 */
function buildWorkbook(sheetNames) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
  xml += '<sheets>';
  for (var i = 0; i < sheetNames.length; i++) {
    xml += '<sheet name="' + xmlEsc(sheetNames[i]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 3) + '"/>';
  }
  xml += '</sheets></workbook>';
  return xml;
}

/**
 * 创建 xl/styles.xml
 * 自定义格式：千 百 十 万 千 百 十 元 角 分
 * numFmtId 164: 人民币大写分列格式
 */
function buildStyles() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1">' +
    '<numFmt numFmtId="164" formatCode="#,##0.00"/>' +
    '</numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="宋体"/></font>' +
    '<font><b/><sz val="11"/><name val="宋体"/></font>' +
    '</fonts>' +
    '<fills count="2">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '</fills>' +
    '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border>' +
    '<left style="thin"><color auto="1"/></left>' +
    '<right style="thin"><color auto="1"/></right>' +
    '<top style="thin"><color auto="1"/></top>' +
    '<bottom style="thin"><color auto="1"/></bottom>' +
    '<diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

/**
 * 创建 xl/sharedStrings.xml
 */
function buildSharedStrings(strings) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strings.length + '" uniqueCount="' + strings.length + '">';
  for (var i = 0; i < strings.length; i++) {
    xml += '<si><t>' + xmlEsc(strings[i]) + '</t></si>';
  }
  xml += '</sst>';
  return xml;
}

/**
 * 创建 xl/worksheets/sheet.xml
 * @param {Array} rows - 行数据，每行为单元格数组 [{v, t, s, style}]
 *   v: 值, t: 's'=字符串 'n'=数字, s: 样式索引(0/1/2)
 * @param {Array} colWidths - 列宽数组
 * @param {Array} merges - 合并单元格数组 ['A1:B1', ...]
 */
function buildSheet(rows, colWidths, merges) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  xml += '<cols>';
  for (var c = 0; c < colWidths.length; c++) {
    xml += '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + colWidths[c] + '" customWidth="1"/>';
  }
  xml += '</cols>';
  xml += '<sheetData>';
  for (var r = 0; r < rows.length; r++) {
    xml += '<row r="' + (r + 1) + '">';
    var row = rows[r];
    for (var c = 0; c < row.length; c++) {
      var cell = row[c];
      if (cell === null || cell === undefined || cell.v === undefined || cell.v === null || cell.v === '') continue;
      var ref = colRef(c) + (r + 1);
      var type = cell.t || 'n';
      var style = cell.s !== undefined ? ' s="' + cell.s + '"' : '';
      xml += '<c r="' + ref + '" t="' + type + '"' + style + '><v>' + xmlEsc(String(cell.v)) + '</v></c>';
    }
    xml += '</row>';
  }
  xml += '</sheetData>';
  if (merges && merges.length > 0) {
    xml += '<mergeCells count="' + merges.length + '">';
    for (var m = 0; m < merges.length; m++) {
      xml += '<mergeCell ref="' + merges[m] + '"/>';
    }
    xml += '</mergeCells>';
  }
  xml += '</worksheet>';
  return xml;
}

/** 列索引转字母 A, B, ..., Z, AA, AB, ... */
function colRef(col) {
  var s = '';
  col++;
  while (col > 0) {
    col--;
    s = String.fromCharCode(65 + (col % 26)) + s;
    col = Math.floor(col / 26);
  }
  return s;
}

/* ---------- 数字拆分工具：千 百 十 万 千 百 十 元 角 分 ---------- */

/**
 * 将金额拆分为 11 个独立数字位
 * 返回数组 [亿, 千万, 百万, 十万, 万, 千, 百, 十, 元, 角, 分]
 * 例如 12345.67 => ['', '', '', 1, 2, 3, 4, 5, 6, 7, '']
 * (从亿到分，共11位)
 */
function splitAmount(amount) {
  var num = Number(amount) || 0;
  var neg = num < 0;
  if (neg) num = -num;
  // 保留两位小数，转为以分为单位
  var cents = Math.round(num * 100);
  var digits = [];
  for (var i = 0; i < 11; i++) {
    digits[i] = '';
  }
  if (cents === 0) return digits;
  // 分
  digits[10] = cents % 10;
  var remain = Math.floor(cents / 10);
  // 角
  digits[9] = remain % 10;
  remain = Math.floor(remain / 10);
  // 元
  digits[8] = remain % 10;
  remain = Math.floor(remain / 10);
  // 十
  digits[7] = remain % 10;
  remain = Math.floor(remain / 10);
  // 百
  digits[6] = remain % 10;
  remain = Math.floor(remain / 10);
  // 千
  digits[5] = remain % 10;
  remain = Math.floor(remain / 10);
  // 万
  digits[4] = remain % 10;
  remain = Math.floor(remain / 10);
  // 十万
  digits[3] = remain % 10;
  remain = Math.floor(remain / 10);
  // 百万
  digits[2] = remain % 10;
  remain = Math.floor(remain / 10);
  // 千万
  digits[1] = remain % 10;
  remain = Math.floor(remain / 10);
  // 亿
  digits[0] = remain % 10;
  // 负号处理
  if (neg && cents > 0) {
    for (var d = 0; d <= 10; d++) {
      if (digits[d] !== '') {
        digits[d] = '-' + digits[d];
        break;
      }
    }
  }
  return digits;
}

/* ---------- 导出接口 ---------- */

/**
 * 生成 .xlsx 文件字节
 * @param {Array} sheets - 工作表数组 [{name, rows, colWidths, merges}]
 *   rows: [[{v, t, s}]]
 *   colWidths: [number]
 *   merges: ['A1:B1']
 * @returns {ArrayBuffer} .xlsx 文件的 ArrayBuffer
 */
function buildXLSX(sheets) {
  // 先收集所有字符串用于 sharedStrings
  var allStrings = [];
  var stringMap = {};
  function getStringIndex(str) {
    var s = String(str);
    if (stringMap[s] !== undefined) return stringMap[s];
    var idx = allStrings.length;
    allStrings.push(s);
    stringMap[s] = idx;
    return idx;
  }

  // 处理每张表，将字符串转换为索引
  var processedSheets = [];
  var sheetNames = [];
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    sheetNames.push(sheet.name);
    var processedRows = [];
    for (var r = 0; r < sheet.rows.length; r++) {
      var row = sheet.rows[r];
      var processedRow = [];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (cell === null || cell === undefined || cell.v === undefined || cell.v === null || String(cell.v) === '') {
          processedRow.push(null);
        } else if (cell.t === 's') {
          processedRow.push({ v: getStringIndex(cell.v), t: 's', s: cell.s !== undefined ? cell.s : 0 });
        } else {
          processedRow.push({ v: cell.v, t: 'n', s: cell.s !== undefined ? cell.s : 2 });
        }
      }
      processedRows.push(processedRow);
    }
    processedSheets.push({
      name: sheet.name,
      rows: processedRows,
      colWidths: sheet.colWidths || [],
      merges: sheet.merges || []
    });
  }

  // 构建各部分 XML
  var parts = [
    { name: '[Content_Types].xml', data: utf8Encode(buildContentTypes(sheetNames)) },
    { name: '_rels/.rels', data: utf8Encode(buildRels()) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8Encode(buildWbRels(sheetNames.length)) },
    { name: 'xl/workbook.xml', data: utf8Encode(buildWorkbook(sheetNames)) },
    { name: 'xl/styles.xml', data: utf8Encode(buildStyles()) },
    { name: 'xl/sharedStrings.xml', data: utf8Encode(buildSharedStrings(allStrings)) }
  ];

  // 工作表
  for (var i = 0; i < processedSheets.length; i++) {
    var s = processedSheets[i];
    parts.push({
      name: 'xl/worksheets/sheet' + (i + 1) + '.xml',
      data: utf8Encode(buildSheet(s.rows, s.colWidths, s.merges))
    });
  }

  // 打包为 ZIP
  return buildZip(parts).buffer;
}

/* ---------- 导出 ---------- */
exports.crc32 = crc32;
exports.utf8Encode = utf8Encode;
exports.xmlEsc = xmlEsc;
exports.buildZip = buildZip;
exports.splitAmount = splitAmount;
exports.buildXLSX = buildXLSX;
exports.buildSheet = buildSheet;
exports.colRef = colRef;
