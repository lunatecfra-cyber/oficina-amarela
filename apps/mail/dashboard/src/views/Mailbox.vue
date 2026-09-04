<template>
  <div class="flex h-screen bg-[#08080a] text-[#f4f4f6]">
    <Sidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <Header />
      <main class="flex-1 overflow-y-auto p-4 sm:p-6">
        <router-view />
      </main>
    </div>
    <ComposeEmail />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import ComposeEmail from "@/components/ComposeEmail.vue";
import Header from "@/components/Header.vue";
import Sidebar from "@/components/Sidebar.vue";
import { useMailboxStore } from "@/stores/mailboxes";

const mailboxStore = useMailboxStore();
const route = useRoute();

onMounted(() => {
  mailboxStore.fetchMailbox(route.params.mailboxId as string);
});
</script>
