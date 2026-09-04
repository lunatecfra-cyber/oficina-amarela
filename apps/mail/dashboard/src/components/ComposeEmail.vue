<template>
  <div v-if="isComposeModalOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-[#141418] rounded-2xl shadow-2xl w-full max-w-3xl text-[#f4f4f6] border border-[#2a2a32] overflow-hidden transform transition-all">
      <div class="flex justify-between items-center bg-[#1c1c22] border-b border-[#2a2a32] px-6 py-4">
        <div class="flex items-center gap-3">
          <img src="/emblema.png" alt="Oficina Amarela" class="h-6 w-6 object-contain" />
          <h2 class="text-base font-bold text-[#f4ce1f] font-['Cinzel'] tracking-wide">{{ modalTitle }}</h2>
        </div>
        <button @click="closeModal" class="text-[#6e6e78] hover:text-white p-1 rounded-lg transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form @submit.prevent="send" class="p-6">
        <div v-if="error" class="bg-red-950/50 border border-red-800/50 text-red-300 px-4 py-2.5 rounded-xl mb-4 text-xs flex items-start gap-2" role="alert">
          <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span class="block sm:inline">{{ error }}</span>
        </div>
        <div class="mb-4">
          <label for="to" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('compose.to') }}</label>
          <input 
            type="email" 
            id="to" 
            v-model="to" 
            class="block w-full bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all" 
            :placeholder="$t('compose.to_placeholder')" 
            required 
          />
        </div>
        <div class="mb-4">
          <label for="subject" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('compose.subject') }}</label>
          <input 
            type="text" 
            id="subject" 
            v-model="subject" 
            class="block w-full bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all" 
            :placeholder="$t('compose.subject_placeholder')" 
            required 
          />
        </div>
        <div class="mb-5">
          <label for="body" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('compose.new_message') }}</label>
          <RichTextEditor v-model="body" />
        </div>
        <div class="flex justify-end gap-2.5">
          <button 
            type="button" 
            @click="closeModal" 
            class="px-4 py-2 bg-[#1c1c22] hover:bg-[#2a2a32] text-xs font-semibold text-[#b9b9c4] rounded-xl transition-colors"
          >
            {{ $t('common.cancel') }}
          </button>
          <button 
            type="submit" 
            :disabled="isLoading"
            class="px-5 py-2 bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] text-[#08080a] text-xs font-bold rounded-xl shadow-[0_2px_12px_rgba(244,206,31,0.25)] hover:from-[#fbe9a6] hover:to-[#f4ce1f] transition-all uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
          >
            <svg v-if="!isLoading" class="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isLoading ? $t('compose.sending') : $t('compose.send') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { useEmailStore } from "@/stores/emails";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";
import RichTextEditor from "./RichTextEditor.vue";
import { $t } from "@/i18n";

const uiStore = useUIStore();
const { isComposeModalOpen, composeOptions } = storeToRefs(uiStore);
const emailStore = useEmailStore();
const mailboxStore = useMailboxStore();
const { currentMailbox } = storeToRefs(mailboxStore);
const route = useRoute();
const { success: showSuccessToast, error: showErrorToast } = useToast();

const to = ref("");
const subject = ref("");
const body = ref("");
const error = ref<string | null>(null);
const isLoading = ref(false);

const modalTitle = computed(() => {
  switch (composeOptions.value.mode) {
    case "reply":
      return $t("email_detail.reply");
    case "reply-all":
      return $t("email_detail.reply_all");
    case "forward":
      return $t("email_detail.forward");
    default:
      return $t("compose.new_message");
  }
});

const closeModal = () => {
  error.value = null;
  to.value = "";
  subject.value = "";
  body.value = "";
  uiStore.closeComposeModal();
};

const getSignatureBlock = (): string => {
  const sig = currentMailbox.value?.settings?.signature;
  if (sig?.enabled && (sig?.html || sig?.text)) {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const content = sig.html || escapeHtml(sig.text);
    return `<div style="border-top: 1px solid #333; margin-top: 16px; padding-top: 12px;">${content}</div>`;
  }
  return "";
};

watch(isComposeModalOpen, (isOpen) => {
  if (isOpen) {
    const options = composeOptions.value;
    const original = options.originalEmail;
    const sigBlock = getSignatureBlock();

    if (options.mode === "reply" && original) {
      to.value = original.sender;
      subject.value = original.subject.startsWith("Re: ")
        ? original.subject
        : `Re: ${original.subject}`;
      body.value = `<br>${sigBlock}<br><blockquote style="border-left: 2px solid #f4ce1f; margin: 0; padding-left: 1em; color: #999;">Em ${original.date}, ${original.sender} escreveu:<br><br>${original.body}</blockquote>`;
    } else if (options.mode === "reply-all" && original) {
      const recipients = new Set([original.sender]);
      if (
        original.recipient &&
        original.recipient !== currentMailbox.value?.email
      ) {
        recipients.add(original.recipient);
      }
      to.value = Array.from(recipients).join(", ");
      subject.value = original.subject.startsWith("Re: ")
        ? original.subject
        : `Re: ${original.subject}`;
      body.value = `<br>${sigBlock}<br><blockquote style="border-left: 2px solid #f4ce1f; margin: 0; padding-left: 1em; color: #999;">Em ${original.date}, ${original.sender} escreveu:<br><br>${original.body}</blockquote>`;
    } else if (options.mode === "forward" && original) {
      to.value = "";
      subject.value = original.subject.startsWith("Enc: ") || original.subject.startsWith("Fwd: ")
        ? original.subject
        : `Enc: ${original.subject}`;
      body.value = `<br>${sigBlock}<br><div style="border: 1px solid #333; padding: 1em; background-color: #1a1a1f; margin: 1em 0;">
<strong>Mensagem Encaminhada:</strong><br>
<strong>De:</strong> ${original.sender}<br>
<strong>Data:</strong> ${original.date}<br>
<strong>Assunto:</strong> ${original.subject}<br><br>
${original.body}
</div>`;
    } else {
      to.value = "";
      subject.value = "";
      body.value = sigBlock ? `<br><br>${sigBlock}` : "";
    }
  }
});

const htmlToPlainText = (html: string): string => {
  const div = document.createElement("div");
  div.innerHTML = html;
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/div>/gi, "\n");
  div.innerHTML = text;
  return (div.textContent || div.innerText || "").trim();
};

const send = async () => {
  error.value = null;
  if (!currentMailbox.value) {
    error.value = "Nenhuma caixa postal selecionada.";
    return;
  }
  isLoading.value = true;
  try {
    const mailboxId = route.params.mailboxId as string;
    const emailData = {
      to: to.value,
      from: currentMailbox.value.email,
      subject: subject.value,
      html: body.value,
      text: htmlToPlainText(body.value),
    };

    if (
      composeOptions.value.mode === "reply" ||
      composeOptions.value.mode === "reply-all"
    ) {
      const originalEmailId = composeOptions.value.originalEmail?.id;
      if (originalEmailId) {
        await api.replyToEmail(mailboxId, originalEmailId, emailData);
      } else {
        throw new Error("E-mail original não encontrado");
      }
    } else if (composeOptions.value.mode === "forward") {
      const originalEmailId = composeOptions.value.originalEmail?.id;
      if (originalEmailId) {
        await api.forwardEmail(mailboxId, originalEmailId, emailData);
      } else {
        throw new Error("E-mail original não encontrado");
      }
    } else {
      await emailStore.sendEmail(mailboxId, emailData);
    }

    to.value = "";
    subject.value = "";
    body.value = "";
    closeModal();
    showSuccessToast($t("compose.sent_success"));
  } catch (e: any) {
    const errorMessage =
      e.response?.data?.error || "Ocorreu um erro ao enviar a mensagem.";
    error.value = errorMessage;
    showErrorToast(errorMessage);
  } finally {
    isLoading.value = false;
  }
};
</script>
