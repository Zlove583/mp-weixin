# 蒙小账 / 出入库管理系统

面向小微经营与农牧业务的微信小程序项目，目录中包含库存管理、收支记账、票据 OCR、月度报表、Excel 导出及农牧业务页面。

> 本说明依据当前目录代码整理。仓库主要提供小程序运行文件和两个云函数，并非包含完整后端服务、完整 uni-app 源工程的一键部署项目。部分文件已编译或压缩，部分农牧模块仍使用 Mock 数据；存在页面或接口定义不代表已完成真实业务接入。

## 1. 目录结构

```text
.
├── README.md                       # 项目说明与密钥定位
├── project.config.json             # 从根目录导入微信开发者工具时使用
├── test-ocr.js                      # 本地腾讯云 OCR 联调脚本（会调用真实 API）
├── database/
│   ├── agri_module_tables.sql       # 农牧模块 SQL 表结构等材料
│   └── DEPLOYMENT_GUIDE.md          # 农牧模块部署接入说明
└── mp-weixin/                       # 当前小程序运行目录
    ├── app.js / app.json / app.wxss
    ├── project.config.json         # 单独导入此目录时使用
    ├── common/vendor.js            # 已打包的公共依赖
    ├── pages/                      # 登录、首页、库存、记账、OCR、我的等页面
    ├── subpkg-agri/                # 牲畜台账、农产品免税核算页面
    ├── subpkg-tax/                 # 税务申报、风险相关页面
    ├── api/                       # HTTP 请求封装及业务接口定义
    ├── store/                     # 状态管理
    ├── utils/                     # 票据字段、记账、月报、XLSX 等工具
    ├── tests/                     # 月报和 XLSX 本地测试
    └── cloudfunctions/
        ├── ocr/                   # 腾讯云 OCR 调用、识别记录查询与删除
        └── payment/               # 支付订单创建与查询代码
```

根目录还有 `app.js`、`index.js`、`accounting-ledger.js` 等文件。根目录项目配置的 `miniprogramRoot` 指向 `mp-weixin/`，因此排查小程序实际运行逻辑时，应优先检查该目录，不要直接认定根目录同名文件也在运行。

## 2. API 密钥在哪里

**原先两处硬编码的腾讯云 OCR 访问凭证已移除，现在统一使用环境变量。README 不包含实际密钥值。**

| 用途 | 文件 | 当前行号 | 变量 |
| --- | --- | --- | --- |
| 小程序 OCR 云函数调用腾讯云接口 | `mp-weixin/cloudfunctions/ocr/index.js` | 7–8 | `SECRET_ID`、`SECRET_KEY` |
| 本地 OCR 联调脚本直接调用腾讯云接口 | `test-ocr.js` | 14–15 | `SECRET_ID`、`SECRET_KEY` |

- `SECRET_ID`：调用签名中的凭证标识。
- `SECRET_KEY`：生成请求签名所用的秘密密钥。
- 两处代码都请求 `ocr.tencentcloudapi.com`，通过 `signV3()` 生成 `Authorization` 请求头。
- 云函数中使用 `VatInvoiceOCR`、`GeneralBasicOCR`；本地脚本还会调用 `RecognizeGeneralInvoice`。
- 两处代码使用相同的环境变量名，但本地进程和云端运行环境需要分别配置，配置不会自动同步。

### 密钥配置方式（已实现）

云函数和本地脚本均读取以下环境变量，不再回退到旧密钥：

```javascript
const SECRET_ID = (process.env.TENCENT_SECRET_ID || '').trim()
const SECRET_KEY = (process.env.TENCENT_SECRET_KEY || '').trim()
```

缺少任一项或配置只有空白时，识别会提示“请配置环境变量 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY”，不会下载/读取图片或发出 OCR 请求。云函数的历史记录查询、删除仍可使用，不依赖 OCR 密钥。

#### 本地 PowerShell 配置

在准备运行脚本的同一个 PowerShell 会话中设置：

```powershell
$env:TENCENT_SECRET_ID = '替换为自己的 SecretId'
$env:TENCENT_SECRET_KEY = '替换为自己的 SecretKey'
node .\test-ocr.js
```

上面的值只是占位说明，必须在本地替换；不要把真实密钥写回源码或 README，也不要通过聊天发送。直接输入含密钥的命令可能被终端历史记录保存，请只在受信任的本地会话操作。代码不会自动加载 `.env` 文件，也未引入额外配置依赖。

#### 云函数配置

在目标云开发环境中，为 `ocr` 云函数配置环境变量 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`，值分别填写自己的凭证；上传部署修改后的云函数，并确认新配置已在运行实例中生效。本地 PowerShell 环境变量不会自动传入云函数。

当前修改仅移除本地源码中的硬编码，不会替你创建新凭证、停用旧凭证或更新已经部署的云函数。

### 其他相关配置并不等于 API 秘密密钥

| 配置 | 位置 | 说明 |
| --- | --- | --- |
| 微信 AppID | 根目录与 `mp-weixin/` 下的 `project.config.json` 中 `appid` | 当前两个值不一致，应按实际导入目录和自己的小程序确认 |
| 云环境 ID | 上述配置文件的 `cloudEnvId`，以及 `mp-weixin/app.js` 的 `CLOUD_ENV_ID` | 应指向同一目标云开发环境；当前 `CLOUD_ENV_ID` 字符串开头还有制表符，配置时应去掉多余空白 |
| HTTP API 地址 | `mp-weixin/api/request.js` 中 `this.baseUrl` | 当前为空；需要独立 HTTP 后端的功能尚需配置实际服务地址 |
| 用户登录 Token | `mp-weixin/api/request.js` 与用户状态模块 | 运行时从本地存储读取，不是腾讯云 `SECRET_KEY` |
| 支付子商户号 | `mp-weixin/cloudfunctions/payment/index.js` 中 `subMchId` | 当前为空，不能据此认为支付已可用 |

## 3. 导入与运行

### 3.1 准备条件

- 微信开发者工具，以及自己有权限使用的微信小程序 AppID。
- 自己的小程序云开发环境；OCR 需使用有相应调用权限的腾讯云凭证。
- Node.js / npm，用于本地测试和安装云函数依赖。

根目录没有 `package.json`，不要在根目录直接执行 `npm install` 或 `npm run dev` 并期待完整工程启动。

### 3.2 导入小程序

1. 在微信开发者工具中导入项目根目录。
2. 确认根目录 `project.config.json` 的 `miniprogramRoot` 为 `mp-weixin/`，`cloudfunctionRoot` 为 `mp-weixin/cloudfunctions/`。
3. 将所使用项目配置中的 `appid`、`cloudEnvId` 改为自己的配置，并同步核对 `mp-weixin/app.js` 的 `CLOUD_ENV_ID`，不要保留开头空白。
4. 如果选择直接导入 `mp-weixin/`，则使用该目录下的项目配置；不要混淆两份 AppID。
5. 编译预览，结合控制台日志逐项检查页面、云环境和接口连接。

### 3.3 OCR 云函数

1. 按上述说明，为目标环境的 `ocr` 云函数配置 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`。
2. 在开发者工具中，将 `mp-weixin/cloudfunctions/ocr` 上传部署到自己的云环境，并安装其 `wx-server-sdk` 依赖。
3. 在云数据库中准备 `ocr_records` 集合，并按用户隔离需求配置访问权限。
4. 确认云存储图片上传和下载权限，以及小程序选择图片所需的隐私声明。
5. 通过 OCR 页面上传票据并测试识别、历史记录和删除。

OCR 云函数的 `action` 包括 `recognize`、`history`、`delete`。识别需要 `docType` 和云存储 `fileID`；当前识别分支支持 `vat_invoice`、`einvoice`、`bank_receipt`。

### 3.4 其他业务与支付

- HTTP 接口定义在 `mp-weixin/api/modules/`，请求地址集中在 `mp-weixin/api/request.js`，但当前目录未提供相应的完整 HTTP 后端实现。
- 农牧模块有独立的 SQL 与部署材料，也有 Mock 数据；SQL 脚本不是微信云数据库集合的一键初始化脚本。
- 支付云函数包含 `orders` 集合访问与 `cloud.cloudPay` 调用，但子商户号为空；`mp-weixin/utils/payment.js` 也注明当前版本暂不接入微信支付。请勿直接用于真实收款。

## 4. 本地测试

在项目根目录执行以下测试，不需要腾讯云 OCR 凭证：

```powershell
node .\mp-weixin\tests\monthly-report.test.js
node .\mp-weixin\tests\xlsx-builder.test.js
node .\mp-weixin\tests\ocr-credentials.test.js
```

新增的 OCR 凭证测试在隔离环境中模拟云 SDK、文件读取和网络请求，覆盖密钥缺失、空白配置、模拟识别成功及历史查询/删除，不调用真实 OCR 接口。

### 真实 OCR 联调脚本

```powershell
node .\test-ocr.js
```

注意：该脚本不是离线单元测试。当前会读取 `%USERPROFILE%\Desktop\12.png`，并依次调用三个真实 OCR 接口，可能产生费用或消耗额度。请先确认图片、凭证和调用权限；不要将其纳入默认离线测试。当前脚本不会自动读取 `.env` 文件。

## 5. 当前限制与安全提示

- 本次目录检查不等于已在微信开发者工具、真机或生产云环境完成联调。
- 两处源码已移除硬编码密钥；使用 OCR 前必须分别配置本地或云端环境变量。尚未进行真实 OCR 联调或云端部署。
- 如果现有密钥曾公开、共享给无关人员或进入不应访问的仓库，应在腾讯云控制台更换并停用旧凭证；仅修改当前文件不会清除历史版本中的值。
- 不要把真实 `SECRET_KEY` 放入小程序前端、截图、README 或提交记录。
- 当前 OCR 云函数会打印原始识别响应和字段，可能包含票据个人或经营信息；正式部署前应检查日志内容和访问范围。
- 仓库含已编译产物，修改后需重新编译或部署对应部分；云端已部署代码不会因本地文件修改而自动更新。
