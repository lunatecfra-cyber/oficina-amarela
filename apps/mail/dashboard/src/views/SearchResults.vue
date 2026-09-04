<template>
  <div class="bg-[#141418] shadow-xl rounded-2xl overflow-hidden border border-[#2a2a32]">
    <div class="p-5 border-b border-[#2a2a32] bg-[#0e0e12]">
      <h1 class="text-xl font-bold text-[#f4ce1f] font-['Cinzel'] tracking-wide">{{ $t('email_list.search_results') }}</h1>
    </div>
    <div v-if="isLoading" class="p-12 text-center text-xs text-[#9a9aa5]">
      <p>{{ $t('common.loading') }}</p>
    </div>
    <div v-else-if="results.length === 0" class="p-12 text-center text-xs text-[#9a9aa5]">
      <p>Nenhum resultado encontrado para a busca.</p>
    </div>
    <ul v-else class="divide-y divide-[#2a2a32]">
      <li v-for="email in results" :key="email.id">
        <router-link :to="{ name: 'EmailDetail', params: { id: email.id } }" class="block px-6 py-4 hover:bg-[#1c1c22] transition-colors">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-[#f4f4f6] truncate">{{ email.sender }}</p>
            <p class="text-xs text-[#6e6e78] font-mono">{{ email.date }}</p>
          </div>
          <p class="text-sm text-[#9a9aa5] mt-1 truncate">{{ email.subject || '(sem assunto)' }}</p>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSearchStore } from "@/stores/search";
import { $t } from "@/i18n";

const searchStore = useSearchStore();
const { results, isLoading } = storeToRefs(searchStore);
</script>
