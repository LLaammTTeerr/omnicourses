import { onActivated, onDeactivated, ref, toValue, watchEffect, type MaybeRefOrGetter } from 'vue';

export function usePageTitle(title?: MaybeRefOrGetter<string>): void {
  const onScreen = ref(true);
  onActivated(() => (onScreen.value = true));
  onDeactivated(() => (onScreen.value = false));
  watchEffect(() => {
    if (!onScreen.value) return;
    const page = toValue(title);
    document.title = page ? `${page} · OmniCourse` : 'OmniCourse';
  });
}
