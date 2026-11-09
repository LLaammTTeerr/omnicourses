<script setup lang="ts">
import BrandLink from '../shell/BrandLink.vue';
import LangButton from '../shell/LangButton.vue';
import ThemeButton from '../shell/ThemeButton.vue';

// Sign-in and sign-up (UI prototypes): the form on the left, a coloured panel on the right that hides on phones.
// `tone` picks the panel's group colour; the panel is decoration and hidden from screen readers.
defineProps<{ tone: 'ink' | 'phys' }>();
</script>

<template>
  <div class="auth">
    <div class="auth-form">
      <div class="auth-tools">
        <ThemeButton icon-only class="btn sm ghost icon-only" />
        <LangButton short class="btn sm ghost" />
      </div>
      <div class="inner">
        <BrandLink :to="{ name: 'home' }" />
        <slot />
      </div>
    </div>
    <div :class="['auth-art', `tone-${tone}`]" aria-hidden="true">
      <div class="quote"><slot name="art" /></div>
    </div>
  </div>
</template>

<style>
.auth { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); }
.auth-form { position: relative; display: grid; align-content: center; justify-items: center; padding: 64px 16px 64px; }
.auth-tools { position: absolute; top: 14px; right: 16px; display: flex; gap: 6px; }
.auth-tools .ico { display: grid; place-items: center; }
.auth-tools .ico .icon { width: 16px; height: 16px; }
.auth-form .inner { width: min(420px, 100%); display: grid; gap: 18px; }
.auth-form h1 { font-size: clamp(26px, 3vw, 34px); }
.auth-art { position: relative; overflow: hidden; border-left: 1px solid var(--edge); display: grid; place-items: center; padding: 40px; }
.auth-art.tone-ink { background: #111827; color: #fff; }
.auth-art.tone-phys { background: var(--phys); color: #06221f; }
.auth-art .quote { max-width: 420px; display: grid; gap: 14px; }
.auth-art .quote b { font: 700 clamp(28px, 3vw, 40px) / 1.08 var(--display); letter-spacing: -0.03em; }
.auth-art .chip { background: #fff; color: #14161e; justify-self: start; }
.auth-form .error-list { margin: 4px 0 0; padding-left: 1.2em; }
@media (max-width: 960px) {
  .auth { grid-template-columns: 1fr; }
  .auth-art { display: none; }
}
</style>
