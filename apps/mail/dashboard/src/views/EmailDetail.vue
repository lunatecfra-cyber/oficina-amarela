<template>
  <div v-if="email" class="bg-[#141418] shadow-xl rounded-2xl overflow-hidden flex flex-col h-full border border-[#2a2a32]">
    <div class="p-6 sm:p-8 border-b border-[#2a2a32] flex-shrink-0 bg-[#0e0e12]">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" :title="$t('common.back')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <h1 class="text-xl sm:text-2xl font-bold text-[#f4f4f6]">{{ email.subject || '(sem assunto)' }}</h1>
        </div>
        <div class="flex items-center gap-1.5">
          <button @click="handleReply" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" :title="$t('email_detail.reply')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <button @click="handleReplyAll" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" :title="$t('email_detail.reply_all')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </button>
          <button @click="handleForward" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" :title="$t('email_detail.forward')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H7a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
          <button @click="toggleReadStatus" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" :title="email.read ? $t('email_list.mark_unread') : $t('email_list.mark_read')">
            <svg v-if="email.read" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </button>
          <button @click="toggleStarStatus" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" :class="{'text-[#f4ce1f]': email.starred}" :title="email.starred ? $t('email_list.unstar') : $t('email_list.star')">
            <svg v-if="email.starred" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <div class="relative" ref="moveMenu">
            <button @click="isMoveMenuOpen = !isMoveMenuOpen" class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-xl hover:bg-[#1c1c22] transition-colors" title="Mover para pasta">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            </button>
            <div v-if="isMoveMenuOpen" class="absolute right-0 mt-2 w-52 bg-[#141418] rounded-xl shadow-2xl z-10 border border-[#2a2a32] overflow-hidden">
              <button v-for="folder in moveToFolders" :key="folder.id" @click="handleMove(folder.id)" class="block w-full text-left px-4 py-2.5 text-xs text-[#f4f4f6] hover:bg-[#1c1c22] hover:text-[#f4ce1f] transition-colors font-medium">
                {{ folder.name }}
              </button>
            </div>
          </div>
          <button @click="handleDelete" class="p-2 text-[#9a9aa5] hover:text-red-400 rounded-xl hover:bg-[#1c1c22] transition-colors" :title="$t('common.delete')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between mt-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f4ce1f]/20 to-[#a9840e]/20 border border-[#f4ce1f]/30 flex items-center justify-center text-[#f4ce1f] font-bold text-sm font-['Cinzel'] shadow-sm flex-shrink-0">
            {{ email.sender.charAt(0).toUpperCase() }}
          </div>
          <div>
            <p class="text-sm font-semibold text-[#f4f4f6]">{{ email.sender }}</p>
            <p class="text-xs text-[#9a9aa5] font-mono">{{ $t('email_detail.to') }}: {{ email.recipient }}</p>
          </div>
        </div>
        <p class="text-xs text-[#6e6e78] font-mono">{{ email.date }}</p>
      </div>
    </div>
    <div class="flex-grow">
      <EmailIframe :body="emailBodyWithInlineImages" />
    </div>
    <div v-if="email.attachments && email.attachments.length > 0" class="p-6 sm:p-8 border-t border-[#2a2a32] flex-shrink-0 bg-[#0e0e12]">
      <h2 class="text-base font-bold text-[#f4ce1f] mb-4 flex items-center gap-2 font-['Cinzel']">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        {{ $t('email_detail.attachments') }}
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div v-for="attachment in email.attachments" :key="attachment.id" class="bg-[#141418] rounded-xl p-3.5 flex items-center justify-between border border-[#2a2a32] hover:border-[#f4ce1f]/40 transition-all">
          <div class="w-0 flex-grow mr-3 min-w-0">
            <p class="text-xs font-medium text-[#f4f4f6] truncate">{{ attachment.filename }}</p>
            <p class="text-[11px] text-[#6e6e78] mt-0.5 font-mono">{{ formatBytes(attachment.size) }}</p>
          </div>
          <a :href="getAttachmentUrl(attachment.id)" target="_blank" class="flex-shrink-0 p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-lg hover:bg-[#1c1c22] transition-colors" :title="$t('email_detail.download')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmailIframe from "@/components/EmailIframe.vue";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import { $t } from "@/i18n";

const emailStore = useEmailStore();
const { currentEmail: email } = storeToRefs(emailStore);
const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const uiStore = useUIStore();
const route = useRoute();
const router = useRouter();

const isMoveMenuOpen = ref(false);
const moveMenu = ref<HTMLElement | null>(null);

const handleClickOutside = (event: MouseEvent) => {
  if (moveMenu.value && !moveMenu.value.contains(event.target as Node)) {
    isMoveMenuOpen.value = false;
  }
};

watch(isMoveMenuOpen, (isOpen) => {
  if (isOpen) {
    document.addEventListener("click", handleClickOutside);
  } else {
    document.removeEventListener("click", handleClickOutside);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});

const moveToFolders = computed(() => {
  const fromFolder = route.query.fromFolder as string;
  return folders.value.filter((folder) => folder.id !== fromFolder);
});

const emailBodyWithInlineImages = computed(() => {
  if (!email.value || !email.value.body) {
    return "";
  }

  let body = email.value.body;
  const mailboxId = route.params.mailboxId as string;
  const emailId = route.params.id as string;

  if (email.value.attachments && email.value.attachments.length > 0) {
    for (const attachment of email.value.attachments) {
      if (attachment.disposition === "inline" && attachment.content_id) {
        const url = getAttachmentUrl(attachment.id);
        const cid = attachment.content_id.startsWith("<")
          ? attachment.content_id.slice(1, -1)
          : attachment.content_id;
        const regex = new RegExp(`cid:${cid}`, "g");
        body = body.replace(regex, url);
      }
    }
  }

  return body;
});

const getAttachmentUrl = (attachmentId: string) => {
  const mailboxId = route.params.mailboxId as string;
  const emailId = route.params.id as string;
  return `/api/v1/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachmentId}`;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

onMounted(async () => {
  const mailboxId = route.params.mailboxId as string;
  const emailId = route.params.id as string;

  await emailStore.fetchEmail(mailboxId, emailId);
  folderStore.fetchFolders(mailboxId);

  if (email.value && !email.value.read) {
    emailStore.updateEmail(mailboxId, emailId, { read: true });
  }
});

const toggleReadStatus = () => {
  if (email.value) {
    emailStore.updateEmail(route.params.mailboxId as string, email.value.id, {
      read: !email.value.read,
    });
  }
};

const toggleStarStatus = () => {
  if (email.value) {
    emailStore.updateEmail(route.params.mailboxId as string, email.value.id, {
      starred: !email.value.starred,
    });
  }
};

const handleMove = (folderId: string) => {
  if (email.value) {
    emailStore.moveEmail(
      route.params.mailboxId as string,
      email.value.id,
      folderId,
    );
    isMoveMenuOpen.value = false;
    router.back();
  }
};

const handleDelete = () => {
  if (email.value && confirm($t("email_detail.delete") + "?")) {
    emailStore.deleteEmail(route.params.mailboxId as string, email.value.id);
    router.push({
      name: "EmailList",
      params: { mailboxId: route.params.mailboxId, folder: "inbox" },
    });
  }
};

const handleReply = () => {
  if (email.value) {
    uiStore.openComposeModal({ mode: "reply", originalEmail: email.value });
  }
};

const handleReplyAll = () => {
  if (email.value) {
    uiStore.openComposeModal({ mode: "reply-all", originalEmail: email.value });
  }
};

const handleForward = () => {
  if (email.value) {
    uiStore.openComposeModal({ mode: "forward", originalEmail: email.value });
  }
};
</script>
