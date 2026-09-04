<template>
  <div v-if="!isRegistrationEnabled()" class="min-h-screen flex items-center justify-center bg-[#08080a] py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full text-center bg-[#141418] p-8 rounded-2xl border border-[#2a2a32] shadow-2xl">
      <img src="/emblema.png" alt="Oficina Amarela" class="h-16 w-16 mx-auto mb-4 object-contain" />
      <h2 class="text-xl font-bold text-[#f4ce1f] mb-2 font-['Cinzel']">{{ $t('auth.registration_disabled') }}</h2>
      <p class="text-xs text-[#9a9aa5] mb-6 leading-relaxed">{{ $t('auth.registration_disabled_desc') }}</p>
      <router-link to="/login" class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-[#f4ce1f] border border-[#f4ce1f]/30 rounded-xl hover:bg-[#f4ce1f]/10 transition-colors">
        {{ $t('auth.return_to_login') }}
      </router-link>
    </div>
  </div>
  <div v-else class="min-h-screen flex flex-col items-center justify-center bg-[#08080a] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <!-- Language selector top right -->
    <div class="absolute top-6 right-6">
      <button 
        @click="toggleLanguage" 
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#2a2a32] bg-[#141418] hover:border-[#f4ce1f]/50 hover:text-[#f4ce1f] text-[#b9b9c4] transition-all duration-200"
      >
        <span>{{ locale === 'pt-BR' ? '🇧🇷 PT' : '🇺🇸 EN' }}</span>
      </button>
    </div>

    <div class="max-w-md w-full space-y-8 bg-[#141418] p-8 rounded-2xl border border-[#2a2a32] shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative z-10">
      <div class="text-center">
        <img src="/emblema.png" alt="Oficina Amarela" class="h-16 w-16 mx-auto mb-4 object-contain drop-shadow-[0_0_15px_rgba(244,206,31,0.3)]" />
        <h1 class="font-['Cinzel'] text-2xl font-bold tracking-wider text-[#f4ce1f] mb-1">
          OFICINA AMARELA
        </h1>
        <p class="text-xs uppercase tracking-widest text-[#9a9aa5] font-mono mb-4">
          Correio do Pacto
        </p>
        <h2 class="text-lg font-semibold text-[#f4f4f6]">
          {{ $t('auth.create_account_title') }}
        </h2>
        <p class="mt-2 text-xs text-[#9a9aa5]">
          {{ $t('common.or') }}
          <router-link
            to="/login"
            class="font-medium text-[#f4ce1f] hover:text-[#fbe9a6] underline underline-offset-2 transition-colors ml-1"
          >
            {{ $t('auth.sign_in') }}
          </router-link>
        </p>
      </div>

      <form class="mt-6 space-y-5" @submit.prevent="handleRegister">
        <div v-if="authStore.error" class="rounded-xl bg-red-950/50 border border-red-800/50 p-3.5">
          <p class="text-xs text-red-300">{{ authStore.error }}</p>
        </div>
        <div v-if="successMessage" class="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3.5">
          <p class="text-xs text-emerald-300">{{ successMessage }}</p>
        </div>

        <div class="space-y-4">
          <div>
            <label for="email" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
              {{ $t('auth.email') }}
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all"
              placeholder="admin@oficinaamarela.com.br"
            />
          </div>

          <div>
            <label for="password" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
              {{ $t('auth.password') }}
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              minlength="8"
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all"
              :placeholder="$t('auth.password_placeholder')"
            />
          </div>

          <div>
            <label for="confirm-password" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
              {{ $t('auth.confirm_password') }}
            </label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              required
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all"
              :placeholder="$t('auth.confirm_password_placeholder')"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="authStore.loading || password !== confirmPassword"
            class="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-[#08080a] bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] hover:from-[#fbe9a6] hover:to-[#f4ce1f] shadow-[0_4px_15px_rgba(244,206,31,0.25)] hover:shadow-[0_6px_20px_rgba(244,206,31,0.4)] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f] transition-all disabled:opacity-50 uppercase tracking-wider"
          >
            {{ authStore.loading ? $t('auth.creating_account') : $t('auth.create_account') }}
          </button>
          <p v-if="password && confirmPassword && password !== confirmPassword" class="mt-2 text-xs text-red-400 text-center">
            {{ $t('auth.passwords_dont_match') }}
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAppSettings } from "@/composables/useAppSettings";
import { useAuthStore } from "@/stores/auth";
import { useI18n, $t } from "@/i18n";

const router = useRouter();
const authStore = useAuthStore();
const { isRegistrationEnabled } = useAppSettings();
const { locale, setLocale } = useI18n();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const successMessage = ref("");

const toggleLanguage = () => {
  setLocale(locale.value === "pt-BR" ? "en" : "pt-BR");
};

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    return;
  }

  try {
    await authStore.register(email.value, password.value);
    successMessage.value = $t("auth.account_created");
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  } catch (error) {
    // Error is handled by store
  }
}
</script>
