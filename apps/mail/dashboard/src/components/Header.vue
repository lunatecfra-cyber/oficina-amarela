<template>
  <header class="flex items-center justify-between px-6 py-3.5 bg-[#0e0e12] border-b border-[#2a2a32] backdrop-blur-md bg-opacity-95 sticky top-0 z-10">
    <div class="flex items-center flex-1 max-w-2xl">
      <router-link to="/" class="flex items-center gap-3 mr-6 group shrink-0">
        <img src="/emblema.png" alt="Oficina Amarela" class="h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(244,206,31,0.25)] transition-transform group-hover:scale-105" />
        <div class="hidden sm:flex flex-col">
          <span class="font-['Cinzel'] font-bold text-sm tracking-wider text-[#f4ce1f] group-hover:text-[#fbe9a6] transition-colors leading-tight">OFICINA AMARELA</span>
          <span class="text-[9px] tracking-widest text-[#9a9aa5] uppercase font-mono leading-none">Correio do Pacto</span>
        </div>
      </router-link>

      <div class="relative w-full">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <svg class="h-4 w-4 text-[#6e6e78]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input 
          type="text" 
          v-model="searchQuery" 
          @keyup.enter="performSearch" 
          :placeholder="$t('header.search_placeholder')" 
          class="w-full pl-10 pr-4 py-2 border border-[#2a2a32] bg-[#141418] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/40 focus:border-[#f4ce1f] transition-all duration-200" 
        />
      </div>
    </div>

    <div class="flex items-center gap-2 ml-4">
      <button 
        @click="toggleLanguage" 
        class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#2a2a32] bg-[#141418] hover:border-[#f4ce1f]/50 hover:text-[#f4ce1f] text-[#b9b9c4] transition-all duration-200"
        title="Alternar Idioma / Switch Language"
      >
        <span>{{ locale === 'pt-BR' ? '🇧🇷 PT' : '🇺🇸 EN' }}</span>
      </button>

      <router-link 
        to="/" 
        class="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#b9b9c4] hover:text-[#f4ce1f] hover:bg-[#1c1c22] rounded-lg transition-all duration-200"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
        </svg>
        <span class="hidden md:inline">{{ $t('header.mailboxes') }}</span>
      </router-link>

      <a 
        href="#" 
        @click.prevent="handleSettingsClick" 
        class="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#b9b9c4] hover:text-[#f4ce1f] hover:bg-[#1c1c22] rounded-lg transition-all duration-200"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="hidden md:inline">{{ $t('header.settings') }}</span>
      </a>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSearchStore } from "@/stores/search";
import { useI18n, $t } from "@/i18n";

const searchQuery = ref("");
const searchStore = useSearchStore();
const route = useRoute();
const router = useRouter();
const { locale, setLocale } = useI18n();

const toggleLanguage = () => {
  setLocale(locale.value === "pt-BR" ? "en" : "pt-BR");
};

const performSearch = () => {
  const mailboxId = route.params.mailboxId as string;
  searchStore.searchEmails(mailboxId, searchQuery.value);
  router.push({ name: "SearchResults" });
};

const handleSettingsClick = () => {
  const mailboxId = route.params.mailboxId as string;
  if (route.name === "Settings") {
    if (mailboxId) {
      router.push({
        name: "EmailList",
        params: { mailboxId, folder: "inbox" },
      });
    } else {
      router.push("/");
    }
  } else {
    if (mailboxId) {
      router.push({ name: "Settings", params: { mailboxId } });
    }
  }
};
</script>
