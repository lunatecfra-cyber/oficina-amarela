<template>
  <div class="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
    <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2a32] pb-6">
      <div class="flex items-center gap-4">
        <img src="/emblema.png" alt="Oficina Amarela" class="h-12 w-12 object-contain drop-shadow-[0_0_12px_rgba(244,206,31,0.25)]" />
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold font-['Cinzel'] tracking-wider text-[#f4ce1f]">
            {{ $t('mailboxes.title') }}
          </h1>
          <p class="text-xs text-[#9a9aa5] font-sans mt-0.5">{{ $t('mailboxes.subtitle') }}</p>
        </div>
      </div>
      <div class="flex items-center flex-wrap gap-3">
        <div class="text-right mr-2 hidden sm:block">
          <p class="text-xs text-[#f4f4f6] font-mono">{{ authStore.currentUser?.email }}</p>
          <p v-if="authStore.isAdmin" class="text-[10px] text-[#f4ce1f] font-bold uppercase tracking-wider">{{ $t('auth.admin') }}</p>
        </div>
        <button
          @click="openCreateMailboxModal"
          class="px-3.5 py-2 text-xs font-bold text-[#08080a] bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] rounded-xl hover:from-[#fbe9a6] hover:to-[#f4ce1f] shadow-[0_2px_12px_rgba(244,206,31,0.25)] transition-all flex items-center gap-1.5 uppercase tracking-wider"
        >
          <svg class="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {{ $t('mailboxes.new_mailbox') }}
        </button>
        <router-link
          v-if="authStore.isAdmin"
          to="/admin"
          class="px-3.5 py-2 text-xs font-semibold text-[#f4f4f6] bg-[#1c1c22] border border-[#2a2a32] rounded-xl hover:border-[#f4ce1f]/40 hover:text-[#f4ce1f] transition-all"
        >
          {{ $t('header.admin_panel') }}
        </router-link>
        <button
          @click="handleLogout"
          class="px-3 py-2 text-xs font-semibold text-[#9a9aa5] bg-[#141418] border border-[#2a2a32] rounded-xl hover:text-red-400 hover:border-red-900/50 transition-all"
        >
          {{ $t('auth.logout') }}
        </button>
      </div>
    </div>

    <div v-if="mailboxes.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <router-link 
        v-for="mailbox in mailboxes" 
        :key="mailbox.id" 
        :to="{ name: 'Mailbox', params: { mailboxId: mailbox.id } }"
        class="group relative bg-[#141418] rounded-2xl shadow-lg hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden border border-[#2a2a32] hover:border-[#f4ce1f]/60 transform hover:-translate-y-1"
      >
        <div class="relative p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f4ce1f]/20 to-[#a9840e]/20 border border-[#f4ce1f]/30 flex items-center justify-center text-[#f4ce1f] font-bold text-lg font-['Cinzel'] shadow-sm">
              {{ mailbox.name.charAt(0).toUpperCase() }}
            </div>
            <svg class="w-5 h-5 text-[#6e6e78] group-hover:text-[#f4ce1f] transform group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-[#f4f4f6] mb-1 group-hover:text-[#f4ce1f] transition-colors duration-200">{{ mailbox.name }}</h2>
          <p class="text-xs text-[#9a9aa5] flex items-center font-mono">
            <svg class="w-3.5 h-3.5 mr-1.5 text-[#6e6e78]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {{ mailbox.email }}
          </p>
        </div>
      </router-link>
    </div>

    <div v-else class="text-center bg-[#141418] rounded-2xl shadow-xl p-12 border border-[#2a2a32] max-w-2xl mx-auto">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1c1c22] border border-[#2a2a32] flex items-center justify-center">
        <svg class="w-8 h-8 text-[#f4ce1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 class="text-xl font-bold text-[#f4f4f6] mb-2 font-['Cinzel']">{{ $t('mailboxes.no_mailboxes') }}</h2>
      <p class="text-xs text-[#9a9aa5] mb-6 max-w-md mx-auto leading-relaxed">
        {{ $t('mailboxes.no_mailboxes_desc') }}
      </p>
      <button
        @click="openCreateMailboxModal"
        class="px-5 py-2.5 text-xs font-bold text-[#08080a] bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] rounded-xl hover:from-[#fbe9a6] hover:to-[#f4ce1f] shadow-[0_2px_15px_rgba(244,206,31,0.25)] transition-all uppercase tracking-wider"
      >
        {{ $t('mailboxes.new_mailbox') }}
      </button>
      <div class="mt-8 bg-[#0e0e12] rounded-xl p-4 border border-[#2a2a32] text-left">
        <p class="text-xs text-[#9a9aa5] flex items-center gap-2">
          <span class="text-emerald-400">✓</span>
          {{ $t('mailboxes.dns_hint') }}
        </p>
      </div>
    </div>

    <!-- Modal Create Mailbox -->
    <div v-if="isCreateModalOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-[#141418] rounded-2xl shadow-2xl w-full max-w-md text-[#f4f4f6] border border-[#2a2a32] overflow-hidden">
        <div class="flex justify-between items-center bg-[#1c1c22] border-b border-[#2a2a32] px-6 py-4">
          <h2 class="text-base font-bold text-[#f4ce1f] font-['Cinzel']">{{ $t('mailboxes.create_mailbox') }}</h2>
          <button @click="closeCreateMailboxModal" class="text-[#6e6e78] hover:text-white p-1 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleCreateMailbox" class="p-6">
          <div v-if="createError" class="bg-red-950/50 border border-red-800/50 text-red-300 px-3.5 py-2.5 rounded-xl text-xs mb-4">
            {{ createError }}
          </div>
          <div class="mb-4">
            <label for="mailbox-email" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('mailboxes.mailbox_email') }}</label>
            <input 
              type="email" 
              id="mailbox-email" 
              v-model="newMailboxEmail" 
              class="block w-full bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all" 
              placeholder="contato@oficinaamarela.com.br"
              required 
            />
          </div>
          <div class="mb-6">
            <label for="mailbox-name" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('mailboxes.mailbox_name') }}</label>
            <input 
              type="text" 
              id="mailbox-name" 
              v-model="newMailboxName" 
              class="block w-full bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all" 
              placeholder="Contato"
              required 
            />
          </div>
          <div class="flex justify-end gap-2.5">
            <button 
              type="button" 
              @click="closeCreateMailboxModal" 
              class="px-4 py-2 bg-[#1c1c22] hover:bg-[#2a2a32] text-xs font-semibold text-[#b9b9c4] rounded-xl transition-colors"
            >
              {{ $t('common.cancel') }}
            </button>
            <button 
              type="submit" 
              :disabled="isCreatingMailbox"
              class="px-5 py-2 bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] text-[#08080a] text-xs font-bold rounded-xl shadow-[0_2px_12px_rgba(244,206,31,0.25)] hover:from-[#fbe9a6] hover:to-[#f4ce1f] transition-all uppercase tracking-wider disabled:opacity-50"
            >
              {{ isCreatingMailbox ? $t('mailboxes.creating') : $t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useMailboxStore } from "@/stores/mailboxes";
import { $t } from "@/i18n";

const router = useRouter();
const mailboxStore = useMailboxStore();
const authStore = useAuthStore();
const { mailboxes } = storeToRefs(mailboxStore);
const { success: showSuccessToast, error: showErrorToast } = useToast();

const isCreateModalOpen = ref(false);
const newMailboxEmail = ref("");
const newMailboxName = ref("");
const isCreatingMailbox = ref(false);
const createError = ref<string | null>(null);

onMounted(() => {
  mailboxStore.fetchMailboxes();
});

const openCreateMailboxModal = () => {
  isCreateModalOpen.value = true;
  newMailboxEmail.value = "";
  newMailboxName.value = "";
  createError.value = null;
};

const closeCreateMailboxModal = () => {
  isCreateModalOpen.value = false;
  newMailboxEmail.value = "";
  newMailboxName.value = "";
  createError.value = null;
};

const handleCreateMailbox = async () => {
  createError.value = null;

  if (!newMailboxEmail.value || !newMailboxName.value) {
    createError.value = "Preencha todos os campos";
    return;
  }

  isCreatingMailbox.value = true;
  try {
    await api.createMailbox(newMailboxEmail.value, newMailboxName.value);
    showSuccessToast($t("common.created"));
    closeCreateMailboxModal();
    await mailboxStore.fetchMailboxes();
  } catch (e: any) {
    const errorMessage = e.response?.data?.error || "Erro ao criar caixa postal";
    createError.value = errorMessage;
    showErrorToast(errorMessage);
  } finally {
    isCreatingMailbox.value = false;
  }
};

async function handleLogout() {
  await authStore.logout();
  router.push("/login");
}
</script>
