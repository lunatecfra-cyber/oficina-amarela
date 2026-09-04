<template>
  <aside class="w-64 bg-[#0e0e12] p-5 border-r border-[#2a2a32] flex flex-col shrink-0">
    <button 
      @click="openComposeModal" 
      class="w-full mb-6 px-5 py-3 bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] text-[#08080a] font-bold rounded-xl shadow-[0_4px_20px_rgba(244,206,31,0.2)] hover:shadow-[0_6px_25px_rgba(244,206,31,0.35)] hover:from-[#fbe9a6] hover:to-[#f4ce1f] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f] transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2.5 text-sm uppercase tracking-wider"
    >
      <svg class="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {{ $t('sidebar.compose') }}
    </button>
    <nav class="flex-1 overflow-y-auto">
      <ul class="space-y-1">
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'inbox' } }" 
            class="flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-[#b9b9c4] hover:text-white hover:bg-[#1c1c22] transition-all duration-150 text-sm font-medium group"
            active-class="bg-[#1c1c22] text-[#f4ce1f] font-semibold border-l-2 border-[#f4ce1f]"
          >
            <svg class="w-4 h-4 text-[#6e6e78] group-hover:text-[#f4ce1f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <span>{{ $t('sidebar.inbox') }}</span>
          </router-link>
        </li>
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'sent' } }" 
            class="flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-[#b9b9c4] hover:text-white hover:bg-[#1c1c22] transition-all duration-150 text-sm font-medium group"
            active-class="bg-[#1c1c22] text-[#f4ce1f] font-semibold border-l-2 border-[#f4ce1f]"
          >
            <svg class="w-4 h-4 text-[#6e6e78] group-hover:text-[#f4ce1f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>{{ $t('sidebar.sent') }}</span>
          </router-link>
        </li>
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'draft' } }" 
            class="flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-[#b9b9c4] hover:text-white hover:bg-[#1c1c22] transition-all duration-150 text-sm font-medium group"
            active-class="bg-[#1c1c22] text-[#f4ce1f] font-semibold border-l-2 border-[#f4ce1f]"
          >
            <svg class="w-4 h-4 text-[#6e6e78] group-hover:text-[#f4ce1f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{{ $t('sidebar.draft') }}</span>
          </router-link>
        </li>
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'archive' } }" 
            class="flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-[#b9b9c4] hover:text-white hover:bg-[#1c1c22] transition-all duration-150 text-sm font-medium group"
            active-class="bg-[#1c1c22] text-[#f4ce1f] font-semibold border-l-2 border-[#f4ce1f]"
          >
            <svg class="w-4 h-4 text-[#6e6e78] group-hover:text-[#f4ce1f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span>{{ $t('sidebar.archive') }}</span>
          </router-link>
        </li>
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'trash' } }" 
            class="flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-[#b9b9c4] hover:text-red-400 hover:bg-[#1c1c22] transition-all duration-150 text-sm font-medium group"
            active-class="bg-[#1c1c22] text-red-400 font-semibold border-l-2 border-red-400"
          >
            <svg class="w-4 h-4 text-[#6e6e78] group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{{ $t('sidebar.trash') }}</span>
          </router-link>
        </li>
        <li class="pt-5">
          <div class="flex items-center justify-between px-3.5 mb-2">
            <h2 class="text-[11px] font-bold text-[#6e6e78] uppercase tracking-wider">{{ $t('sidebar.custom_folders') }}</h2>
            <button 
              @click="createNewFolder" 
              class="p-1 text-[#6e6e78] hover:text-[#f4ce1f] hover:bg-[#1c1c22] rounded-md transition-all duration-150"
              :title="$t('sidebar.new_folder')"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <ul class="space-y-1">
            <li v-for="folder in customFolders" :key="folder.id">
              <router-link 
                :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: folder.id } }" 
                class="flex items-center gap-3 py-2 px-3.5 rounded-xl text-[#b9b9c4] hover:text-white hover:bg-[#1c1c22] transition-all duration-150 text-sm group"
                active-class="bg-[#1c1c22] text-[#f4ce1f] font-semibold border-l-2 border-[#f4ce1f]"
              >
                <svg class="w-4 h-4 text-[#6e6e78] group-hover:text-[#f4ce1f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span class="truncate">{{ folder.name }}</span>
              </router-link>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import { $t } from "@/i18n";

const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const uiStore = useUIStore();
const route = useRoute();

const defaultFolderIds = ["archive", "inbox", "sent", "spam", "trash", "draft"];
const customFolders = computed(() => {
  return folders.value.filter(
    (folder) => !defaultFolderIds.includes(folder.name.toLowerCase()),
  );
});

onMounted(() => {
  folderStore.fetchFolders(route.params.mailboxId as string);
});

const openComposeModal = () => {
  uiStore.openComposeModal();
};

const createNewFolder = () => {
  const folderName = prompt($t("sidebar.prompt_folder_name"));
  if (folderName) {
    folderStore.createFolder(route.params.mailboxId as string, folderName);
  }
};
</script>
