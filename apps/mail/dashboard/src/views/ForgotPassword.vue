<template>
  <div class="min-h-screen flex items-center justify-center bg-[#08080a] py-12 px-4 sm:px-6 lg:px-8 relative">
    <div class="max-w-md w-full space-y-6 bg-[#141418] p-8 rounded-2xl border border-[#2a2a32] shadow-2xl">
      <div class="text-center">
        <img src="/emblema.png" alt="Oficina Amarela" class="h-14 w-14 mx-auto mb-3 object-contain drop-shadow-[0_0_12px_rgba(244,206,31,0.25)]" />
        <h2 class="text-xl font-bold text-[#f4ce1f] font-['Cinzel'] tracking-wider">
          {{ $t('auth.reset_password') }}
        </h2>
        <p class="mt-1 text-xs text-[#9a9aa5]">
          {{ $t('auth.reset_password_instructions') }}
        </p>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="handleForgotPassword">
        <div v-if="error" class="rounded-xl bg-red-950/50 border border-red-800/50 p-3 text-xs text-red-300">
          {{ error }}
        </div>

        <div v-if="successMessage" class="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3 text-xs text-emerald-300">
          {{ successMessage }}
        </div>

        <div v-if="!successMessage">
          <div>
            <label for="email" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('auth.email') }}</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50"
              placeholder="seu-email@oficinaamarela.com.br"
            />
          </div>
        </div>

        <div v-if="!successMessage">
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#08080a] bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] hover:from-[#fbe9a6] hover:to-[#f4ce1f] shadow transition-all uppercase tracking-wider disabled:opacity-50"
          >
            {{ isLoading ? $t('common.loading') : $t('auth.send_reset_link') }}
          </button>
        </div>

        <div class="text-center pt-2">
          <router-link
            to="/login"
            class="text-xs text-[#9a9aa5] hover:text-[#f4ce1f] transition-colors"
          >
            ← {{ $t('auth.return_to_login') }}
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { $t } from "@/i18n";

const router = useRouter();
const { success, error: showError } = useToast();

const email = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

async function handleForgotPassword() {
  error.value = null;
  isLoading.value = true;

  try {
    await api.forgotPassword(email.value);
    successMessage.value = `Link de recuperação enviado para ${email.value}. Verifique sua caixa de entrada.`;
    success("Link enviado!");
  } catch (e: any) {
    const errorMessage =
      e.response?.data?.error || "Falha ao enviar link de recuperação.";
    error.value = errorMessage;
    showError(errorMessage);
  } finally {
    isLoading.value = false;
  }
}
</script>
