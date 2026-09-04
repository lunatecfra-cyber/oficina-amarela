<template>
  <div class="bg-[#141418] shadow-xl rounded-2xl overflow-hidden border border-[#2a2a32]">
    <div class="px-6 py-4 border-b border-[#2a2a32] bg-[#0e0e12] flex items-center justify-between">
      <h1 class="text-xl font-bold text-[#f4ce1f] font-['Cinzel'] tracking-wide">{{ localizedFolderName }}</h1>
      <button 
        @click="handleRefresh"
        :disabled="isRefreshing"
        class="p-2 text-[#9a9aa5] hover:text-[#f4ce1f] rounded-lg hover:bg-[#1c1c22] transition-all disabled:opacity-50"
        :title="isRefreshing ? $t('common.loading') : $t('common.refresh')"
      >
        <svg v-if="!isRefreshing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin text-[#f4ce1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>
    </div>
    <ul v-if="emails.length > 0" class="divide-y divide-[#2a2a32]">
      <li v-for="email in emails" :key="email.id" class="group relative transition-all duration-150" :class="{ 'bg-[#1c1c22]/70': !email.read, 'hover:bg-[#1c1c22]': true }">
        <router-link :to="{ name: 'EmailDetail', params: { id: email.id }, query: { fromFolder: folderId } }" class="block px-6 py-3.5">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-grow overflow-hidden min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <div v-if="!email.read" class="w-2 h-2 bg-[#f4ce1f] rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(244,206,31,0.6)]"></div>
                <p class="text-sm text-[#f4f4f6] truncate" :class="{'font-bold': !email.read, 'font-medium text-[#b9b9c4]': email.read}">{{ email.sender }}</p>
              </div>
              <p class="text-sm truncate" :class="{'font-semibold text-white': !email.read, 'text-[#9a9aa5]': email.read}">{{ email.subject || '(sem assunto)' }}</p>
            </div>
            <div class="flex-shrink-0 flex items-center gap-2">
              <p class="text-xs text-[#6e6e78] group-hover:hidden whitespace-nowrap font-mono">{{ email.date }}</p>
              <div class="hidden group-hover:flex items-center gap-1">
                <button @click.prevent="toggleStarStatus(email)" class="p-1.5 text-[#6e6e78] hover:text-[#f4ce1f] rounded-lg hover:bg-[#2a2a32] transition-colors" :class="{'text-[#f4ce1f]': email.starred}" :title="email.starred ? $t('email_list.unstar') : $t('email_list.star')">
                  <svg v-if="email.starred" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
                <button @click.prevent="toggleReadStatus(email)" class="p-1.5 text-[#6e6e78] hover:text-[#f4ce1f] rounded-lg hover:bg-[#2a2a32] transition-colors" :title="email.read ? $t('email_list.mark_unread') : $t('email_list.mark_read')">
                  <svg v-if="email.read" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </button>
                <button @click.prevent="handleDelete(email.id)" class="p-1.5 text-[#6e6e78] hover:text-red-400 rounded-lg hover:bg-[#2a2a32] transition-colors" :title="$t('common.delete')">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </router-link>
      </li>
    </ul>
    <div v-else class="p-16 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0e0e12] border border-[#2a2a32] flex items-center justify-center">
        <svg class="w-8 h-8 text-[#6e6e78]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h2 class="text-lg font-bold text-[#f4f4f6] mb-1 font-['Cinzel']">{{ $t('email_list.no_emails') }}</h2>
      <p class="text-xs text-[#9a9aa5] max-w-sm mx-auto leading-relaxed">{{ $t('email_list.no_emails_desc') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import type { Email } from "@/types";
import { $t } from "@/i18n";

const emailStore = useEmailStore();
const { emails, isRefreshing } = storeToRefs(emailStore);
const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const route = useRoute();

let refreshInterval: ReturnType<typeof setInterval> | null = null;

const folderId = computed(() => route.params.folder as string);

const localizedFolderName = computed(() => {
  const fid = (folderId.value || "").toLowerCase();
  if (fid === "inbox") return $t("sidebar.inbox");
  if (fid === "sent") return $t("sidebar.sent");
  if (fid === "draft") return $t("sidebar.draft");
  if (fid === "archive") return $t("sidebar.archive");
  if (fid === "trash") return $t("sidebar.trash");
  if (fid === "spam") return $t("sidebar.spam");

  const foundFolder = folders.value.find((f) => f.id === folderId.value);
  return foundFolder ? foundFolder.name : folderId.value;
});

const startAutoRefresh = () => {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    emailStore.fetchEmails(route.params.mailboxId as string, {
      folder: folderId.value,
    });
  }, 30000);
};

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};

const handleRefresh = () => {
  emailStore.fetchEmails(route.params.mailboxId as string, {
    folder: folderId.value,
  });
};

onMounted(() => {
  emailStore.fetchEmails(route.params.mailboxId as string, {
    folder: folderId.value,
  });
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});

watch(folderId, (newFolderId) => {
  emailStore.fetchEmails(route.params.mailboxId as string, {
    folder: newFolderId,
  });
});

const toggleReadStatus = (email: Email) => {
  emailStore.updateEmail(route.params.mailboxId as string, email.id, {
    read: !email.read,
  });
};

const toggleStarStatus = (email: Email) => {
  emailStore.updateEmail(route.params.mailboxId as string, email.id, {
    starred: !email.starred,
  });
};

const handleDelete = (emailId: string) => {
  if (confirm($t("email_detail.delete") + "?")) {
    emailStore.deleteEmail(route.params.mailboxId as string, emailId);
  }
};
</script>
