<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-[#08080a] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <!-- Ambient background glow -->
    <div class="absolute w-[500px] h-[500px] bg-[#f4ce1f]/5 rounded-full blur-3xl pointer-events-none -top-40 -left-40"></div>
    <div class="absolute w-[400px] h-[400px] bg-[#f4ce1f]/5 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

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
          {{ $t('auth.sign_in') }}
        </h2>
        <p v-if="isRegistrationEnabled()" class="mt-2 text-xs text-[#9a9aa5]">
          {{ $t('common.or') }}
          <router-link
            to="/register"
            class="font-medium text-[#f4ce1f] hover:text-[#fbe9a6] underline underline-offset-2 transition-colors ml-1"
          >
            {{ $t('auth.create_account') }}
          </router-link>
        </p>
      </div>

      <form class="mt-6 space-y-5" @submit.prevent="handleLogin">
        <div v-if="authStore.error" class="rounded-xl bg-red-950/50 border border-red-800/50 p-3.5">
          <p class="text-xs text-red-300">{{ authStore.error }}</p>
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
              placeholder="nome@oficinaamarela.com.br"
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
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all"
              :placeholder="$t('auth.password')"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="authStore.loading"
            class="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-[#08080a] bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] hover:from-[#fbe9a6] hover:to-[#f4ce1f] shadow-[0_4px_15px_rgba(244,206,31,0.25)] hover:shadow-[0_6px_20px_rgba(244,206,31,0.4)] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f] transition-all disabled:opacity-50 uppercase tracking-wider"
          >
            {{ authStore.loading ? $t('auth.signing_in') : $t('auth.sign_in') }}
          </button>
        </div>

        <div v-if="isAccountRecoveryEnabled()" class="text-center pt-2">
          <router-link
            to="/forgot-password"
            class="text-xs text-[#9a9aa5] hover:text-[#f4ce1f] transition-colors"
          >
            {{ $t('auth.forgot_password') }}
          </router-link>
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
const { isRegistrationEnabled, isAccountRecoveryEnabled } = useAppSettings();
const { locale, setLocale } = useI18n();

const email = ref("");
const password = ref("");

const toggleLanguage = () => {
  setLocale(locale.value === "pt-BR" ? "en" : "pt-BR");
};

async function handleLogin() {
  try {
    await authStore.login(email.value, password.value);
    router.push("/");
  } catch (error) {
    // Error is handled by store
  }
}
</script>
