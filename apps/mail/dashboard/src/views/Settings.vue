<template>
  <div class="bg-[#141418] shadow-xl rounded-2xl p-6 sm:p-8 border border-[#2a2a32] max-w-3xl mx-auto">
    <div class="flex items-center justify-between border-b border-[#2a2a32] pb-5 mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold font-['Cinzel'] tracking-wide text-[#f4ce1f]">{{ $t('settings.title') }}</h1>
        <p class="text-xs text-[#9a9aa5] mt-1">{{ $t('settings.subtitle') }}</p>
      </div>
      <button 
        @click="toggleLanguage" 
        class="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#2a2a32] bg-[#0e0e12] hover:border-[#f4ce1f]/50 hover:text-[#f4ce1f] text-[#b9b9c4] transition-all"
      >
        <span>{{ locale === 'pt-BR' ? '🇧🇷 Português (Brasil)' : '🇺🇸 English' }}</span>
      </button>
    </div>

    <div v-if="mailbox">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <div>
          <label for="name" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('mailboxes.mailbox_name') }}</label>
          <input 
            type="text" 
            id="name" 
            v-model="mailbox.name" 
            class="block w-full bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 transition-all" 
          />
        </div>
        <div>
          <label for="email" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('mailboxes.mailbox_email') }}</label>
          <input 
            type="email" 
            id="email" 
            v-model="mailbox.email" 
            class="block w-full bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#6e6e78] font-mono px-3.5 py-2.5 opacity-70 cursor-not-allowed" 
            disabled 
          />
        </div>

        <!-- Signature Section -->
        <div class="border-t border-[#2a2a32] pt-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-semibold text-[#f4f4f6]">{{ $t('settings.signature') }}</h2>
              <p class="text-xs text-[#9a9aa5]">Assinatura automática anexada ao final das novas mensagens enviadas.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="signatureEnabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-[#2a2a32] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#08080a] after:border-[#08080a] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f4ce1f]"></div>
            </label>
          </div>
          <div v-if="signatureEnabled" class="bg-[#0e0e12] rounded-xl p-2 border border-[#2a2a32]">
            <RichTextEditor v-model="signatureHtml" />
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button 
            type="submit" 
            class="px-5 py-2.5 bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] text-[#08080a] text-xs font-bold rounded-xl shadow-[0_2px_12px_rgba(244,206,31,0.25)] hover:from-[#fbe9a6] hover:to-[#f4ce1f] transition-all uppercase tracking-wider"
          >
            {{ $t('common.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import RichTextEditor from "@/components/RichTextEditor.vue";
import { useMailboxStore } from "@/stores/mailboxes";
import { useToast } from "@/composables/useToast";
import { useI18n, $t } from "@/i18n";

const mailboxStore = useMailboxStore();
const { currentMailbox: mailbox } = storeToRefs(mailboxStore);
const route = useRoute();
const { success: showSuccessToast } = useToast();
const { locale, setLocale } = useI18n();

const signatureEnabled = ref(false);
const signatureHtml = ref("");

const toggleLanguage = () => {
  setLocale(locale.value === "pt-BR" ? "en" : "pt-BR");
};

watch(
  mailbox,
  (m) => {
    if (m?.settings?.signature) {
      signatureEnabled.value = m.settings.signature.enabled;
      signatureHtml.value =
        m.settings.signature.html || m.settings.signature.text || "";
    }
  },
  { immediate: true },
);

onMounted(() => {
  mailboxStore.fetchMailbox(route.params.mailboxId as string);
});

const stripHtml = (html: string): string => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
};

const updateSettings = () => {
  if (mailbox.value) {
    const settings = {
      ...mailbox.value.settings,
      signature: {
        enabled: signatureEnabled.value,
        text: stripHtml(signatureHtml.value),
        html: signatureHtml.value,
      },
    };
    mailboxStore.updateMailbox(route.params.mailboxId as string, settings);
    showSuccessToast($t("common.saved"));
  }
};
</script>
