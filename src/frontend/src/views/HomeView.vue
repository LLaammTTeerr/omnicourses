<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { HOME_SIGNED_IN } from '../auth/redirect.js';
import { useAuth } from '../auth/store.js';
import ApiStatus from '../components/ApiStatus.vue';
import { GROUPS, groupClass, type GroupId } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';

// The landing page (UI prototypes: index.html). It says what works today and marks the rest as coming,
// so a visitor is never promised a screen that does not exist yet.
const auth = useAuth();
const locale = useLocale();

interface Feature {
  group: GroupId;
  glyph: string;
  title: string;
  text: string;
  soon?: boolean;
}

const m = useMessages({
  vi: {
    eyebrow: 'Cho sinh viên HCMUS · APCS trước tiên',
    title: 'Biết chính xác còn thiếu gì để tốt nghiệp.',
    lead: 'Một chỗ cho bảng điểm, tiến độ từng nhóm tín chỉ và các thủ tục ở trường. Mọi quy chế do rule engine tính, không phải AI.',
    start: 'Bắt đầu miễn phí',
    open: 'Mở tổng quan',
    readGuides: 'Đọc hướng dẫn thủ tục',
    noPortal: 'Không cần mật khẩu cổng trường. Dữ liệu là do bạn nhập.',
    stage: '8 nhóm tín chỉ, mỗi nhóm một màu và một ký hiệu.',
    featuresTitle: 'Mọi thứ về việc học, xếp gọn trong một màn hình.',
    soon: 'Sắp có',
    features: [
      { group: 'phys', glyph: '↗', title: 'Hướng dẫn thủ tục', text: 'Đăng ký học phần, đóng học phí, tải bảng điểm. Link thẳng tới cổng, các bước, ngày kiểm tra gần nhất. Đọc được khi chưa đăng nhập.' },
      { group: 'gen', glyph: '≡', title: 'Bảng điểm của bạn', text: 'Nhập từng môn, duyệt từng dòng rồi lưu. Dòng chưa đủ thông tin không lưu được. Lưu lần sau thay toàn bộ lần trước.' },
      { group: 'thesis', glyph: '⇣', title: 'Dữ liệu là của bạn', text: 'Tải toàn bộ dữ liệu về một file JSON, hoặc xóa tài khoản bất cứ lúc nào.' },
      { group: 'core', glyph: '%', title: 'Xét tốt nghiệp theo từng nhóm', text: '8 nhóm tín chỉ, mỗi nhóm một màu. Đã đạt, đang học, còn thiếu, theo đúng quy chế.' },
      { group: 'elec', glyph: '⇄', title: 'Lộ trình kéo thả', text: 'Kéo môn vào học kỳ. Tiên quyết, kỳ mở môn và giới hạn tín chỉ được kiểm tra ngay khi thả.', soon: true },
      { group: 'pol', glyph: '?', title: 'Trợ lý có trích dẫn', text: 'Mỗi câu trả lời kèm điều khoản. Việc liên quan hồ sơ của bạn do rule engine kiểm tra.', soon: true },
    ] satisfies Feature[],
    promiseTitle: 'Ba điều không bao giờ làm.',
    promises: [
      { group: 'pol', title: 'Không để AI quyết định quy chế', text: 'Tiên quyết, giới hạn tín chỉ, điều kiện tốt nghiệp chỉ do rule engine tính.' },
      { group: 'core', title: 'Không giữ mật khẩu cổng trường', text: 'Không đăng ký hộ, không đọc trang portal. Chỉ có link và dữ liệu bạn tự nhập.' },
      { group: 'eng', title: 'Không gửi tên hay MSSV cho AI', text: 'Trợ lý chỉ nhận mã môn, điểm, học kỳ, và chỉ sau khi bạn đồng ý.' },
    ] satisfies { group: GroupId; title: string; text: string }[],
    ctaTitle: 'Kỳ đăng ký sắp tới, chuẩn bị bảng điểm trước đã.',
    ctaText: 'Tài khoản miễn phí. Xóa toàn bộ dữ liệu bất cứ lúc nào.',
    cta: 'Tạo tài khoản',
    status: 'Trạng thái hệ thống',
  },
  en: {
    eyebrow: 'For HCMUS students · APCS first',
    title: 'Know exactly what you still need to graduate.',
    lead: 'One place for your transcript, your progress in each credit group and the tasks at school. Every academic rule is computed by the rule engine, not by AI.',
    start: 'Get started free',
    open: 'Open your dashboard',
    readGuides: 'Read the school task guides',
    noPortal: 'No school portal password needed. You enter your own data.',
    stage: '8 credit groups, each with its own colour and glyph.',
    featuresTitle: 'Everything about your studies, on one screen.',
    soon: 'Coming soon',
    features: [
      { group: 'phys', glyph: '↗', title: 'School task guides', text: 'Register for courses, pay tuition, download your transcript. A direct link to the portal, the steps and the date they were last checked. Readable without an account.' },
      { group: 'gen', glyph: '≡', title: 'Your transcript', text: 'Enter each course, review every row, then save. An incomplete row cannot be saved. A later save replaces the earlier one.' },
      { group: 'thesis', glyph: '⇣', title: 'Your data is yours', text: 'Download everything as one JSON file, or delete your account at any time.' },
      { group: 'core', glyph: '%', title: 'Degree audit by group', text: '8 credit groups, one colour each. Passed, in progress and still needed, by the regulation.' },
      { group: 'elec', glyph: '⇄', title: 'Drag-and-drop roadmap', text: 'Drag a course into a term. Prerequisites, offering terms and credit caps are checked as you drop.', soon: true },
      { group: 'pol', glyph: '?', title: 'An advisor that cites', text: 'Every answer cites its clause. Anything about your record is checked by the rule engine.', soon: true },
    ] satisfies Feature[],
    promiseTitle: 'Three things we never do.',
    promises: [
      { group: 'pol', title: 'AI never decides a rule', text: 'Prerequisites, credit caps and graduation status are computed only by the rule engine.' },
      { group: 'core', title: 'We never hold your portal password', text: 'No registering on your behalf, no reading portal pages. Only links and the data you enter.' },
      { group: 'eng', title: 'Your name and student ID never reach an AI', text: 'The advisor only gets course codes, grades and terms, and only after you agree.' },
    ] satisfies { group: GroupId; title: string; text: string }[],
    ctaTitle: 'Registration is coming: get your transcript ready first.',
    ctaText: 'Free account. Delete all your data at any time.',
    cta: 'Create account',
    status: 'System status',
  },
});

usePageTitle();
</script>

<template>
  <div class="landing">
    <section class="l-hero" aria-labelledby="l-title">
      <div>
        <span class="chip ink"><Icon name="cap" size="sm" />{{ m.eyebrow }}</span>
        <h1 id="l-title">{{ m.title }}</h1>
        <p class="lead">{{ m.lead }}</p>
        <div class="l-cta">
          <RouterLink v-if="auth.signedIn" class="btn primary" :to="HOME_SIGNED_IN">{{ m.open }} <Icon name="right" size="sm" /></RouterLink>
          <RouterLink v-else class="btn primary" :to="{ name: 'sign-up' }">{{ m.start }} <Icon name="right" size="sm" /></RouterLink>
          <RouterLink class="btn" :to="{ name: 'guides' }"><Icon name="book" size="sm" />{{ m.readGuides }}</RouterLink>
        </div>
        <p class="small t3 l-note">{{ m.noPortal }}</p>
      </div>
      <figure class="l-stage">
        <ul class="l-board" aria-hidden="true">
          <li v-for="group in GROUPS" :key="group.id" :class="['l-tile', groupClass(group.id)]">
            <span class="glyph sm">{{ group.glyph }}</span><span>{{ group.short[locale.lang] }}</span>
          </li>
        </ul>
        <figcaption class="small t2">{{ m.stage }}</figcaption>
      </figure>
    </section>

    <section class="l-section" aria-labelledby="f-title">
      <h2 id="f-title">{{ m.featuresTitle }}</h2>
      <div class="features">
        <article v-for="feature in m.features" :key="feature.title" :class="['card', 'feature', groupClass(feature.group), { soon: feature.soon }]">
          <span class="glyph" aria-hidden="true">{{ feature.glyph }}</span>
          <h3>{{ feature.title }} <span v-if="feature.soon" class="chip">{{ m.soon }}</span></h3>
          <p>{{ feature.text }}</p>
        </article>
      </div>
    </section>

    <section class="l-section" aria-labelledby="p-title">
      <h2 id="p-title">{{ m.promiseTitle }}</h2>
      <div class="promise">
        <div v-for="promise in m.promises" :key="promise.title" class="box">
          <span :class="['glyph', 'sm', groupClass(promise.group)]" aria-hidden="true">✕</span>
          <b>{{ promise.title }}</b>
          <p class="small t2">{{ promise.text }}</p>
        </div>
      </div>
      <div v-if="!auth.signedIn" class="card l-final">
        <div>
          <h2>{{ m.ctaTitle }}</h2>
          <p class="t2">{{ m.ctaText }}</p>
        </div>
        <RouterLink class="btn primary big" :to="{ name: 'sign-up' }">{{ m.cta }} <Icon name="right" size="sm" /></RouterLink>
      </div>
    </section>

    <section class="l-status small t3" :aria-label="m.status">
      <ApiStatus />
    </section>
  </div>
</template>

<style scoped>
.landing { max-width: 1240px; margin: 0 auto; }
.l-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: center; padding: 20px 0 40px; }
.l-hero h1 { margin-top: 18px; font-size: clamp(36px, 5.6vw, 68px); line-height: 1.02; letter-spacing: -0.045em; overflow-wrap: anywhere; }
.chip.ink { white-space: normal; min-height: 28px; padding: 4px 12px; }
.lead { font-size: 18px; color: var(--ink-2); max-width: 46ch; margin-top: 18px; }
.l-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
.l-cta .btn { min-height: 52px; padding: 0 22px; font-size: 16px; border-radius: 14px; white-space: normal; }
.l-note { margin-top: 16px; }
.l-stage { margin: 0; display: grid; gap: 12px; }
.l-board {
  list-style: none; margin: 0; padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
  background: var(--surface); border: 1px solid var(--edge); border-radius: var(--r); box-shadow: var(--shadow-lg);
}
.l-tile { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--c); color: var(--on); font-weight: 650; font-size: 14px; min-width: 0; }
.l-tile .glyph { background: rgba(255, 255, 255, 0.22); color: inherit; box-shadow: none; }
.l-section { padding: 40px 0; display: grid; gap: 26px; }
.l-section > h2 { font-size: clamp(26px, 3.4vw, 40px); font-weight: 700; letter-spacing: -0.035em; max-width: 22ch; }
.features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.feature { padding: 22px; display: grid; gap: 10px; align-content: start; }
.feature h3 { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.feature p { color: var(--ink-2); font-size: 14.5px; }
.feature.soon { background: transparent; border-style: dashed; box-shadow: none; }
.promise { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.promise .box { padding: 20px; display: grid; gap: 8px; border: 1px solid var(--edge); background: var(--surface); }
.l-final { display: flex; gap: 18px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 22px; }
.l-final h2 { font-size: clamp(22px, 2.6vw, 28px); }
.l-final p { margin-top: 6px; }
.l-status { padding-top: 8px; }
@media (max-width: 1180px) {
  .features { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 960px) {
  .l-hero, .promise { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .features { grid-template-columns: 1fr; }
}
</style>
