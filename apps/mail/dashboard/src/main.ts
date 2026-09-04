import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "./App.vue";
import router from "./router";
import i18n, { $t } from "./i18n";
import "./assets/main.css";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

// Global translation helper
app.config.globalProperties.$t = $t;

app.mount("#app");
