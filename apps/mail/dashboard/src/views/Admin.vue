<template>
  <div class="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between border-b border-[#2a2a32] pb-6">
      <div class="flex items-center gap-4">
        <img src="/emblema.png" alt="Oficina Amarela" class="h-10 w-10 object-contain drop-shadow-[0_0_10px_rgba(244,206,31,0.25)]" />
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold font-['Cinzel'] tracking-wider text-[#f4ce1f]">
            {{ $t('admin.title') }}
          </h1>
          <p class="text-xs text-[#9a9aa5] mt-0.5">{{ $t('admin.subtitle') }}</p>
        </div>
      </div>
      <router-link
        to="/"
        class="px-3.5 py-2 text-xs font-semibold text-[#b9b9c4] bg-[#141418] border border-[#2a2a32] rounded-xl hover:text-[#f4ce1f] hover:border-[#f4ce1f]/40 transition-all flex items-center gap-2"
      >
        ← {{ $t('common.back') }}
      </router-link>
    </div>

    <!-- Register New User Section -->
    <div class="bg-[#141418] rounded-2xl shadow-xl p-6 mb-8 border border-[#2a2a32]">
      <h2 class="text-base font-bold text-[#f4ce1f] font-['Cinzel'] mb-4">{{ $t('admin.create_user') }}</h2>
      <form @submit.prevent="handleRegisterUser" class="space-y-4">
        <div v-if="registerError" class="rounded-xl bg-red-950/50 border border-red-800/50 p-3 text-xs text-red-300">
          {{ registerError }}
        </div>
        <div v-if="registerSuccess" class="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3 text-xs text-emerald-300">
          {{ registerSuccess }}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="new-email" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
              {{ $t('auth.email') }}
            </label>
            <input
              id="new-email"
              v-model="newUser.email"
              type="email"
              required
              class="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all"
              placeholder="vitor@oficinaamarela.com.br"
            />
          </div>
          <div>
            <label for="new-password" class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
              {{ $t('admin.user_password') }}
            </label>
            <input
              id="new-password"
              v-model="newUser.password"
              type="password"
              required
              minlength="8"
              class="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] placeholder-[#6e6e78] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50 focus:border-[#f4ce1f] transition-all"
              :placeholder="$t('auth.password_placeholder')"
            />
          </div>
        </div>
        <button
          type="submit"
          :disabled="registerLoading"
          class="px-5 py-2.5 bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] text-[#08080a] text-xs font-bold rounded-xl shadow-[0_2px_12px_rgba(244,206,31,0.25)] hover:from-[#fbe9a6] hover:to-[#f4ce1f] transition-all uppercase tracking-wider disabled:opacity-50"
        >
          {{ registerLoading ? $t('auth.creating_account') : $t('admin.create_user') }}
        </button>
      </form>
    </div>

    <!-- Users List -->
    <div class="bg-[#141418] rounded-2xl shadow-xl p-6 mb-8 border border-[#2a2a32]">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-bold text-[#f4ce1f] font-['Cinzel']">{{ $t('admin.users') }}</h2>
        <button
          @click="loadUsers"
          :disabled="usersLoading"
          class="px-3 py-1.5 text-xs font-medium text-[#f4ce1f] hover:text-[#fbe9a6] bg-[#1c1c22] rounded-lg border border-[#2a2a32] transition-colors"
        >
          {{ usersLoading ? $t('common.loading') : $t('common.refresh') }}
        </button>
      </div>

      <div v-if="usersLoading && users.length === 0" class="text-center py-8 text-xs text-[#9a9aa5]">
        {{ $t('common.loading') }}
      </div>

      <div v-else-if="users.length === 0" class="text-center py-8 text-xs text-[#9a9aa5]">
        Nenhum usuário encontrado
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-[#2a2a32]">
          <thead>
            <tr>
              <th class="px-4 py-3 text-left text-[11px] font-bold text-[#6e6e78] uppercase tracking-wider">{{ $t('auth.email') }}</th>
              <th class="px-4 py-3 text-left text-[11px] font-bold text-[#6e6e78] uppercase tracking-wider">{{ $t('admin.role') }}</th>
              <th class="px-4 py-3 text-left text-[11px] font-bold text-[#6e6e78] uppercase tracking-wider">Criado em</th>
              <th class="px-4 py-3 text-left text-[11px] font-bold text-[#6e6e78] uppercase tracking-wider">{{ $t('admin.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#2a2a32]">
            <tr v-for="user in users" :key="user.id" class="hover:bg-[#1c1c22]/50 transition-colors">
              <td class="px-4 py-3 text-xs text-[#f4f4f6] font-mono">{{ user.email }}</td>
              <td class="px-4 py-3 text-xs">
                <span v-if="user.isAdmin" class="px-2.5 py-0.5 text-[10px] font-bold text-[#08080a] bg-[#f4ce1f] rounded-full uppercase tracking-wider">
                  {{ $t('admin.role_admin') }}
                </span>
                <span v-else class="px-2.5 py-0.5 text-[10px] font-medium text-[#b9b9c4] bg-[#2a2a32] rounded-full">
                  {{ $t('admin.role_user') }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-[#6e6e78] font-mono">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="px-4 py-3 text-xs">
                <button
                  @click="openAccessModal(user)"
                  class="text-[#f4ce1f] hover:text-[#fbe9a6] font-medium transition-colors"
                >
                  {{ $t('admin.grant_access') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Access Management Modal -->
    <div
      v-if="selectedUser"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="closeAccessModal"
    >
      <div class="bg-[#141418] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-[#2a2a32]">
        <div class="p-6 border-b border-[#2a2a32] bg-[#1c1c22]">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-[#f4ce1f] font-['Cinzel']">
              Gerenciar Acesso: {{ selectedUser.email }}
            </h3>
            <button
              @click="closeAccessModal"
              class="text-[#6e6e78] hover:text-white transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="p-6">
          <div class="mb-6">
            <h4 class="text-sm font-semibold text-[#f4f4f6] mb-3">{{ $t('admin.grant_access') }}</h4>
            <form @submit.prevent="handleGrantAccess" class="space-y-4">
              <div v-if="accessError" class="rounded-xl bg-red-950/50 border border-red-800/50 p-3 text-xs text-red-300">
                {{ accessError }}
              </div>
              <div v-if="accessSuccess" class="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3 text-xs text-emerald-300">
                {{ accessSuccess }}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
                    {{ $t('mailboxes.mailbox_email') }}
                  </label>
                  <input
                    v-model="accessForm.mailboxId"
                    type="text"
                    required
                    class="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50"
                    placeholder="contato@oficinaamarela.com.br"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-[#b9b9c4] mb-1.5">
                    {{ $t('admin.role') }}
                  </label>
                  <select
                    v-model="accessForm.role"
                    required
                    class="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-[#2a2a32] rounded-xl text-sm text-[#f4f4f6] focus:outline-none focus:ring-2 focus:ring-[#f4ce1f]/50"
                  >
                    <option value="owner">Proprietário (Owner)</option>
                    <option value="admin">Administrador (Admin)</option>
                    <option value="write">Leitura e Envio (Write)</option>
                    <option value="read">Apenas Leitura (Read)</option>
                  </select>
                </div>
              </div>
              <div class="flex gap-2.5">
                <button
                  type="submit"
                  :disabled="accessLoading"
                  class="px-4 py-2 bg-gradient-to-r from-[#f4ce1f] to-[#e5be15] text-[#08080a] text-xs font-bold rounded-xl shadow transition-all uppercase tracking-wider disabled:opacity-50"
                >
                  {{ accessLoading ? $t('common.loading') : $t('admin.grant_access') }}
                </button>
                <button
                  type="button"
                  @click="handleRevokeAccess"
                  :disabled="accessLoading || !accessForm.mailboxId"
                  class="px-4 py-2 bg-[#2a2a32] text-red-400 hover:bg-red-950/40 text-xs font-semibold rounded-xl border border-red-900/40 transition-all disabled:opacity-50"
                >
                  {{ $t('admin.revoke_access') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { $t } from "@/i18n";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

const router = useRouter();
const authStore = useAuthStore();

if (!authStore.isAdmin) {
  router.push("/");
}

const newUser = ref({ email: "", password: "" });
const registerLoading = ref(false);
const registerError = ref("");
const registerSuccess = ref("");

const users = ref<User[]>([]);
const usersLoading = ref(false);

const selectedUser = ref<User | null>(null);
const accessForm = ref({ mailboxId: "", role: "read" });
const accessLoading = ref(false);
const accessError = ref("");
const accessSuccess = ref("");

onMounted(() => {
  loadUsers();
});

async function handleRegisterUser() {
  registerLoading.value = true;
  registerError.value = "";
  registerSuccess.value = "";

  try {
    await api.adminRegisterUser(newUser.value.email, newUser.value.password);
    registerSuccess.value = `Usuário ${newUser.value.email} criado com sucesso!`;
    newUser.value = { email: "", password: "" };
    await loadUsers();
  } catch (error: any) {
    registerError.value =
      error.response?.data?.error || "Falha ao criar usuário";
  } finally {
    registerLoading.value = false;
  }
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    const response = await api.adminListUsers();
    users.value = response.data;
  } catch (error: any) {
    console.error("Failed to load users:", error);
  } finally {
    usersLoading.value = false;
  }
}

function openAccessModal(user: User) {
  selectedUser.value = user;
  accessForm.value = { mailboxId: "", role: "read" };
  accessError.value = "";
  accessSuccess.value = "";
}

function closeAccessModal() {
  selectedUser.value = null;
  accessForm.value = { mailboxId: "", role: "read" };
  accessError.value = "";
  accessSuccess.value = "";
}

async function handleGrantAccess() {
  if (!selectedUser.value) return;

  accessLoading.value = true;
  accessError.value = "";
  accessSuccess.value = "";

  try {
    await api.adminGrantAccess(
      selectedUser.value.id,
      accessForm.value.mailboxId,
      accessForm.value.role,
    );
    accessSuccess.value = `Acesso concedido com sucesso!`;
    accessForm.value.mailboxId = "";
  } catch (error: any) {
    accessError.value = error.response?.data?.error || "Falha ao conceder acesso";
  } finally {
    accessLoading.value = false;
  }
}

async function handleRevokeAccess() {
  if (!selectedUser.value || !accessForm.value.mailboxId) return;

  if (
    !confirm(
      `Revogar acesso de ${selectedUser.value.email} à caixa ${accessForm.value.mailboxId}?`,
    )
  ) {
    return;
  }

  accessLoading.value = true;
  accessError.value = "";
  accessSuccess.value = "";

  try {
    await api.adminRevokeAccess(
      selectedUser.value.id,
      accessForm.value.mailboxId,
    );
    accessSuccess.value = `Acesso revogado com sucesso!`;
    accessForm.value.mailboxId = "";
  } catch (error: any) {
    accessError.value =
      error.response?.data?.error || "Falha ao revogar acesso";
  } finally {
    accessLoading.value = false;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
</script>
