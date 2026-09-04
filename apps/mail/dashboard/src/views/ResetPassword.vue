<template>
  <div class="min-h-screen flex items-center justify-center bg-[#08080a] py-12 px-4 sm:px-6 lg:px-8 relative">
    <div class="max-w-md w-full space-y-6 bg-[#141418] p-8 rounded-2xl border border-[#2a2a32] shadow-2xl">
      <div class="text-center">
        <img src="/emblema.png" alt="Oficina Amarela" class="h-14 w-14 mx-auto mb-3 object-contain drop-shadow-[0_0_12px_rgba(244,206,31,0.25)]" />
        <h2 class="text-xl font-bold text-[#f4ce1f] font-['Cinzel'] tracking-wider">
          {{ $t('auth.reset_password') }}
        </h2>
        <p class="mt-1 text-xs text-[#9a9aa5]">
          Digite sua nova senha abaixo
        </p>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="handleResetPassword">
        <div v-if="error" class="rounded-xl bg-red-950/50 border border-red-800/50 p-3 text-xs text-red-300">
          {{ error }}
        </div>

        <div v-if="successMessage" class="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3 text-xs text-emerald-300">
          {{ successMessage }}
        </div>

        <div v-if="!successMessage" class="space-y-4">
          <div>
            <label for="password" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('auth.password') }}</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              minlength="8"
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50"
              :placeholder="$t('auth.password_placeholder')"
            />
          </div>
          <div>
            <label for="confirm-password" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">{{ $t('auth.confirm_password') }}</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              required
              class="block w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50"
              :placeholder="$t('auth.confirm_password_placeholder')"
            />
          </div>
        </div>

        <div v-if="password && confirmPassword && password !== confirmPassword" class="text-xs text-red-400 text-center">
          {{ $t('auth.passwords_dont_match') }}
        </div>

        <div v-if="!successMessage">
          <button
            type="submit"
            :disabled="isLoading || password !== confirmPassword || !password"
            class="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#08080a] bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] hover:from-[#fbe9a6] hover:to-[#f4ce1f] shadow transition-all uppercase tracking-wider disabled:opacity-50"
          >
            {{ isLoading ? $t('common.loading') : $t('auth.reset_password') }}
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
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { $t } from "@/i18n";

const router = useRouter();
const route = useRoute();
const { success, error: showError } = useToast();

const password = ref("");
const confirmPassword = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const token = ref<string | null>(null);

onMounted(() => {
  token.value = route.query.token as string;
  if (!token.value) {
    error.value = "Link de recuperação inválido ou expirado.";
  }
});

async function handleResetPassword() {
  if (!token.value) {
    error.value = "Link de recuperação inválido.";
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = $t("auth.passwords_dont_match");
    return;
  }

  error.value = null;
  isLoading.value = true;

  try {
    await api.resetPassword(token.value, password.value);
    successMessage.value =
      "Senha redefinida com sucesso! Você já pode fazer login.";
    success("Senha redefinida com sucesso!", 5000);
    setTimeout(() => {
      router.push("/login");
    }, 2500);
  } catch (e: any) {
    const errorMessage =
      e.response?.data?.error || "Falha ao redefinir a senha.";
    error.value = errorMessage;
    showError(errorMessage);
  } finally {
    isLoading.value = false;
  }
}
</script>
