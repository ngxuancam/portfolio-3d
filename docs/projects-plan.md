# Kế hoạch dựng 4 dự án trên portfolio

> Trạng thái: **bản kế hoạch**. Chưa tạo repo, chưa deploy, chưa gắn domain nào. Mỗi bước "tạo repo public / tạo project Vercel / gắn subdomain / publish npm" đều cần anh xác nhận riêng.
> Ngày lập: 2026-11-08.

## 0. Hiện trạng

- Card nằm trong [`src/content/resume.ts`](../src/content/resume.ts) (mảng `projects`, dòng ~132–177), render bởi [`src/components/sections/Projects.tsx`](../src/components/sections/Projects.tsx).
- Type [`Project`](../src/types/resume.ts) đã có `url?` và `repoUrl?`. `url` đã được dùng trong JSON‑LD (`JsonLdBuilder.withProjects`) và JSON Resume (`resumeSerializers`), nhưng **card chưa hiển thị link nào**.
- `outcome` được đưa thẳng vào `llms.txt` và `resume.json` dưới dạng "Outcome: …", tức là máy tìm kiếm và LLM đang đọc các con số chưa có thật. Nên sửa phần này sớm, kể cả trước khi dựng xong.
- **Năm trên card (2022–2025) không đúng** nếu bây giờ mới dựng. Khuyên ghi năm ship thật (2026/2027), hoặc bỏ năm và ghi "Demo cá nhân".

## 1. Khung chung (theo mẫu OnlyFan)

| Mục | Quyết định |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript, ESLint (copy config của `onlyfan/`) |
| Giấy phép | Apache‑2.0, giống portfolio và OnlyFan |
| Đo lường | `@vercel/speed-insights` (field data CWV) + một trang `/perf` (hoặc mục trong README) ghi phương pháp đo và kết quả lab |
| Hạ tầng | Mỗi dự án một repo `ngxuancam/<repo>`, một project Vercel trong team `ngxuancams-projects`, push `main` → tự deploy |
| Domain | `<sub>.nguyenxuancam.com`: anh tự thêm CNAME trên Cloudflare (để DNS‑only cho tới khi Vercel cấp cert, sau đó mới bật proxy nếu muốn) |
| Liên kết ngược | Footer mỗi demo có "← nguyenxuancam.com" và link repo |
| Dev server | Thêm entry vào `F:\2026\4_ME\ForMe\.claude\launch.json`, cổng 3219–3226 (dev/prod cho mỗi dự án) |
| SEO | `opengraph-image.tsx`, `sitemap.ts`, `robots.ts`, `manifest.ts` như OnlyFan |

| # | Dự án | Repo | Subdomain |
|---|---|---|---|
| 01 | Orbit Configurator | `orbit-configurator` | `orbit.nguyenxuancam.com` |
| 02 | Pulse Dashboard | `pulse-dashboard` | `pulse.nguyenxuancam.com` |
| 03 | Tides Story | `tides-story` | `tides.nguyenxuancam.com` |
| 04 | Atlas UI Kit | `atlas-ui` (monorepo) | `atlas.nguyenxuancam.com` (Storybook + docs) |

Phụ (Pulse): `pulse-stream.nguyenxuancam.com` cho WebSocket server trên Cloudflare Workers (xem mục 3).

---

## 2. Orbit Configurator (01)

**MVP đáng tin:** trình cấu hình **kệ module** (modular shelving). Chọn loại sản phẩm này vì nó *thật sự cần* instancing: rất nhiều bracket, ốc, tấm kệ lặp lại.
- Chọn số cột (1–6), số tầng (2–6), độ sâu; thêm phụ kiện (ngăn kéo, cửa, hộp).
- 4–5 vật liệu PBR: sồi, óc chó, thép sơn tĩnh điện, nhôm xước, laminate trắng.
- Giá tính theo cấu hình, **URL chia sẻ được** (state trong query string), nút chụp ảnh PNG.
- Điều khiển camera, preset góc nhìn, hoạt động tốt trên mobile.

**Kiến trúc và quyết định:**
- R3F + drei. `frameloop="demand"`, chỉ gọi `invalidate()` khi state, camera hoặc animation thay đổi. Dừng hẳn khi `document.hidden`. Đây là gốc của claim "idle tab cost zero GPU", và đo được.
- Bộ phận lặp dùng `InstancedMesh` (drei `<Instances>`), mỗi loại part × vật liệu là 1 draw call.
- Asset: model tự dựng trong Blender (hoặc sinh theo tham số bằng code). Texture CC0 (ambientCG / Poly Haven). Pipeline `gltf-transform`: meshopt + texture **KTX2** (UASTC cho normal, ETC1S cho albedo/ORM) qua `KTX2Loader`. Script `npm run assets` để ai cũng tái tạo được.
- Zustand store làm nguồn sự thật duy nhất, đồng bộ hai chiều với URL. Scene chỉ subscribe từng slice để không re-render thừa.
- Environment HDRI nhỏ (1k, KTX2), contact shadow bake một lần, không đổ bóng realtime mỗi frame.

**Milestones (người‑ngày):**
1. Scaffold, scene, camera, lighting, on‑demand loop: 1.5
2. Mô hình tham số + instancing + store/URL: 3
3. Pipeline asset KTX2/meshopt + vật liệu PBR: 2.5
4. UI cấu hình, giá, share/snapshot, mobile: 2
5. Đo hiệu năng, `/perf`, README, deploy: 1

**Tổng ≈ 10 ngày.**

**Claim "+32% add-to-cart vs. static images":** demo cá nhân không có shop, không có traffic, nên **không thể đo trung thực**. Đề xuất thay bằng số kỹ thuật đo được:
- *"0 frame khi idle · N part trong M draw call · tải lần đầu X MB"*. Đo bằng Playwright: đếm `renderer.info.render.frame` trong 10 s idle (lộ qua `window.__orbitStats` ở build đo), đếm `renderer.info.render.calls` ở cấu hình lớn nhất, và tổng transfer size.
- Wording gợi ý: **"Idle tabs render 0 frames; 300+ parts in 12 draw calls"** (điền số thật sau khi đo).

---

## 3. Pulse Dashboard (02)

**MVP đáng tin:** dashboard theo dõi **luồng chỉnh sửa Wikipedia theo thời gian thực**. Đây là dữ liệu thật, công khai (Wikimedia EventStreams `recentchange`, khoảng vài chục sự kiện/giây), nên không phải số giả.
- 4 KPI tile realtime, 2–3 biểu đồ Canvas (line theo giây, bar theo wiki, heat theo giờ), bảng sự kiện **ảo hoá 100k dòng** có sort/filter/search.
- Nút pause/resume, chọn cửa sổ thời gian, chế độ "replay" từ dữ liệu ghi sẵn để demo ổn định khi nguồn chậm.

**Kiến trúc và quyết định:**
- **Vercel Functions không giữ được WebSocket server lâu dài.** Vì vậy tách stream ra **Cloudflare Worker + Durable Object** (anh đã dùng Cloudflare): DO subscribe EventStreams (SSE), gộp lại, rồi broadcast qua WebSocket tới client. Gắn domain `pulse-stream.nguyenxuancam.com`. Nếu không muốn thêm Worker, phương án B là route handler SSE trên Vercel, nhưng khi đó phải bỏ chữ "WebSockets" khỏi stack.
- Fallback: Web Worker sinh dữ liệu giả lập cùng schema khi WS mất kết nối, và UI ghi rõ "simulated".
- **RSC cho shell** (layout, nav, filter panel, metadata); **client island** chỉ cho chart, bảng và KPI.
- Dữ liệu nằm **ngoài React**: ring buffer (typed arrays) trong store thuần, `useSyncExternalStore` với snapshot throttle theo rAF. Chart vẽ thẳng lên Canvas 2D (cân nhắc OffscreenCanvas trong worker cho chart nặng). React không re-render theo từng event.
- Bảng: virtualizer (TanStack Virtual hoặc tự viết), hàng cao cố định, sort/filter chạy trong Web Worker, input dùng `startTransition`/`useDeferredValue` để giữ INP thấp.

**Milestones:**
1. Scaffold, RSC shell, layout: 1
2. Worker + DO stream, client WS + reconnect + fallback giả lập: 3
3. Store ring buffer + KPI: 1.5
4. Canvas chart (3 loại, DPR‑aware, tooltip): 3
5. Bảng ảo 100k dòng + sort/filter trong worker: 2.5
6. Đo INP (lab + field), `/perf`, deploy hai phần: 1.5

**Tổng ≈ 12–13 ngày.**

**Claim "INP held under 120ms at p75":** đo được, nhưng phải nói rõ là lab hay field.
- Lab: Playwright + CPU throttle 4×, kịch bản 50 tương tác (sort, filter, gõ search, cuộn) khi bảng đang có 100k dòng và stream đang chạy. Lấy INP qua `web-vitals` (bản attribution) và báo p75.
- Field: Speed Insights báo INP p75 thật, nhưng chỉ có ý nghĩa khi đủ lượt truy cập.
- Wording gợi ý: **"INP p75 < 120 ms with 100k live rows (lab, 4× CPU throttle)"**. Nếu số đo ra cao hơn thì ghi số thật.

---

## 4. Tides Story (03)

**MVP đáng tin:** bài long‑form gốc khoảng 1.500–2.000 chữ, 5–6 chương. Gợi ý chủ đề: **thuỷ triều và nghề biển ở Đà Nẵng** (anh có lợi thế bản địa: ảnh tự chụp, câu chuyện thật). Có bản tiếng Anh, tiếng Việt là tuỳ chọn.
- Mỗi chương một ScrollTrigger timeline: text reveal, ảnh parallax, một infographic (chu kỳ trăng và triều, biểu đồ mực nước đo thực tế).
- Đại dương GLSL nền cố định, sóng mạnh hoặc lặng theo vận tốc cuộn, màu nước đổi theo chương (bình minh → bão → đêm).

**Kiến trúc và quyết định:**
- Nội dung là RSC/MDX, **đọc được khi không có JS** (progressive enhancement). Animation chỉ là lớp phủ thêm.
- GSAP + ScrollTrigger (GSAP hiện miễn phí toàn bộ plugin, kể cả SplitText). Một `gsap.context()` cho mỗi chương để cleanup sạch khi unmount.
- Ocean: plane Three.js thuần (không cần R3F cho một mesh), sóng Gerstner trong vertex shader, Fresnel + foam trong fragment. Uniform `uVelocity` lấy từ `ScrollTrigger.getVelocity()` qua lò xo giảm chấn để không giật.
- Chỉ render khi canvas trong viewport, giảm DPR trên mobile, `prefers-reduced-motion` thì dùng ảnh tĩnh và tắt scrub.
- Dữ liệu triều: lấy bảng thuỷ triều công khai (ghi nguồn), lưu tĩnh thành JSON.

**Milestones:**
1. Viết nội dung, chọn/chụp ảnh, storyboard: 3 (rủi ro lớn nhất, nằm ngoài phần code)
2. Scaffold MDX + layout typographic, chạy được không cần JS: 1.5
3. Shader ocean + liên kết vận tốc cuộn: 2.5
4. Timeline từng chương + infographic: 3
5. Reduced‑motion, mobile, perf pass, deploy: 1

**Tổng ≈ 11 ngày.**

**Claim "Awwwards Honorable Mention (placeholder)":** **không được giữ** dù có chữ "placeholder", vì nó đã lọt vào `llms.txt`/JSON‑LD như một thành tích.
- Thay bằng số đo được: **"60 fps ocean on a mid-range phone · 0 CLS · fully readable without JS"**.
- Nếu anh muốn: nộp Awwwards (có phí, kết quả không chắc). Chỉ ghi "Awwwards Honorable Mention" **sau khi** thật sự nhận được, trước đó có thể ghi "Submitted to Awwwards".

---

## 5. Atlas UI Kit (04)

**MVP đáng tin:** khoảng **20 primitive headless** theo WAI‑ARIA APG, cộng một token pipeline.
- Primitive: Button, Toggle, Checkbox, RadioGroup, Switch, Tabs, Accordion/Disclosure, Dialog, AlertDialog, Popover, Tooltip, Menu, Listbox/Select, Combobox, Slider, Toast, VisuallyHidden, FocusScope, Portal, Separator.
- Theme mẫu (style bằng token) để Storybook trông như một design system thật.

**Kiến trúc và quyết định:**
- Monorepo npm workspaces: `packages/tokens`, `packages/react` (hooks + component headless), `packages/figma-plugin`, `apps/storybook`.
- **Tự viết** hook (`useDialog`, `useListbox`, …) thay vì bọc React Aria/Radix. Nếu bọc thì claim "headless primitives" không còn là của mình.
- Tokens: **Style Dictionary v4**, nguồn theo định dạng DTCG (`*.tokens.json`), có 3 tầng primitive → semantic → component. Output:
  1. CSS custom properties (light/dark qua `[data-theme]`)
  2. TS types + const (`TokenName` union, autocomplete)
  3. Figma: **Figma REST API Variables chỉ ghi được ở gói Enterprise**, nên output là một JSON, kèm **plugin Figma nhỏ trong repo** đọc JSON đó để tạo/cập nhật Variables + Styles (Plugin API dùng được với mọi gói). Vẫn đúng tinh thần "từ một nguồn".
- Kiểm thử: Vitest + Testing Library cho logic, **Playwright test bàn phím** theo từng pattern APG, `@storybook/addon-a11y` + `axe` trong CI (fail build nếu có vi phạm).
- Storybook build tĩnh, deploy lên `atlas.nguyenxuancam.com`. Publish npm `@ngxuancam/atlas-*` là tuỳ chọn, cần anh xác nhận.

**Milestones:**
1. Monorepo, CI, Storybook skeleton: 1.5
2. Token source + Style Dictionary build 3 output: 2
3. Plugin Figma đồng bộ Variables: 2
4. Primitive đợt 1 (8 cái đơn giản): 3
5. Primitive đợt 2 (overlay, listbox, combobox, slider, toast; phần khó nhất về focus/ARIA): 5
6. Test bàn phím + axe CI, docs, deploy: 2

**Tổng ≈ 15 ngày.**

**Claim "Adopted by 5 teams, 140+ components":** không đúng với dự án cá nhân. Thay bằng:
- **"20 accessible primitives · 0 axe violations in CI · 1 token source → CSS, TS & Figma"**.
- Có một số *dogfood* thật: nếu Pulse, Tides và portfolio dùng `@ngxuancam/atlas-tokens` thì có thể ghi **"Powers 4 of my production sites"**, và câu này đúng.

---

## 6. Thứ tự dựng (khuyến nghị)

1. **Orbit** (~10 ngày): gần nhất với điểm mạnh 3D và stack OnlyFan (R3F/drei/Zustand), tái dùng nhiều nhất, ra demo đẹp nhanh nhất.
2. **Pulse** (~13 ngày): chứng minh năng lực frontend "không 3D" mà nhà tuyển dụng hỏi nhiều nhất (RSC, perf, INP, dữ liệu lớn).
3. **Atlas** (~15 ngày): làm sau Pulse để rút token/primitive từ chính nhu cầu thật của Pulse, sau đó retrofit token vào Pulse và portfolio để có claim dogfood.
4. **Tides** (~11 ngày): phụ thuộc nhiều vào viết nội dung và ảnh. Có thể bắt đầu viết và chụp ảnh song song ngay từ bây giờ.

Tổng khoảng **49 người‑ngày** (khoảng 10 tuần nếu làm buổi tối/cuối tuần). Mỗi dự án ship độc lập, không chờ nhau.

## 7. Card trên portfolio sẽ link tới demo thế nào

Thay đổi trong repo `portfolio` (làm một lần, rồi mỗi lần ship chỉ sửa dữ liệu):

1. **Type** `Project`: thêm `status: "live" | "building"` (và tuỳ chọn `metricsUrl` trỏ tới `/perf` của demo).
2. **Card** (`Projects.tsx`): thêm hàng hành động ở đáy card, gồm **"Live demo ↗"** (`url`) và **"Source"** (`repoUrl`), `target="_blank" rel="noopener"`. Dùng link rõ ràng thay vì bọc cả card thành `<a>`, để không xung đột với kéo ngang của `HorizontalScroller` và giữ ngữ nghĩa a11y. Card `status: "building"` hiện badge "In progress" và không có link demo.
3. **Dữ liệu** (`resume.ts`), mỗi lần ship: điền `url`, `repoUrl`, `status: "live"`, `outcome` bằng số đã đo, `year` bằng năm ship thật.
4. **Ngay bây giờ** (trước khi dựng, khuyên làm sớm): chuyển 4 card sang `status: "building"` và thay `outcome` bằng mô tả mục tiêu (vd. *"Target: 0 GPU frames when idle"*), để `llms.txt`/`resume.json`/JSON‑LD thôi phát tán số chưa có. Serializer đã dùng `url`, nên JSON‑LD/JSON Resume tự có link khi điền.
5. Tuỳ chọn: thêm **OnlyFan** làm card thứ 5 (đã live, số liệu thật: ~40 Hz solver, 60 fps).

## 8. Các điểm cần anh quyết định / xác nhận

- [ ] Đồng ý tên repo và subdomain ở bảng mục 1.
- [ ] Pulse: dùng Cloudflare Worker + Durable Object cho WebSocket (thêm `pulse-stream.` subdomain), hay SSE trên Vercel và bỏ chữ "WebSockets"?
- [ ] Orbit: sản phẩm là kệ module, hay anh có sản phẩm khác muốn làm?
- [ ] Tides: chủ đề thuỷ triều Đà Nẵng, và anh có ảnh tự chụp không?
- [ ] Atlas: có publish npm `@ngxuancam/atlas-*` không?
- [ ] Có sửa ngay `outcome`/`year` của 4 card (mục 7.4) trước khi dựng không?
- [ ] Mỗi dự án: xác nhận trước khi tạo repo public, tạo project Vercel và gắn domain.
