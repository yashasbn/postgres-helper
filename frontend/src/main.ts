import { createApp } from "vue";
import App from "@/App.vue";
import { getRouter } from "@/router";
import pinia from "@/store/index";
import { setupValidation } from "@/utils/validation";

const app = createApp(App);
app.use(pinia);
app.use(getRouter());

setupValidation();

app.mount("#app");
