import { configure, defineRule } from "vee-validate";
import { required, min_value, email } from "@vee-validate/rules";

export const setupValidation = (): void => {
  configure({
    validateOnInput: true
  });

  defineRule("required", required);
  defineRule("min_value", min_value);
  defineRule("email", email);
};
